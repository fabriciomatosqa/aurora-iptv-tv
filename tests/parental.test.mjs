import test from "node:test";
import assert from "node:assert/strict";
import {isRestricted,createPin,verifyPin,validatePin} from "../src/core/parental.mjs";
test("adult material is not exposed by a benign group name",()=>{
  assert.equal(isRestricted({group:"Filmes +18",title:"Filme"}),true);
  assert.equal(isRestricted({group:"Cinema",title:"Filme +18"}),true);
  assert.equal(isRestricted({group:"Animação",title:"Zoológico"}),false);
  assert.equal(isRestricted({group:"Filmes",title:"XXX"}),true);
});
test("PIN validation rejects trivial invalid lengths and letters",()=>{
  assert.equal(validatePin("123"),false);
  assert.equal(validatePin("1234"),true);
  assert.equal(validatePin("12ab"),false);
});
test("PIN is salted and verified without saving plaintext",async()=>{
  const p1=await createPin("8129");
  const p2=await createPin("8129");
  assert.notEqual(p1.salt,p2.salt);
  assert.notEqual(p1.hash,p2.hash);
  assert.equal(await verifyPin("8129",p1),true);
  assert.equal(await verifyPin("8128",p1),false);
  assert.equal(JSON.stringify(p1).includes("8129"),false);
});
