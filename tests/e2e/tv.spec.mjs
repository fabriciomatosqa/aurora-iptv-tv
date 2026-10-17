import { test, expect } from "@playwright/test";

test.beforeEach(async ({page})=>{
  await page.goto("/");
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
});

test("home UI fits 720p, 1080p, and 4K logical viewports",async({page})=>{
  for(const [w,h] of [[1280,720],[1920,1080],[3840,2160]]){
    await page.setViewportSize({width:w,height:h});
    await expect(page.getByRole("heading",{name:/AURORA/})).toBeVisible();
    const d=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
    expect(d.width).toBeLessThanOrEqual(d.viewport+1);
  }
});
test("remote focus follows D-pad and Enter opens category",async({page})=>{
  await page.locator('[data-focus="nav-home"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-focus="nav-live"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading",{name:"Ao Vivo"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading",{name:/AURORA/})).toBeVisible();
});
test("M3U imports, groups series, and persists selected playlist",async({page})=>{
  const text='#EXTM3U\n#EXTINF:-1 tvg-id="ch" group-title="Canais",Canal de esportes\nhttps://example.org/ch.m3u8\n#EXTINF:-1 group-title="Séries",Aurora S01E01\nhttps://example.org/ep1.mp4\n#EXTINF:-1 group-title="Séries",Aurora S01E02\nhttps://example.org/ep2.mp4';
  await page.locator('[data-focus="nav-settings"]').click();
  await page.locator('input[name="name"]').fill("Minha lista");
  await page.locator('textarea[name="m3u"]').fill(text);
  await page.locator("#playlist-form").getByRole("button",{name:"Salvar playlist"}).click();
  await expect(page.getByText(/Playlist importada/)).toBeVisible();
  await page.locator('[data-focus="nav-series"]').click();
  await expect(page.locator(".card")).toHaveCount(1);
  await page.getByRole("button",{name:"Abrir Aurora"}).click();
  await expect(page.getByRole("heading",{name:"Episódios disponíveis"})).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(2);
  await page.reload();
  await page.locator('[data-focus="nav-settings"]').click();
  await expect(page.getByText("Minha lista",{exact:false}).first()).toBeVisible();
});
test("XMLTV feeds fixture schedule without invented scores",async({page})=>{
  const list='#EXTM3U\n#EXTINF:-1 tvg-id="sports.br" group-title="Canais",Canal de Esportes\nhttps://example.org/sport.m3u8';
  const now=new Date();
  const utcStr=(d)=>d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,"0")+String(d.getUTCDate()).padStart(2,"0")+String(d.getUTCHours()).padStart(2,"0")+String(d.getUTCMinutes()).padStart(2,"0")+"00 +0000";
  const start=utcStr(new Date(now.getTime()+3_600_000));
  const end=utcStr(new Date(now.getTime()+7_200_000));
  const guide='<tv><channel id="sports.br"><display-name>Canal de Esportes</display-name></channel><programme channel="sports.br" start="'+start+'" stop="'+end+'"><title>Fluminense x Flamengo</title></programme></tv>';
  await page.locator('[data-focus="nav-settings"]').click();
  await page.locator('input[name="name"]').fill("Futebol");
  await page.locator('textarea[name="m3u"]').fill(list);
  await page.locator("#playlist-form").getByRole("button",{name:"Salvar playlist"}).click();
  await page.locator('textarea[name="xml"]').fill(guide);
  await page.locator("#epg-form").getByRole("button",{name:"Importar programação"}).click();
  await page.locator('[data-focus="nav-football"]').click();
  await expect(page.getByText(/Fluminense/)).toBeVisible();
  await expect(page.getByText(/Flamengo/)).toBeVisible();
  await expect(page.getByText(/EM BREVE/)).toBeVisible();
});
test("PIN hides +18 content until verified, and locks after restart",async({page})=>{
  const playlist='#EXTM3U\n#EXTINF:-1 group-title="Filmes",Filme família\nhttps://example.org/family.mp4\n#EXTINF:-1 group-title="Filmes +18",Filme restrito\nhttps://example.org/restricted.mp4';
  await page.locator('[data-focus="nav-settings"]').click();
  await page.locator('input[name="name"]').fill("Protegida");
  await page.locator('textarea[name="m3u"]').fill(playlist);
  await page.locator("#playlist-form").getByRole("button",{name:"Salvar playlist"}).click();
  await page.locator('[data-focus="nav-movies"]').click();
  await expect(page.getByText("Filme família")).toBeVisible();
  await expect(page.getByText("Filme restrito")).toHaveCount(0);
  await page.locator('[data-focus="nav-settings"]').click();
  await page.locator("#pin-create input[name='pin']").fill("4512");
  await page.locator("#pin-create").getByRole("button",{name:/Ativar proteção/}).click();
  await page.locator('[data-focus="nav-movies"]').click();
  await expect(page.getByText("Filme restrito")).toBeVisible();
  await page.reload();
  await page.locator('[data-focus="nav-movies"]').click();
  await expect(page.getByText("Filme restrito")).toHaveCount(0);
});
