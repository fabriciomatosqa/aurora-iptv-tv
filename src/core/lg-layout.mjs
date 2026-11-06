// LG webOS TV layout helpers. Rendered only when <body class="lg-tv">.
// The shared Android, Samsung and desktop experiences are not redesigned here.
// Original, consistent stroke icons for ten-foot navigation.
const GLYPHS={
  live:'<rect x="4" y="6" width="24" height="18" rx="3"/><path d="M11 28h10M16 24v4"/><path d="m13 11 8 4-8 4z"/>',
  movies:'<rect x="5" y="11" width="22" height="17" rx="3"/><path d="M5 12 26 7l-2-5-21 5 2 5M9 10l3-5m5 4 3-5"/><path d="m14 16 7 4-7 4z"/>',
  series:'<rect x="6" y="9" width="22" height="19" rx="3"/><path d="M2 23V7a3 3 0 0 1 3-3h17"/><path d="m14 15 7 4-7 4z"/>',
  favorites:'<path d="m16 3 4.1 8.4 9.3 1.4-6.7 6.6 1.6 9.2L16 24.3l-8.3 4.3 1.6-9.2-6.7-6.6 9.3-1.4z"/>',
  history:'<circle cx="16" cy="16" r="12"/><path d="M16 8v9l6 3"/><path d="M8 7 5 10l-3-3"/>',
  football:'<circle cx="16" cy="16" r="12"/><path d="m12 13 4-3 4 3-1.5 5h-5zM16 4v6M6 13l6 0m8 0h6M9 25l4.5-7m9.5 7-4.5-7"/>',
  settings:'<circle cx="16" cy="16" r="4"/><path d="M13 3h6l.7 3.7 3.2 1.9 3.6-1.2 3 5.2-2.8 2.5v3.8l2.8 2.5-3 5.2-3.6-1.2-3.2 1.9L19 30h-6l-.7-3.7-3.2-1.9-3.6 1.2-3-5.2 2.8-2.5v-3.8l-2.8-2.5 3-5.2 3.6 1.2 3.2-1.9z"/>',
  arrow:'<path d="m13 9 7 7-7 7"/>',
  play:'<path d="m12 8 12 8-12 8z"/>',
  fullscreen:'<path d="M5 12V5h7m8 0h7v7m0 8v7h-7M12 27H5v-7"/>',
  guide:'<rect x="4" y="6" width="24" height="22" rx="3"/><path d="M10 3v6M22 3v6M4 14h24M10 19h5M10 23h10"/>',
  folder:'<path d="M3 9a3 3 0 0 1 3-3h8l3 3h9a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/>',
  video:'<rect x="4" y="7" width="20" height="18" rx="3"/><path d="m24 13 6-4v14l-6-4"/>',
  info:'<circle cx="16" cy="16" r="12"/><path d="M16 14v8m0-13v1"/>'
};
export const LG_LIBRARY_ROUTES=new Set(["live","movies","series","favorites","history","unknown"]);
export function lgSymbol(name, cls="lg-icon"){
  return '<svg class="'+cls+'" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(GLYPHS[name]||GLYPHS.live)+'</svg>';
}
function fmt(number){return Number(number||0).toLocaleString("pt-BR");}
export function lgGroupKey(item){
  const group=String(item?.group||item?.episodes?.[0]?.group||"").trim();
  return group || "Sem categoria";
}
export function lgGroupLabel(group) {
  // User's original M3U labels remain the grouping keys. Remove only the
  // duplicate top-level prefix in the *visible* secondary category title.
  const clean=String(group||"").replace(/^\s*(?:CANAIS?|AO VIVO|LIVE TV|FILMES?|MOVIES?|SÉRIES?|SERIES)\s*[|:›>]\s*/i,"").trim();
  return clean||group||"Sem categoria";
}
export function lgFacets(items){
  const groups=new Map();
  for(const item of items||[]){
    const key=lgGroupKey(item);
    if(!groups.has(key))groups.set(key,{key,label:lgGroupLabel(key),count:0});
    groups.get(key).count++;
  }
  return [
    {key:"__all__",label:"Todos os conteúdos",count:items?.length||0},
    ...[...groups.values()].sort((a,b)=>a.label.localeCompare(b.label,"pt-BR",{sensitivity:"base",numeric:true}))
  ];
}
export function lgSecondaryMarkup({heading,facets,selected="__all__",esc}){
  const entries=facets.map((entry,i)=>
    '<button class="lg-secondary-item'+(selected===entry.key?' selected':'')+'" type="button" data-action="lg-group" data-lg-group="'+esc(entry.key)+'" data-focus="lg-group-'+i+'" aria-pressed="'+(selected===entry.key?'true':'false')+'">' +
    '<span class="lg-secondary-label">'+esc(entry.label)+'</span><span class="lg-secondary-count">'+fmt(entry.count)+'</span></button>'
  ).join("");
  return '<aside class="lg-secondary" aria-label="Subcategorias de '+esc(heading)+'">'+
    '<div class="lg-secondary-heading"><span class="lg-rail-kicker">BIBLIOTECA</span><h2>Subcategorias</h2>'+
    '<p>'+fmt((facets[0]?.count)||0)+' títulos disponíveis</p></div>'+
    '<div class="lg-secondary-list">'+entries+'</div></aside>';
}

