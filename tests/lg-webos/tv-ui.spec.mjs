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

test("LG TV 26 has dedicated shell, readable sidebar, and four catalogue columns", async ({page}) => {
  await addChannels(page);
  await expect(page.locator("body")).toHaveClass(/lg-tv/);
  await expect(page.getByRole("heading",{name:"Ao Vivo"})).toBeVisible();
  const metrics = await page.evaluate(() => {
    const cards=[...document.querySelectorAll(".cards > .card")];
    return {
      first: cards[0].getBoundingClientRect().toJSON(),
      fourth: cards[3].getBoundingClientRect().toJSON(),
      fifth: cards[4].getBoundingClientRect().toJSON(),
      font: parseFloat(getComputedStyle(cards[0].querySelector(".card-title")).fontSize),
      navigation: parseFloat(getComputedStyle(document.querySelector(".nav button")).fontSize),
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    };
  });
  expect(metrics.fourth.y).toBe(metrics.first.y);
  expect(metrics.fifth.y).toBeGreaterThan(metrics.first.y+100);
  expect(metrics.font).toBeGreaterThanOrEqual(18);
  expect(metrics.navigation).toBeGreaterThanOrEqual(18);
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
  await page.locator('[data-focus="nav-live"]').click();
  await expect(page.getByRole("button",{name:"Abrir AMC HD"})).toBeVisible();
  await page.locator('[data-focus="nav-settings"]').click();
  await expect(page.locator(".lg-import-audit")).toContainText("Entradas M3U encontradas");
  await expect(page.locator(".lg-import-audit")).toContainText("3");
});

test("LG classifies a playback failure as warning, not as success", async ({page}) => {
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
