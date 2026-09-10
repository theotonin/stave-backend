import prisma from '../config/database.js';
import { fail, text } from './common.js';
import { accessibleProject, proposeAction } from './actions.js';
import { responseRequest, extractResponse, tools, instructions, providerReady } from './provider.js';
import { serializeProject } from '../utils/projectFinance.js';
import { archiveAudioFiles, searchArchive } from './search.js';
const busy=new Set();
export async function sendMessage(userId,conversationId,message) {
  const content=text(message,'Mensagem',4000);
  const conversation=await prisma.assistantConversation.findFirst({where:{id:conversationId,userId}});
  if(!conversation) throw fail(404,'Conversa não encontrada.');
  if(conversation.projectId) await accessibleProject(userId,conversation.projectId);
  if(!providerReady()) throw fail(503,'Configure o provedor de IA para conversar. Você já pode pesquisar no acervo, consultar projetos e salvar referências pelas ações abaixo.');
  if(busy.has(conversationId)) throw fail(409,'Aguarde a resposta anterior.');
  busy.add(conversationId);
  try {
    const history=await prisma.assistantMessage.findMany({where:{conversationId},orderBy:{createdAt:'desc'},take:16});
    await prisma.assistantMessage.create({data:{conversationId,role:'user',content}});
    const input=[...history.reverse().map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),{role:'user',parts:[{text:content}]}];
    const sources=new Map();
    const pending=[];
    for(let round=0;round<5;round++) {
      const response=await responseRequest({instructions:`${instructions}\nProjeto selecionado: ${conversation.projectId||'nenhum'}.`,input,tools});
      const modelContent=response.candidates[0].content;
      // Preserva as thought signatures do Gemini durante todo o ciclo de ferramentas.
      input.push(modelContent);
      const calls=modelContent.parts.filter(part=>part.functionCall).map(part=>part.functionCall);
      if(!calls.length) {
        const result=extractResponse(response);
        result.sources=[...sources.values()];
        const saved=await prisma.assistantMessage.create({data:{conversationId,role:'assistant',content:result.content||'Não consegui concluir esse pedido. Tente especificar o projeto ou a pesquisa.',sources:result.sources}});
        await prisma.assistantConversation.update({where:{id:conversationId},data:{updatedAt:new Date()}});
        return {message:saved,actions:pending};
      }
      const responses=[];
      for(const call of calls) {
        let result;
        try {
          const args=call.args||{};
          if(call.name==='list_projects') result=await prisma.project.findMany({where:{members:{some:{id:userId}},name:{contains:String(args.query||''),mode:'insensitive'}},select:{id:true,name:true,description:true,status:true,scheduledTo:true},take:25});
          else if(call.name==='read_project') {
            const project=serializeProject(await accessibleProject(userId,args.projectId));
            result={...project,members:project.members.map(({id,name})=>({id,name})),files:project.files.map(({id,originalName,mimeType,size,part})=>({id,originalName,mimeType,size,part}))};
          } else if(call.name==='search_references') {
            result=await searchArchive(args.query);
            for(const source of result)sources.set(source.url,source);
          } else if(call.name==='list_reference_audio') {
            result=await archiveAudioFiles(args.url);
          } else if(call.name==='propose_action') {
            const action=await proposeAction(userId,{projectId:args.projectId,conversationId,kind:args.kind,payload:JSON.parse(args.payloadJson)});
            pending.push(action);result={status:'pending',id:action.id,summary:action.summary,payload:action.payload};
          } else throw fail(400,'Ferramenta não disponível.');
        } catch(error) {result={error:error.statusCode?error.message:'Não foi possível executar a consulta ou propor essa ação.'};}
        responses.push({functionResponse:{name:call.name,...(call.id&&{id:call.id}),response:{result}}});
      }
      input.push({role:'user',parts:responses});
    }
    throw fail(502,'A conversa atingiu o limite de etapas. Divida o pedido em partes menores.');
  } finally {busy.delete(conversationId);}
}
