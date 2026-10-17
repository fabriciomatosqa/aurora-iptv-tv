import test from "node:test";
import assert from "node:assert/strict";
import {parseXMLTV,parseXmltvTime,extractFixture,footballFromEpg,matchGuideChannel,currentAndNext} from "../src/core/epg.mjs";
const xml='<tv><channel id="sports.br"><display-name>Canal de Esportes</display-name></channel>'+
'<programme start="20261017140000 -0300" stop="20261017160000 -0300" channel="sports.br"><title>Fluminense x Flamengo</title><desc>Brasileirão</desc></programme>'+
'<programme start="20261017160000 -0300" stop="20261017180000 -0300" channel="sports.br"><title>Jornal esportivo</title></programme></tv>';
const guide=parseXMLTV(xml);
const channel={title:"Canal de Esportes",tvgId:"sports.br",type:"live",url:"https://example.com/demo.m3u8"};
test("parses real XMLTV timezone and titles",()=>{
  assert.equal(guide.programs.length,2);
  assert.equal(guide.programs[0].start,Date.UTC(2026,9,17,17));
  assert.equal(guide.programs[0].description,"Brasileirão");
});
test("rejects invalid time, including impossible calendar date",()=>{
  assert.equal(parseXmltvTime("20260230010000 -0300"),null);
  assert.equal(parseXmltvTime("notadate"),null);
});
test("exact channel match only",()=>{
  assert.equal(matchGuideChannel(channel,guide),"sports.br");
  assert.equal(matchGuideChannel({title:"Another channel",tvgId:""},guide),null);
});
test("current and next channel schedule",()=>{
  const result=currentAndNext(channel,guide,Date.UTC(2026,9,17,18));
  assert.equal(result.current.title,"Fluminense x Flamengo");
  assert.equal(result.next.title,"Jornal esportivo");
});
test("football requires recognizable two-team title",()=>{
  assert.deepEqual(extractFixture("Fluminense x Flamengo"),{home:"Fluminense",away:"Flamengo"});
  assert.equal(extractFixture("Jogos de futebol de hoje"),null);
  assert.equal(extractFixture("Real Madrid x Real Madrid"),null);
});
test("football list is sourced from channel-matched EPG only",()=>{
  assert.equal(footballFromEpg([channel],guide,Date.UTC(2026,9,17,17,10)).length,1);
  assert.equal(footballFromEpg([],guide,Date.UTC(2026,9,17,17,10)).length,0);
  assert.equal(footballFromEpg([channel],guide,Date.UTC(2026,9,17,22)).length,0);
});
test("XMLTV rejects invalid documents and dangerous sizes",()=>{
  assert.throws(()=>parseXMLTV("not xmltv"));
  assert.throws(()=>parseXMLTV("x".repeat(12_000_002)));
});
