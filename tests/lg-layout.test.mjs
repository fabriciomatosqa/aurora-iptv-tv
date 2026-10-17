import test from "node:test";
import assert from "node:assert/strict";
import {lgHomeMarkup,lgFacets,lgGroupKey,lgGroupLabel,lgSecondaryMarkup,LG_LIBRARY_ROUTES} from "../src/core/lg-layout.mjs";

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

test("LG home has 3 primary types plus favorites/history and settings",()=>{
 const html=lgHomeMarkup({stats:{live:709,movies:25,series:9808},favorites:4,recent:2,
   playlistName:"Minha lista",hasPlaylist:true,esc});
 for(const token of ["home-live","home-movies","home-series","home-favorites","home-history","nav-settings"]){
   assert.ok(html.includes('data-focus="'+token+'"'),token);
 }
 assert.ok(html.includes("Ao Vivo"));
 assert.ok(html.includes("Filmes"));
 assert.ok(html.includes("Séries"));
 assert.ok(html.includes("9.808"));
 assert.ok(html.includes("Minha lista"));
});
test("LG homepage escapes untrusted playlist name",()=>{
 const html=lgHomeMarkup({stats:{live:0,movies:0,series:0},playlistName:'"><img src=x onerror=evil()>',hasPlaylist:true,esc});
 assert.equal(html.includes('<img src=x onerror=evil()>'),false);
 assert.ok(html.includes("&lt;img"));
});
test("secondary categories are derived from M3U groups, keep original filtering keys",()=>{
 const items=[
   {title:"Canal 1",group:"CANAIS | ESPORTES"},
   {title:"Canal 2",group:"CANAIS | ESPORTES"},
   {title:"Canal 3",group:"CANAIS | NOTÍCIAS"},
   {title:"Sem tag",group:""}
 ];
 const groups=lgFacets(items);
 assert.equal(groups[0].key,"__all__");
 assert.equal(groups[0].count,4);
 assert.equal(groups.length,4);
 assert.equal(groups.find(g=>g.key==="CANAIS | ESPORTES").count,2);
 assert.equal(lgGroupLabel("CANAIS | ESPORTES"),"ESPORTES");
 assert.equal(lgGroupKey(items[3]),"Sem categoria");
 const rendered=lgSecondaryMarkup({heading:"Ao Vivo",facets:groups,selected:"CANAIS | ESPORTES",esc});
 assert.ok(rendered.includes('data-lg-group="CANAIS | ESPORTES"'));
 assert.ok(rendered.includes('aria-pressed="true"'));
});
test("series grouped card derives group from an actual episode",()=>{
 assert.equal(lgGroupKey({title:"Série A",episodes:[{group:"Séries | Drama"}]}),"Séries | Drama");
 assert.ok(LG_LIBRARY_ROUTES.has("history"));
 assert.ok(LG_LIBRARY_ROUTES.has("series"));
 assert.ok(!LG_LIBRARY_ROUTES.has("settings"));
});
