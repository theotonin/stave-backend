import prisma from '../config/database.js';
import fs from 'node:fs/promises';
export const requireProject = (getId) => async (req,res,next) => {
  const id=getId(req);
  const project=typeof id==='string' && await prisma.project.findFirst({where:{id,members:{some:{id:req.userId}}}});
  if(!project) {
    if(req.file) await fs.unlink(req.file.path).catch(()=>{});
    return res.status(404).json({message:'Projeto não encontrado.'});
  }
  req.project=project;
  next();
};
export async function requireFile(req,res,next) {
  const file=await prisma.file.findFirst({where:{id:req.params.fileId,project:{members:{some:{id:req.userId}}}}});
  if(!file) return res.status(404).json({message:'Arquivo não encontrado.'});
  req.fileRecord=file;
  next();
}
export function requireOwnUser(req,res,next) {
  if(req.params.id !== req.userId) return res.status(403).json({message:'Você só pode alterar seu próprio perfil.'});
  next();
}
