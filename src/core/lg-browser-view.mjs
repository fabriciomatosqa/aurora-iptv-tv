import {lgSymbol} from "./lg-layout.mjs";
import {lgEpisodeParts,lgDisplayBucket} from "./lg-browser.mjs";
import {lgChannelLogos} from "./lg-channel-logos.mjs";
import {lgMediaKind} from "./lg-media.mjs";
// Semantic LG-only rendering: three columns, no media catalogue data invented.
const safe=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=v=>Number(v||0).toLocaleString("pt-BR");
const clock=ms=>new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(ms));
export function lgRail({title,subtitle,items,selectedKey,action,kind,focusPrefix,query="",limit=120}){
  const needle=String(query||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  const hits=items.map((item,index)=>({item,index})).filter(({item})=>
    !needle||String(item.label||item.title||"").normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").includes(needle));
  const shown=hits.slice(0,limit);
  const body=shown.length?shown.map(({item,index})=>{
    const logo=safeMedia(item.logo),backup=safeMedia(item.logoFallback);
    const channel=kind==="second"&&item.kind==="channel";
    const art=channel?
      '<span class="lg-v5-channel-logo">'+lgSymbol("live","lg-v5-channel-glyph")+
      (logo?'<img loading="lazy" src="'+logo+'" data-fallback="'+backup+
        '" alt="" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=\'\';}else this.remove()">':"")+'</span>':
      logo?'<span class="lg-v4-row-art"><img loading="lazy" src="'+logo+'" alt="" onerror="this.parentElement.style.display=\'none\'"></span>':"";
    return '<button type="button" class="lg-v4-row'+(item.key===selectedKey?' selected':'')+
      (channel?' lg-v5-channel-row':'')+
      '" data-action="'+action+'" data-kind="'+kind+'" data-row="'+index+'" data-focus="'+focusPrefix+'-'+index+
      '" aria-pressed="'+(item.key===selectedKey?'true':'false')+'">'+art+
      '<span class="lg-v4-row-name">'+safe(item.label||item.title)+'</span>'+
      (item.count!==undefined?'<span class="lg-v4-count">'+n(item.count)+'</span>':'')+
      '<span class="lg-v4-row-chevron" aria-hidden="true">'+lgSymbol("arrow","lg-v5-inline-icon")+'</span></button>';
  }).join(""):'<div class="lg-v4-empty-rail">'+(needle?"Nenhum resultado para esta busca.":"Nenhum item disponível")+'</div>';
  const more=shown.length<hits.length?
    '<button type="button" class="lg-v4-load-more" data-action="lg-rail-more" data-kind="'+kind+
    '" data-focus="lg-more-'+kind+'">Mostrar mais ('+n(hits.length-shown.length)+' restantes)</button>':"";
  return '<aside class="lg-v4-rail" aria-label="'+safe(title)+'">'+
    '<div class="lg-v4-rail-head"><span>EXPLORAR</span><h2>'+safe(title)+'</h2><p>'+safe(subtitle)+'</p>'+
    (items.length>8?'<input type="search" class="lg-v4-rail-search" data-input="lg-rail-search" data-kind="'+kind+
      '" data-focus="lg-search-'+kind+'" value="'+safe(query)+'" placeholder="Buscar nesta coluna…" aria-label="Buscar '+safe(title)+'">':'')+
    '</div><div class="lg-v4-rail-list">'+body+more+
    (items.length>8?'<div class="lg-v4-rail-total">'+n(shown.length)+' de '+n(hits.length)+' resultados</div>':"")+
    '</div></aside>';
}
function safeMedia(value){
  try{const url=new URL(String(value));return ["http:","https:"].includes(url.protocol)?safe(url.href):"";}
  catch{return "";}
}
export function lgBrowserHeader(route){
  const tabs=[["live","Ao Vivo"],["movies","Filmes"],["series","Séries"],["football","Futebol"]];
  return '<header class="lg-v4-header"><button type="button" class="lg-v4-brand" data-action="home" data-focus="nav-home" aria-label="Voltar ao início">'+
    '<span class="lg-v4-brand-mark"></span><span><strong>AURORA</strong><small>IPTV TV</small></span></button>'+
    '<nav class="lg-v4-tabs" aria-label="Navegação principal">'+tabs.map(([id,label])=>
    '<button type="button" data-action="'+id+'" data-focus="nav-'+id+'"'+(route===id?' aria-current="page"':'')+' class="'+(route===id?'active':'')+'">'+label+'</button>').join("")+
    '</nav><button type="button" class="lg-v4-settings" data-action="settings" data-focus="nav-settings" aria-label="Configurações">'+lgSymbol("settings","lg-v5-header-icon")+'</button></header>';
}
export function lgEpgMarkup(model,register){
  const selected=model.selected;
  if(!selected)return '<div class="lg-v4-third-empty"><h2>Escolha um canal</h2><p>Selecione uma categoria e depois um canal para visualizar a programação.</p></div>';
  const index=register(selected);
  const {schedule}=model;
  const programme=p=>'<div class="lg-v4-epg-row"><div class="lg-v4-epg-hour">'+clock(p.start)+'</div>'+
    '<div class="lg-v4-epg-title">'+safe(p.title)+'</div>'+
    (p.description?'<p>'+safe(p.description)+'</p>':'')+'</div>';
  const logos=lgChannelLogos(selected,model.channels);
  const poster=safeMedia(logos.primary);
  const posterFallback=safeMedia(logos.fallback);
  const format=lgMediaKind(selected.url);
  const media=safeMedia(selected.url);
  const preview='<section class="lg-v5-preview" aria-label="Prévia do canal">'+
    '<div class="lg-v5-preview-screen" data-preview-state="loading">'+
    (poster?'<img class="lg-v5-preview-poster" src="'+poster+'" data-fallback="'+posterFallback+'" alt="" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=\'\';}else this.remove()">':"")+
    (media?'<video class="lg-v5-preview-video" muted playsinline preload="metadata" src="'+media+'" aria-label="Prévia do canal sem áudio"></video>':"")+
    '<span class="lg-v5-live-pill"><span class="lg-v5-live-dot"></span> PRÉVIA · SEM ÁUDIO</span>'+
    '<div class="lg-v5-preview-state" role="status">Carregando prévia...</div>'+
    '<button type="button" class="lg-v5-preview-open" data-action="item" data-index="'+index+
      '" data-focus="lg-play" aria-label="Abrir '+safe(selected.title)+' em tela cheia">'+
      lgSymbol("fullscreen","lg-v5-preview-button-icon")+'<span>Tela cheia</span></button>'+
    '</div><p class="lg-v5-preview-hint">Pressione OK na mini tela para abrir o canal em tela cheia.'+
    (format==="MPEG-TS"?' Fonte MPEG-TS: no Simulator, a versão HLS costuma ser uma alternativa melhor.':'')+'</p>'+
    '</section>';
  return '<div class="lg-v4-third-title"><span class="lg-v4-overline">CANAL SELECIONADO</span>'+
    '<div class="lg-v6-channel-heading">'+(poster?'<span class="lg-v6-channel-logo"><img src="'+poster+'" data-fallback="'+posterFallback+'" alt="" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=\'\';}else this.remove()"></span>':"")+
    '<div><h2>'+safe(selected.title)+'</h2><p>'+safe(lgDisplayBucket(model.platform))+'</p></div></div></div>'+
    preview+'<h3 class="lg-v4-section-label">'+lgSymbol("guide","lg-v5-section-icon")+' Guia de programação</h3>'+
    (!schedule.now&&!schedule.next.length?
      '<div class="lg-v4-no-epg"><span class="lg-v4-no-epg-icon">'+lgSymbol("guide","lg-v5-empty-icon")+'</span><h4>Programação indisponível</h4>'+
      '<p>Este canal ainda não possui um guia de programação associado. Você pode assistir normalmente ou adicionar um XMLTV.</p>'+
      '<button type="button" data-action="settings" data-focus="lg-epg-settings">Configurar EPG ›</button></div>':
      (schedule.now?'<div class="lg-v4-epg-now"><span class="lg-v4-onair">NO AR</span>'+programme(schedule.now)+'</div>':'')+
      (schedule.next.length?'<div class="lg-v4-epg-list">'+schedule.next.map(programme).join("")+'</div>':''));
}
export function lgMovieMarkup(model,cards,query=""){
  const normalized=String(query||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  const shown=normalized?model.movies.filter(item=>
    String(item.title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLocaleLowerCase("pt-BR").includes(normalized)):model.movies;
  const genre=model.genre==="Gênero não informado"?"Sem categoria definida":lgDisplayBucket(model.genre);
  const platform=model.platform==="Plataforma não informada"?"Da playlist":lgDisplayBucket(model.platform);
  return '<div class="lg-v4-third-title lg-v5-movie-heading"><span class="lg-v4-overline">BIBLIOTECA DE FILMES</span>'+
   '<h2>'+safe(genre)+'</h2><p>'+safe(platform)+' · '+n(model.movies.length)+' títulos disponíveis</p></div>'+
   (model.movies.length>6?'<label class="lg-v5-movie-search-label" for="lg-movie-search">'+
      lgSymbol("movies","lg-v5-search-icon")+
      '<input id="lg-movie-search" type="search" data-input="lg-movie-search" data-focus="lg-movie-search"'+
      ' placeholder="Buscar filme pelo título..." value="'+safe(query)+'" aria-label="Buscar filme pelo título"></label>':"")+
   (shown.length?cards(shown):'<div class="lg-v4-third-empty">'+
     (normalized?"Nenhum filme encontrado para esta busca.":"Nenhum filme corresponde aos filtros.")+'</div>');
}
export function lgEpisodesMarkup(model,register,favoriteKey,isFavorite){
  if(!model.selected)return '<div class="lg-v4-third-empty"><h2>Escolha uma série</h2><p>Os episódios aparecerão aqui.</p></div>';
  const entry=model.selected;
  let lastSeason=null;
  return '<div class="lg-v4-third-title"><span class="lg-v4-overline">SÉRIE SELECIONADA</span><h2>'+safe(entry.title)+'</h2>'+
    '<p>'+n(model.episodes.length)+' episódios · '+safe(lgDisplayBucket(model.platform))+'</p></div>'+
    '<button type="button" class="lg-v4-favorite" data-action="lg-series-favorite" data-focus="lg-series-favorite">'+
      lgSymbol("favorites","lg-v5-inline-icon")+(isFavorite?" Remover dos favoritos":" Favoritar série")+'</button>'+
    '<h3 class="lg-v4-section-label">Episódios</h3>'+
    (model.episodes.length?'<div class="lg-v4-episodes">'+model.episodes.map((ep,i)=>{
      const index=register(ep);
      const parts=lgEpisodeParts(ep);
      const heading=parts&&parts.season!==lastSeason?
        '<h4 class="lg-v4-season-heading">Temporada '+parts.season+'</h4>':"";
      lastSeason=parts?.season??null;
      return heading+'<button type="button" class="lg-v4-episode" data-action="item" data-index="'+index+'" data-focus="lg-episode-'+i+'">'+
        '<span class="lg-v4-episode-number">'+String(i+1).padStart(2,"0")+'</span>'+
        '<span class="lg-v4-episode-details"><strong>'+safe(ep.title)+'</strong><small>'+safe(ep.group)+'</small></span>'+
        '<span class="lg-v4-episode-play">'+lgSymbol("play","lg-v5-inline-icon")+'</span></button>';
    }).join("")+'</div>':'<p>Nenhum episódio válido nesta série.</p>');
}
export function lgFootballHomeMarkup(matches,register) {
  return '<section class="lg-v4-football-home"><div class="lg-v4-football-heading">'+
    '<div><span class="lg-v4-overline">TRANSMISSÕES DA SUA PLAYLIST</span><h2>Futebol</h2></div>'+
    '<button type="button" data-action="football" data-focus="home-football-more">Ver agenda completa ›</button></div>'+
    (matches.length?'<div class="lg-v4-football-games">'+matches.map((match,i)=>{
      const index=register(match.channel),p=match.program;
      return '<button type="button" class="lg-v4-football-game" data-action="item" data-index="'+index+
        '" data-focus="home-game-'+i+'" aria-label="Assistir '+safe(match.home)+' versus '+safe(match.away)+'">'+
        '<span class="lg-v4-match-status'+(match.status==="AO VIVO"?" playing":"")+'">'+safe(match.status)+'</span>'+
        '<strong>'+safe(match.home)+' <em>×</em> '+safe(match.away)+'</strong>'+
        '<small>'+safe(clock(p.start))+' · '+safe(match.channel.title)+'</small><span class="lg-v4-watch">Assistir ›</span></button>';
    }).join("")+'</div>':
      '<div class="lg-v4-football-empty"><strong>Jogos ainda não disponíveis</strong><span>Conecte um guia XMLTV com partidas e canais identificados para acompanhar as transmissões.</span><button data-action="settings" data-focus="home-football-settings">Configurar guia de programação ›</button></div>')+
    '</section>';
}
