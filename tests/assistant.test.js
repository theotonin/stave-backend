import test from 'node:test';
import assert from 'node:assert/strict';
import {actionPayload} from '../src/assistant/actions.js';
import {publicUrl,snapshot} from '../src/assistant/common.js';
import {extractResponse} from '../src/assistant/provider.js';
const project={id:'p',updatedAt:new Date('2026-09-09T10:00Z'),files:[{id:'f',originalName:'demo.wav'}]};
test('ações validam campos, valores, alvos e URLs sem executar mudanças',()=>{
  assert.deepEqual(actionPayload('update_project',{name:'Novo',budgetAmount:'10.50'},project),{name:'Novo',budgetAmount:'10.50'});
  assert.throws(()=>actionPayload('update_project',{members:['intruso']},project));
  assert.throws(()=>actionPayload('update_project',{budgetAmount:-1},project));
  assert.throws(()=>actionPayload('rename_file',{fileId:'outro',originalName:'nome.wav'},project));
  assert.throws(()=>actionPayload('rename_file',{fileId:'f',originalName:'../outro.wav'},project));
  assert.throws(()=>actionPayload('rename_file',{fileId:'f',originalName:'arquivo.exe'},project));
  assert.throws(()=>actionPayload('import_audio',{url:'https://youtube.com/watch?v=123'},project));
  assert.equal(actionPayload('save_reference',{title:'Música',url:'https://www.youtube.com/watch?v=abc'},project).title,'Música');
  assert.equal(project.files[0].originalName,'demo.wav');
});
test('links e citações não aceitam protocolos executáveis nem endereços locais',()=>{
  for(const url of ['javascript:alert(1)','http://example.com','https://localhost/x','https://127.0.0.1/x','https://u:p@example.com/']) assert.throws(()=>publicUrl(url));
  const output=extractResponse({candidates:[{content:{role:'model',parts:[{text:'Pensamento interno',thought:true},{text:'Resultado'}]}}]});
  assert.equal(output.content,'Resultado');assert.equal(output.sources.length,0);
});
test('snapshot detecta edição concorrente de projeto e arquivos',()=>{
  assert.notEqual(snapshot(project),snapshot({...project,updatedAt:new Date()}));
  assert.notEqual(snapshot(project),snapshot({...project,files:[{id:'f',originalName:'outro.wav'}]}));
});
