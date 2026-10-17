import { parseM3U, groupSeries } from "./core/playlist.mjs";
import { loadState, saveState, itemKey } from "./core/storage.mjs";
import { parseXMLTV, currentAndNext, footballFromEpg } from "./core/epg.mjs";
import { loadRemoteText, hasNativePlayer, startNative } from "./core/native.mjs";
import {isRestricted,createPin,verifyPin} from "./core/parental.mjs";
import {needsDailyUpdate,localDay,mergePlaylist} from "./core/updates.mjs";
import {remoteKey,registerRemoteKeys} from "./core/remote.mjs";
import {hasTizenPlayer,startTizenPlayer,tizenPositionSeconds,toggleTizenPlayback,seekTizen,stopTizenPlayer} from "./core/tizen-player.mjs";
import {loadCatalog,saveCatalog,loadGuide,saveGuide as saveGuideDB,deletePlaylistData} from "./core/catalog-db.mjs";
import { focusFirst, restoreFocus, nextFocus } from "./core/focus.mjs";
import {parseLgM3U,reclassifyLgItems,auditLgCatalog,mergeLgPlaylist} from "./core/lg-catalog.mjs";
import {LG_LIBRARY_ROUTES, lgHomeMarkup, lgSecondaryMarkup, lgGroupKey, lgFacets} from "./core/lg-layout.mjs";
import {lgBrowseModel,lgSeriesGroups,lgMatchSchedule} from "./core/lg-browser.mjs";
import {lgRail,lgBrowserHeader,lgEpgMarkup,lgMovieMarkup,lgEpisodesMarkup,lgFootballHomeMarkup} from "./core/lg-browser-view.mjs";

const app = document.getElementById("app");
const playerRoot = document.getElementById("player-root");
const state = loadState();
const lgTv = document.body.classList.contains("lg-tv");
const LG_PAGE_SIZE=48;
const lgNavPages=[
  ["home","Início","home"],["live","Ao Vivo","tv"],["movies","Filmes","film"],
  ["series","Séries","layers"],["favorites","Favoritos","star"],["history","Histórico","history"],
  ["football","Futebol","trophy"],["settings","Configurações","settings"]
];
let lgSelectedGroup="__all__", lgGroupFacets=[], lgLibraryTitle="";
const lgBrowseState={
  live:{platform:"",channel:""},
  movies:{genre:"",platform:""},
  series:{platform:"",series:""}
};
let lgBrowserModel=null,lgRailRows={first:[],second:[]};
const lgRailQuery={first:"",second:""};
const lgRailLimit={first:100,second:120};
let lgResetSecondScroll=false,lgResetThirdScroll=false;
let lgPageItems=[], lgRendered=0, lgObserver=null;
function resetLgPage() {
  lgPageItems=[];lgRendered=0;
  lgObserver?.disconnect();lgObserver=null;
}
function lgScrollMainTop() {
  if (lgTv) { const main=app.querySelector("main"); if(main)main.scrollTop=0; }
}

