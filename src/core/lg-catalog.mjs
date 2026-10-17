// LG-specific M3U parser and classification with explicit evidence priority.
// The group name can be ambiguous (e.g. "FILMES E SÉRIES" contains live channels).
// Never classify a broadcaster as a movie solely because of that mixed category.
const EPISODE=/(?:^|[\s._-])(?:s\d{1,3}[\s._-]*e\d{1,3}|\d{1,3}x\d{1,3})(?=$|[\s._-])/i;
const LIVE_GROUP=/(?:^|[\s|/()[\]_-])(?:canais?|ao vivo|live tv|tv ao vivo|esportes?|noticias|notícias)(?:$|[\s|/()[\]_-])/i;
const SERIES_GROUP=/(?:^|[\s|/()[\]_-])(?:séries?|series|seriados|tv shows)(?:$|[\s|/()[\]_-])/i;
const MOVIE_GROUP=/(?:^|[\s|/()[\]_-])(?:filmes?|movies?|cinema|vod)(?:$|[\s|/()[\]_-])/i;
const CHANNEL_BRANDS=/^(?:a\s*&\s*e|amc|axn|band(?:\s+(?:news|sports?))?|bbc(?:\s+(?:news|earth|world))?|canal\s+brasil|discovery(?:\s+(?:channel|kids|science|turbo|world))?|animal\s+planet|record(?:\s+(?:news|tv))?|globo(?:news|play)?|sbt|cnn(?:\s+brasil)?|premiere(?:\s+\d+)?|sportv(?:\s+\d+)?|espn(?:\s+\d+)?|hbo(?:\s+\d+)?|tnt(?:\s+series)?|telecine(?:\s+\w+)?|multishow|viva|gnt|sony(?:\s+channel)?|warner(?:\s+channel)?|history(?:\s+channel)?|fox(?:\s+(?:sports?|life))?|national\s+geographic|nat\s+geo)(?=$|[\s([_-])/i;
const CHANNEL_VARIANT=/(?:^|[\s[(_-])(?:FHD|HD|SD|UHD|4K|8K|H[ .-]?265|H[ .-]?264|HEVC|ALT|SPORTS|NEWS)(?=$|[\s\])_-])/i;
const URL_LIVE=/(?:^|\/)live\//i,URL_MOVIE=/(?:^|\/)movie\//i,URL_SERIES=/(?:^|\/)series\//i;
function typeFor(item) {
  const group=String(item?.group||"");
  const title=String(item?.title||"");
  const url=String(item?.url||"");
  const isEpisode=EPISODE.test(title);
  if(isEpisode)return "series";
  // Structural evidence from user-provided URLs has priority over mixed group labels.
  if(URL_SERIES.test(url))return "series";
  if(URL_MOVIE.test(url))return "movies";
  if(URL_LIVE.test(url))return "live";
  const mixed=MOVIE_GROUP.test(group)&&SERIES_GROUP.test(group);
  const broadcast=CHANNEL_BRANDS.test(title) &&
    (CHANNEL_VARIANT.test(title) || LIVE_GROUP.test(group) || mixed || Boolean(item?.tvgId));
  if(broadcast)return "live";
  if(LIVE_GROUP.test(group)&&!MOVIE_GROUP.test(group)&&!SERIES_GROUP.test(group))return "live";
  if(mixed){
    // A direct movie-file extension is additional, source-supplied VOD evidence.
    if(/\.(?:mp4|mkv|avi|mov)(?:[?#]|$)/i.test(url))return "movies";
    // Unidentifiable formats must not leak channel brands into movie catalogues.
    return "unknown";
  }
  if(MOVIE_GROUP.test(group))return "movies";
  if(SERIES_GROUP.test(group))return "series";
  // Recognizable broadcast stations can be reported even without a group label.
  if(CHANNEL_BRANDS.test(title) && CHANNEL_VARIANT.test(title))return "live";
  return "unknown";
}
export function classifyLgItem(item){return typeFor(item);}
export function reclassifyLgItems(items){
  let corrected=0;
  for(const item of items||[]){
    const newType=typeFor(item);
    if(newType!==item.type){item.type=newType;corrected++;}
  }
  return corrected;
}
function unquotedComma(line){
  let quote="";
  for(let i=0;i<line.length;i++){
    if((line[i]==='"'||line[i]==="'") && (!quote||quote===line[i]))quote=quote?"":line[i];
    else if(line[i]===","&&!quote)return i;
  }
  return -1;
}
export function parseLgM3U(text){
  if(typeof text!=="string"||!text.trimStart().startsWith("#EXTM3U"))
    throw Error("A playlist precisa começar com #EXTM3U.");
  const items=[];
  let pending=null,groupOverride="",declared=0,invalid=0;
  const first=text.split(/\r?\n/,1)[0];
  const guideUrl=/(?:x-tvg-url|url-tvg)=["']([^"']*)["']/i.exec(first)?.[1]||"";
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(line.startsWith("#EXTINF:")){
      declared++;
      const split=unquotedComma(line);
      const metadata=split<0?line:line.slice(0,split);
      const attrs={};
      for(const x of metadata.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
        attrs[x[1].toLowerCase()]=x[2]??x[3];
      pending={
        title:(split<0?"":line.slice(split+1)).trim()||attrs["tvg-name"]||"Sem título",
        group:attrs["group-title"]||groupOverride||"",
        logo:attrs["tvg-logo"]||"",
        tvgId:attrs["tvg-id"]||"",
        tvgName:attrs["tvg-name"]||"",
        platform:attrs["platform"]||attrs["provider"]||attrs["stream-provider"]||"",
        genre:attrs["genre"]||attrs["category"]||""
      };
      groupOverride="";
    }else if(line.startsWith("#EXTGRP:")){
      const group=line.slice(8).trim();
      if(pending&&!pending.group)pending.group=group;
      else groupOverride=group;
    }else if(pending&&line&&!line.startsWith("#")){
      try{
        const url=new URL(line);
        if(!["http:","https:"].includes(url.protocol))throw Error("unsupported");
        const item={...pending,url:line,type:"unknown"};
        item.type=typeFor(item);
        items.push(item);
      }catch{invalid++;}
      pending=null;
    }
  }
  if(pending)invalid++;
  return {items,count:items.length,declared,invalid,guideUrl};
}
export function auditLgCatalog(items){
  const result={all:0,live:0,movies:0,series:0,unknown:0,episodes:0};
  for(const it of items||[]){
    result.all++;
    if(it.type==="live")result.live++;
    else if(it.type==="movies")result.movies++;
    else if(it.type==="series"){result.episodes++;result.series++;}
    else result.unknown++;
  }
  return result;
}


// Keep day-old entries offline but update metadata for streams still present.
// The original shared merger only appended URLs and left corrected M3U labels stale.
export function mergeLgPlaylist(oldItems,newItems){
  const list=[],positions=new Map();
  for(const item of oldItems||[]){
    if(!item?.url || positions.has(item.url))continue;
    positions.set(item.url,list.length);
    list.push({...item});
  }
  let added=0,updated=0;
  for(const item of newItems||[]){
    if(!item?.url)continue;
    if(positions.has(item.url)){
      const pos=positions.get(item.url);
      const old=list[pos];
      const merged={...old,...item,
        logo:item.logo||old.logo,
        tvgId:item.tvgId||old.tvgId,
        platform:item.platform||old.platform,
        genre:item.genre||old.genre
      };
      merged.type=typeFor(merged);
      list[pos]=merged;
      updated++;
    }else{
      const entry={...item,type:typeFor(item)};
      positions.set(item.url,list.length);
      list.push(entry);added++;
    }
  }
  return {items:list,added,updated};
}
