import { sessionUser } from '../services/sessionService.js';
export default async function authMiddleware(req,res,next) {
  try {
    const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const userId=await sessionUser(token);
    if(!userId) return res.status(401).json({message:'Sessão expirada. Faça login novamente.'});
    req.userId=userId;
    req.sessionToken=token;
    req.token=userId;
    next();
  } catch {res.status(503).json({message:'Não foi possível validar a sessão.'});}
}