const pages = [
  ["home", "Início", "home"], ["live", "Ao Vivo", "tv"], ["movies", "Filmes", "film"],
  ["series", "Séries", "layers"], ["football", "Futebol", "trophy"],
  ["favorites", "Favoritos", "star"], ["settings", "Configurações", "settings"]
];
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  tv: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4"/>',
  layers: '<rect x="5" y="5" width="16" height="16" rx="2"/><path d="M3 17V3h14"/>',
  trophy: '<path d="M8 21h8m-4-4v4M7 4h10v7a5 5 0 0 1-10 0zM7 6H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4"/>',
  star: '<path d="m12 2 3.2 6.5 7.2 1-5.2 5.1 1.3 7.2L12 18.4l-6.5 3.4 1.3-7.2-5.2-5.1 7.2-1z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 13.5l2-1.5-2-1.5-.8-2 1-2.4-2.1-2.1-2.4 1-2-.8L12 2l-1.5 2-2 .8-2.4-1L4 6l1 2.4-.8 2L2 12l2 1.5.8 2-1 2.4L6 20l2.4-1 2 .8L12 22l1.5-2.2 2-.8 2.4 1 2.1-2.1-1-2.4z"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 3M3 8V4h4"/>'
};
function icon(name) { return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.play) + "</svg>"; }
function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]); }
function safeMedia(v) { try { const u = new URL(v); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } }
const testItem = { title: "Vídeo livre de demonstração (CC0)", group: "Demonstração", type: "movies", logo: "", url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" };
let route = "home", history = [], search = "", currentSeries = null, currentPlay = null;
let displayItems = [], notice = "", lastPositionUpdate = -1, hideTimer = null, returnFocusKey = "";
let parentUnlocked = false, pinFailures = 0, pinBlockedUntil = 0, tizenPlaying = false, tizenEnded = false;
function allowed(item) { return !isRestricted(item) || (Boolean(state.parental) && parentUnlocked); }
function activePlaylist() { return state.playlists.find(p => p.id === state.activeId) || null; }
function items() { return activePlaylist()?.items || []; }
function stats() {
  const all = items();
  return { live: all.filter(i=>i.type==="live").length, movies: all.filter(i=>i.type==="movies").length,
    series: lgTv?lgSeriesGroups(all).length:groupSeries(all).length, unknown: all.filter(i=>i.type==="unknown").length };
}
function persist() { if (!saveState(state)) notice = "O armazenamento local está cheio. Nesta versão de teste use listas menores."; }
function navigate(next) { if (next === route) return; history.push(route);
  if(lgTv && next!=="details"){lgSelectedGroup="__all__";lgRailQuery.first="";lgRailQuery.second="";lgRailLimit.first=100;lgRailLimit.second=120;}
  route = next; search = ""; resetLgPage();render();lgScrollMainTop(); }
function goBack() { if (currentPlay) { closePlayer(); return; } if (history.length) { route = history.pop(); search = ""; resetLgPage();render();lgScrollMainTop(); } else if (route !== "home") { route = "home"; resetLgPage();render();lgScrollMainTop(); } }
function pageShell(label) {
  return '<div class="topbar"><div class="eyebrow">' + esc(label) + '</div><div class="topright">AURORA IPTV TV · PRÉVIA 0.2.0</div></div>';
}
function empty(title, description, action = "") {
  return '<div class="empty"><h3>' + esc(title) + '</h3><p>' + esc(description) + '</p>' +
    (action ? '<div class="actions" style="margin-top:16px"><button class="btn primary" data-focus="add-list" data-action="settings">' + icon("plus") + ' Configurar playlist</button></div>' : "") + '</div>';
}
function addCard(item, label = "") {
  const index = displayItems.push(item) - 1;
  const media = safeMedia(item.logo);
  const title = esc(item.title);
  return '<button class="card" data-action="item" data-index="' + index + '" data-focus="item-' + index + '" aria-label="Abrir ' + title + '">' +
    '<div class="card-art">' + (media ? '<img loading="lazy" src="' + esc(media) + '" alt="" onerror="this.style.display=\'none\'">' : '<span class="card-letter">' + esc(item.title?.charAt(0) || "A") + '</span>') +
    (label ? '<span class="card-badge">' + esc(label) + '</span>' : "") +
    '</div><div class="card-body"><div class="card-title">' + title +
    '</div><div class="card-tag">' + esc(item.group || (item.type === "series" ? "Série" : "Conteúdo")) + '</div></div></button>';
}
function cards(itemsToShow, label = "") {
  const paged = lgTv && ["live","movies","series","favorites","unknown","details"].includes(route);
  if(!paged)return '<div class="cards">' + itemsToShow.slice(0,180).map(it=>addCard(it,label)).join("") + '</div>';
  lgPageItems=itemsToShow;
  lgRendered=Math.min(itemsToShow.length,LG_PAGE_SIZE);
  const content=itemsToShow.slice(0,lgRendered).map(it=>addCard(it,label)).join("");
  const rest=itemsToShow.length-lgRendered;
  return '<div class="cards" data-lg-page-grid>' + content + '</div>' +
    '<div class="lg-paging-info" data-lg-page-info>' +
    '<span data-lg-count>Exibindo <strong>'+lgRendered.toLocaleString("pt-BR")+'</strong> de <strong>'+itemsToShow.length.toLocaleString("pt-BR")+'</strong> conteúdos</span>' +
    (rest ? '<button type="button" data-focus="lg-more" data-action="lg-more">Carregar mais ('+Math.min(rest,LG_PAGE_SIZE)+')</button>' : '<span>Todos os itens desta seção foram exibidos.</span>') +
    '</div>';
}
function appendLgPage() {
  if(!lgTv || !lgPageItems.length || lgRendered>=lgPageItems.length)return;
  const grid=app.querySelector("[data-lg-page-grid]");
  const info=app.querySelector("[data-lg-page-info]");
  if(!grid || !info)return;
  const end=Math.min(lgRendered+LG_PAGE_SIZE,lgPageItems.length);
  const batch=lgPageItems.slice(lgRendered,end).map(it=>addCard(it)).join("");
  grid.insertAdjacentHTML("beforeend",batch);
  lgRendered=end;
  const text=info.querySelector("[data-lg-count]");
  if(text)text.innerHTML='Exibindo <strong>'+lgRendered.toLocaleString("pt-BR")+'</strong> de <strong>'+lgPageItems.length.toLocaleString("pt-BR")+'</strong> conteúdos';
  const button=info.querySelector('[data-action="lg-more"]');
  if(button) {
    const rest=lgPageItems.length-lgRendered;
    if(!rest) {
      lgObserver?.disconnect();lgObserver=null;
      button.remove();
      info.insertAdjacentHTML("beforeend","<span>Todos os itens desta seção foram exibidos.</span>");
    }else button.textContent="Carregar mais ("+Math.min(rest,LG_PAGE_SIZE)+")";
  }
}
function observeLgPages(){
  lgObserver?.disconnect();lgObserver=null;
  if(!lgTv || lgRendered>=lgPageItems.length)return;
  const root=app.querySelector("main"),more=app.querySelector('[data-action="lg-more"]');
  if(!root || !more || !("IntersectionObserver" in window))return;
  lgObserver=new IntersectionObserver(entries=>{
    if(entries.some(e=>e.isIntersecting))appendLgPage();
  },{root,rootMargin:"0px 0px 220px 0px",threshold:0});
  lgObserver.observe(more);
}
const timeLabel = ms => new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(ms));
function epgGuide() { return activePlaylist()?.guide || {channels:[],programs:[]}; }
function guideRows(channels) {
  const guide=epgGuide();
  if(!guide.programs.length)return "";
  const rows=channels.filter(allowed).slice(0,60).map(item=>{
    const n=currentAndNext(item,guide);
    if(!n.current&&!n.next)return "";
    const index=displayItems.push(item)-1;
    const text=n.current ? "Agora: "+n.current.title+" ("+timeLabel(n.current.start)+")" : "Sem programa atual";
    return '<button class="playlist-line guide-row" data-focus="guide-'+index+'" data-action="item" data-index="'+index+
      '"><strong>'+esc(item.title)+'</strong><span>'+esc(text)+(n.next?' · A seguir: '+esc(n.next.title):'')+'</span></button>';
  }).filter(Boolean).join("");
  return rows ? '<section><h2>Programação de canais</h2><div class="saved-list">'+rows+'</div></section>' : "";
}
function home() {
  const s = stats(), playlist = activePlaylist();
  if (lgTv) {
    const recentCount=state.recent.filter(it=>(!it.playlistId || it.playlistId===state.activeId) && allowed(it)).length;
    const matches=lgMatchSchedule(footballFromEpg(items().filter(i=>i.type==="live"&&allowed(i)),epgGuide()),Date.now(),4);
    const register=item=>displayItems.push(item)-1;
    const football=lgFootballHomeMarkup(matches,register);
    const home=lgHomeMarkup({stats:s,favorites:state.favorites.length,recent:recentCount,
      playlistName:playlist?.name||"",hasPlaylist:Boolean(playlist),esc});
    const auditLink=s.unknown?
      '<button type="button" class="lg-unclassified-link" data-action="unknown" data-focus="home-unknown">'+
      s.unknown.toLocaleString("pt-BR")+' itens ainda sem classificação · Verificar ›</button>':"";
    return home.replace('<footer class="lg-home-footer">',football+auditLink+'<footer class="lg-home-footer">');
  }
  const recent = state.recent.filter(it => (!it.playlistId || it.playlistId === state.activeId) && allowed(it)).slice(0, 5);
  const total = s.live + s.movies + s.series;
  return pageShell("Seu entretenimento, sua escolha") +
    '<div class="hero"><div class="hero-inner"><div class="kicker">Experiência feita para televisão</div>' +
    '<h1>AURORA<br>IPTV TV</h1><p>Suas playlists, seus favoritos e seus conteúdos. Tudo pronto para navegar com o controle remoto.</p>' +
    '<div class="actions"><button class="btn primary" data-focus="hero-start" data-action="' + (playlist ? "live" : "settings") + '">' + icon(playlist ? "play" : "plus") + (playlist ? " Explorar canais" : " Adicionar playlist") + '</button>' +
    '<button class="btn" data-action="test" data-focus="hero-demo">' + icon("play") + ' Testar vídeo livre</button></div></div></div>' +
    '<div class="stats"><div class="stat"><strong>' + s.live + '</strong><span>Canais</span></div><div class="stat"><strong>' + s.movies + '</strong><span>Filmes</span></div><div class="stat"><strong>' + s.series + '</strong><span>Séries</span></div><div class="stat"><strong>' + state.favorites.length + '</strong><span>Favoritos</span></div></div>' +
    '<section><div class="section-head"><h2>Continuar assistindo</h2><span>' + (recent.length ? "Últimos conteúdos" : "Ainda não há histórico") + '</span></div>' +
    (recent.length ? cards(recent) : empty("Sua próxima história começa aqui", "Reproduza um conteúdo para encontrá-lo nesta seção.")) + '</section>' +
    '<section><div class="section-head"><h2>Sua biblioteca</h2><span>' + total + " títulos identificados" + '</span></div>' +
    (total ? cards([...items().filter(i=>i.type==="live" && allowed(i)).slice(0, 3), ...items().filter(i=>i.type==="movies" && allowed(i)).slice(0, 3), ...groupSeries(items()).filter(allowed).slice(0, 3)]) :
    empty("Adicione sua primeira playlist", "O aplicativo não inclui canais, filmes ou séries. Use somente fontes às quais você tenha acesso legítimo.", true)) + '</section>' +
    (s.unknown ? '<p class="muted">' + s.unknown + ' entradas sem classificação confiável. Consulte Configurações; elas não são exibidas incorretamente como canais ou filmes.</p>' : "");
}
function catalogue(type, title) {
  let content = type === "series" ? groupSeries(items()) : items().filter(i=>i.type===type);
  if (type === "favorites") {
    const shows=lgTv?lgSeriesGroups(items()):groupSeries(items());
    content=[...items().filter(i=>state.favorites.includes(itemKey(i,state.activeId)) && i.type!=="series"),
      ...shows.filter(i=>state.favorites.includes(itemKey(i,state.activeId))||
        (lgTv&&state.favorites.includes(lgSeriesKey(i))))];
  }
  if (type === "unknown") content = items().filter(i=>i.type==="unknown");
  if (lgTv && type==="history") content=state.recent.filter(it=>(!it.playlistId || it.playlistId===state.activeId));
  content=content.filter(allowed);
  if (lgTv) {
    // Facets are derived from every accessible item, before applying the selected group
    // and search. This prevents the secondary list from disappearing while searching.
    lgLibraryTitle=title;
    lgGroupFacets=lgFacets(content);
    if(!lgGroupFacets.some(entry=>entry.key===lgSelectedGroup))lgSelectedGroup="__all__";
    if(lgSelectedGroup!=="__all__")content=content.filter(it=>lgGroupKey(it)===lgSelectedGroup);
  }
  if (search.trim()) content = content.filter(it => it.title.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));
  return pageShell(title) + '<h2>' + esc(title) + '</h2><p class="subtitle">' + content.length.toLocaleString("pt-BR") + ' itens encontrados nesta seção</p>' +
   '<div class="searchbar"><input class="search" type="search" data-focus="search" data-input="search" placeholder="Buscar por nome..." value="' + esc(search) + '" aria-label="Buscar"></div>' +
   (content.length ? cards(content) : empty("Nenhum conteúdo nesta seção", "Adicione uma playlist ou tente uma pesquisa diferente.", !activePlaylist())) + (type==="live" ? guideRows(content) : "");
}
function seriesDetails() {
  if (!currentSeries) return empty("Série não encontrada", "Volte ao catálogo.");
  return pageShell("Séries / Episódios") +
   '<div class="actions" style="margin-bottom:18px"><button class="btn" data-action="back" data-focus="back">' + icon("back") + ' Voltar</button>' +
   '<button class="btn" data-action="favorite-series" data-focus="favorite">' + icon("star") +
   (state.favorites.includes(itemKey(currentSeries, state.activeId)) ? " Remover dos favoritos" : " Favoritar série") + '</button></div>' +
   '<h1>' + esc(currentSeries.title) + '</h1><p class="subtitle">Selecione um episódio. A série aparece como um único card no catálogo.</p>' +
   '<section><h2>Episódios disponíveis</h2>' + cards(currentSeries.episodes) + '</section>';
}
function football() {
  const matches=footballFromEpg(items().filter(allowed), epgGuide());
  const rows=matches.slice(0,100).map(match=>{
    const index=displayItems.push(match.channel)-1;
    const now=Date.now(),p=match.program;
    const status=match.isReprise?"REPRISE":p.start<=now&&p.stop>now?"TRANSMISSÃO AGORA":"EM BREVE";
    return '<button class="football-row" data-action="item" data-index="'+index+'" data-focus="match-'+index+'"><div class="football-teams">'+esc(match.home)+' <strong>×</strong> '+esc(match.away)+'</div>'+
      '<div class="football-time">'+esc(status)+' · '+esc(timeLabel(p.start))+' · '+esc(match.channel.title)+'</div></button>';
  }).join("");
  return pageShell("Futebol") + '<h1>Futebol</h1><p class="subtitle">Transmissões identificadas no EPG da sua playlist. O horário é da transmissão, não necessariamente o início da partida.</p>' +
   (rows?'<div class="football-list">'+rows+'</div>':empty("Sem confrontos confirmados pelo guia", "Importe um XMLTV em Configurações. Sem dados confiáveis, não inventamos jogos ou placares.")) +
   '<section><h2>Competições</h2><p>Os filtros por campeonato serão liberados quando existirem metadados confiáveis. Não usamos resultados fictícios.</p></section>';
}
function settings() {
  const selected = activePlaylist();
  const s = stats();
  const audit=selected?.importAudit;
  const lgImportInfo=lgTv&&selected?'<div class="lg-import-audit" role="status">Playlist: <strong>'+esc(selected.name)+'</strong> · Entradas M3U encontradas: <strong>'+(audit?.declared == null ? "Não disponível" : Number(audit.declared).toLocaleString("pt-BR"))+'</strong> · Importadas: <strong>'+Number(selected.items?.length||0).toLocaleString("pt-BR")+'</strong> · URLs ignoradas: <strong>'+(audit?.invalid == null ? "Não disponível" : Number(audit.invalid).toLocaleString("pt-BR"))+'</strong><p class="muted">Os números correspondem ao arquivo M3U recebido, não à quantidade que o provedor anuncia externamente.</p></div>':'';
  const lines = state.playlists.map(p => '<div class="playlist-line"><strong>' + esc(p.name) + (p.id===state.activeId ? ' ✓' : '') +
   '</strong><div class="actions"><button class="btn" data-focus="activate-' + esc(p.id) + '" data-action="activate" data-id="' + esc(p.id) + '">Usar</button>' +
   '<button class="btn warn" data-action="delete" data-id="' + esc(p.id) + '" data-focus="delete-' + esc(p.id) + '">Excluir</button></div></div>').join("");
  const pinSection=state.parental ?
    '<form id="pin-unlock"><label class="field">PIN parental<input data-focus="pin-enter" type="password" inputmode="numeric" name="pin" minlength="4" maxlength="12" required></label>' +
    '<button class="btn primary" type="submit" data-focus="pin-submit">'+(parentUnlocked?'Verificar novamente':'Desbloquear conteúdos +18')+'</button></form>' +
    (parentUnlocked?'<button class="btn" data-action="parent-lock" data-focus="parent-lock">Bloquear agora</button>':'') +
    '<form id="pin-change"><label class="field">PIN atual<input name="current" type="password" inputmode="numeric" minlength="4" maxlength="12" required data-focus="pin-old"></label>' +
    '<label class="field">Novo PIN<input name="next" type="password" inputmode="numeric" minlength="4" maxlength="12" required data-focus="pin-next"></label>' +
    '<button class="btn" type="submit" data-focus="pin-change">Alterar PIN</button></form>' :
    '<form id="pin-create"><label class="field">Criar PIN de 4 a 12 números<input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" required data-focus="pin-create"></label>' +
    '<button class="btn primary" type="submit" data-focus="pin-create-submit">Ativar proteção +18</button></form>';
  return pageShell("Configurações") + '<h2>Configurações</h2><p class="subtitle">Gerencie suas fontes, preferências e testes de reprodução.</p>' +
   lgImportInfo + '<div class="settings-grid"><div class="panel"><h3>Minhas playlists</h3><p>Adicione uma URL M3U ou cole o texto de uma playlist de testes.</p>' +
   '<form id="playlist-form"><label class="field">Nome da playlist<input name="name" data-focus="name" placeholder="Minha playlist" required maxlength="80"></label>' +
   '<label class="field">Endereço URL (opcional ao colar M3U)<input name="url" type="url" data-focus="url" placeholder="https://.../playlist.m3u"></label>' +
   '<label class="field">Texto M3U (alternativo, para testar no PC)<textarea name="m3u" data-focus="m3u" placeholder="#EXTM3U&#10;#EXTINF:-1 group-title=..."></textarea></label>' +
   '<div class="actions"><button class="btn primary" type="submit" data-focus="save-list">Salvar playlist</button></div></form>' +
   '<p class="muted">No navegador, a importação por URL depende de CORS. Para listas muito grandes ainda será necessário armazenamento nativo e importação em fluxo.</p>' +
   '<div class="saved-list">' + (lines || '<p class="muted">Nenhuma playlist cadastrada.</p>') + '</div></div>' +
   '<div class="panel"><h3>Guia de programação (XMLTV)</h3><p>Para sua playlist ativa. O guia é usado em Ao Vivo e Futebol.</p>' +
   '<form id="epg-form"><label class="field">URL XMLTV (opcional)<input name="url" type="url" placeholder="https://.../epg.xml" data-focus="epg-url" value="'+esc(selected?.guideUrl||"")+'"></label>' +
   '<label class="field">Texto XMLTV para testes (opcional)<textarea name="xml" data-focus="epg-text" placeholder="&lt;tv&gt;...&lt;/tv&gt;"></textarea></label>' +
   '<button type="submit" class="btn primary" data-focus="epg-save">Importar programação</button></form>' +
   '<p class="muted">'+(selected?.guide?.programs?.length||0)+' programas salvos nesta playlist. Arquivos XMLTV.gz ainda exigem descompactação no servidor ou suporte específico.</p></div>' +
   '<div class="panel"><h3>Controle parental</h3><p>Conteúdos +18 ficam ocultos até o PIN ser autorizado nesta sessão.</p>' +
     pinSection + '<p class="muted">O PIN é protegido com PBKDF2 e salt. O bloqueio limita a interface, não criptografa listas no armazenamento local.</p></div>' +
   '<div class="panel"><h3>Aparência e testes</h3>' +
   '<label class="field">Tema<select id="theme" data-focus="theme"><option value="dark"' + (state.theme==="dark"?" selected":"") + '>Escuro</option><option value="light"' + (state.theme==="light"?" selected":"") + '>Claro (experimental)</option></select></label>' +
   '<div class="actions"><button class="btn" data-action="test" data-focus="test-video">' + icon("play") + ' Vídeo CC0</button>' +
   (selected && selected.url ? '<button class="btn" data-action="refresh" data-focus="refresh">Atualizar playlist</button>' : "") + '</div>' +
   '<p class="muted">Ativa: ' + esc(selected?.name || "Nenhuma") + '</p><p class="muted">Itens sem tipo confiável: ' + s.unknown + '</p>' +
   (s.unknown ? '<button class="btn" data-focus="unknown" data-action="unknown">Visualizar não classificados</button>' : "") +
   '<p class="muted">A prévia salva dados no armazenamento do navegador: não use credenciais privadas para testes públicos ou compartilhados.</p>' +
   '<p class="muted">20 idiomas e suporte completo a todas as APIs de TV continuam em desenvolvimento.</p></div></div>';
}
function lgSeriesKey(series){return String(state.activeId||"demo")+"|series:"+String(series.platform||"")+"|"+String(series.title||"");}
function lgTripleBrowser(preferredFocus="") {
  // LG-only UI; catalogs are filtered before modelling, preserving parental policy.
  const data=items().filter(allowed);
  const stateForRoute=lgBrowseState[route] || {};
  const model=lgBrowseModel(route,data,epgGuide(),stateForRoute);
  lgBrowserModel=model;
  if(route==="live") {
    stateForRoute.platform=model.platform;
    stateForRoute.channel=model.channel;
  }else if(route==="movies"){
    stateForRoute.genre=model.genre;
    stateForRoute.platform=model.platform;
  }else {
    stateForRoute.platform=model.platform;
    stateForRoute.series=model.series;
  }
  const register=item=>displayItems.push(item)-1;
  const prevLists=[...app.querySelectorAll(".lg-v4-rail-list")].map(el=>el.scrollTop);
  const prevThird=app.querySelector(".lg-v4-third")?.scrollTop||0;
  let first=[],second=[],firstTitle="",secondTitle="",third="",firstLabel="",secondLabel="";
  if(route==="live"){
    firstTitle="Plataformas";secondTitle="Canais";
    first=model.platforms;
    second=model.channels.map(ch=>({key:ch.url,label:ch.title}));
    firstLabel="Escolha a plataforma";secondLabel=model.platform||"Nenhuma plataforma";
    third=lgEpgMarkup(model,register);
  } else if(route==="movies"){
    firstTitle="Gêneros";secondTitle="Plataformas";
    first=model.genres;second=model.platforms;
    firstLabel="Selecione o gênero";secondLabel=model.genre||"Escolha um gênero";
    third=lgMovieMarkup(model,filtered=>cards(filtered));
  } else if(route==="series"){
    firstTitle="Plataformas";secondTitle="Séries";
    first=model.platforms;
    second=model.shows.map(entry=>({key:entry.key,label:entry.title,count:entry.episodes.length,logo:entry.logo}));
    firstLabel="Escolha a plataforma";secondLabel=model.platform||"Escolha uma plataforma";
    const fav=model.selected && (state.favorites.includes(itemKey(model.selected,state.activeId)) || state.favorites.includes(lgSeriesKey(model.selected)));
    third=lgEpisodesMarkup(model,register,itemKey(model.selected||{},state.activeId),Boolean(fav));
  }
  lgRailRows={first,second};
  app.innerHTML=lgBrowserHeader(route)+
    '<div class="lg-v4-workspace" role="main">'+
    lgRail({title:firstTitle,subtitle:firstLabel,items:first,selectedKey:
      route==="movies"?model.genre:model.platform,action:"lg-filter",kind:"first",focusPrefix:"lg-first",query:lgRailQuery.first,limit:lgRailLimit.first})+
    lgRail({title:secondTitle,subtitle:secondLabel,items:second,selectedKey:
      route==="live"?model.channel:route==="series"?model.series:model.platform,
      action:"lg-filter",kind:"second",focusPrefix:"lg-second",query:lgRailQuery.second,limit:lgRailLimit.second})+
    '<main class="lg-v4-third" aria-label="'+esc(route==="live"?"Guia de programação":route==="movies"?"Filmes filtrados":"Episódios")+'">'+
    third+'</main></div>';
  const railLists=[...app.querySelectorAll(".lg-v4-rail-list")];
  if(railLists[0])railLists[0].scrollTop=prevLists[0]||0;
  if(railLists[1])railLists[1].scrollTop=lgResetSecondScroll?0:(prevLists[1]||0);
  const thirdPane=app.querySelector(".lg-v4-third");
  if(thirdPane)thirdPane.scrollTop=lgResetThirdScroll?0:prevThird;
  lgResetSecondScroll=false;lgResetThirdScroll=false;
  restoreFocus(preferredFocus||"lg-first-0");
  observeLgPages();
}
function render(preferredFocus = "") {
  displayItems=[];
  lgObserver?.disconnect();lgObserver=null;
  document.body.classList.toggle("theme-light",state.theme==="light");
  const homepage=lgTv && route==="home";
  const triple=lgTv && ["live","movies","series"].includes(route);
  const library=lgTv && LG_LIBRARY_ROUTES.has(route) && !triple;
  app.className=lgTv?(homepage?"lg-home-mode":triple?"lg-triple-mode":library?"lg-library-mode":"lg-standard-mode"):"";
  if(triple){lgTripleBrowser(preferredFocus);return;}
  if(homepage){
    if(lgTv && /não conseguiu reproduzir esta mídia/i.test(notice))notice="";
    app.innerHTML=(notice?'<div class="notice lg-home-notice" role="status">'+esc(notice)+'</div>':"")+home();
    restoreFocus(preferredFocus || "home-live");
    return;
  }
  const navPages=lgTv?lgNavPages:pages;
  const nav=navPages.map(([id,label,ico])=>'<button data-action="'+id+'" data-focus="nav-'+id+'" class="'+
    (route===id || (route==="details" && id==="series")?"active":"")+
    '" aria-current="'+(route===id?"page":"false")+'">'+icon(ico)+'<span>'+esc(label)+'</span></button>').join("");
  let page = route==="home" ? home() : route==="live" ? catalogue("live","Ao Vivo") :
    route==="movies" ? catalogue("movies","Filmes") : route==="series" ? catalogue("series","Séries") :
    route==="football" ? football() : route==="favorites" ? catalogue("favorites","Favoritos") :
    route==="history" && lgTv ? catalogue("history","Histórico") :
    route==="settings" ? settings() : route==="unknown" ? catalogue("unknown","Sem classificação") : seriesDetails();
  const secondary=library?lgSecondaryMarkup({heading:lgLibraryTitle,facets:lgGroupFacets,selected:lgSelectedGroup,esc}):"";
  app.innerHTML='<aside class="sidebar" aria-label="Menu principal"><div class="logo"><div class="logo-mark" aria-hidden="true"></div><div><div class="logo-name">AURORA</div><span class="logo-sub">IPTV TV</span></div></div><nav class="nav">'+
    nav+'</nav><div class="sidebar-bottom">VERSÃO DE DESENVOLVIMENTO<br>Controle remoto: ← ↑ → ↓ · OK · Voltar</div></aside>'+
    secondary+'<main role="main">'+
    (notice?'<div class="notice" role="status">'+esc(notice)+'</div>':"")+page+'</main>';
  restoreFocus(preferredFocus || "nav-"+(route==="details"?"series":route));
  observeLgPages();
}
function openItem(item) {
  if (!allowed(item)) {notice="Conteúdo restrito. Configure ou desbloqueie o PIN parental.";route="settings";render("pin-enter");return;}
  if (item.type === "series" && Array.isArray(item.episodes)) {
    currentSeries = item; navigate("details"); return;
  }
  startPlayer(item);
}
function favorite(item) {
  const key = itemKey(item,state.activeId);
  state.favorites = state.favorites.includes(key) ? state.favorites.filter(x=>x!==key) : [...state.favorites,key];
  persist(); render("favorite");
}
function startPlayer(item) {
  const url = safeMedia(item.url);
  if (!url) { notice = "Não há URL de reprodução HTTP(S) válida."; render(); return; }
  returnFocusKey = document.activeElement?.dataset.focus || "";
  currentPlay = item;
  state.recent = [{ ...item, playlistId: state.activeId }, ...state.recent.filter(r => r.url !== item.url)].slice(0,15);
  persist();
  const key = itemKey(item,state.activeId);
  if (hasNativePlayer()) {
    startNative(item,key,state.positions[key]||0);
    return;
  }
  if (hasTizenPlayer()) {
    playerRoot.innerHTML='<div class="player-screen tizen-screen" role="dialog" aria-label="AVPlay"><div class="player-header">'+
      '<h3>'+esc(item.title)+'</h3><div class="actions"><button class="btn" data-focus="close-player" data-action="close-player">'+icon("back")+' Voltar</button></div></div>'+
      '<div id="tizen-player-error" role="alert"></div></div>';
    tizenPlaying=startTizenPlayer(url,state.positions[key]||0,
      msg=>{const box=playerRoot.querySelector("#tizen-player-error");if(box)box.textContent=msg;},
      ()=>{tizenEnded=true;delete state.positions[key];persist();closePlayer();});
    if(tizenPlaying){playerRoot.querySelector('[data-action="close-player"]')?.focus();scheduleHideControls();return;}
    playerRoot.innerHTML="";
  }
  const liked = state.favorites.includes(key);
  playerRoot.innerHTML = '<div class="player-screen" role="dialog" aria-label="Reprodutor de vídeo"><div class="player-header">' +
   '<div><h3>' + esc(item.title) + '</h3><p>Retomada disponível quando o formato permite</p></div>' +
   '<div class="actions"><button class="btn" data-action="player-favorite" data-focus="player-favorite">' + icon("star") + (liked?" Favoritado":" Favoritar") + '</button>' +
   '<button class="btn" data-action="close-player" data-focus="close-player">' + icon("back") + ' Voltar</button></div></div>' +
   '<video controls playsinline autoplay tabindex="0" data-focus="video" src="' + esc(url) + '"></video><div class="player-help">Esc ou Voltar para sair · Espaço para pausar</div></div>';
  const vid = playerRoot.querySelector("video");
  vid.addEventListener("loadedmetadata",()=>{ const pos=state.positions[key]||0; if (Number.isFinite(vid.duration) && pos < vid.duration-15) vid.currentTime=pos; });
  vid.addEventListener("timeupdate",()=>{
    const sec=Math.floor(vid.currentTime);
    if (sec>0 && Math.abs(lastPositionUpdate-sec)>=5) { state.positions[key]=sec; lastPositionUpdate=sec; persist(); }
  });
  vid.addEventListener("ended",()=>{delete state.positions[key];persist();});
  vid.addEventListener("error",()=>{notice="O dispositivo/navegador não conseguiu reproduzir esta mídia. Confira o formato, acesso e codecs.";});
  vid.play().catch(()=>{ /* Browser may require explicit playback gesture. */ });
  vid.focus();
  scheduleHideControls();
}
function scheduleHideControls() {
  clearTimeout(hideTimer);
  const screen=playerRoot.querySelector(".player-screen");
  if (!screen) return;
  screen.classList.remove("player-idle");
  hideTimer=setTimeout(()=>{ if (screen.querySelector(".player-header")?.contains(document.activeElement)) screen.querySelector("video")?.focus(); screen.classList.add("player-idle"); },4500);
}
function closePlayer() {
  if (!currentPlay) return;
  if(tizenPlaying){
    const key=itemKey(currentPlay,state.activeId),seconds=tizenPositionSeconds();
    if(seconds>0 && !tizenEnded)state.positions[key]=Math.floor(seconds);
    stopTizenPlayer();tizenPlaying=false;tizenEnded=false;persist();clearTimeout(hideTimer);
    playerRoot.innerHTML="";currentPlay=null;render(returnFocusKey);returnFocusKey="";return;
  }
  const vid=playerRoot.querySelector("video");
  if (vid && Number.isFinite(vid.currentTime) && vid.currentTime>0 && !vid.ended) {
    state.positions[itemKey(currentPlay,state.activeId)]=Math.floor(vid.currentTime); persist();
  }
  vid?.pause(); if (vid) vid.removeAttribute("src");
  clearTimeout(hideTimer); playerRoot.innerHTML=""; currentPlay=null; lastPositionUpdate=-1;
  render(returnFocusKey);
  returnFocusKey = "";
}
async function saveGuide(form) {
  const p=activePlaylist();
  if(!p){ notice="Escolha uma playlist antes de importar o EPG.";render("nav-settings");return; }
  const data=new FormData(form);
  const url=String(data.get("url")||"").trim(), pasted=String(data.get("xml")||"").trim();
  if(!pasted&&!safeMedia(url)){notice="Insira XMLTV válido ou uma URL HTTP(S).";render("epg-url");return;}
  try{
    let xml=pasted;
    if(!xml) xml=await loadRemoteText(url);
    const guide=parseXMLTV(xml);
    if(!guide.programs.length)throw Error("O XMLTV não contém programas válidos.");
    await saveGuideDB(p.id,guide);
    p.guide=guide;if(url)p.guideUrl=url;p.lastGuideAttemptDay=localDay();
    persist();notice="Guia importado: "+guide.programs.length+" programas.";render("nav-settings");
  }catch(err){notice="Não foi possível importar XMLTV: "+err.message+". Verifique também CORS.";render("nav-settings");}
}
async function refreshGuideQuiet(playlist) {
  if(!playlist?.guideUrl || playlist.lastGuideAttemptDay===localDay())return;
  playlist.lastGuideAttemptDay=localDay();persist();
  try {
    const newGuide=parseXMLTV(await loadRemoteText(playlist.guideUrl));
    if(!newGuide.programs.length) return;
    await saveGuideDB(playlist.id,newGuide);
    playlist.guide=newGuide;persist();
  } catch { /* Never erase last known valid guide on connectivity/CORS failures. */ }
}
async function savePlaylist(form) {
  const data = new FormData(form);
  const name = String(data.get("name")||"").trim();
  const url = String(data.get("url")||"").trim();
  const pasted = String(data.get("m3u")||"").trim();
  if (!name || (!pasted && !safeMedia(url))) { notice="Informe um nome e uma URL HTTP(S) ou o texto M3U."; render("name"); return; }
  try {
    let text = pasted;
    if (!text) {
      text=await loadRemoteText(url);
    }
    const parsed=lgTv?parseLgM3U(text):parseM3U(text);
    if (!parsed.count) throw new Error("Nenhuma entrada de vídeo válida foi encontrada.");
    const id=(globalThis.crypto?.randomUUID?.() || String(Date.now()));
    await saveCatalog(id,parsed.items);
    state.playlists.push({id,name,url,items:parsed.items,guideUrl:parsed.guideUrl,guide:null,importAudit:lgTv?{declared:parsed.declared,invalid:parsed.invalid}:null,updatedAt:Date.now(),lastAttemptDay:localDay()});
    state.activeId=id; notice="Playlist importada: " + parsed.count + " entradas válidas.";
    persist(); render("nav-settings");
  } catch(error) { notice="Não foi possível importar: " + (error instanceof Error ? error.message : "erro desconhecido") + ". Confira o formato e, para URL, as permissões CORS."; render("name"); }
}
async function refreshActive({quiet=false, playlist=activePlaylist()}={}) {
  if(!playlist?.url)return;
  playlist.lastAttemptDay=localDay();
  persist();
  try{
    const parsed=lgTv?parseLgM3U(await loadRemoteText(playlist.url)):parseM3U(await loadRemoteText(playlist.url));
    if(!parsed.count)throw new Error("A lista recebida está vazia.");
    const merge=lgTv?mergeLgPlaylist(playlist.items,parsed.items):mergePlaylist(playlist.items,parsed.items);
    await saveCatalog(playlist.id,merge.items);
    playlist.items=merge.items;playlist.updatedAt=Date.now();
    if(lgTv)playlist.importAudit={declared:parsed.declared,invalid:parsed.invalid};
    if(parsed.guideUrl)playlist.guideUrl=parsed.guideUrl;
    if(!quiet){notice="Atualização concluída: "+merge.added+" itens novos, sem apagar os antigos.";persist();render("nav-settings");}
    else persist();
  }catch(error){
    if(!quiet){notice="Atualização falhou. Seus dados foram preservados. Verifique a conexão ou CORS.";render("nav-settings");}
  }
}
async function handlePin(form) {
  const formData=new FormData(form);
  const mode=form.id;
  if(Date.now()<pinBlockedUntil){notice="Muitas tentativas. Tente novamente após 30 segundos.";render("nav-settings");return;}
  try{
    if(mode==="pin-create"){
      state.parental=await createPin(String(formData.get("pin")||""));parentUnlocked=true;
      notice="Proteção parental ativada.";persist();render("nav-settings");return;
    }
    if(mode==="pin-unlock"){
      if(!await verifyPin(String(formData.get("pin")||""),state.parental))throw Error("PIN incorreto");
      parentUnlocked=true;pinFailures=0;notice="Conteúdos +18 liberados nesta sessão.";render("nav-settings");return;
    }
    if(mode==="pin-change"){
      if(!await verifyPin(String(formData.get("current")||""),state.parental))throw Error("PIN atual incorreto");
      state.parental=await createPin(String(formData.get("next")||""));
      parentUnlocked=true;pinFailures=0;notice="PIN alterado.";persist();render("nav-settings");return;
    }
  }catch(error){
    pinFailures++;
    if(pinFailures>=5){pinBlockedUntil=Date.now()+30_000;pinFailures=0;}
    notice="Não foi possível validar o PIN. Verifique os 4 a 12 números.";
    render("nav-settings");
  }
}

