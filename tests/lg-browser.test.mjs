import test from "node:test";
import assert from "node:assert/strict";
import {lgBrowseModel,lgPlatform,lgGenre,lgSeriesGroups,lgEpgForChannel,lgMatchSchedule,PLATFORM_UNKNOWN,GENRE_UNKNOWN} from "../src/core/lg-browser.mjs";
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
  assert.ok(lgEpgMarkup(result,()=>0).includes("Assistir canal"));
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
