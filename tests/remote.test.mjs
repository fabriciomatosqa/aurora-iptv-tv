import test from "node:test";
import assert from "node:assert/strict";
import {remoteKey} from "../src/core/remote.mjs";
test("standard D-pad and keyboard keys",()=>{
  assert.equal(remoteKey({key:"ArrowRight",keyCode:39}),"ArrowRight");
  assert.equal(remoteKey({key:"Enter",keyCode:13}),"Enter");
  assert.equal(remoteKey({key:" "}),"PlayPause");
});
test("Tizen and LG remote Back and media keys",()=>{
  assert.equal(remoteKey({keyCode:10009}),"Escape");
  assert.equal(remoteKey({keyCode:461}),"Escape");
  assert.equal(remoteKey({keyCode:415}),"PlayPause");
  assert.equal(remoteKey({keyCode:417}),"FastForward");
});