app.addEventListener("click",event=>{
  const target=event.target.closest("[data-action]"); if (!target) return;
  const action=target.dataset.action;
  if (pages.some(p=>p[0]===action) || action==="unknown" || (lgTv && action==="history")) navigate(action);
  else if (lgTv && action==="lg-filter") {
    const kind=target.dataset.kind,idx=Number(target.dataset.row);
    const entry=lgRailRows[kind]?.[idx];
    if(!entry || !lgBrowseState[route])return;
    const selected=lgBrowseState[route];
    if(route==="live"){
      if(kind==="first"){selected.platform=entry.key;selected.channel="";}
      else selected.channel=entry.key;
    }else if(route==="movies"){
      if(kind==="first"){selected.genre=entry.key;selected.platform="";}
      else selected.platform=entry.key;
    }else if(route==="series"){
      if(kind==="first"){selected.platform=entry.key;selected.series="";}
      else selected.series=entry.key;
    }
    if(kind==="first"){lgRailQuery.second="";lgRailLimit.second=120;lgResetSecondScroll=true;}
    lgResetThirdScroll=true;
    resetLgPage();render(target.dataset.focus); 
  }
  else if (lgTv && action==="lg-rail-more"){
    const kind=target.dataset.kind;
    if(kind==="first"||kind==="second"){lgRailLimit[kind]+=120;render("lg-more-"+kind);}
  }
  else if (lgTv && action==="lg-series-favorite"){
    if(lgBrowserModel?.selected){
      const series=lgBrowserModel.selected;
      const key=lgSeriesKey(series),legacy=itemKey(series,state.activeId);
      const was=state.favorites.includes(key)||state.favorites.includes(legacy);
      state.favorites=state.favorites.filter(k=>k!==key&&k!==legacy);
      if(!was)state.favorites.push(key);
      persist();render("lg-series-favorite");
    }
  }
  else if (lgTv && action==="lg-group") {
    lgSelectedGroup=target.dataset.lgGroup;
    const groupIndex=lgGroupFacets.findIndex(entry=>entry.key===lgSelectedGroup);
    search="";
    resetLgPage();render("lg-group-"+Math.max(0,groupIndex));lgScrollMainTop();
  }
  else if (action==="lg-more") appendLgPage();
  else if (action==="item") openItem(displayItems[Number(target.dataset.index)]);
  else if (action==="test") startPlayer(testItem);
  else if (action==="back") goBack();
  else if (action==="favorite-series" && currentSeries) favorite(currentSeries);
  else if (action==="activate") {state.activeId=target.dataset.id;search="";resetLgPage();persist();render("nav-settings");}
  else if (action==="delete") {
    const id=target.dataset.id;
    if (!confirm("Excluir esta playlist e o catálogo local associado?")) return;
    void deletePlaylistData(id).catch(()=>{notice="Não foi possível remover completamente o cache anterior.";});
    state.playlists=state.playlists.filter(p=>p.id!==id);
    if(state.activeId===id)state.activeId=state.playlists[0]?.id||null;
    persist();render("nav-settings");
  }
  else if (action==="refresh") refreshActive();
  else if (action==="parent-lock"){parentUnlocked=false;notice="Conteúdo +18 bloqueado.";render("nav-settings");}
});
app.addEventListener("submit",event=>{
  if(event.target.id==="playlist-form"){ event.preventDefault();savePlaylist(event.target); }
  if(event.target.id==="epg-form"){ event.preventDefault();saveGuide(event.target); }
  if(event.target.id.startsWith("pin-")){event.preventDefault();handlePin(event.target);}
});
app.addEventListener("input",event=>{
  if(lgTv&&event.target.dataset.input==="lg-rail-search"){
    const kind=event.target.dataset.kind;
    if(kind==="first"||kind==="second"){
      const value=event.target.value,cursor=event.target.selectionStart;
      lgRailQuery[kind]=value;
      lgRailLimit[kind]=kind==="first"?100:120;
      render("lg-search-"+kind);
      const newInput=app.querySelector('[data-input="lg-rail-search"][data-kind="'+kind+'"]');
      if(newInput&&cursor!==null)newInput.setSelectionRange(cursor,cursor);
    }
    return;
  }
  if(event.target.dataset.input!=="search") return;
  const cursor=event.target.selectionStart;search=event.target.value;resetLgPage();render("search");
  const input=app.querySelector('[data-input="search"]');if(input&&cursor!==null)input.setSelectionRange(cursor,cursor);
});
app.addEventListener("change",event=>{
  if(event.target.id==="theme"){state.theme=event.target.value;persist();render("theme");}
});
playerRoot.addEventListener("click",event=>{
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(action==="close-player")closePlayer();
  if(action==="player-favorite" && currentPlay){
    const key=itemKey(currentPlay,state.activeId);
    state.favorites=state.favorites.includes(key)?state.favorites.filter(x=>x!==key):[...state.favorites,key];
    persist();playerRoot.querySelector('[data-action="player-favorite"]').innerHTML=icon("star")+(state.favorites.includes(key)?" Favoritado":" Favoritar");
    scheduleHideControls();
  }
});
playerRoot.addEventListener("pointermove",scheduleHideControls);
document.addEventListener("keydown",event=>{
  const field=["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName);
  const key=remoteKey(event);
  if(key==="Escape" || (key==="Backspace"&&!field)) {event.preventDefault();goBack();return;}
  if(currentPlay){
    scheduleHideControls();
    if(tizenPlaying){
      if(key==="PlayPause"){event.preventDefault();toggleTizenPlayback();}
      if(key==="FastForward"){event.preventDefault();seekTizen(15);}
      if(key==="Rewind"){event.preventDefault();seekTizen(-15);}
      if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(key)){event.preventDefault();nextFocus(key,playerRoot);}
      return;
    }
    const vid=playerRoot.querySelector("video");
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(key) && !field) {
      event.preventDefault();nextFocus(key,playerRoot);return;
    }
    if(key==="PlayPause" && !field){
      event.preventDefault();if(vid)vid.paused?vid.play().catch(()=>{}):vid.pause();
    }
    if(key==="FastForward" && vid && Number.isFinite(vid.duration)) {event.preventDefault();vid.currentTime=Math.min(vid.duration,vid.currentTime+15);}
    if(key==="Rewind" && vid && Number.isFinite(vid.duration)) {event.preventDefault();vid.currentTime=Math.max(0,vid.currentTime-15);}
    return;
  }
  if(!field && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(key)){event.preventDefault();nextFocus(key);}
});
registerRemoteKeys();

