// LG webOS-only three-column browser data model.
// Nothing here invents a provider, genre, game, channel, or programme.
// Every platform/genre must originate in M3U metadata; otherwise use an honest fallback.

const KNOWN_PLATFORMS=[
  "Netflix","Prime Video","Amazon Prime","Disney+","Disney Plus","HBO Max","Max",
  "Globoplay","Globo Play","Apple TV+","Apple TV","Crunchyroll","Funimation",
  "Paramount+","Paramount Plus","Pluto TV","Claro TV","Claro video","Claro",
  "DirecTV","DirecTV Go","DGO","Premiere","AMC Plus","Discovery+","Discovery Plus",
  "Telecine","Looke","MUBI","Sony One","Lionsgate+","Star+","YouTube",
  "Brasil Paralelo","Record","Band","SBT","Netflix Kids","Star Channel"
];
const GENRES=[
  "Ação","Aventura","Animação","Anime","Animes","Comédia","Documentário","Documentários",
  "Drama","Dramas","Ficção Científica","Fantasia","Terror","Suspense","Romance",
  "Românticos","Família","Infantil","Musical","Crime","Policial","História","Biografia",
  "Guerra","Faroeste","Esportes","Religioso","Dorama","Doramas"
];
const PLATFORM_UNKNOWN="Plataforma não informada";
const CATEGORY_PREFIX="Categoria da lista: ";
const CATEGORY_UNKNOWN="Categoria não informada";
const GENRE_UNKNOWN="Gênero não informado";
const text=value=>String(value??"").trim();
const norm=value=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
// IPTV playlists use many decorative Unicode symbols before service names.
// Normalize only group metadata, never infer a provider from a media title.
const cleanToken=value=>text(value)
  .replace(/^[^\p{L}\p{N}]+/u,"")
  .replace(/[^\p{L}\p{N}+]+$/u,"").trim();
const tokens=group=>text(group).split(/\s*(?:\||\/|›|»| > | :: | : )\s*/).map(cleanToken).filter(Boolean);
const KIND=/^(?:filmes?|movies?|vod|s[eé]ries?|series|canais?|ao vivo|live tv|tv|plataformas?|g[eê]neros?|categorias?|fhd|hd|sd|uhd|4k|dublado|legendado|dual audio)$/i;
function matches(candidate,options) {
  const token=norm(cleanToken(candidate));
  return options.find(option=>norm(option)===token)||"";
}
function findFromGroup(group,options) {
  const sorted=[...options].sort((a,b)=>b.length-a.length);
  for(const segment of tokens(group)){
    const exact=matches(segment,sorted);
    if(exact)return exact;
    const textValue=norm(segment).replace(/[()[\]]/g," ").replace(/\s+/g," ").trim();
    // E.g. "SÉRIES - NETFLIX", "Netflix [Séries]", "Filmes Drama".
    // Require a recognized category at the edge, never scan content titles.
    for(const option of sorted){
      const service=norm(option);
      for(const kind of ["filmes","filme","movies","movie","vod","series","serie","canais","canal",
        "ao vivo","live tv","plataforma","plataformas","generos","genero","categoria","categorias",
        "dublado","legendado"]){
        if([kind+" "+service,service+" "+kind,kind+" - "+service,service+" - "+kind].includes(textValue))
          return option;
      }
      // Some providers use decorative badges between the category and source.
      if(textValue.endsWith(" "+service)){
        const prefix=textValue.slice(0,-service.length).replace(/[-–—\s]+$/g,"");
        if(KIND.test(prefix))return option;
      }
    }
  }
  return "";
}
function findPlatform(item){
  const explicit=cleanToken(item?.platform||item?.provider||"");
  if(explicit)return explicit;
  return findFromGroup(item?.group,KNOWN_PLATFORMS)||PLATFORM_UNKNOWN;
}
function findGenre(item){
  const explicit=cleanToken(item?.genre||item?.category||"");
  if(explicit)return explicit;
  return findFromGroup(item?.group,GENRES)||GENRE_UNKNOWN;
}
// Fallback categories are taken literally from the provider's own group-title.
// They are not relabeled as streaming platforms.
export function lgSourceCategory(item){
  const groups=tokens(item?.group||"");
  const relevant=groups.filter(part=>!KIND.test(part) && !matches(part,KNOWN_PLATFORMS));
  if(!relevant.length)return CATEGORY_UNKNOWN;
  return relevant[relevant.length-1].slice(0,90);
}
export function lgSourceBucket(item){
  const platform=findPlatform(item);
  if(platform!==PLATFORM_UNKNOWN)return platform;
  const category=lgSourceCategory(item);
  return category===CATEGORY_UNKNOWN?PLATFORM_UNKNOWN:CATEGORY_PREFIX+category;
}
export function lgIsCategoryBucket(label){return String(label||"").startsWith(CATEGORY_PREFIX);}
export {CATEGORY_PREFIX};
export function lgSeriesTitle(title){
  const value=text(title).replace(/^\s*(?:\[24H\]\s*)/i,"");
  const pattern=/(?:^|[\s._–-])(?:s(?:eason)?\s*\d{1,3}[\s._-]*e(?:p(?:is[oó]dio)?)?\s*\d{1,3}|\d{1,3}\s*x\s*\d{1,3}|t(?:emporada)?\s*\d{1,3}\s*[-._ ]*\s*(?:e|ep|epis[oó]dio)\s*\d{1,3})(?:\b|(?=[\s._-]))/i;
  const match=pattern.exec(value);
  const base=match?value.slice(0,match.index):value;
  return (base.replace(/\s*[\[(](?:L|D|LEG|DUB|FHD|HD)[\])]\s*$/i,"").replace(/[-–._\s]+$/g,"").trim()||value);
}

