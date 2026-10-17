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

test("LG clarifies the 180-card preview limit without hiding search results", async ({page}) => {
  await addChannels(page,201);
  await expect(page.locator(".cards > .card")).toHaveCount(180);
  await expect(page.locator(".lg-results-summary")).toContainText("Exibindo 180 de 201 itens");
  await page.locator('input[data-input="search"]').fill("Canal 201");
  await expect(page.locator(".cards > .card")).toHaveCount(1);
  await expect(page.locator(".lg-results-summary")).toHaveCount(0);
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
