import test from "node:test";
import assert from "node:assert/strict";
import { parseM3U, classifyItem, groupSeries } from "../src/core/playlist.mjs";

test("parses metadata and preserves channel URLs", () => {
  const list = '#EXTM3U url-tvg="https://example.org/epg.xml"\n#EXTINF:-1 tvg-id="ch" group-title="Canais" tvg-logo="https://example.org/p.png",Canal autorizado\nhttps://example.org/live.m3u8\n';
  const result = parseM3U(list);
  assert.equal(result.count, 1);
  assert.equal(result.guideUrl, "https://example.org/epg.xml");
  assert.equal(result.items[0].type, "live");
});
test("does not guess unknown content type", () => {
  assert.equal(classifyItem("Variados", "Uma história"), "unknown");
});
test("series consolidate into a single card", () => {
  const list = '#EXTM3U\n#EXTINF:-1 group-title="Séries",Aurora S01E01\nhttps://example.org/1.mp4\n#EXTINF:-1 group-title="Séries",Aurora S01E02\nhttps://example.org/2.mp4';
  const groups = groupSeries(parseM3U(list).items);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].episodes.length, 2);
});
test("rejects invalid or non-http input", () => {
  assert.throws(() => parseM3U("not a playlist"));
  assert.equal(parseM3U("#EXTM3U\n#EXTINF:-1,C\njavascript:alert(1)").items.length, 0);
});
