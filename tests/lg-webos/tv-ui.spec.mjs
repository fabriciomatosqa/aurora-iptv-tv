import {test,expect} from "@playwright/test";
test.beforeEach(async({page})=>{
  await page.goto("/");
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
});
async function importM3U(page,lines,name="Biblioteca de testes"){
  await page.locator('[data-focus="nav-settings"]').click();
  await page.locator('input[name="name"]').fill(name);
  await page.locator('textarea[name="m3u"]').fill(["#EXTM3U",...lines].join("\n"));
  await page.locator("#playlist-form").getByRole("button",{name:"Salvar playlist"}).click();
  await expect(page.getByText(/Playlist importada/)).toBeVisible();
}
const entry=(group,title,url="https://example.test/stream.m3u8",id="")=>
  '#EXTINF:-1 group-title="'+group+'"'+(id?' tvg-id="'+id+'"':'')+','+title+'\n'+url;
const fixture=[
  entry("Canais | Globoplay","Canal Um","https://example.test/one.m3u8","one"),
  entry("Canais | Globoplay","Canal Dois","https://example.test/two.m3u8","two"),
  entry("Canais | Pluto TV","Canal Três","https://example.test/three.m3u8","three"),
  entry("Filmes | Ação | Netflix","Aventuras Um","https://example.test/movie1.mp4"),
  entry("Filmes | Ação | Disney+","Aventuras Dois","https://example.test/movie2.mp4"),
  entry("Filmes | Comédia | Netflix","Comédia Um","https://example.test/comedy.mp4"),
  entry("Séries | Crunchyroll","Anime X S01E02","https://example.test/ep2.mp4"),
  entry("Séries | Crunchyroll","Anime X S01E01","https://example.test/ep1.mp4"),
  entry("Séries | Netflix","Outra Série S01E01","https://example.test/other.mp4")
];
test("LG Home retains the Aurora tiles and navigation entry points",async({page})=>{
  await expect(page.locator("#app")).toHaveClass(/lg-home-mode/);
  for(const type of ["live","movies","series","favorites","history"]){
    await expect(page.locator('[data-focus="home-'+type+'"]')).toBeVisible();
  }
  await expect(page.locator(".lg-v4-football-home")).toBeVisible();
  await page.screenshot({path:"dist/lg-visual-report/lg-720p-home-v4.png"});
});
test("LG Ao Vivo uses precisely platform -> channel -> EPG panels",async({page})=>{
  await importM3U(page,fixture);
  await page.locator('[data-focus="nav-live"]').click();
  await expect(page.locator("#app")).toHaveClass(/lg-triple-mode/);
  await expect(page.locator(".lg-v4-rail")).toHaveCount(2);
  await expect(page.locator(".lg-v4-rail").nth(0)).toContainText("Plataformas");
  await expect(page.locator(".lg-v4-rail").nth(1)).toContainText("Canais");
  await expect(page.locator(".lg-v4-third")).toContainText("Guia de programação");
  await expect(page.locator(".lg-v4-rail").first()).toContainText("Globoplay");
  await page.locator('.lg-v4-rail:first-of-type [data-row="1"]').click();
  await expect(page.locator(".lg-v4-rail").nth(1)).toContainText("Canal Três");
  await expect(page.locator(".lg-v4-third")).toContainText("Canal Três");
  await expect(page.getByText("Aventuras Um")).toHaveCount(0);
});
test("LG XMLTV is displayed for the actual selected channel",async({page})=>{
  await importM3U(page,fixture);
  const now=Date.now();
  const format=ts=>{
    const d=new Date(ts);
    return d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,"0")+String(d.getUTCDate()).padStart(2,"0")+
      String(d.getUTCHours()).padStart(2,"0")+String(d.getUTCMinutes()).padStart(2,"0")+"00 +0000";
  };
  const guide='<tv><channel id="one"><display-name>Canal Um</display-name></channel>'+
    '<programme channel="one" start="'+format(now-600000)+'" stop="'+format(now+2400000)+'"><title>Programa Verdadeiro</title></programme>'+
    '<programme channel="one" start="'+format(now+2400000)+'" stop="'+format(now+4800000)+'"><title>Próxima atração</title></programme></tv>';
  await page.locator('textarea[name="xml"]').fill(guide);
  await page.locator("#epg-form").getByRole("button",{name:"Importar programação"}).click();
  await page.locator('[data-focus="nav-live"]').click();
  await page.locator(".lg-v4-rail").nth(1).getByRole("button",{name:/Canal Um/}).click();
  await expect(page.locator(".lg-v4-third")).toContainText("Programa Verdadeiro");
  await expect(page.locator(".lg-v4-third")).toContainText("Próxima atração");
  await expect(page.locator('[data-focus="lg-play"]')).toBeVisible();
});
test("LG movies filters genre, platform, and only movies",async({page})=>{
  await importM3U(page,fixture);
  await page.locator('[data-focus="nav-movies"]').click();
  await expect(page.locator(".lg-v4-rail").first()).toContainText("Gêneros");
  await expect(page.locator(".lg-v4-rail").nth(1)).toContainText("Plataformas");
  await expect(page.locator(".lg-v4-rail").first()).toContainText("Comédia");
  await expect(page.locator(".lg-v4-third")).toContainText("Aventuras Dois");
  await page.locator('.lg-v4-rail:first-of-type [data-row="1"]').click();
  await expect(page.locator(".lg-v4-third")).toContainText("Comédia Um");
  await expect(page.locator(".lg-v4-third")).not.toContainText("Canal Dois");
  await expect(page.locator(".lg-v4-third")).not.toContainText("Anime X");
  await page.screenshot({path:"dist/lg-visual-report/lg-720p-movies-v4.png"});
});
test("LG series platform -> title -> episodes in season order",async({page})=>{
  await importM3U(page,fixture);
  await page.locator('[data-focus="nav-series"]').click();
  await expect(page.locator(".lg-v4-rail").first()).toContainText("Plataformas");
  await expect(page.locator(".lg-v4-rail").nth(1)).toContainText("Séries");
  await expect(page.locator(".lg-v4-rail").nth(1)).toContainText("Anime X");
  const episodes=page.locator(".lg-v4-episode-details strong");
  await expect(episodes).toHaveCount(2);
  await expect(episodes.first()).toHaveText("Anime X S01E01");
  await expect(episodes.nth(1)).toHaveText("Anime X S01E02");
  await expect(page.locator(".lg-v4-third")).not.toContainText("Aventuras Um");
  await expect(page.locator('[data-focus="lg-series-favorite"]')).toBeVisible();
});
test("LG football Home shows real EPG fixtures and clicking opens channel URL",async({page})=>{
  await importM3U(page,fixture);
  const start=new Date(Date.now()+600000),stop=new Date(Date.now()+5400000);
  const fmt=d=>d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,"0")+String(d.getUTCDate()).padStart(2,"0")+
    String(d.getUTCHours()).padStart(2,"0")+String(d.getUTCMinutes()).padStart(2,"0")+"00 +0000";
  const xml='<tv><programme channel="one" start="'+fmt(start)+'" stop="'+fmt(stop)+'"><title>Clube Azul x Clube Verde</title></programme></tv>';
  await page.locator('textarea[name="xml"]').fill(xml);
  await page.locator("#epg-form").getByRole("button",{name:"Importar programação"}).click();
  await page.locator('[data-focus="nav-home"]').click();
  await expect(page.locator(".lg-v4-football-game")).toHaveCount(1);
  await expect(page.locator(".lg-v4-football-game")).toContainText("Clube Azul");
  await page.locator(".lg-v4-football-game").click();
  await expect(page.locator(".player-screen")).toBeVisible();
  await expect(page.locator(".player-screen video")).toHaveAttribute("src","https://example.test/one.m3u8");
});
test("LG browser rails remain fixed and have independent scrolling",async({page})=>{
  const many=Array.from({length:100},(_,i)=>entry("Canais | Globoplay","Canal "+i,"https://example.test/"+i+".m3u8","ch"+i));
  await importM3U(page,many);
  await page.locator('[data-focus="nav-live"]').click();
  const first=await page.locator(".lg-v4-header").evaluate(el=>el.getBoundingClientRect().top);
  const second=await page.locator(".lg-v4-rail").first().evaluate(el=>el.getBoundingClientRect().top);
  const amount=await page.locator(".lg-v4-rail-list").nth(1).evaluate(el=>{el.scrollTop=900;return el.scrollTop;});
  expect(amount).toBeGreaterThan(100);
  expect(await page.locator(".lg-v4-header").evaluate(el=>el.getBoundingClientRect().top)).toBe(first);
  expect(await page.locator(".lg-v4-rail").first().evaluate(el=>el.getBoundingClientRect().top)).toBe(second);
  expect(await page.evaluate(()=>document.documentElement.scrollTop)).toBe(0);
});
test("LG preserves filters when returning from Settings and supports TV viewports",async({page})=>{
  await importM3U(page,fixture);
  await page.locator('[data-focus="nav-movies"]').click();
  await page.locator('.lg-v4-rail:first-of-type [data-row="1"]').click();
  await expect(page.locator(".lg-v4-third")).toContainText("Comédia Um");
  await page.locator('[data-focus="nav-settings"]').click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".lg-v4-third")).toContainText("Comédia Um");
  for(const [width,height] of [[1280,720],[1920,1080],[3840,2160]]){
    await page.setViewportSize({width,height});
    const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));
    expect(dims.scroll).toBeLessThanOrEqual(dims.view+1);
  }
});


