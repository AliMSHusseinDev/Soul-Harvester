import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});
await page.goto("http://127.0.0.1:5173/");
await page.waitForFunction(() => window.__soulHarvester?.().ready);
await page.waitForTimeout(2000);
await page.screenshot({ path: "artifacts/courtyard-menu.png" });
console.log(await page.evaluate(() => window.__soulHarvester()));
await page.locator("#enter").click();
await page.waitForTimeout(1000);
console.log("after enter", await page.evaluate(() => window.__soulHarvester()));
await page.screenshot({ path: "artifacts/courtyard-play.png" });
await browser.close();
