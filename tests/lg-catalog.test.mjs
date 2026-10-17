import test from "node:test";
import assert from "node:assert/strict";
import {parseLgM3U,reclassifyLgItems,auditLgCatalog,mergeLgPlaylist,classifyLgItem} from "../src/core/lg-catalog.mjs";
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
