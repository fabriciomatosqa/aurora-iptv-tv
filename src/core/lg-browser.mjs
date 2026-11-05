// LG webOS-only three-column browser data model.
// Nothing here invents a provider, genre, game, channel, or programme.
// Every platform/genre must originate in M3U metadata; otherwise use an honest fallback.
import {seriesTitle} from "./playlist.mjs";
import {matchGuideChannel} from "./epg.mjs";

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
const GENRE_UNKNOWN="Gênero não informado";
const text=value=>String(value??"").trim();
const norm=value=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
const cleanToken=value=>text(value)
  .replace(/^[\s\u2666\u25c6\u2726\u2727\u2605\u2606\u2022\u00b7+\-|:\/]+/g,"")
  .replace(/[\s\u2666\u25c6\u2726\u2727\u2605\u2606\u2022\u00b7|:\/]+$/g,"").trim();
const tokens=group=>text(group)
  .split(/\s*(?:\||\/|›|»| > | :: | : )\s*/)
  .map(cleanToken).filter(Boolean);
function matches(candidate,options){
  const value=norm(cleanToken(candidate));
  return options.find(x=>norm(x)===value)||"";
}
function findFromGroup(group,options) {
  for(const segment of tokens(group)){
    const direct=matches(segment,options);
    if(direct)return direct;
    // Metadata strings such as "SÉRIES NETFLIX" or "NETFLIX - SÉRIES".
    // Only accept an exact known platform/genre after removing a category label.
    const bare=norm(segment).replace(/[()[\]]/g," ").replace(/\s+/g," ").trim();
    const kinds=["filmes","filme","movies","movie","vod","series","serie","canais","canal",
      "ao vivo","live tv","plataforma","plataformas","generos","genero","categoria","categorias"];
    for(const option of options) {
      const label=norm(option);
      for(const kind of kinds){
        if(bare===kind+" "+label || bare===label+" "+kind ||
           bare===kind+" - "+label || bare===label+" - "+kind)return option;
      }
    }
  }
  return "";
}
function findPlatform(item) {
  const explicit=cleanToken(item?.platform||item?.provider||"");
  if(explicit)return explicit;
  // Never extract a streaming provider from the title of a movie or episode.
  return findFromGroup(item?.group,KNOWN_PLATFORMS)||PLATFORM_UNKNOWN;
}
function findGenre(item) {
  const explicit=cleanToken(item?.genre||item?.category||"");
  if(explicit)return explicit;
  return findFromGroup(item?.group,GENRES)||GENRE_UNKNOWN;
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
    const platform=lgPlatform(item);
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
function episodeNumber(e){
  const a=/(?:^|[\s._-])s(\d{1,3})[\s._-]*e(\d{1,3})/i.exec(e.title) ||
    /(?:^|[\s._-])(\d{1,3})x(\d{1,3})/i.exec(e.title);
  return a?Number(a[1])*1000+Number(a[2]):null;
}
function indexSeries(index){
  if(index.series)return index.series;
  const groups=new Map();
  const byPlatform=new Map();
  for(const ep of index.items){
    if(ep.type!=="series")continue;
    const platform=lgPlatform(ep),title=seriesTitle(ep.title);
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

function lgEpgForChannel(item,guide,now=Date.now()){
  if(!item || !guide?.programs?.length)return {now:null,next:[],status:"no-guide"};
  const id=matchGuideChannel(item,guide);
  if(!id)return {now:null,next:[],status:"no-channel"};
  const future=guide.programs.filter(x=>x.channel===id && x.stop>now).sort((a,b)=>a.start-b.start);
  return {now:future.find(x=>x.start<=now&&now<x.stop)||null,next:future.filter(x=>x.start>now).slice(0,15),status:"ok"};
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
