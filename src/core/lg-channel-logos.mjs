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
  const quality=/(?:\s+|\s*[\[(])(?:FHD|HD|SD|UHD|4K|8K|H[.\s-]?265|H[.\s-]?264|HEVC|ALT|BACKUP)(?:[\])])?\s*$/i;
  for(let i=0;i<5;i++){
    const next=value.replace(quality,"").trim();
    if(next===value)break;
    value=next;
  }
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
}
// Prefer: 1. individual channel icon; 2. another bitrate variant's same-brand
// icon from the same provider catalogue; 3. verified national broadcaster mark.
export function lgChannelLogos(channel,channels){
  const primary=String(channel?.logo||"").trim();
  const stem=lgChannelStem(channel?.title);
  const sibling=Array.isArray(channels)?channels.find(c=>
    c!==channel && lgChannelStem(c?.title)===stem && /^https?:\/\//i.test(c?.logo||"")):null;
  const known=lgKnownBrandLogo(channel);
  return {primary:primary||String(sibling?.logo||"").trim()||known,
    fallback:primary||sibling?.logo?known:"",known:!!known};
}