export const lgPlatform=item=>findPlatform(item);
export const lgGenre=item=>findGenre(item);
export {PLATFORM_UNKNOWN,GENRE_UNKNOWN};

export function lgFacetsFrom(items, field) {
  const counts=new Map();
  for(const item of items) {
    const label=field(item);
    counts.set(label,(counts.get(label)||0)+1);
  }
  return [...counts.entries()].map(([key,count])=>({key,label:key,count}))
    .sort((a,b)=>{
      const unknown=x=>/^(?:plataforma|gênero) não informad[ao]$/i.test(x.label);
      if(unknown(a)!==unknown(b))return unknown(a)?1:-1;
      return a.label.localeCompare(b.label,"pt-BR",{numeric:true,sensitivity:"base"});
    });
}

// Indexes stay cached while a playlist array remains unchanged. Never store the
// index in localStorage/IndexedDB; it is derived from the currently allowed items.
let indexCache=new WeakMap();
export function invalidateLgBrowserIndex(items){
  if(Array.isArray(items))indexCache.delete(items);
  else indexCache=new WeakMap();
}
function indexFor(items){
  const list=Array.isArray(items)?items:[];
  let index=indexCache.get(list);
  if(!index){
    index={items:list,live:null,movies:null,series:null};
    indexCache.set(list,index);
  }
  return index;
}
const facetSort=(a,b)=>a.label.localeCompare(b.label,"pt-BR",{numeric:true,sensitivity:"base"});
const isUnknown=label=>label===PLATFORM_UNKNOWN||label===GENRE_UNKNOWN;
function facetsFromMap(map){
  return [...map.entries()].map(([key,values])=>({key,label:key,count:Array.isArray(values)?values.length:values}))
    .sort((a,b)=>isUnknown(a.key)!==isUnknown(b.key)?isUnknown(a.key)?1:-1:facetSort(a,b));
}
function indexLive(index){
  if(index.live)return index.live;
  const byPlatform=new Map();
  for(const item of index.items){
    if(item.type!=="live")continue;
    const platform=lgSourceBucket(item);
    if(!byPlatform.has(platform))byPlatform.set(platform,[]);
    byPlatform.get(platform).push(item);
  }
  for(const channels of byPlatform.values())channels.sort((a,b)=>
    a.title.localeCompare(b.title,"pt-BR",{numeric:true}));
  index.live={byPlatform,platforms:facetsFromMap(byPlatform)};
  return index.live;
}
function indexMovies(index){
  if(index.movies)return index.movies;
  const byGenre=new Map();
  for(const item of index.items){
    if(item.type!=="movies")continue;
    const genre=lgGenre(item),platform=lgPlatform(item);
    if(!byGenre.has(genre))byGenre.set(genre,new Map());
    const byPlatform=byGenre.get(genre);
    if(!byPlatform.has(platform))byPlatform.set(platform,[]);
    byPlatform.get(platform).push(item);
  }
  const genres=[...byGenre.entries()].map(([key,platforms])=>({
    key,label:key,count:[...platforms.values()].reduce((sum,arr)=>sum+arr.length,0)
  })).sort((a,b)=>isUnknown(a.key)!==isUnknown(b.key)?isUnknown(a.key)?1:-1:facetSort(a,b));
  index.movies={byGenre,genres};
  return index.movies;
}
export function lgEpisodeParts(item){
  const title=String(typeof item==="string"?item:item?.title||"");
  const match=/(?:^|[\s._–-])s(\d{1,3})[\s._-]*e(?:p(?:is[oó]dio)?)?\s*(\d{1,3})/i.exec(title) ||
    /(?:^|[\s._–-])(\d{1,3})\s*x\s*(\d{1,3})/i.exec(title) ||
    /(?:^|[\s._–-])t(?:emporada)?\s*(\d{1,3})[\s._-]*(?:e|ep|epis[oó]dio)\s*(\d{1,3})/i.exec(title);
  return match?{season:Number(match[1]),episode:Number(match[2])}:null;
}
function episodeNumber(ep){
  const info=lgEpisodeParts(ep);
  return info?info.season*1000+info.episode:null;
}
function indexSeries(index){
  if(index.series)return index.series;
  const groups=new Map();
  const byPlatform=new Map();
  for(const ep of index.items){
    if(ep.type!=="series")continue;
    const platform=lgSourceBucket(ep),title=lgSeriesTitle(ep.title);
    const key=norm(platform)+"|"+norm(title);
    if(!groups.has(key)){
      const show={key,title,type:"series",platform,group:ep.group,logo:ep.logo,episodes:[],url:ep.url};
      groups.set(key,show);
      if(!byPlatform.has(platform))byPlatform.set(platform,[]);
      byPlatform.get(platform).push(show);
    }
    const show=groups.get(key);
    if(!show.logo&&ep.logo)show.logo=ep.logo;
    show.episodes.push(ep);
  }
  for(const show of groups.values()){
    show.episodes.sort((a,b)=>{
      const A=episodeNumber(a),B=episodeNumber(b);
      return A===null&&B===null?0:A===null?1:B===null?-1:A-B;
    });
  }
  for(const shows of byPlatform.values())shows.sort((a,b)=>a.title.localeCompare(b.title,"pt-BR",{numeric:true}));
  const all=[...groups.values()].sort((a,b)=>a.title.localeCompare(b.title,"pt-BR",{numeric:true}));
  index.series={all,byPlatform,platforms:facetsFromMap(byPlatform)};
  return index.series;
}
export function lgSeriesGroups(items){return indexSeries(indexFor(items)).all;}
export function lgBrowseModel(route,all,guide,{platform="",channel="",genre="",series=""}={}){
  const index=indexFor(all);
  if(route==="live"){
    const source=indexLive(index);
    const platforms=source.platforms;
    const activePlatform=source.byPlatform.has(platform)?platform:platforms[0]?.key||"";
    const channels=source.byPlatform.get(activePlatform)||[];
    const activeChannel=channels.some(c=>c.url===channel)?channel:channels[0]?.url||"";
    const selected=channels.find(c=>c.url===activeChannel)||null;
    return {route,platforms,channels,platform:activePlatform,channel:activeChannel,selected,
      schedule:lgEpgForChannel(selected,guide)};
  }
  if(route==="movies"){
    const source=indexMovies(index);
    const genres=source.genres;
    const activeGenre=source.byGenre.has(genre)?genre:genres[0]?.key||"";
    const byPlatform=source.byGenre.get(activeGenre)||new Map();
    const platforms=facetsFromMap(byPlatform);
    const activePlatform=byPlatform.has(platform)?platform:platforms[0]?.key||"";
    const movies=byPlatform.get(activePlatform)||[];
    return {route,genres,platforms,genre:activeGenre,platform:activePlatform,movies};
  }
  if(route==="series"){
    const source=indexSeries(index);
    const platforms=source.platforms;
    const activePlatform=source.byPlatform.has(platform)?platform:platforms[0]?.key||"";
    const shows=source.byPlatform.get(activePlatform)||[];
    const activeSeries=shows.some(p=>p.key===series)?series:shows[0]?.key||"";
    const selected=shows.find(p=>p.key===activeSeries)||null;
    return {route,platforms,shows,platform:activePlatform,series:activeSeries,selected,episodes:selected?.episodes||[]};
  }
  throw Error("Unsupported LG route");
}

