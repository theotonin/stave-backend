import { Router } from 'express';
import prisma from '../config/database.js';
import auth from '../middlewares/authMiddleware.js';
import { asyncRoute, fail, text } from './common.js';
import { accessibleProject, proposeAction, decideAction } from './actions.js';
import { searchArchive, searchWeb, archiveAudioFiles } from './search.js';
import { providerReady } from './provider.js';
import { sendMessage } from './chat.js';
import { serializeProject } from '../utils/projectFinance.js';
import { downloadProject } from '../services/projectService.js';

const router=Router();
router.use(auth);
const active=new Map();
router.use((req,res,next)=>{
  // Limite simples por sessão/usuário para consultas externas e propostas.
  if(req.method==='GET') return next();
  const now=Date.now(), prior=active.get(req.userId);
  const entry=!prior||now-prior.start>60000?{start:now,count:0}:prior;
  if(++entry.count>30) return res.status(429).json({message:'Muitos pedidos. Aguarde um minuto.'});
  active.set(req.userId,entry);
  if(active.size>1000) for(const [id,item] of active) if(now-item.start>60000) active.delete(id);
  next();
});
router.get('/capabilities',(req,res)=>res.json({chat:providerReady(),webSearch:false,provider:'gemini',archiveSearch:true,importAudio:true,separateAudio:Boolean(process.env.DEMUCS_PYTHON)}));
router.get('/conversations',asyncRoute(async(req,res)=>res.json({conversations:await prisma.assistantConversation.findMany({where:{userId:req.userId},orderBy:{updatedAt:'desc'},take:50})})));
router.post('/conversations',asyncRoute(async(req,res)=>{
  if(req.body.projectId) await accessibleProject(req.userId,req.body.projectId);
  const conversation=await prisma.assistantConversation.create({data:{userId:req.userId,title:text(req.body.title||'Nova conversa','Título',120),projectId:req.body.projectId||null}});
  res.status(201).json({conversation});
}));
router.get('/conversations/:id',asyncRoute(async(req,res)=>{
  const conversation=await prisma.assistantConversation.findFirst({where:{id:req.params.id,userId:req.userId},include:{messages:{orderBy:{createdAt:'asc'},take:200},actions:{orderBy:{createdAt:'asc'}}}});
  if(!conversation) throw fail(404,'Conversa não encontrada.');
  if(conversation.projectId) await accessibleProject(req.userId,conversation.projectId);
  res.json({conversation});
}));
router.post('/conversations/:id/messages',asyncRoute(async(req,res)=>res.json(await sendMessage(req.userId,req.params.id,req.body.message))));
router.post('/search',asyncRoute(async(req,res)=>{
  const query=text(req.body.query,'Busca',500);
  if(req.body.source==='web') res.json(await searchWeb(query));
  else res.json({sources:await searchArchive(query),content:'Resultados do acervo de áudio do Internet Archive. As descrições vêm do catálogo; não são uma análise do som.'});
}));
router.post('/reference-files',asyncRoute(async(req,res)=>res.json({files:await archiveAudioFiles(req.body.url)})));
router.get('/projects/:id',asyncRoute(async(req,res)=>{
  const project=serializeProject(await accessibleProject(req.userId,req.params.id));
  const references=await prisma.projectReference.findMany({where:{projectId:project.id},orderBy:{createdAt:'desc'}});
  res.json({project,references});
}));
router.post('/actions',asyncRoute(async(req,res)=>res.status(201).json({action:await proposeAction(req.userId,req.body)})));
router.get('/actions',asyncRoute(async(req,res)=>res.json({actions:await prisma.assistantAction.findMany({where:{userId:req.userId,status:'pending',project:{members:{some:{id:req.userId}}}},orderBy:{createdAt:'desc'},take:50})})));
router.post('/actions/:id/decision',asyncRoute(async(req,res)=>{
  if(typeof req.body.confirm!=='boolean') throw fail(400,'Informe a confirmação da ação.');
  res.json({action:await decideAction(req.userId,req.params.id,req.body.confirm)});
}));
router.get('/jobs',asyncRoute(async(req,res)=>res.json({jobs:await prisma.assistantJob.findMany({where:{userId:req.userId,project:{members:{some:{id:req.userId}}}},orderBy:{createdAt:'desc'},take:50})})));
router.get('/jobs/:id/download',asyncRoute(async(req,res)=>{
  const job=await prisma.assistantJob.findFirst({where:{id:req.params.id,userId:req.userId,status:'completed'}});
  if(!job) throw fail(404,'Resultado não encontrado.');
  const project=await accessibleProject(req.userId,job.projectId);
  const ids=(job.outputs||[]).map(file=>file.id);
  const files=project.files.filter(file=>ids.includes(file.id));
  if(!files.length||files.length!==ids.length) throw fail(404,'Um dos resultados já foi removido do projeto.');
  await downloadProject({...project,name:project.name+'_resultados',files},res);
}));
export default router;
