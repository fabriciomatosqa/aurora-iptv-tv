import test from "node:test";
import assert from "node:assert/strict";
import {parseLgM3U,reclassifyLgItems,auditLgCatalog,mergeLgPlaylist,classifyLgItem,dedupeLgItems,lgUnknownGroupSummary} from "../src/core/lg-catalog.mjs";
const prefix="#EXTM3U\n";
test("LG importer never caps entries at 180",()=>{
  const rows=[];
  for(let i=0;i<1003;i++)rows.push('#EXTINF:-1 group-title="Canais",Canal '+i+'\nhttps://example.test/'+i+'.m3u8');
  const parsed=parseLgM3U(prefix+rows.join("\n"));
  assert.equal(parsed.count,1003);
  assert.equal(parsed.invalid,0);
  assert.equal(parsed.declared,1003);
});
test("LG correctly reclassifies channel-like cards labeled as Séries without touching real episodes",()=>{
  const items=[
    {title:"A&E FHD [ALT]",group:"Série",type:"series"},
    {title:"AMC SD",group:"Series",type:"series"},
    {title:"Minha Série S01E02 FHD",group:"Série",type:"series"},
    {title:"Filme 4K",group:"Filmes",type:"movies"},
    {title:"Sem formato",group:"Série",type:"series"}
  ];
  assert.equal(reclassifyLgItems(items),2);
  assert.deepEqual(items.map(x=>x.type),["live","live","series","movies","series"]);
});
test("LG M3U supports an attribute containing a comma and EXTGRP",()=>{
  const parsed=parseLgM3U(prefix+
    '#EXTINF:-1 tvg-name="Um, dois" tvg-id="x",Canal Correto\n#EXTGRP:Canais\nhttps://example.test/channel.m3u8\n');
  assert.equal(parsed.items[0].title,"Canal Correto");
  assert.equal(parsed.items[0].group,"Canais");
  assert.equal(parsed.items[0].type,"live");
});
test("LG exposes invalid URL count instead of silently treating it as imported",()=>{
  const parsed=parseLgM3U(prefix+'#EXTINF:-1 group-title="Canais",Válido\nhttps://example.test/ok\n'+
    '#EXTINF:-1 group-title="Canais",Inválido\njavascript:alert(1)\n');
  assert.equal(parsed.count,1);
  assert.equal(parsed.declared,2);
  assert.equal(parsed.invalid,1);
  assert.equal(auditLgCatalog(parsed.items).all,1);
});

test("LG mixed Filmes e Séries category never turns obvious live stations into films",()=>{
  const text='#EXTM3U\n'+
    '#EXTINF:-1 group-title="FILMES E SÉRIES" tvg-logo="https://example.test/ae.png",A&E FHD [ALT]\nhttps://example.test/ae.m3u8\n'+
    '#EXTINF:-1 group-title="FILMES E SÉRIES",AMC HD\nhttps://example.test/amc.m3u8\n'+
    '#EXTINF:-1 group-title="FILMES E SÉRIES",AXN SD\nhttps://example.test/axn.m3u8\n'+
    '#EXTINF:-1 group-title="FILMES E SÉRIES",Meu Filme Original\nhttps://example.test/movie/100.mp4\n'+
    '#EXTINF:-1 group-title="FILMES E SÉRIES",Minha Série S01E01\nhttps://example.test/series/1.mp4\n'+
    '#EXTINF:-1 group-title="FILMES E SÉRIES",Título ambíguo\nhttps://example.test/stream.m3u8\n';
  const parsed=parseLgM3U(text);
  assert.deepEqual(parsed.items.map(i=>i.type),["live","live","live","movies","series","unknown"]);
  assert.equal(auditLgCatalog(parsed.items).live,3);
  assert.equal(auditLgCatalog(parsed.items).unknown,1);
});
test("LG preserves optional genuine M3U provider/genre metadata",()=>{
  const result=parseLgM3U('#EXTM3U\n#EXTINF:-1 group-title="Filmes" provider="Netflix" genre="Ação",Aventura\nhttps://example.test/m.mp4\n');
  assert.equal(result.items[0].platform,"Netflix");
  assert.equal(result.items[0].genre,"Ação");
});
test("LG legacy cache is reclassified without changing URLs or favorite identity",()=>{
  const items=[{url:"https://example.test/amc.m3u8",group:"FILMES E SÉRIES",title:"AMC FHD",type:"movies"}];
  assert.equal(reclassifyLgItems(items),1);
  assert.equal(items[0].type,"live");
  assert.equal(items[0].url,"https://example.test/amc.m3u8");
});
test("LG refresh replaces old metadata for identical URLs and retains offline entries",()=>{
  const old=[{url:"https://example.test/ch",title:"AMC HD",group:"FILMES E SÉRIES",type:"movies",logo:"https://example.test/old.png"},
    {url:"https://example.test/offline",title:"Offline",group:"Canais",type:"live"}];
  const recent=[{url:"https://example.test/ch",title:"AMC FHD",group:"Canais | Globoplay",type:"live",logo:"",tvgId:"amc"},
    {url:"https://example.test/new",title:"Novo Canal",group:"Canais",type:"live"}];
  const merged=mergeLgPlaylist(old,recent);
  assert.equal(merged.added,1);
  assert.equal(merged.updated,1);
  assert.equal(merged.items.length,3);
  assert.equal(merged.items[0].title,"AMC FHD");
  assert.equal(merged.items[0].tvgId,"amc");
  assert.equal(merged.items[0].logo,"https://example.test/old.png");
  assert.equal(merged.items[1].title,"Offline");
});

