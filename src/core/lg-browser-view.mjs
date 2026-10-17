// Semantic LG-only rendering: three columns, no media catalogue data invented.
const safe=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=v=>Number(v||0).toLocaleString("pt-BR");
const clock=ms=>new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(ms));
export function lgRail({title,subtitle,items,selectedKey,action,kind,focusPrefix}){
  const body=items.length?items.map((item,index)=>
    '<button type="button" class="lg-v4-row'+(item.key===selectedKey?' selected':'')+
    '" data-action="'+action+'" data-kind="'+kind+'" data-row="'+index+'" data-focus="'+focusPrefix+'-'+index+
    '" aria-pressed="'+(item.key===selectedKey?'true':'false')+'">'+
    '<span class="lg-v4-row-name">'+safe(item.label||item.title)+'</span>'+
    (item.count!==undefined?'<span class="lg-v4-count">'+n(item.count)+'</span>':'')+
    '<span class="lg-v4-row-chevron" aria-hidden="true">›</span></button>').join("") :
    '<div class="lg-v4-empty-rail">Nenhum item disponível</div>';
  return '<aside class="lg-v4-rail" aria-label="'+safe(title)+'">'+
    '<div class="lg-v4-rail-head"><span>EXPLORAR</span><h2>'+safe(title)+'</h2><p>'+safe(subtitle)+'</p></div>'+
    '<div class="lg-v4-rail-list">'+body+'</div></aside>';
}
export function lgBrowserHeader(route){
  const tabs=[["live","Ao Vivo"],["movies","Filmes"],["series","Séries"],["football","Futebol"]];
  return '<header class="lg-v4-header"><button type="button" class="lg-v4-brand" data-action="home" data-focus="nav-home" aria-label="Voltar ao início">'+
    '<span class="lg-v4-brand-mark"></span><span><strong>AURORA</strong><small>IPTV TV</small></span></button>'+
    '<nav class="lg-v4-tabs" aria-label="Navegação principal">'+tabs.map(([id,label])=>
    '<button type="button" data-action="'+id+'" data-focus="nav-'+id+'"'+(route===id?' aria-current="page"':'')+' class="'+(route===id?'active':'')+'">'+label+'</button>').join("")+
    '</nav><button type="button" class="lg-v4-settings" data-action="settings" data-focus="nav-settings" aria-label="Configurações">⚙</button></header>';
}
export function lgEpgMarkup(model,register){
  const selected=model.selected;
  if(!selected)return '<div class="lg-v4-third-empty"><h2>Escolha um canal</h2><p>Selecione uma plataforma e depois um canal para visualizar a programação.</p></div>';
  const index=register(selected);
  const {schedule}=model;
  const programme=p=>'<div class="lg-v4-epg-row"><div class="lg-v4-epg-hour">'+clock(p.start)+'</div>'+
    '<div class="lg-v4-epg-title">'+safe(p.title)+'</div>'+
    (p.description?'<p>'+safe(p.description)+'</p>':'')+'</div>';
  return '<div class="lg-v4-third-title"><span class="lg-v4-overline">CANAL SELECIONADO</span>'+
    '<h2>'+safe(selected.title)+'</h2><p>'+safe(model.platform)+'</p></div>'+
    '<button class="lg-v4-play" data-action="item" data-index="'+index+'" data-focus="lg-play">▶ Assistir canal</button>'+
    '<h3 class="lg-v4-section-label">Guia de programação</h3>'+
    (schedule.now?'<div class="lg-v4-epg-now"><span class="lg-v4-onair">NO AR</span>'+programme(schedule.now)+'</div>':
      '<p class="lg-v4-epg-empty">Nenhum programa confirmado em andamento.</p>')+
    (schedule.next.length?'<div class="lg-v4-epg-list">'+schedule.next.map(programme).join("")+'</div>':
      '<p class="lg-v4-epg-empty">Sem próximas informações no EPG desta playlist.</p>')+
    (!schedule.now&&!schedule.next.length?'<p class="lg-v4-hint">A programação depende de dados XMLTV válidos associados a este canal. Você pode importar o guia em Configurações.</p>':'');
}
export function lgMovieMarkup(model,cards){
  return '<div class="lg-v4-third-title"><span class="lg-v4-overline">FILMES</span><h2>'+safe(model.genre)+'</h2>'+
   '<p>'+safe(model.platform)+' · '+n(model.movies.length)+' filmes</p></div>'+
   (model.movies.length?cards(model.movies):
    '<div class="lg-v4-third-empty">Nenhum filme corresponde aos filtros.</div>');
}
export function lgEpisodesMarkup(model,register,favoriteKey,isFavorite){
  if(!model.selected)return '<div class="lg-v4-third-empty"><h2>Escolha uma série</h2><p>Os episódios aparecerão aqui.</p></div>';
  const entry=model.selected;
  return '<div class="lg-v4-third-title"><span class="lg-v4-overline">SÉRIE SELECIONADA</span><h2>'+safe(entry.title)+'</h2>'+
    '<p>'+n(model.episodes.length)+' episódios · '+safe(model.platform)+'</p></div>'+
    '<button type="button" class="lg-v4-favorite" data-action="lg-series-favorite" data-focus="lg-series-favorite">'+
      (isFavorite?"★ Remover dos favoritos":"☆ Favoritar série")+'</button>'+
    '<h3 class="lg-v4-section-label">Episódios</h3>'+
    (model.episodes.length?'<div class="lg-v4-episodes">'+model.episodes.map((ep,i)=>{
      const index=register(ep);
      return '<button type="button" class="lg-v4-episode" data-action="item" data-index="'+index+'" data-focus="lg-episode-'+i+'">'+
        '<span class="lg-v4-episode-number">'+String(i+1).padStart(2,"0")+'</span>'+
        '<span class="lg-v4-episode-details"><strong>'+safe(ep.title)+'</strong><small>'+safe(ep.group)+'</small></span>'+
        '<span class="lg-v4-episode-play">▶</span></button>';
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
      '<div class="lg-v4-football-empty">Nenhum confronto identificado no EPG. Importe um guia XMLTV para mostrar jogos reais aqui.</div>')+
    '</section>';
}