export function lgHomeMarkup({stats,favorites=0,recent=0,playlistName="",esc,hasPlaylist=false,date=new Date()}){
  const tiles=[
    {id:"live",name:"Ao Vivo",caption:"Os melhores canais em um só lugar",count:stats.live,icon:"live",cls:"live"},
    {id:"movies",name:"Filmes",caption:"Encontre seu próximo filme",count:stats.movies,icon:"movies",cls:"movies"},
    {id:"series",name:"Séries",caption:"Histórias para acompanhar",count:stats.series,icon:"series",cls:"series"},
    {id:"favorites",name:"Favoritos",caption:"O que você mais gosta",count:favorites,icon:"favorites",cls:"favorites"},
    {id:"history",name:"Histórico",caption:"Continue de onde parou",count:recent,icon:"history",cls:"history"}
  ];
  const card=(tile,large)=>
    '<button type="button" class="lg-home-tile lg-tile-'+tile.cls+(large?' lg-tile-large':' lg-tile-small')+
    '" data-action="'+tile.id+'" data-focus="home-'+tile.id+'" aria-label="Abrir '+esc(tile.name)+'">'+
    '<span class="lg-tile-glow" aria-hidden="true"></span>'+
    '<span class="lg-tile-symbol">'+lgSymbol(tile.icon)+'</span>'+
    '<span class="lg-tile-copy"><span class="lg-tile-name">'+esc(tile.name)+'</span>'+
    '<span class="lg-tile-description">'+esc(tile.caption)+'</span></span>'+
    '<span class="lg-tile-bottom"><span class="lg-tile-total">'+fmt(tile.count)+(Number(tile.count)===1?' item':' itens')+'</span>'+
    '<span class="lg-tile-arrow">'+lgSymbol("arrow")+'</span></span></button>';
  const stamp=new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
  return '<div class="lg-home-shell" role="main">'+
    '<header class="lg-home-header"><div class="lg-home-brand"><span class="lg-home-brand-icon" aria-hidden="true"></span>'+
    '<span><strong>AURORA</strong><small>IPTV TV</small></span></div>'+
    '<div class="lg-home-header-actions"><span class="lg-home-time" data-lg-clock>'+esc(stamp)+'</span>'+
    '<button data-action="settings" data-focus="nav-settings" class="lg-home-settings" aria-label="Configurações">'+lgSymbol("settings")+'</button></div></header>'+
    '<section class="lg-home-intro"><div><span class="lg-home-eyebrow">SUA EXPERIÊNCIA NA TV</span>'+
    '<h1>O que vamos assistir <em>hoje?</em></h1>'+
    '<p>Escolha o que deseja explorar. Tudo à distância de um clique.</p></div>'+
    (hasPlaylist?'<div class="lg-home-list-pill"><span class="lg-home-list-dot"></span>'+esc(playlistName)+'</div>':'')+'</section>'+
    '<div class="lg-home-tiles"><div class="lg-home-primary">'+tiles.slice(0,3).map(tile=>card(tile,true)).join("")+'</div>'+
    '<div class="lg-home-shortcuts">'+tiles.slice(3).map(tile=>card(tile,false)).join("")+'</div></div>'+
    '<footer class="lg-home-footer"><span>SEU UNIVERSO DE ENTRETENIMENTO</span>'+
    '<div class="lg-home-quick">'+(hasPlaylist?'':'<button data-action="settings" data-focus="home-add">+ Adicionar playlist</button>')+
    '</div><span>Use as setas do controle para navegar</span></footer></div>';
}
