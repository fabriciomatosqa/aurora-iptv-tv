import test from "node:test";
import assert from "node:assert/strict";
import {needsDailyUpdate,localDay,mergePlaylist} from "../src/core/updates.mjs";
test("only one daily network attempt",()=>{
  const today=localDay(new Date("2026-10-17T12:00:00Z"));
  assert.equal(needsDailyUpdate({url:"https://example.org/playlist.m3u",lastAttemptDay:today},new Date("2026-10-17T12:00:00Z")),false);
  assert.equal(needsDailyUpdate({url:"https://example.org/playlist.m3u",lastAttemptDay:"2025-01-01"},new Date("2026-10-17T12:00:00Z")),true);
  assert.equal(needsDailyUpdate({url:""},new Date()),false);
});
test("merge adds new streams and retains vanished originals",()=>{
  const before=[{url:"https://a",title:"A"}];
  const result=mergePlaylist(before,[{url:"https://a",title:"A"},{url:"https://b",title:"B"}]);
  assert.equal(result.added,1);assert.equal(result.items.length,2);
  assert.equal(before.length,1);
});
