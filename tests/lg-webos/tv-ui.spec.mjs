import {test, expect} from "@playwright/test";

test.beforeEach(async ({page}) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    // Tests never touch real user playlists.
    indexedDB.deleteDatabase("aurora-tv-catalogs");
  });
  await page.reload();
});

async function addChannels(page, count = 12) {
  const data = ["#EXTM3U"];
  for (let i = 1; i <= count; i++) {
    data.push('#EXTINF:-1 group-title="Canais",Canal '+String(i).padStart(3,"0"));
    data.push("https://example.invalid/stream-"+i+".m3u8");
  }
  await page.locator('[data-focus="nav-settings"]').click();
  await page.locator('input[name="name"]').fill("Playlist de teste visual");
  await page.locator('textarea[name="m3u"]').fill(data.join("\n"));
  await page.locator("#playlist-form").getByRole("button",{name:"Salvar playlist"}).click();
  await expect(page.getByText(/Playlist importada/)).toBeVisible();
  await page.locator('[data-focus="nav-live"]').click();
}

test("LG TV 26 has fixed two-level navigation and three catalogue columns", async ({page}) => {
  await addChannels(page);
  await expect(page.locator("body")).toHaveClass(/lg-tv/);
  await expect(page.getByRole("heading",{name:"Ao Vivo"})).toBeVisible();
  const metrics = await page.evaluate(() => {
    const cards=[...document.querySelectorAll(".cards > .card")];
    return {
      first: cards[0].getBoundingClientRect().toJSON(),
      third: cards[2].getBoundingClientRect().toJSON(),
      fourth: cards[3].getBoundingClientRect().toJSON(),
      font: parseFloat(getComputedStyle(cards[0].querySelector(".card-title")).fontSize),
      navigation: parseFloat(getComputedStyle(document.querySelector(".nav button")).fontSize),
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    };
  });
  expect(metrics.third.y).toBe(metrics.first.y);
  expect(metrics.fourth.y).toBeGreaterThan(metrics.first.y+100);
  expect(metrics.font).toBeGreaterThanOrEqual(17);
  expect(metrics.navigation).toBeGreaterThanOrEqual(16);
  await expect(page.locator(".lg-secondary")).toBeVisible();
  await expect(page.locator(".lg-secondary-item").first()).toContainText("Todos os conteúdos");
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport+1);
  await page.screenshot({path:"dist/lg-visual-report/lg-720p-catalogue.png",fullPage:false});
});

test("LG remote still navigates with arrow keys and enter", async ({page}) => {
  await addChannels(page);
  await page.locator('[data-focus="nav-home"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-focus="nav-live"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const focused=await page.evaluate(()=>document.activeElement?.dataset.focus);
  expect(focused).not.toBe("nav-live");
});

test("LG can navigate beyond 180 and eventually reach all 201 imported channels", async ({page}) => {
  await addChannels(page,201);
  await expect(page.locator(".cards > .card")).toHaveCount(48);
  await expect(page.locator("[data-lg-count]")).toContainText("48");
  await expect(page.locator("[data-lg-count]")).toContainText("201");
  for(let i=0;i<4;i++) await page.locator('[data-action="lg-more"]').evaluate(el => el.click());
  await expect(page.locator(".cards > .card")).toHaveCount(201);
  await expect(page.locator('[data-action="lg-more"]')).toHaveCount(0);
  await expect(page.getByText("Canal 201",{exact:true})).toBeVisible();
  await page.locator('input[data-input="search"]').fill("Canal 201");
  await expect(page.locator(".cards > .card")).toHaveCount(1);
  await expect(page.locator(".lg-results-summary")).toHaveCount(0);
});

test("LG sidebar and logo remain in place when the channel catalogue scrolls", async ({page}) => {
  await addChannels(page,120);
  const before=await page.locator(".sidebar .logo").evaluate(el=>el.getBoundingClientRect().top);
  const scrolled=await page.locator("main").evaluate(main=>{main.scrollTop=1100;return main.scrollTop;});
  expect(scrolled).toBeGreaterThan(100);
  const after=await page.locator(".sidebar .logo").evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(after-before)).toBeLessThan(1);
  const pageScroll=await page.evaluate(()=>document.documentElement.scrollTop);
  expect(pageScroll).toBe(0);
});

