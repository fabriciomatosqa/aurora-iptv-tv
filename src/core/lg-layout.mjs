// LG webOS TV layout helpers. Rendered only when <body class="lg-tv">.
// The shared Android, Samsung and desktop experiences are not redesigned here.
const GLYPHS={
  live:'<rect x="4" y="5" width="24" height="17" rx="3"/><path d="M9 29h14M16 22v7M10 11l8 4-8 4z"/>',
  movies:'<rect x="5" y="8" width="23" height="20" rx="3"/><path d="m6 8 19-5 2 6-20 5M12 15v8l7-4z"/>',
  series:'<rect x="7" y="5" width="21" height="22" rx="3"/><path d="M3 23V5a2 2 0 0 1 2-2h17M13 12l9 5-9 5z"/>',
  favorites:'<path d="m16 3 4.1 8.7 9.4 1.2-6.9 6.6 1.7 9.4L16 24.4l-8.3 4.5 1.7-9.4-6.9-6.6 9.4-1.2z"/>',
  history:'<circle cx="16" cy="17" r="12"/><path d="M16 9v9l6 4M4 6v8h8"/>',
  football:'<circle cx="16" cy="16" r="12"/><path d="m11 14 5-4 5 4-2 7h-6zM16 4v6M5 14l6 0M27 14l-6 0M9 26l4-5m10 5-4-5"/>',
  settings:'<circle cx="16" cy="16" r="4"/><path d="m16 3 3 2 4-.4 1.6 3.7 3.8 2-1 4 1 3.7-3.4 2.7-.7 4-4 .4-3.3 2.7-3.3-2.7-4-.4-.7-4L5.6 18l1-3.7-1-4 3.8-2L11 4.6 15 5z"/>',
  arrow:'<path d="m12 8 9 8-9 8M21 16H7"/>'
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
    '<span class="lg-tile-bottom"><span class="lg-tile-total">'+fmt(tile.count)+' itens</span>'+
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
