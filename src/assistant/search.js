import { text, publicUrl, fail } from './common.js';

export async function searchArchive(query) {
  const term=text(query,'Busca',250).replace(/[^\p{L}\p{N}\s-]/gu,' ').trim();
  if(!term) throw fail(400,'Informe palavras para pesquisar.');
  const url=new URL('https://archive.org/advancedsearch.php');
  url.search=new URLSearchParams({q:`mediatype:audio AND (${term.split(/\s+/).map(word=>`(title:"${word}" OR subject:"${word}")`).join(' AND ')})`,output:'json',rows:'8',page:'1','sort[]':'downloads desc'}).toString();
  for(const field of ['identifier','title','creator','description']) url.searchParams.append('fl[]',field);
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw fail(502,'A busca no Internet Archive está indisponível. Tente novamente.');
  const data=await response.json();
  return (data.response?.docs || []).map(item=>({
    title:String(item.title || item.identifier).slice(0,300),url:`https://archive.org/details/${encodeURIComponent(item.identifier)}`,
    author:[item.creator].flat().filter(Boolean).join(', ').slice(0,300),
    description:[item.description].flat().filter(Boolean).join(' ').replace(/<[^>]*>/g,'').slice(0,450),
    source:'Internet Archive',
  }));
}

export async function archiveAudioFiles(referenceUrl) {
  const url=new URL(publicUrl(referenceUrl));
  const id=url.hostname==='archive.org' && url.pathname.match(/^\/details\/([\w.-]+)\/?$/)?.[1];
  if(!id) throw fail(400,'A listagem de áudios está disponível para referências do Internet Archive.');
  const response=await fetch(`https://archive.org/metadata/${id}`,{signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw fail(502,'Não foi possível consultar os arquivos da referência.');
  const data=await response.json();
  return (data.files || []).filter(f=>!f.private && /\.(mp3|wav|flac|ogg)$/i.test(f.name) && Number(f.size)>0 && Number(f.size)<=50*1024*1024).slice(0,15).map(f=>({name:f.name,size:Number(f.size),url:`https://archive.org/download/${id}/${f.name.split('/').map(encodeURIComponent).join('/')}`}));
}

export async function searchWeb() {
  throw fail(503,'Busca geral na web desativada nesta demo. Use o catálogo do Internet Archive ou peça referências na conversa com Gemini.');
}
