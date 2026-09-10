import prisma from '../config/database.js';
import { accessibleProject } from './actions.js';
import { mkdir, writeFile, unlink, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { fail } from './common.js';
const root=path.resolve('uploads');
const limit=50*1024*1024;
let running=false;
export async function fetchArchiveAudio(url,redirects=0) {
  const target=new URL(url);
  // A importação só acessa servidores do Internet Archive, não URLs arbitrárias.
  if(target.protocol!=='https:'||target.username||target.password||target.port||!(target.hostname==='archive.org'||/^[\w.-]+\.archive\.org$/.test(target.hostname))||redirects>5) throw fail(400,'Origem de importação não suportada.');
  const response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(60000)});
  if([301,302,303,307,308].includes(response.status)) return fetchArchiveAudio(new URL(response.headers.get('location'),target).href,redirects+1);
  if(!response.ok) throw fail(502,'O arquivo externo não está disponível.');
  if(Number(response.headers.get('content-length'))>limit) throw fail(400,'O áudio excede 50 MB.');
  const chunks=[];let size=0;
  for await(const chunk of response.body) {size+=chunk.length;if(size>limit) throw fail(400,'O áudio excede 50 MB.');chunks.push(chunk);}
  const buffer=Buffer.concat(chunks);
  const type=response.headers.get('content-type')||'';
  if(!buffer.length||(!type.startsWith('audio/')&&!type.includes('octet-stream'))) throw fail(400,'A origem não retornou um arquivo de áudio.');
  return {buffer,mimeType:type.split(';')[0]};
}
async function separate(job,project) {
  const file=project.files.find(f=>f.id===job.payload.fileId);
  if(!file||!process.env.DEMUCS_PYTHON) throw fail(400,'Arquivo ou processador de separação indisponível.');
  const input=path.resolve(file.storagePath);
  if(!input.startsWith(root+path.sep)) throw fail(400,'Caminho de áudio inválido.');
  const output=path.resolve('uploads','jobs',job.id);
  await mkdir(output,{recursive:true});
  await new Promise((resolve,reject)=>{
    const child=spawn(process.env.DEMUCS_PYTHON,['-m','demucs','--two-stems','vocals','-n','htdemucs','-d','cpu','-o',output,input],{
      stdio:['ignore','ignore','pipe'],shell:false,
      env:{...process.env,OMP_NUM_THREADS:process.env.OMP_NUM_THREADS||'2',MKL_NUM_THREADS:process.env.MKL_NUM_THREADS||'2'},
    });
    child.stderr.resume();
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(fail(504,'A separação excedeu o tempo limite.'));},20*60000);
    child.on('error',()=>{clearTimeout(timer);reject(fail(503,'Processador de áudio não encontrado.'));});
    child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(fail(502,'Não foi possível separar este áudio. Verifique a instalação do processador.'));});
  });
  const entries=await readdir(path.join(output,'htdemucs'),{withFileTypes:true});
  const folder=entries.find(entry=>entry.isDirectory());
  if(!folder) throw fail(502,'O processador não gerou arquivos.');
  const outputs=[];
  for(const [filename,part] of [['vocals.wav','Voz'],['no_vocals.wav','Acompanhamento']]) {
    const storagePath=path.join(output,'htdemucs',folder.name,filename);
    outputs.push({originalName:`${path.parse(file.originalName).name}_${part.toLowerCase()}.wav`,storagePath,mimeType:'audio/wav',size:(await stat(storagePath)).size,sourceFileId:file.id,part});
  }
  return outputs;
}
export async function processNextJob() {
  if(running) return;
  running=true;
  let job,outputs=[];
  try {
    job=await prisma.assistantJob.findFirst({where:{status:'queued'},orderBy:{createdAt:'asc'}});
    if(!job) return;
    const claim=await prisma.assistantJob.updateMany({where:{id:job.id,status:'queued'},data:{status:'processing'}});
    if(!claim.count) return;
    const project=await accessibleProject(job.userId,job.projectId);
    if(job.kind==='import_audio') {
      const {buffer,mimeType}=await fetchArchiveAudio(job.payload.url);
      const name=decodeURIComponent(new URL(job.payload.url).pathname.split('/').at(-1));
      const extension=path.extname(name).toLowerCase();
      await mkdir(root,{recursive:true});
      const storagePath=path.join(root,crypto.randomUUID()+extension);
      await writeFile(storagePath,buffer);
      outputs=[{originalName:name.slice(0,200),mimeType,size:buffer.length,storagePath,sourceUrl:job.payload.url}];
    } else if(job.kind==='separate_audio') outputs=await separate(job,project);
    else throw fail(400,'Processamento não suportado.');
    await prisma.$transaction(async db=>{
      await accessibleProject(job.userId,job.projectId,db);
      const files=[];
      for(const data of outputs) files.push(await db.file.create({data:{...data,projectId:job.projectId}}));
      await db.project.update({where:{id:job.projectId},data:{updatedAt:new Date()}});
      await db.assistantJob.update({where:{id:job.id},data:{status:'completed',outputs:files.map(f=>({id:f.id,name:f.originalName,part:f.part}))}});
    },{timeout:15000});
  } catch(error) {
    for(const file of outputs) await unlink(file.storagePath).catch(()=>{});
    if(job?.kind==='separate_audio') await rm(path.join(root,'jobs',job.id),{recursive:true,force:true}).catch(()=>{});
    if(job) await prisma.assistantJob.updateMany({where:{id:job.id},data:{status:'failed',error:error.statusCode?error.message:'O processamento falhou. Tente novamente.'}}).catch(()=>{});
  } finally {running=false;}
}
export async function startWorker() {
  // Apenas um servidor/worker nesta primeira versão. Uma reinicialização torna a falha explícita.
  await prisma.assistantJob.updateMany({where:{status:'processing'},data:{status:'failed',error:'O servidor reiniciou durante o processamento. Solicite uma nova tarefa.'}});
  const timer=setInterval(processNextJob,5000);timer.unref();
  processNextJob();
}
