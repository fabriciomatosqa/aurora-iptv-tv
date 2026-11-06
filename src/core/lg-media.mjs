// LG-only media diagnostics. Never log IPTV URLs: they may contain credentials.
export function lgMediaKind(url){
  try{
    const {pathname}=new URL(String(url||""));
    if(/\.m3u8$/i.test(pathname))return "HLS";
    if(/\.ts$/i.test(pathname))return "MPEG-TS";
    if(/\.(?:mp4|m4v|mov)$/i.test(pathname))return "MP4";
    if(/\.(?:mkv|avi)$/i.test(pathname))return "Arquivo de vídeo";
    return "Formato não identificado";
  }catch{return "URL inválida";}
}
// Xtream-compatible, same-origin fallback only. No blanket rewriting of opaque streams.
// Returns an alternate URL exclusively on a real user action, not during playlist import.
export function lgHlsAlternative(url){
  try{
    const source=new URL(String(url||""));
    if(!/^https?:$/.test(source.protocol))return "";
    if(!/^\/live\/[^/?#]+\/[^/?#]+\/[^/?#]+\.ts$/i.test(source.pathname))return "";
    source.pathname=source.pathname.replace(/\.ts$/i,".m3u8");
    return source.href;
  }catch{return "";}
}
export function lgMediaErrorText(item,mediaErrorCode=0){
  const kind=lgMediaKind(item?.url);
  const prefix=mediaErrorCode===4?"Este dispositivo não reconheceu o formato de reprodução.":
    mediaErrorCode===2?"A transmissão sofreu uma falha de rede.":
    mediaErrorCode===3?"Ocorreu um erro ao decodificar o vídeo.":
    mediaErrorCode===1?"A reprodução foi interrompida.":
    "Não foi possível iniciar a transmissão.";
  if(kind==="MPEG-TS")return prefix+
    " A fonte usa MPEG-TS; teste a versão HLS (.m3u8) da playlist. O Simulator pode ter suporte diferente de uma TV LG real.";
  if(kind==="HLS")return prefix+
    " A fonte é HLS. Verifique disponibilidade do canal, codec e autenticação; o Simulator não reproduz todos os fluxos.";
  return prefix+" Confira a disponibilidade do canal, o acesso e os codecs suportados.";
}
