import test from "node:test";
import assert from "node:assert/strict";
import {lgChannelStem,lgChannelLogos,lgKnownBrandLogo,TV_GLOBO_GENERIC_LOGO} from "../src/core/lg-channel-logos.mjs";

test("LG uses existing tvg-logo first, siblings second, trusted Globo broadcaster mark third",()=>{
  const a={title:"GLOBO BAHIA SALVADOR FHD",logo:"https://example.test/globo-bahia.png"};
  const b={title:"GLOBO BAHIA SALVADOR HD",logo:""};
  const c={title:"GLOBO AMAPA SD",logo:""};
  const d={title:"GLOBONEWS FHD",logo:""};
  const group=[a,b,c,d];
  assert.equal(lgChannelLogos(a,group).primary,a.logo);
  assert.equal(lgChannelLogos(b,group).primary,a.logo);
  assert.equal(lgChannelLogos(b,group).fallback,TV_GLOBO_GENERIC_LOGO);
  assert.equal(lgChannelLogos(c,group).primary,TV_GLOBO_GENERIC_LOGO);
  assert.equal(lgChannelLogos(d,group).primary,"");
  assert.equal(lgKnownBrandLogo({title:"TV Globo DF FHD"}),TV_GLOBO_GENERIC_LOGO);
  assert.equal(lgKnownBrandLogo({title:"Globoplay FHD"}),"");
});
test("LG strips quality suffix variants from network identity but keeps affiliate region",()=>{
  assert.equal(lgChannelStem("GLOBO AMAPA FHD [ALT]"),"globo amapa");
  assert.equal(lgChannelStem("GLOBO AMAPA SD"),"globo amapa");
  assert.notEqual(lgChannelStem("GLOBO AMAPA FHD"),lgChannelStem("GLOBO BAHIA FHD"));
});
