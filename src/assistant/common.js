import crypto from 'node:crypto';
export function fail(statusCode,message) { return Object.assign(new Error(message),{statusCode}); }
export function text(value,label,max=1000) {
  if(typeof value!=='string' || !value.trim() || value.length>max) throw fail(400,`${label} inválido.`);
  return value.trim();
}
export function publicUrl(value) {
  let url;
  try {url=new URL(value);} catch {throw fail(400,'URL inválida.');}
  if(url.protocol!=='https:' || url.username || url.password || url.port || !url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname.includes(':')) throw fail(400,'Use um link HTTPS público.');
  url.hash='';
  return url.href;
}
export function snapshot(project) {
  return crypto.createHash('sha256').update(JSON.stringify({updatedAt:project.updatedAt,files:project.files?.map(f=>[f.id,f.originalName]).sort(),references:project.references?.map(r=>[r.id,r.title,r.url,r.author,r.notes]).sort()})).digest('hex');
}
export const asyncRoute = (fn) => async (req,res,next) => {try{await fn(req,res);}catch(error){next(error);}};
