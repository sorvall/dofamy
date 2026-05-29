#!/usr/bin/env node
/**
 * Expo Metro export вставляет entry-<hash>.js без type="module",
 * из-за чего в браузере падает: Cannot use 'import.meta' outside a module.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const indexPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("fix-web-index: dist/index.html not found — run build:web first");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf8");
const before = html;
html = html.replace(
  /<script src="(\/_expo\/static\/js\/web\/entry-[^"]+\.js)" defer><\/script>/,
  '<script type="module" src="$1" defer></script>'
);

if (html === before) {
  console.warn("fix-web-index: entry script tag not found or already fixed");
} else {
  fs.writeFileSync(indexPath, html);
  console.log("fix-web-index: added type=module to entry script");
}
