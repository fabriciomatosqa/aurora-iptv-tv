import test from "node:test";
import assert from "node:assert/strict";
import {lgMediaKind,lgHlsAlternative,lgMediaErrorText} from "../src/core/lg-media.mjs";

test("LG reports source MPEG-TS or HLS without exposing IPTV credentials",()=>{
  assert.equal(lgMediaKind("https://example.test/live/u/p/33.ts"),"MPEG-TS");
  assert.equal(lgMediaKind("https://example.test/live/u/p/33.m3u8"),"HLS");
  assert.equal(lgMediaKind("https://example.test/movie/u/p/123.mp4"),"MP4");
  const diagnostic=lgMediaErrorText({url:"https://example.test/live/SECRET/PRIVATE/33.ts"},4);
  assert.match(diagnostic,/MPEG-TS/);
  assert.match(diagnostic,/HLS/);
  assert.doesNotMatch(diagnostic,/SECRET|PRIVATE|example\.test/);
});
test("LG only proposes alternate HLS for exact Xtream live TS paths",()=>{
  const from="https://example.test/live/test-user/test-pass/123.ts?session=xxx";
  assert.equal(lgHlsAlternative(from),
    "https://example.test/live/test-user/test-pass/123.m3u8?session=xxx");
  assert.equal(lgHlsAlternative("https://example.test/movie/u/p/33.ts"),"");
  assert.equal(lgHlsAlternative("https://example.test/live.ts"),"");
  assert.equal(lgHlsAlternative("https://example.test/live/u/p/33.m3u8"),"");
  assert.equal(lgHlsAlternative("javascript:alert(1)"),"");
  assert.equal(lgHlsAlternative("https://example.test/live/u/p/33.ts?redirect=http://evil.test"),"https://example.test/live/u/p/33.m3u8?redirect=http://evil.test");
});
