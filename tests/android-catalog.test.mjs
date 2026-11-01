import {test} from "node:test";
import assert from "node:assert/strict";
import {saveState,loadState,itemKey} from "../src/core/storage.mjs";

test("inactive inline legacy data survives persistence until its durable migration commits",()=>{
  let saved="";globalThis.localStorage={setItem(_key,value){saved=value;},getItem(){return saved;}};
  const state={playlists:[{id:"active"},{id:"inactive",legacyItemsPending:true,items:[{url:"https://example.test/1"}],legacyGuidePending:true,guide:{programs:[{title:"Saved guide"}]}}],activeId:"active",favorites:["inactive|https://example.test/1"],positions:{"inactive|https://example.test/1":42},recent:[]};
  assert.equal(saveState(state),true);const restored=loadState();
  assert.deepEqual(restored.playlists[1].items,state.playlists[1].items);assert.deepEqual(restored.playlists[1].guide,state.playlists[1].guide);
  assert.deepEqual(restored.favorites,state.favorites);assert.deepEqual(restored.positions,state.positions);
  state.playlists[1].legacyItemsPending=false;state.playlists[1].legacyGuidePending=false;saveState(state);
  assert.equal(loadState().playlists[1].items,undefined);assert.equal(loadState().playlists[1].guide,undefined);
});
test("native series favorite identity survives its displayed title changing",()=>{
  const original=itemKey({type:"series",title:"Aurora"},"one");
  const renamed=itemKey({type:"series",title:"Aurora Revisada",favoriteSeriesTitle:"Aurora"},"one");
  assert.equal(renamed,original);
  assert.equal(itemKey({type:"movies",title:"Renamed",url:"https://example.test/movie"},"one"),"one|https://example.test/movie");
});
test("Android bridge matches asynchronous readers and serializes whole legacy migrations before refresh",async()=>{
  const calls=[];let release;
  globalThis.window={AuroraNative:{catalogVersion:()=>1,catalogRequest(operation,text,id){
    const payload=JSON.parse(text);calls.push({operation,payload});
    const respond=()=>window.auroraCatalogResponse(id,operation==="legacyBegin"?{ready:false}:{operation,playlist:payload.playlist},"");
    if(operation==="legacyAppend"&&!release)release=respond;else queueMicrotask(respond);
  }}};
  const api=await import("../src/core/android-catalog.mjs?queue-test");assert.equal(api.hasAndroidCatalog(),true);
  const migration=api.migrateAndroidCatalog({id:"one"},Array.from({length:600},(_,i)=>({url:"https://example.test/"+i})));
  await new Promise(resolve=>setImmediate(resolve));
  const refresh=api.androidCatalog("refresh",{playlist:"one",url:"https://example.test/list"});
  const read=await api.androidCatalog("summary",{playlist:"two"});assert.equal(read.playlist,"two");
  assert.equal(calls.some(c=>c.operation==="refresh"),false);release();await migration;await refresh;
  assert.deepEqual(calls.filter(c=>c.operation==="legacyAppend").map(c=>c.payload.items.length),[256,256,88]);
  assert.ok(calls.findIndex(c=>c.operation==="legacyCommit")<calls.findIndex(c=>c.operation==="refresh"));
});
test("failed Android migration aborts and permits retry without marking old data committed",async()=>{
  const operations=[];let fail=true;
  globalThis.window={AuroraNative:{catalogVersion:()=>1,catalogRequest(operation,_text,id){operations.push(operation);queueMicrotask(()=>window.auroraCatalogResponse(id,{ready:false},operation==="legacyAppend"&&fail?"disk full":""));}}};
  const api=await import("../src/core/android-catalog.mjs?abort-test");
  await assert.rejects(api.migrateAndroidCatalog({id:"one"},[{url:"https://example.test/1"}]),/disk full/);
  assert.equal(operations.includes("legacyCommit"),false);assert.equal(operations.at(-1),"legacyAbort");
  fail=false;await api.migrateAndroidCatalog({id:"one"},[{url:"https://example.test/1"}]);assert.equal(operations.at(-1),"legacyCommit");
});