window.auroraGoBack=goBack;
window.auroraNativePlaybackEnded=(key,seconds,ended)=>{
  if(ended)delete state.positions[key];
  else if(Number.isFinite(seconds)&&seconds>=0)state.positions[key]=seconds;
  persist();currentPlay=null;render(returnFocusKey);returnFocusKey="";
};
async function hydrateCatalogs() {
  // Migrates legacy localStorage content without discarding favorites or positions.
  try {
    for(const p of state.playlists) {
      if(Array.isArray(p.items) && p.items.length) await saveCatalog(p.id,p.items);
      else p.items=(await loadCatalog(p.id))||[];
      if(lgTv) {
        const corrected=reclassifyLgItems(p.items);
        if(corrected)await saveCatalog(p.id,p.items);
        if(!p.importAudit)p.importAudit={declared:null,invalid:null};
      }
      if(p.guide?.programs?.length) await saveGuideDB(p.id,p.guide);
      else p.guide=(await loadGuide(p.id))||null;
    }
    persist();
    render();
    const active=activePlaylist();
    if(needsDailyUpdate(active))setTimeout(()=>refreshActive({quiet:true,playlist:active}),1200);
    if(active?.guideUrl && active.lastGuideAttemptDay!==localDay())setTimeout(()=>refreshGuideQuiet(active),2200);
  } catch {
    notice="Este navegador não conseguiu acessar o banco local. O catálogo pode não persistir após fechar o app.";
    render();
  }
}
render();
void hydrateCatalogs();
