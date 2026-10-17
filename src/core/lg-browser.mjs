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
const tokens=group=>text(group).split(/\s*(?:\||\/|›|»| > | :: | : )\s*/).map(x=>x.trim()).filter(Boolean);
const common=/^(canais?|ao vivo|live|live tv|filmes?|movies?|vod|s[eé]ries?|series|tv shows|tv|uhd|4k|fhd|hd|sd)$/i;
function matches(candidate,options) {
  const value=norm(candidate);
  return options.find(x=>norm(x)===value) || "";
}
function findPlatform(item) {
  const explicit=text(item?.platform || item?.provider || "");
  if(explicit)return explicit;
  const group=tokens(item?.group);
  for(const g of group){const p=matches(g,KNOWN_PLATFORMS);if(p)return g;}
  // A compound label such as "NETFLIX | Séries" is still source metadata.
  // No fuzzy matching from title — a movie name can mention a streaming service.
  // Do not turn generic channel genres such as "ESPORTES" into a platform.
  // A platform is shown only when the M3U names a recognized provider or
  // explicitly supplies the provider/platform attribute.
  return PLATFORM_UNKNOWN;
}
function findGenre(item) {
  const explicit=text(item?.genre || item?.category || "");
  if(explicit)return explicit;
  for(const g of tokens(item?.group)){const found=matches(g,GENRES);if(found)return g;}
  return GENRE_UNKNOWN;
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
    .sort((a,b)=>a.label.localeCompare(b.label,"pt-BR",{numeric:true,sensitivity:"base"}));
}

export function lgSeriesGroups(items) {
  const result=new Map();
  for(const episode of items.filter(i=>i.type==="series")){
    const platform=lgPlatform(episode),title=seriesTitle(episode.title);
    const key=norm(platform)+"|"+norm(title);
    if(!result.has(key))result.set(key,{
      key, title, type:"series",platform,group:episode.group,logo:episode.logo,
      episodes:[],url:episode.url
    });
    const s=result.get(key);
    if(!s.logo && episode.logo)s.logo=episode.logo;
    s.episodes.push(episode);
  }
  const episodeNumber=e=>{
    const a=/(?:^|[\s._-])s(\d{1,3})[\s._-]*e(\d{1,3})/i.exec(e.title) ||
      /(?:^|[\s._-])(\d{1,3})x(\d{1,3})/i.exec(e.title);
    return a?Number(a[1])*1000+Number(a[2]):null;
  };
  for(const entry of result.values()){
    entry.episodes.sort((a,b)=>{
      const A=episodeNumber(a),B=episodeNumber(b);
      return A===null&&B===null?0:A===null?1:B===null?-1:A-B;
    });
  }
  return [...result.values()].sort((a,b)=>a.title.localeCompare(b.title,"pt-BR"));
}
export function lgBrowseModel(route,all,guide,{platform="",channel="",genre="",series=""}={}){
  const allowed=all||[];
  if(route==="live"){
    const content=allowed.filter(i=>i.type==="live");
    const platforms=lgFacetsFrom(content,lgPlatform);
    const activePlatform=platforms.some(p=>p.key===platform)?platform:platforms[0]?.key||"";
    const channels=content.filter(i=>lgPlatform(i)===activePlatform)
      .sort((a,b)=>a.title.localeCompare(b.title,"pt-BR",{numeric:true}));
    const activeChannel=channels.some(c=>c.url===channel)?channel:channels[0]?.url||"";
    const selected=channels.find(c=>c.url===activeChannel)||null;
    return {route,platforms,channels,platform:activePlatform,channel:activeChannel,selected,
      schedule:lgEpgForChannel(selected,guide)};
  }
  if(route==="movies"){
    const content=allowed.filter(i=>i.type==="movies");
    const genres=lgFacetsFrom(content,lgGenre);
    const activeGenre=genres.some(p=>p.key===genre)?genre:genres[0]?.key||"";
    const byGenre=content.filter(i=>lgGenre(i)===activeGenre);
    const platforms=lgFacetsFrom(byGenre,lgPlatform);
    const activePlatform=platforms.some(p=>p.key===platform)?platform:platforms[0]?.key||"";
    const movies=byGenre.filter(i=>lgPlatform(i)===activePlatform);
    return {route,genres,platforms,genre:activeGenre,platform:activePlatform,movies};
  }
  if(route==="series"){
    const groups=lgSeriesGroups(allowed);
    const platforms=lgFacetsFrom(groups,x=>x.platform);
    const activePlatform=platforms.some(p=>p.key===platform)?platform:platforms[0]?.key||"";
    const shows=groups.filter(g=>g.platform===activePlatform);
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
