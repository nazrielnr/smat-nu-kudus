import { chromium } from "playwright";
const S = process.argv[2];
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await p.goto("http://localhost:5174/login");
await p.fill("#login-email", "admin@nu-kudus.id");
await p.fill("input[type=password]", "Password123!");
await p.click("button[type=submit]");
await p.waitForURL("http://localhost:5174/");
await p.waitForTimeout(1500);
await p.screenshot({ path: S + "/e-dash.png" });
console.log(await p.evaluate(() => [...document.querySelectorAll("aside button, aside a, [data-sidebar] button")].map(e => e.textContent.trim()).join(" | ")));
for (const r of ["/wakif","/penerimaan","/persetujuan","/assets","/accounts","/journals","/reports/financial-position","/audit-logs","/users","/settings"]) {
  await p.goto("http://localhost:5174" + r); await p.waitForTimeout(1200);
  console.log(r, "|", await p.evaluate(() => document.querySelector("h1")?.textContent), "|", await p.evaluate(() => [...document.querySelectorAll("main button")].map(e => e.textContent.trim()||e.ariaLabel).filter(Boolean).slice(0,12).join(" / ")));
}
await p.goto("http://localhost:5174/penerimaan/new"); await p.waitForTimeout(1200); await p.screenshot({ path: S + "/e-form.png" });
await b.close();
