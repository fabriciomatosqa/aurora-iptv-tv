import {test,expect} from "@playwright/test";

test("Android cached pages use only the active native library while a remote refresh is held",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("aurora-tv-preview-v1",JSON.stringify({playlists:[{id:"active",name:"Active",url:"https://example.test/list"},{id:"inactive",name:"Inactive",url:"https://example.test/inactive"}],activeId:"active",favorites:[],positions:{},recent:[]}));
    window.__requests=[];window.__plays=[];window.__refreshHeld=false;
    // Cached native startup must continue even when the old IndexedDB cannot open.
    indexedDB.open=()=>{throw Error("Legacy storage deliberately unavailable");};
    window.AuroraNative={catalogVersion:()=>1,play:(...args)=>window.__plays.push(args),catalogRequest(operation,text,id){
      const payload=JSON.parse(text);window.__requests.push({operation,...payload});
      if(operation==="refresh"){window.__refreshHeld=true;return;}
      let result={};
      if(operation==="summary")result={ready:true,total:1000,live:0,movies:1000,series:0,unknown:0};
      if(operation==="groups")result=["Filmes"];
      if(operation==="page"){
        const offset=payload.offset||0,limit=payload.limit||48;
        const items=payload.kind==="movies"?Array.from({length:Math.min(limit,1000-offset)},(_,i)=>({type:"movies",title:"Movie "+(offset+i),group:"Filmes",url:"https://example.test/"+(offset+i)})):[];
        result={items,more:payload.kind==="movies"&&offset+items.length<1000};
      }
      queueMicrotask(()=>window.auroraCatalogResponse(id,result,""));
    }};
  });
  await page.goto("/");await expect(page.getByRole("button",{name:"Abrir Movie 0",exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__refreshHeld)).toBe(true);
  await page.locator("[data-focus=nav-movies]").click();await expect(page.locator(".card")).toHaveCount(48);
  await page.locator("[data-input=search]").fill("Movie");
  await page.locator("[data-input=search]").evaluate(input=>input.setSelectionRange(2,2));
  await expect.poll(()=>page.evaluate(()=>window.__requests.filter(r=>r.operation==="page").at(-1)?.search)).toBe("Movie");
  await expect.poll(()=>page.locator("[data-input=search]").evaluate(input=>input.selectionStart)).toBe(2);
  await page.locator("[data-input=search]").fill("");
  await expect.poll(()=>page.evaluate(()=>window.__requests.filter(r=>r.operation==="page").at(-1)?.search)).toBe("");
  for(let i=1;i<=4;i++){await page.locator("[data-action=android-next]").click();await expect(page.locator(".card-title").first()).toHaveText("Movie "+(i*48));}
  await expect(page.locator(".card")).toHaveCount(48);await page.locator(".card").first().click();
  expect(await page.evaluate(()=>window.__plays[0][0])).toBe("https://example.test/192");
  expect(await page.evaluate(()=>window.__requests.every(r=>r.playlist==="active"))).toBe(true);
  expect(await page.evaluate(()=>window.__refreshHeld)).toBe(true);
});

test("first Android conversion keeps saved movies watchable before the native commit",async({page})=>{
  await page.addInitScript(()=>{
    const items=Array.from({length:1000},(_,i)=>({type:"movies",title:"Saved Movie "+i,group:"Filmes",url:"https://example.test/"+i}));
    localStorage.setItem("aurora-tv-preview-v1",JSON.stringify({playlists:[{id:"legacy",name:"Legacy",items}],activeId:"legacy",favorites:["legacy|https://example.test/5"],positions:{"legacy|https://example.test/5":42},recent:[]}));
    window.__migrationHeld=false;window.__plays=[];
    window.AuroraNative={catalogVersion:()=>1,play:(...args)=>window.__plays.push(args),catalogRequest(operation,_text,id){
      if(operation==="legacyAppend"){window.__migrationHeld=true;return;}
      queueMicrotask(()=>window.auroraCatalogResponse(id,{ready:false},""));
    }};
  });
  await page.goto("/");await expect.poll(()=>page.evaluate(()=>window.__migrationHeld)).toBe(true);
  await page.locator("[data-focus=nav-movies]").click();await expect(page.locator(".card")).toHaveCount(48);
  for(let i=1;i<=4;i++){await page.locator("[data-action=android-next]").click();await expect(page.locator(".card-title").first()).toHaveText("Saved Movie "+(i*48));}
  await page.locator(".card").first().click();expect(await page.evaluate(()=>window.__plays[0][0])).toBe("https://example.test/192");
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("aurora-tv-preview-v1")));
  expect(saved.playlists[0].items).toHaveLength(1000);expect(saved.positions["legacy|https://example.test/5"]).toBe(42);
  expect(saved.favorites).toContain("legacy|https://example.test/5");
});