test("LG initial M3U import ignores duplicate URLs and reports the count",()=>{
 const src='#EXTM3U\n#EXTINF:-1 group-title="Canais",Canal Um\nhttps://example.test/stream.m3u8\n'+
   '#EXTINF:-1 group-title="Filmes",Outra etiqueta para o mesmo URL\nhttps://example.test/stream.m3u8\n'+
   '#EXTINF:-1 group-title="Filmes",Filme\nhttps://example.test/movie/123.mp4\n';
 const result=parseLgM3U(src);
 assert.equal(result.declared,3);
 assert.equal(result.count,2);
 assert.equal(result.duplicates,1);
 assert.equal(result.invalid,0);
 assert.deepEqual(result.items.map(x=>x.type),["live","movies"]);
});
test("LG large M3U parser preserves all 12,000 distinct entries without truncation",()=>{
 const src=['#EXTM3U'];
 for(let i=0;i<12000;i++)src.push(
   '#EXTINF:-1 tvg-id="C'+i+'" group-title="Canais",Canal '+i,
   'https://example.test/live/'+i+'.m3u8');
 const parsed=parseLgM3U(src.join('\r\n'));
 assert.equal(parsed.count,12000);
 assert.equal(parsed.declared,12000);
 assert.equal(parsed.duplicates,0);
 assert.equal(parsed.items.at(-1).title,"Canal 11999");
});
test("LG identical daily refresh has zero changes and does not require a catalog rewrite",()=>{
 const base=[{url:"https://example.test/live/1",title:"C1",group:"Canais",
   type:"live",logo:"",tvgId:"",platform:"",genre:""}];
 const result=mergeLgPlaylist(base,base.map(i=>({...i})));
 assert.equal(result.added,0);
 assert.equal(result.changed,0);
 assert.equal(result.updated,1);
 assert.deepEqual(result.items,base);
 assert.strictEqual(base[0].title,"C1");
 const modified=mergeLgPlaylist(base,[{...base[0],logo:"https://example.test/logo.png"}]);
 assert.equal(modified.changed,1);
 assert.equal(modified.added,0);
 assert.equal(modified.items[0].logo,"https://example.test/logo.png");
});

test("LG migration deduplicates old cache but never alters favorite/position URL",()=>{
  const older=[
    {url:"https://example.test/one",title:"A",type:"live",group:"Canais"},
    {url:"https://example.test/one",title:"A duplicado",type:"live",group:"Canais"},
    {url:"https://example.test/two",title:"B",type:"live",group:"Canais"}
  ];
  const result=dedupeLgItems(older);
  assert.equal(result.removed,1);
  assert.equal(result.items.length,2);
  assert.equal(result.items[0].url,older[0].url);
  assert.equal(result.items[1].url,older[2].url);
  assert.equal(older.length,3);
  assert.strictEqual(dedupeLgItems(result.items).items,result.items);
});

