// Optional, verifiable broadcast-brand fallback for providers lacking tvg-logo.
// Never call external search APIs with playlist URLs or user credentials.
export const TV_GLOBO_GENERIC_LOGO="https://commons.wikimedia.org/wiki/Special:FilePath/TV_Globo_logo_%28April_2025%29.png?width=240";
export function lgKnownBrandLogo(item){
  const title=String(item?.title||"").trim();
  // Affiliate channels retain their own names; this is the generic TV Globo
  // broadcaster mark, not a fabricated affiliate-specific mark.
  if(/^(?:(?:TV|REDE)\s+)?GLOBO(?:\s|$)/i.test(title) &&
     !/^(?:(?:TV|REDE)\s+)?GLOBO\s+(?:NEWS|PLAY|RURAL|REP[ÓO]RTER|FILMES)/i.test(title)){
    return TV_GLOBO_GENERIC_LOGO;
  }
  return "";
}
export function lgChannelStem(title){
  let value=String(title||"").trim();
  const quality=/(?:\s+(?:FHD|HD|SD|UHD|4K|8K|H[.\s-]?265|H[.\s-]?264|HEVC|ALT|BACKUP)|\s*[\[(](?:FHD|HD|SD|UHD|4K|8K|H[.\s-]?265|H[.\s-]?264|HEVC|ALT|BACKUP)[\])])\s*$/i;
  for(let i=0;i<5;i++){
    const next=value.replace(quality,"").trim();
    if(next===value)break;
    value=next;
  }
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
}
// Prefer: 1. individual channel icon; 2. another bitrate variant's same-brand
// icon from the same provider catalogue; 3. verified national broadcaster mark.
const siblingCache=new WeakMap();
function siblingLogoIndex(channels){
  if(!Array.isArray(channels))return new Map();
  const existing=siblingCache.get(channels);
  if(existing)return existing;
  const index=new Map();
  for(const channel of channels){
    if(!/^https?:\/\//i.test(channel?.logo||""))continue;
    const stem=lgChannelStem(channel.title);
    if(stem&&!index.has(stem))index.set(stem,channel.logo);
  }
  siblingCache.set(channels,index);
  return index;
}
export function lgChannelLogos(channel,channels){
  const primary=String(channel?.logo||"").trim();
  const sibling=siblingLogoIndex(channels).get(lgChannelStem(channel?.title))||"";
  const known=lgKnownBrandLogo(channel);
  return {primary:primary||sibling||known,
    fallback:(primary||sibling)?known:"",known:!!known};
}
