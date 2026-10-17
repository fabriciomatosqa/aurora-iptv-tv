import test from "node:test";
import assert from "node:assert/strict";
import {parseLgM3U,reclassifyLgItems,auditLgCatalog} from "../src/core/lg-catalog.mjs";
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