test("LG repairs linear TV channels mislabeled as a Series category",async({page})=>{
  const data='#EXTM3U\n#EXTINF:-1 group-title="Série",A&E FHD [ALT]\nhttps://example.test/a.m3u8\n'+
    '#EXTINF:-1 group-title="Série",AMC HD\nhttps://example.test/b.m3u8\n'+
    '#EXTINF:-1 group-title="Série",Drama S01E02 FHD\nhttps://example.test/c.m3u8';
  await page.locator('[data-focus="nav-settings"]').click();
  await page.locator('input[name="name"]').fill("Teste de classificação");
  await page.locator('textarea[name="m3u"]').fill(data);
  await page.locator('#playlist-form').getByRole('button',{name:"Salvar playlist"}).click();
  await page.locator('[data-focus="nav-live"]').click();
  await expect(page.getByRole("button",{name:"Abrir A&E FHD [ALT]"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Abrir AMC HD"})).toBeVisible();
  await page.locator('[data-focus="nav-series"]').click();
  await expect(page.getByRole("button",{name:/Abrir Drama/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Abrir A&E/})).toHaveCount(0);
  // The corrected classification must also survive a full Simulator reload.
  await page.reload();
  await page.locator('[data-focus="home-live"]').click();
  await expect(page.getByRole("button",{name:"Abrir AMC HD"})).toBeVisible();
  await page.locator('[data-focus="nav-settings"]').click();
  await expect(page.locator(".lg-import-audit")).toContainText("Entradas M3U encontradas");
  await expect(page.locator(".lg-import-audit")).toContainText("3");
});

test("LG classifies a playback failure as warning, not as success", async ({page}) => {
  await page.locator('[data-focus="nav-settings"]').click();
  await page.locator("main").evaluate(main => {
    const banner=document.createElement("div");
    banner.className="notice";
    banner.textContent="O dispositivo/navegador não conseguiu reproduzir esta mídia. Confira formato e codecs.";
    main.prepend(banner);
  });
  await expect(page.locator("main > .notice")).toHaveClass(/lg-notice-error/);
});

test("LG 1080p and 4K logical viewports do not horizontally overflow", async ({page}) => {
  await addChannels(page,12);
  for(const [width,height] of [[1920,1080],[3840,2160]]){
    await page.setViewportSize({width,height});
    await expect(page.locator(".cards > .card").first()).toBeVisible();
    const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:window.innerWidth}));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.view+1);
  }
});


test("LG welcomes with three large types and separate favorites/history shortcuts", async ({page}) => {
  await expect(page.locator("#app")).toHaveClass(/lg-home-mode/);
  await expect(page.getByRole("heading",{name:/O que vamos assistir/})).toBeVisible();
  for(const item of ["live","movies","series","favorites","history"]){
    await expect(page.locator('[data-focus="home-'+item+'"]')).toBeVisible();
  }
  const count=await page.locator(".lg-home-primary .lg-home-tile").count();
  expect(count).toBe(3);
  const second=await page.locator(".lg-home-shortcuts .lg-home-tile").count();
  expect(second).toBe(2);
  await page.screenshot({path:"dist/lg-visual-report/lg-720p-home.png",fullPage:false});
});

test("LG primary tiles navigate with D-pad to a fixed category and subcategory column",async({page})=>{
  const live=page.locator('[data-focus="home-live"]');
  await live.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-focus="home-movies"]')).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(live).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#app")).toHaveClass(/lg-library-mode/);
  await expect(page.locator(".lg-secondary")).toBeVisible();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.getByRole("heading",{name:"Ao Vivo"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#app")).toHaveClass(/lg-home-mode/);
});

test("LG M3U subcategories filter the full catalog and can be reset via Todos",async({page})=>{
  const m3u=[
    '#EXTM3U',
    '#EXTINF:-1 group-title="CANAIS | ESPORTES",Canal Esporte 1',
    'https://example.test/sport1.m3u8',
    '#EXTINF:-1 group-title="CANAIS | ESPORTES",Canal Esporte 2',
    'https://example.test/sport2.m3u8',
    '#EXTINF:-1 group-title="CANAIS | NOTÍCIAS",Canal Notícias',
    'https://example.test/news.m3u8'
  ].join("\n");
  await page.locator('[data-focus="nav-settings"]').click();
  await page.locator('input[name="name"]').fill("Grupos por emissora");
  await page.locator('textarea[name="m3u"]').fill(m3u);
  await page.locator("#playlist-form").getByRole("button",{name:"Salvar playlist"}).click();
  await page.locator('[data-focus="nav-live"]').click();
  await expect(page.locator(".cards > .card")).toHaveCount(3);
  await expect(page.locator(".lg-secondary-list")).toContainText("ESPORTES");
  await expect(page.locator(".lg-secondary-list")).toContainText("NOTÍCIAS");
  await page.locator('[data-lg-group="CANAIS | ESPORTES"]').click();
  await expect(page.locator(".cards > .card")).toHaveCount(2);
  await expect(page.locator(".cards > .card").first()).toContainText("Esporte");
  await page.locator('input[data-input="search"]').fill("2");
  await expect(page.locator(".cards > .card")).toHaveCount(1);
  await page.locator('[data-lg-group="__all__"]').click();
  await expect(page.locator(".cards > .card")).toHaveCount(3);
});

test("LG opens history from the home dashboard, even without recent items",async({page})=>{
  await page.locator('[data-focus="home-history"]').click();
  await expect(page.getByRole("heading",{name:"Histórico"})).toBeVisible();
  await expect(page.locator(".lg-secondary")).toBeVisible();
  await page.locator('[data-focus="nav-home"]').click();
  await expect(page.locator('[data-focus="home-favorites"]')).toBeVisible();
});
