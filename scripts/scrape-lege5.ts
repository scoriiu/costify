/**
 * Scrapes Romanian legislation articles from lege5.ro
 * 
 * Usage:
 *   npx tsx scripts/scrape-lege5.ts
 * 
 * It will open a browser, log in with the configured credentials,
 * then scrape each article and save the text to temp/lege5/
 */

import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const EMAIL = "office@1minus1.ro";
const PASSWORD = "1minus1.R@";

const ARTICLES: Record<string, string> = {
  // Codul Fiscal - TVA rates
  "art-291-cote-tva":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281728530&d=2025-04-07",
  // Codul Fiscal - Profit tax rate
  "art-17-cota-impozit-profit":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281726577&d=2025-04-07",
  // Codul Fiscal - Micro-enterprise tax
  "art-47-microintreprinderi-definitie":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281726734&d=2025-04-07",
  "art-51-cota-impozit-micro":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281726810&d=2025-04-07",
  // Codul Fiscal - Dividend tax
  "art-43-impozit-dividende-pj":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281726694&d=2025-04-07",
  "art-97-impozit-dividende-pf":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281727388&d=2025-04-07",
  // Codul Fiscal - CAS/CASS rates
  "art-138-cas":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281727922&d=2025-04-07",
  "art-156-cass":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281728038&d=2025-04-07",
  // Codul Fiscal - CAM
  "art-220-cam":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281728375&d=2025-04-07",
  // Codul Fiscal - VAT registration threshold
  "art-310-plafon-tva":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281728491&d=2025-04-07",
  // Codul Fiscal - Income tax PF
  "art-64-cota-impozit-venit":
    "https://lege5.ro/App/Document/geztsobvgm3q/codul-fiscal-din-2015?pid=281726913&d=2025-04-07",
};

async function main() {
  const outDir = path.join(__dirname, "..", "temp", "lege5");
  fs.mkdirSync(outDir, { recursive: true });

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  console.log("Logging in to lege5.ro...");
  await page.goto("https://lege5.ro/Authentication/Login");
  await page.waitForLoadState("networkidle");

  await page.fill('input[type="email"], input[name="email"], #Email', EMAIL);
  await page.fill('input[type="password"], input[name="password"], #Password', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"], .login-btn, #loginButton');

  await page.waitForTimeout(3000);
  console.log("Logged in successfully");

  // Scrape each article
  for (const [name, url] of Object.entries(ARTICLES)) {
    console.log(`Scraping ${name}...`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Try to get the article content from the main content area
      const content = await page.evaluate(() => {
        const selectors = [
          ".document-content",
          ".article-content",
          ".content-area",
          "#documentContent",
          ".law-content",
          "article",
          ".text-content",
          "main",
          ".container .content",
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent && el.textContent.trim().length > 100) {
            return el.textContent.trim();
          }
        }

        // Fallback: get body text minus navigation
        const body = document.body.cloneNode(true) as HTMLElement;
        body.querySelectorAll("nav, header, footer, .sidebar, .menu, script, style").forEach((el) => el.remove());
        return body.textContent?.trim() ?? "";
      });

      const filePath = path.join(outDir, `${name}.txt`);
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`  Saved ${content.length} chars to ${filePath}`);
    } catch (err) {
      console.error(`  Failed to scrape ${name}:`, err);
    }
  }

  await browser.close();
  console.log("\nDone! Files saved to temp/lege5/");
}

main().catch(console.error);
