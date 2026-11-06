import test from "node:test";
import assert from "node:assert/strict";
import {lgBrowseModel,lgPlatform,lgGenre,lgSourceCategory,lgSourceBucket,lgNormalizeGroupName,lgDisplayBucket,lgSeriesTitle,lgSeriesGroups,lgEpgForChannel,lgMatchSchedule,invalidateLgBrowserIndex,PLATFORM_UNKNOWN,GENRE_UNKNOWN} from "../src/core/lg-browser.mjs";
import {lgEpgMarkup,lgRail,lgMovieMarkup,lgEpisodesMarkup,lgFootballHomeMarkup} from "../src/core/lg-browser-view.mjs";

const E=String.raw;
const live=(title,group,id="")=>({title,group,tvgId:id,type:"live",url:"https://example.test/"+encodeURIComponent(title)+".m3u8"});
const film=(title,group)=>({title,group,type:"movies",url:"https://example.test/"+encodeURIComponent(title)+".mp4"});
const series=(title,group)=>({title,group,type:"series",url:"https://example.test/"+encodeURIComponent(title)+".mp4"});
test("LG platform/genre must originate in source metadata",()=>{
  assert.equal(lgPlatform(live("Sports HD","Canais | Esportes")),PLATFORM_UNKNOWN);
  assert.equal(lgPlatform(live("Canal HD","Globoplay")), "Globoplay");
  assert.equal(lgPlatform(film("Netflix the Movie","Filmes | Ação")),PLATFORM_UNKNOWN);
  assert.equal(lgGenre(film("Filme","Filmes | Ação | Netflix")),"Ação");
  assert.equal(lgGenre(film("Sem gênero","Filmes | Netflix")),GENRE_UNKNOWN);
  assert.equal(lgPlatform({type:"movies",platform:"Serviço fornecido no M3U",group:"Filmes"}),"Serviço fornecido no M3U");
});
test("LG live platform -> channels -> selected channel guide",()=>{
  const channels=[live("A","Globoplay","a"),live("B","Globoplay","b"),live("C","Pluto TV","c")];
  const start=Date.now()-2000,stop=Date.now()+90000;
  const guide={channels:[],programs:[{channel:"b",title:"Jornal ao vivo",start,stop},{channel:"b",title:"Próximo",start:stop,stop:stop+3600000}]};
  const result=lgBrowseModel("live",channels,guide,{platform:"Globoplay",channel:channels[1].url});
  assert.equal(result.platforms.length,2);
  assert.equal(result.channels.length,2);
  assert.equal(result.selected.title,"B");
  assert.equal(result.schedule.now.title,"Jornal ao vivo");
  assert.equal(result.schedule.next[0].title,"Próximo");
  assert.ok(lgEpgMarkup(result,()=>0).includes("Jornal ao vivo"));
  assert.ok(lgEpgMarkup(result,()=>0).includes("Tela cheia"));
});
test("LG movie genre -> platform -> filtered movies; no live leakage",()=>{
  const all=[film("F1","Filmes | Ação | Netflix"),film("F2","Filmes | Ação | Disney+"),film("F3","Filmes | Comédia | Netflix"),live("TV","Globoplay")];
  const result=lgBrowseModel("movies",all,null,{genre:"Ação",platform:"Netflix"});
  assert.deepEqual(result.movies.map(m=>m.title),["F1"]);
  assert.deepEqual(result.platforms.map(m=>m.key),["Disney+","Netflix"]);
  assert.ok(lgMovieMarkup(result,()=>"<div>Filme F1</div>").includes("Filme F1"));
});
test("LG series groups episodes per series and platform; sorts episode titles",()=>{
  const all=[series("Anime S01E02","Crunchyroll | Séries"),series("Anime S01E01","Crunchyroll | Séries"),
    series("Anime S01E01","Netflix | Séries"),film("Not an episode","Filmes")];
  const groups=lgSeriesGroups(all);
  assert.equal(groups.length,2);
  const result=lgBrowseModel("series",all,null,{platform:"Crunchyroll"});
  assert.equal(result.shows.length,1);
  assert.deepEqual(result.episodes.map(e=>e.title),["Anime S01E01","Anime S01E02"]);
  assert.ok(lgEpisodesMarkup(result,()=>0,"",false).includes("Anime S01E02"));
});
test("LG football home cards rely on real channel mapping and retain exact URL",()=>{
  const channel=live("Sports Channel","Globoplay");
  const start=Date.now()+5*60_000,stop=start+120*60_000;
  const games=lgMatchSchedule([{home:"Clube A",away:"Clube B",channel,program:{start,stop},isReprise:false},
    {home:"No channel",away:"Test",program:{start,stop}}]);
  assert.equal(games.length,1);
  let selected=null;
  const html=lgFootballHomeMarkup(games,item=>{selected=item;return 8;});
  assert.equal(selected.url,channel.url);
  assert.ok(html.includes('data-index="8"'));
  assert.ok(html.includes("Clube A"));
  assert.ok(html.includes("EM BREVE"));
  assert.equal(html.includes("No channel"),false);
});
test("LG helpers escape M3U names before HTML insertion",()=>{
  const escape=v=>String(v).replace(/</g,"&lt;").replace(/"/g,"&quot;");
  assert.equal(lgRail({title:"Plat",subtitle:"",items:[{key:"x",label:"Test <script>"}],selectedKey:"x",action:"lg-filter",kind:"first",focusPrefix:"lg-first"}).includes("<script>"),false);
  assert.equal(lgFootballHomeMarkup([{home:'<img src=x>',away:"B",channel:live("Channel","Globoplay"),program:{start:Date.now(),stop:Date.now()+100000},status:"AO VIVO"}],()=>0).includes("<img src=x>"),false);
});

test("LG recognizes decorated provider groups actually supplied by M3U",()=>{
  const ep=series("(A)mar S01E01","♦ Netflix");
  const crunchy=series("Jujutsu Kaisen S01E01","✦ Crunchyroll");
  const marvel=film("Aventura VOD","FILMES | ✦ Disney+");
  assert.equal(lgPlatform(ep),"Netflix");
  assert.equal(lgPlatform(crunchy),"Crunchyroll");
  assert.equal(lgPlatform(marvel),"Disney+");
  const groups=lgSeriesGroups([ep,crunchy]);
  assert.deepEqual(groups.map(g=>g.platform).sort(),["Crunchyroll","Netflix"]);
});
test("LG prefers genuine platform and genre over unclassified bucket in first column",()=>{
  const all=[
    film("Sem gênero","Filmes"),
    film("Drama 1","Filmes | Drama | Netflix"),
    film("Ação 1","Filmes | Ação | Netflix")
  ];
  const m=lgBrowseModel("movies",all,null,{});
  assert.equal(m.genre,"Ação");
  assert.equal(m.platform,"Netflix");
  assert.deepEqual(m.movies.map(x=>x.title),["Ação 1"]);
  assert.equal(m.genres.at(-1).label,GENRE_UNKNOWN);
});
test("LG rail searches full list before limiting DOM rows",()=>{
  const source=Array.from({length:450},(_,i)=>({key:String(i),label:"Série número "+i}));
  const html=lgRail({title:"Séries",subtitle:"",items:source,selectedKey:"449",action:"lg-filter",
    kind:"second",focusPrefix:"lg-second",query:"449",limit:30});
  assert.ok(html.includes("Série número 449"));
  assert.equal(html.includes("Série número 448"),false);
  assert.ok(html.includes('data-row="449"'));
});
test("LG legacy unknown sources remain accessible for manual classification",()=>{
  const items=[film("Only one","Filmes | Netflix"),live("Canal", "Canais")];
  const model=lgBrowseModel("movies",items,null,{});
  assert.equal(model.movies.length,1);
  assert.equal(model.movies[0].title,"Only one");
});

test("LG large series catalog is indexed once and reused during repeated navigation",()=>{
  const items=Array.from({length:12000},(_,i)=>series("Programa "+(i%400)+" S01E"+String(Math.floor(i/400)+1).padStart(2,"0"),"Séries | Netflix"));
  const first=lgBrowseModel("series",items,null,{platform:"Netflix"});
  const second=lgBrowseModel("series",items,null,{platform:"Netflix",series:first.shows[399].key});
  assert.strictEqual(first.shows,second.shows);
  assert.equal(first.shows.length,400);
  assert.equal(second.episodes.length,30);
  assert.strictEqual(lgSeriesGroups(items),lgSeriesGroups(items));
  items.push(series("Nova Série S01E01","Séries | Netflix"));
  invalidateLgBrowserIndex(items);
  assert.equal(lgBrowseModel("series",items,null,{}).shows.length,401);
});
test("LG repeated live and film navigation reuses indexed categories",()=>{
  const all=[...Array.from({length:900},(_,i)=>live("C "+i,"Canais | Globoplay")),
    ...Array.from({length:1500},(_,i)=>film("F "+i,"Filmes | Ação | Netflix"))];
  const a=lgBrowseModel("live",all,null,{platform:"Globoplay"});
  const b=lgBrowseModel("live",all,null,{platform:"Globoplay",channel:a.channels[350].url});
  assert.strictEqual(a.channels,b.channels);
  assert.equal(a.channels.length,900);
  const m=lgBrowseModel("movies",all,null,{genre:"Ação",platform:"Netflix"});
  const m2=lgBrowseModel("movies",all,null,{genre:"Ação",platform:"Netflix"});
  assert.strictEqual(m.movies,m2.movies);
  assert.equal(m.movies.length,1500);
});
test("LG exact EPG index strips channel quality suffixes only when match is unique",()=>{
  const now=Date.now();
  const guide={channels:[{id:"canalbr",name:"Canal Brasil"}],
    programs:[{channel:"canalbr",title:"Programa Agora",start:now-120000,stop:now+120000},
      {channel:"canalbr",title:"Programa Depois",start:now+120000,stop:now+3600000}]};
  const result=lgEpgForChannel(live("Canal Brasil FHD [H265]","Canais"),guide,now);
  assert.equal(result.now.title,"Programa Agora");
  assert.equal(result.next[0].title,"Programa Depois");
  assert.equal(lgEpgForChannel(live("Canal Brasil HD [ALT]","Canais"),guide,now).status,"ok");
  assert.equal(lgEpgForChannel(live("Brasil TV HD","Canais"),guide,now).status,"no-channel");
  const duplicated={channels:[{id:"a",name:"Canal Brasil"},{id:"b",name:"Canal Brasil"}],
    programs:[{channel:"a",title:"A",start:now-100,stop:now+100},{channel:"b",title:"B",start:now-100,stop:now+100}]};
  assert.equal(lgEpgForChannel(live("Canal Brasil FHD","Canais"),duplicated,now).status,"no-channel");
});

test("LG metadata handles Unicode-decorated source platforms without taking them from titles",()=>{
  const cases=[
    ["♦ Netflix","Netflix"],
    ["✧ Netflix","Netflix"],
    ["✦ Crunchyroll","Crunchyroll"],
    ["♥ Disney+","Disney+"],
    ["SÉRIES | ✿ HBO Max","HBO Max"],
    ["SÉRIES - Prime Video","Prime Video"],
    ["✦ Apple TV+","Apple TV+"]
  ];
  for(const [group,expected] of cases){
    assert.equal(lgPlatform(series("Uma Série S01E01",group)),expected,group);
  }
  assert.equal(lgPlatform(series("Netflix: Documentário S01E01","Séries")),PLATFORM_UNKNOWN);
});

test("LG derives real group-title categories when no actual streaming service is provided",()=>{
  const entries=[
    live("Canal Esporte","Canais | Esportes"),
    live("Canal Notícias","Canais | Notícias"),
    live("Canal Sem Grupo","Canais"),
    series("Seriado A S01E01","Séries | Doramas"),
    series("Seriado B S01E01","Séries | Animação")
  ];
  assert.equal(lgPlatform(entries[0]),PLATFORM_UNKNOWN);
  assert.equal(lgSourceCategory(entries[0]),"Esportes");
  assert.equal(lgSourceCategory(entries[1]),"Notícias");
  assert.equal(lgSourceBucket(entries[0]),"Categoria da lista: Esportes");
  const liveModel=lgBrowseModel("live",entries,null,{});
  assert.deepEqual(liveModel.platforms.map(i=>i.key),
    ["Categoria da lista: Esportes","Categoria da lista: Notícias",PLATFORM_UNKNOWN]);
  assert.equal(liveModel.channels.length,1);
  const seriesModel=lgBrowseModel("series",entries,null,{});
  assert.deepEqual(seriesModel.platforms.map(i=>i.key),
    ["Categoria da lista: Animação","Categoria da lista: Doramas"]);
  assert.equal(seriesModel.shows.length,1);
});

test("LG series grouping normalizes spaced season markers and preserves separate show names",()=>{
  const episodes=[
    series("(A)mar S01E01","♦ Netflix"),
    series("(A)mar S01 E02","♦ Netflix"),
    series("(A)mar T01 Episódio 03","♦ Netflix"),
    series("(A)mar 1x04","♦ Netflix"),
    series("(A)mar S02.E01","♦ Netflix"),
    series("Amar S01E01","♦ Netflix"),
    series("Outra Série S01E01","♦ Netflix")
  ];
  assert.equal(lgSeriesTitle("(A)mar S01 E02"),"(A)mar");
  assert.equal(lgSeriesTitle("(A)mar T01 Episódio 03"),"(A)mar");
  assert.equal(lgSeriesTitle("(A)mar 1x04"),"(A)mar");
  const shows=lgSeriesGroups(episodes);
  assert.equal(shows.length,3);
  const amar=shows.find(x=>x.title==="(A)mar");
  assert.equal(amar.episodes.length,5);
  assert.equal(amar.platform,"Netflix");
  assert.ok(shows.some(x=>x.title==="Amar"));
  assert.ok(shows.some(x=>x.title==="Outra Série"));
});
test("LG does not present fake streaming platform when M3U provides only a generic category",()=>{
  const group="Canais | Desenhos 24H";
  const item=live("[24H] American Dad 09",group);
  assert.equal(lgPlatform(item),PLATFORM_UNKNOWN);
  assert.equal(lgSourceBucket(item),"Categoria da lista: Desenhos 24H");
});

test("LG category display drops technical prefix without losing distinct source key",()=>{
  const a=live("SPORTV FHD","Canais | ESPORTES");
  const b=live("SPORTV HD","Canais | Esportes");
  const result=lgBrowseModel("live",[a,b],null,{});
  assert.deepEqual(result.platforms.map(x=>x.key),["Categoria da lista: Esportes"]);
  assert.equal(result.channels.length,2);
  assert.equal(lgDisplayBucket(result.platforms[0].key),"Esportes");
  assert.equal(lgNormalizeGroupName("DOCUMENTÁRIOS"),"Documentários");
});
test("LG film source collections are derived only from real M3U groups",()=>{
  const filmOne=film("Aventura (2022)","Filmes | Drama | Sessão Brasileira");
  const filmTwo=film("Clássico (2014)","Filmes | Drama");
  const model=lgBrowseModel("movies",[filmOne,filmTwo],null,{genre:"Drama"});
  assert.equal(model.platforms.length,2);
  assert.deepEqual(model.platforms.map(x=>x.key),["Categoria da lista: Sessão Brasileira",PLATFORM_UNKNOWN]);
  assert.deepEqual(model.movies.map(x=>x.title),["Aventura (2022)"]);
});