// Index XMLTV by channel once per imported guide instead of scanning the
// entire guide for every selected channel on a low-power webOS TV.
const epgCache=new WeakMap();
const guideCanon=value=>String(value||"").normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR")
  .replace(/[^a-z0-9]+/g," ").trim();
function withoutTransmissionSuffix(title){
  let value=String(title||"").replace(/^\[(?:24H|AO VIVO)\]\s*/i,"").trim();
  const previous=()=>value;
  const suffix=/(?:\s+(?:FHD|HD|SD|UHD|4K|8K|HEVC|H[.\s-]?265|H[.\s-]?264|ALT)|\s*[\[(](?:FHD|HD|SD|UHD|4K|8K|HEVC|H[.\s-]?265|H[.\s-]?264|ALT)[\])])\s*$/i;
  let before;
  do{before=previous();value=value.replace(suffix,"").trim();}while(value!==before);
  return value;
}

function indexGuide(guide){
  let index=epgCache.get(guide);
  if(index)return index;
  const programs=new Map(),names=new Map();
  for(const program of guide.programs||[]){
    if(!program.channel)continue;
    if(!programs.has(program.channel))programs.set(program.channel,[]);
    programs.get(program.channel).push(program);
  }
  for(const list of programs.values())list.sort((a,b)=>a.start-b.start);
  for(const ch of guide.channels||[]){
    const key=guideCanon(ch.name);
    if(!key)continue;
    if(!names.has(key))names.set(key,[]);
    names.get(key).push(ch.id);
  }
  index={programs,names};
  epgCache.set(guide,index);
  return index;
}
function lgEpgForChannel(item,guide,now=Date.now()){
  if(!item||!guide?.programs?.length)return {now:null,next:[],status:"no-guide"};
  const source=indexGuide(guide);
  let id=String(item.tvgId||"").trim();
  if(!id||!source.programs.has(id)){
    const exact=source.names.get(guideCanon(item.title))||[];
    if(exact.length===1)id=exact[0];
    else if(exact.length===0){
      // LG source titles often append "FHD [H265]". Strip only explicit
      // quality suffixes; never guess an unrelated channel by fuzzy matching.
      const stripped=withoutTransmissionSuffix(item.title);
      const candidates=source.names.get(guideCanon(stripped))||[];
      id=candidates.length===1?candidates[0]:"";
    }else id="";
  }
  if(!id)return {now:null,next:[],status:"no-channel"};
  const channel=source.programs.get(id)||[];
  let current=null,upcoming=[];
  for(const p of channel){
    if(p.stop<=now)continue;
    if(p.start<=now && now<p.stop){if(!current)current=p;}
    else if(p.start>now){upcoming.push(p);if(upcoming.length>=15)break;}
  }
  return {now:current,next:upcoming,status:"ok"};
}
export {lgEpgForChannel};

export function lgMatchSchedule(matches,now=Date.now(),limit=5){
  // The EPG parser already ignores programmes finished more than an hour ago.
  // Avoid publishing future matches without a real channel mapping.
  return (matches||[]).filter(x=>x.channel?.type==="live" && x.program?.stop>now-3600000)
    .slice(0,limit).map(match=>({
      ...match,
      status:match.isReprise?"REPRISE":match.program.start<=now&&match.program.stop>now?"AO VIVO":
        match.program.stop<=now?"ENCERRADO":"EM BREVE"
    }));
}