test("LG classifies mixed FILMES E SÉRIES live logos as TV, not as movies",async({page})=>{
  await importM3U(page,[
    entry("FILMES E SÉRIES","A&E FHD","https://example.test/ae.m3u8"),
    entry("FILMES E SÉRIES","AMC HD","https://example.test/amc.m3u8"),
    entry("FILMES E SÉRIES","AXN SD","https://example.test/axn.m3u8"),
    entry("Filmes | Drama | Netflix","Filme de Drama","https://example.test/movie/5.mp4"),
    entry("Séries | ♦ Netflix","(A)mar S01E01","https://example.test/series/11.mp4")
  ],"M3U problemática corrigida");
  await page.locator('[data-focus="nav-live"]').click();
  await expect(page.locator(".lg-v4-rail").nth(1)).toContainText("A&E FHD");
  await expect(page.locator(".lg-v4-rail").nth(1)).toContainText("AMC HD");
  await page.locator('[data-focus="nav-movies"]').click();
  await expect(page.locator(".lg-v4-third")).toContainText("Filme de Drama");
  await expect(page.locator(".lg-v4-third")).not.toContainText("A&E FHD");
  await expect(page.locator(".lg-v4-third")).not.toContainText("AMC HD");
  await page.locator('[data-focus="nav-series"]').click();
  await expect(page.locator(".lg-v4-rail").first()).toContainText("Netflix");
  await expect(page.locator(".lg-v4-rail").first()).not.toContainText("Plataforma não informada");
  await expect(page.locator(".lg-v4-third")).toContainText("(A)mar S01E01");
  await page.reload();
  await page.locator('[data-focus="home-live"]').click();
  await expect(page.locator(".lg-v4-rail").nth(1)).toContainText("AMC HD");
});
test("LG long channel list can search channel number beyond first 120 items",async({page})=>{
  const entries=Array.from({length:180},(_,i)=>entry("Canais | Globoplay",
    "Canal "+String(i).padStart(3,"0"),"https://example.test/live/"+i+".m3u8"));
  await importM3U(page,entries);
  await page.locator('[data-focus="nav-live"]').click();
  await expect(page.locator(".lg-v4-row").count()).resolves.toBeGreaterThan(100);
  await page.locator('[data-input="lg-rail-search"][data-kind="second"]').fill("Canal 179");
  await expect(page.locator(".lg-v4-rail").nth(1).locator(".lg-v4-row")).toHaveCount(1);
  await expect(page.locator(".lg-v4-rail").nth(1)).toContainText("Canal 179");
});
test("LG video errors stay inside player and never obstruct Home after going back",async({page})=>{
  await importM3U(page,[entry("Canais | Globo","Canal Teste","https://example.test/live/test.m3u8")]);
  await page.locator('[data-focus="nav-live"]').click();
  await page.locator('[data-focus="lg-play"]').click();
  await expect(page.locator(".player-screen video")).toBeVisible();
  await page.locator(".player-screen video").evaluate(video=>video.dispatchEvent(new Event("error")));
  await expect(page.locator(".lg-player-error")).toBeVisible();
  await page.locator('[data-action="close-player"]').click();
  await page.locator('[data-focus="nav-home"]').click();
  await expect(page.locator(".lg-home-notice")).toHaveCount(0);
});
