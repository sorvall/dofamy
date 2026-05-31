#!/usr/bin/env node
/**
 * Post-process dist/index.html after `expo export --platform web`:
 * - type="module" on entry script (import.meta)
 * - SEO meta / canonical / JSON-LD if Expo stripped custom head
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");
const publicIndexPath = path.join(root, "public", "index.html");

const SITE_TITLE = "Dofamy — планировщик дня голосом и якоря задач";
const SITE_DESCRIPTION =
  "Dofamy — веб-приложение для планирования дня голосом, якорных фото «до» и «после», таймеров задач и ИИ-отчётов. Фокус, продуктивность и спокойное закрытие дня.";
const SITE_URL = "https://dofamy.ru/";

if (!fs.existsSync(indexPath)) {
  console.error("fix-web-index: dist/index.html not found — run build:web first");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf8");

html = html.replace(
  /<script src="(\/_expo\/static\/js\/web\/entry-[^"]+\.js)" defer><\/script>/,
  '<script type="module" src="$1" defer></script>'
);

if (!html.includes('rel="canonical"')) {
  const seoHead = `
    <title>${SITE_TITLE}</title>
    <meta name="description" content="${SITE_DESCRIPTION}" />
    <link rel="canonical" href="${SITE_URL}" />
    <meta property="og:title" content="${SITE_TITLE}" />
    <meta property="og:description" content="${SITE_DESCRIPTION}" />
    <meta property="og:url" content="${SITE_URL}" />
    <meta property="og:image" content="https://dofamy.ru/logo512.png" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:type" content="website" />
    <meta name="robots" content="index, follow" />
  `;
  html = html.replace("</head>", `${seoHead}\n  </head>`);
}

if (!html.includes('id="dofamy-seo"') && fs.existsSync(publicIndexPath)) {
  const publicHtml = fs.readFileSync(publicIndexPath, "utf8");
  const seoBlock = publicHtml.match(/<article id="dofamy-seo">[\s\S]*?<\/article>/);
  if (seoBlock) {
    html = html.replace("<div id=\"root\"></div>", `${seoBlock[0]}\n\n    <div id="root"></div>`);
  }
}

html = html.replace(/<html lang="[^"]*">/, '<html lang="ru">');

fs.writeFileSync(indexPath, html);
console.log("fix-web-index: post-processed dist/index.html");

for (const file of ["robots.txt", "sitemap.xml", "yandex_e82b4d751f1b10ad.html"]) {
  const src = path.join(root, "public", file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}