test("LG [24H] broadcasts are live even when their source group says Séries",()=>{
  const text=[
    "#EXTM3U",
    '#EXTINF:-1 group-title="Séries | ♦ Netflix",[24H] American Dad 09',
    "https://example.test/linear-american-dad.m3u8",
    '#EXTINF:-1 group-title="Séries | ♦ Netflix",[24H] As Visões da Raven',
    "https://example.test/linear-raven.m3u8",
    '#EXTINF:-1 group-title="Séries | ♦ Netflix",American Dad S02 E09',
    "https://example.test/series/real-episode.mp4"
  ].join("\n");
  const parsed=parseLgM3U(text);
  assert.deepEqual(parsed.items.map(i=>i.type),["live","live","series"]);
  const prior=parsed.items.map(i=>({...i,type:"series"}));
  assert.equal(reclassifyLgItems(prior),2);
  assert.equal(auditLgCatalog(prior).live,2);
  assert.equal(auditLgCatalog(prior).series,1);
});
test("LG does not erase source group-title or URLs when reclassifying 24H",()=>{
  const item={title:"[24H] Simpsons 08",group:"Séries | Desenhos",url:"https://example.test/x",
    tvgId:"",type:"series"};
  assert.equal(reclassifyLgItems([item]),1);
  assert.equal(item.type,"live");
  assert.equal(item.group,"Séries | Desenhos");
  assert.equal(item.url,"https://example.test/x");
});

test("LG classifies explicit Cinema films even in mixed FILMES E SÉRIES source",()=>{
  const mixed="FILMES E SÉRIES";
  const film={group:mixed,title:"Homem-Aranha: Um Novo Dia [Cinema] (2026)",
    url:"https://example.test/vod/opaque-id"};
  const episode={group:mixed,title:"Série A S01 E02",url:"https://example.test/opaque-episode"};
  const live={group:mixed,title:"A&E FHD [ALT]",url:"https://example.test/opaque-channel"};
  const opaque={group:mixed,title:"Conteúdo sem dados",url:"https://example.test/opaque"};
  assert.equal(classifyLgItem(film),"movies");
  assert.equal(classifyLgItem(episode),"series");
  assert.equal(classifyLgItem(live),"live");
  assert.equal(classifyLgItem(opaque),"unknown");
});
test("LG files in movie formats are movies, not fabricated series or channels",()=>{
  assert.equal(classifyLgItem({title:"Filme sem gênero",group:"",url:"https://example.test/library/99.mp4"}),"movies");
  assert.equal(classifyLgItem({title:"Show S01E01",group:"",url:"https://example.test/library/100.mp4"}),"series");
  assert.equal(classifyLgItem({title:"Canal HD",group:"Canais",url:"https://example.test/live/123.ts"}),"live");
});
test("LG reports top unknown source groups without exposing URLs or secrets",()=>{
  const items=[
    {title:"X",group:"FILMES E SÉRIES",type:"unknown",url:"https://example.test/secret-token"},
    {title:"Y",group:"FILMES E SÉRIES",type:"unknown",url:"https://example.test/password"},
    {title:"Z",group:"Sem metadados",type:"unknown",url:"https://example.test/credential"},
    {title:"A",group:"Canais",type:"live",url:"https://example.test/secret"}
  ];
  const result=lgUnknownGroupSummary(items);
  assert.equal(result.total,3);
  assert.deepEqual(result.groups,[{name:"FILMES E SÉRIES",count:2},{name:"Sem metadados",count:1}]);
  assert.doesNotMatch(JSON.stringify(result),/secret|password|credential/i);
});

test("LG audit redacts accidental tokens inside provider group titles",()=>{
  const result=lgUnknownGroupSummary([
    {title:"X",type:"unknown",group:"Filmes password=example-secret"},
    {title:"Y",type:"unknown",group:"https://example.test/private-key?token=secret"}
  ]);
  assert.equal(result.total,2);
  assert.doesNotMatch(JSON.stringify(result),/example-secret|private-key|token=secret/);
  assert.match(JSON.stringify(result),/\[omitido\]|\[URL omitida\]/);
});
