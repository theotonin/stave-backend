import prisma from '../config/database.js';
import { fail, text, publicUrl, snapshot } from './common.js';
import { normalizeProjectFinance, parseProjectDate, serializeProject } from '../utils/projectFinance.js';

export async function accessibleProject(userId,id,db=prisma) {
  if(typeof id!=='string') throw fail(400,'Selecione um projeto.');
  const project=await db.project.findFirst({where:{id,members:{some:{id:userId}}},include:{files:true,members:true,references:true}});
  if(!project) throw fail(404,'Projeto não encontrado.');
  return project;
}
export function actionPayload(kind,input,project) {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw fail(400,'Parâmetros inválidos.');
  if(kind==='update_project') {
    const allowed=['name','description','type','status','scheduledTo','budgetAmount','paymentAmount','paymentDate'];
    if(!Object.keys(input).length || Object.keys(input).some(k=>!allowed.includes(k))) throw fail(400,'Alteração não suportada.');
    const payload={...normalizeProjectFinance(input)};
    if(input.name!==undefined) payload.name=text(input.name,'Nome',200);
    if(input.description!==undefined) {if(typeof input.description!=='string'||input.description.length>5000) throw fail(400,'Descrição inválida.');payload.description=input.description;}
    if(input.type!==undefined) {
      const categories=['Trilha sonora','Composição','Arranjo','Instrumental','Vocal','Orquestração'];
      if(!Array.isArray(input.type)||input.type.some(t=>!categories.includes(t))) throw fail(400,'Classificação inválida.');
      payload.type=[...new Set(input.type)];
    }
    if(input.status!==undefined) {if(!['Em andamento','Concluído','Em revisão','Rascunho'].includes(input.status)) throw fail(400,'Status inválido.');payload.status=input.status;}
    if(input.scheduledTo!==undefined) payload.scheduledTo=parseProjectDate(input.scheduledTo,'Entrega');
    return JSON.parse(JSON.stringify(payload));
  }
  if(kind==='save_reference') return {url:publicUrl(input.url),title:text(input.title,'Título',300),author:String(input.author||'').slice(0,300),notes:String(input.notes||'').slice(0,2000)};
  if(kind==='rename_file') {
    const file=project.files.find(f=>f.id===input.fileId);
    if(!file) throw fail(404,'Arquivo não encontrado no projeto.');
    const name=text(input.originalName,'Nome do arquivo',200);
    if(/[\\/\x00-\x1f]/.test(name) || name.split('.').at(-1).toLowerCase()!==file.originalName.split('.').at(-1).toLowerCase()) throw fail(400,'Preserve a extensão e use apenas um nome de arquivo.');
    return {fileId:file.id,originalName:name};
  }
  if(kind==='import_audio') {
    const url=new URL(publicUrl(input.url));
    if(url.hostname!=='archive.org'||!url.pathname.startsWith('/download/')||! /\.(mp3|wav|ogg|flac)$/i.test(url.pathname)||url.search) throw fail(400,'Use um arquivo de áudio público listado pelo Internet Archive.');
    return {url:url.href};
  }
  if(kind==='separate_audio') {
    if(!process.env.DEMUCS_PYTHON) throw fail(503,'Separação de áudio ainda não configurada neste servidor.');
    const file=project.files.find(f=>f.id===input.fileId);
    if(!file || !/\.(mp3|wav|flac|ogg)$/i.test(file.originalName)) throw fail(400,'Selecione um áudio do projeto.');
    if(file.size>50*1024*1024) throw fail(400,'A separação aceita áudios de até 50 MB.');
    return {fileId:file.id};
  }
  throw fail(400,'Ação não disponível.');
}
export async function proposeAction(userId,{projectId,conversationId,kind,payload}) {
  const project=await accessibleProject(userId,projectId);
  if(conversationId && !await prisma.assistantConversation.findFirst({where:{id:conversationId,userId}})) throw fail(404,'Conversa não encontrada.');
  const normalized=actionPayload(kind,payload,project);
  const labels={update_project:'Atualizar informações',save_reference:'Salvar referência',rename_file:'Renomear arquivo',import_audio:'Importar áudio',separate_audio:'Separar voz e acompanhamento'};
  return prisma.assistantAction.create({data:{userId,projectId,conversationId:conversationId||null,kind,payload:normalized,snapshot:snapshot(project),summary:`${labels[kind]} em “${project.name}”`}});
}
export async function decideAction(userId,id,confirm) {
  return prisma.$transaction(async db=>{
    const action=await db.assistantAction.findFirst({where:{id,userId}});
    if(!action) throw fail(404,'Ação não encontrada.');
    await db.$queryRaw`SELECT id FROM "Project" WHERE id=${action.projectId} FOR UPDATE`;
    const current=await db.assistantAction.findUnique({where:{id}});
    const project=await accessibleProject(userId,action.projectId,db);
    if(current.status!=='pending') return current;
    if(!confirm) return db.assistantAction.update({where:{id},data:{status:'rejected'}});
    if(snapshot(project)!==action.snapshot) throw fail(409,'O projeto mudou desde a proposta. Gere uma nova proposta antes de confirmar.');
    const payload=actionPayload(action.kind,action.payload,project);
    let result;
    if(action.kind==='update_project') result=serializeProject(await db.project.update({where:{id:project.id},data:{...payload,updatedAt:new Date()}}));
    if(action.kind==='save_reference') {
      result=await db.projectReference.upsert({where:{projectId_url:{projectId:project.id,url:payload.url}},create:{projectId:project.id,...payload},update:{title:payload.title,notes:payload.notes,author:payload.author}});
      await db.project.update({where:{id:project.id},data:{updatedAt:new Date()}});
    }
    if(action.kind==='rename_file') {
      result=await db.file.update({where:{id:payload.fileId},data:{originalName:payload.originalName}});
      await db.project.update({where:{id:project.id},data:{updatedAt:new Date()}});
    }
    if(['import_audio','separate_audio'].includes(action.kind)) {
      result=await db.assistantJob.create({data:{userId,projectId:project.id,kind:action.kind,payload}});
      await db.project.update({where:{id:project.id},data:{updatedAt:new Date()}});
    }
    return db.assistantAction.update({where:{id},data:{status:'confirmed',result:JSON.parse(JSON.stringify(result))}});
  },{timeout:15000});
}
