import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

test('sessões, isolamento, proposta/confirmar, repetição e conflitos', {timeout:120000},async()=>{
 const owner=randomUUID(),other=randomUUID(),password=randomUUID();let projectId;
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 async function req(path,method='GET',body,token) {
   const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token&&{Authorization:'Bearer '+token})},...(body!==undefined&&{body:JSON.stringify(body)})});
   return {status:response.status,data:await response.json()};
 }
 try{
  for(const id of [owner,other])await prisma.user.create({data:{id,name:'Teste assistente',username:id,email:id+'@example.invalid',password:await bcrypt.hash(password,10)}});
  const login=await req('/login','POST',{login:owner,password});assert.equal(login.status,200);assert(login.data.token);assert.equal(login.data.user.password,undefined);
  const token=login.data.token;
  const otherLogin=await req('/login','POST',{login:other,password});const otherToken=otherLogin.data.token;
  const secondLogin=await req('/login','POST',{login:owner,password});const secondToken=secondLogin.data.token;
  assert.equal((await req('/users/'+owner+'/password','PUT',{senhaAtual:password,novaSenha:'fraca',confirmarNovaSenha:'fraca'},token)).status,400);
  assert.equal((await req('/users/'+owner+'/password','PUT',{senhaAtual:password,novaSenha:'SenhaNova123',confirmarNovaSenha:'SenhaNova123'},token)).status,200);
  assert.equal((await req('/projects','GET',undefined,secondToken)).status,401);
  assert.equal((await req('/projects')).status,401);
  assert.equal((await req('/projects','GET',undefined,owner)).status,401);
  const created=await req('/projects','POST',{name:'Fixture assistente',type:['Composição'],budgetAmount:'20.00'},token);
  assert.equal(created.status,201);projectId=created.data.project.id;
  assert.equal(created.data.project.members[0].password,undefined);
  assert.equal((await req('/projects/'+projectId,'GET',undefined,otherToken)).status,404);
  assert.equal((await req('/projects/'+projectId+'/download','GET',undefined,otherToken)).status,404);
  const conversation=(await req('/assistant/conversations','POST',{projectId,title:'Teste'},token)).data.conversation;
  assert.equal((await req('/assistant/conversations/'+conversation.id,'GET',undefined,otherToken)).status,404);
  const proposed=await req('/assistant/actions','POST',{projectId,conversationId:conversation.id,kind:'update_project',payload:{name:'Alteração confirmada',budgetAmount:'150.50'}},token);
  assert.equal(proposed.status,201);const action=proposed.data.action;
  assert.equal((await prisma.project.findUnique({where:{id:projectId}})).name,'Fixture assistente');
  assert.equal((await req('/assistant/actions/'+action.id+'/decision','POST',{confirm:true},otherToken)).status,404);
  const confirmed=await req('/assistant/actions/'+action.id+'/decision','POST',{confirm:true},token);
  assert.equal(confirmed.status,200);assert.equal(confirmed.data.action.status,'confirmed');
  assert.equal((await req('/assistant/actions/'+action.id+'/decision','POST',{confirm:true},token)).data.action.status,'confirmed');
  const updated=await req('/projects/'+projectId,'GET',undefined,token);assert.equal(updated.data.project.budgetAmount,'150.50');
  const conflicting=(await req('/assistant/actions','POST',{projectId,kind:'update_project',payload:{name:'Não aplicar'}},token)).data.action;
  await prisma.project.update({where:{id:projectId},data:{description:'Mudança externa'}});
  assert.equal((await req('/assistant/actions/'+conflicting.id+'/decision','POST',{confirm:true},token)).status,409);
  assert.equal((await req('/assistant/actions/'+conflicting.id+'/decision','POST',{confirm:false},token)).data.action.status,'rejected');
  const reference=(await req('/assistant/actions','POST',{projectId,kind:'save_reference',payload:{title:'Referência de teste',url:'https://www.youtube.com/watch?v=abcdefghijk',notes:'Inspiração'}},token)).data.action;
  assert.equal(await prisma.projectReference.count({where:{projectId}}),0);
  await req('/assistant/actions/'+reference.id+'/decision','POST',{confirm:true},token);
  await req('/assistant/actions/'+reference.id+'/decision','POST',{confirm:true},token);
  assert.equal(await prisma.projectReference.count({where:{projectId}}),1);
  assert.equal((await req('/assistant/projects/'+projectId,'GET',undefined,otherToken)).status,404);
  assert.equal((await req('/users/'+owner,'PUT',{nome:'Intruso'},otherToken)).status,403);
  // Simula somente Gemini e catálogo externos; API, sessão, ferramentas e banco são reais.
  const originalFetch=globalThis.fetch, previousKey=process.env.GEMINI_API_KEY, previousModel=process.env.GEMINI_MODEL;
  const bodies=[];
  try {
    process.env.GEMINI_API_KEY='test-provider-key';process.env.GEMINI_MODEL='gemini-test';
    const output=[
      [{functionCall:{name:'list_projects',args:{query:'Alteração'}},thoughtSignature:'test-signature'}],
      [{functionCall:{name:'read_project',args:{projectId}}}],
      [{functionCall:{name:'search_references',args:{query:'piano'}}}],
      [{functionCall:{name:'propose_action',args:{projectId,kind:'update_project',payloadJson:JSON.stringify({name:'Sugestão da IA'})}}}],
      [{text:'Preparei uma proposta. Confirme na interface.'}],
    ];
    const isGemini=url=>String(url).startsWith('https://generativelanguage.googleapis.com/');
    globalThis.fetch=async(url,options)=>{
      if(String(url).startsWith('https://archive.org/advancedsearch.php'))return Response.json({response:{docs:[{identifier:'testmp3testfile',title:'Fonte de teste'}]}});
      if(!isGemini(url)) return originalFetch(url,options);
      assert.equal(options.headers['x-goog-api-key'],'test-provider-key');
      assert(!String(url).includes('test-provider-key'));
      bodies.push(JSON.parse(options.body));
      return Response.json({candidates:[{content:{role:'model',parts:output[bodies.length-1]},finishReason:'STOP'}]});
    };
    const reply=await req('/assistant/conversations/'+conversation.id+'/messages','POST',{message:'Sugira um nome e procure referências de piano.'},token);
    assert.equal(reply.status,200);assert.equal(bodies.length,5);
    assert.equal(bodies[0].tools[0].googleSearch,undefined);
    assert(bodies[0].tools[0].functionDeclarations.some(tool=>tool.name==='search_references'));
    assert.equal(bodies[1].contents.find(item=>item.role==='model').parts[0].thoughtSignature,'test-signature');
    const toolResults=bodies.at(-1).contents.flatMap(item=>item.parts).filter(part=>part.functionResponse);
    assert.equal(toolResults.length,4);
    const read=toolResults.find(item=>item.functionResponse.name==='read_project').functionResponse.response.result;
    assert.equal(read.members[0].password,undefined);assert.equal(read.members[0].email,undefined);
    assert.equal(reply.data.actions[0].status,'pending');
    assert.equal((await prisma.project.findUnique({where:{id:projectId}})).name,'Alteração confirmada');
    const stored=await req('/assistant/conversations/'+conversation.id,'GET',undefined,token);
    assert.equal(stored.data.conversation.messages.length,2);
    assert.equal(stored.data.conversation.messages[1].sources[0].url,'https://archive.org/details/testmp3testfile');
    const caps=await req('/assistant/capabilities','GET',undefined,token);
    assert.equal(caps.data.chat,true);assert.equal(caps.data.webSearch,false);
    assert.equal((await req('/assistant/search','POST',{query:'Referência',source:'web'},token)).status,503);
    globalThis.fetch=async(url,options)=>isGemini(url)?new Response('upstream internal details',{status:429}):originalFetch(url,options);
    const failure=await req('/assistant/conversations/'+conversation.id+'/messages','POST',{message:'Outro pedido'},token);
    assert.equal(failure.status,429);assert(!JSON.stringify(failure.data).includes('upstream internal'));
  } finally {
    globalThis.fetch=originalFetch;
    if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;
    if(previousModel===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=previousModel;
  }
  const logout=await req('/login/logout','POST',{},token);assert.equal(logout.status,200);
  assert.equal((await req('/assistant/conversations','GET',undefined,token)).status,401);
 } finally {
   if(projectId)await prisma.project.deleteMany({where:{id:projectId}});
   await prisma.user.deleteMany({where:{id:{in:[owner,other]}}});
   server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await prisma.$disconnect();
 }
});
