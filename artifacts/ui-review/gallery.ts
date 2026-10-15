import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const entries = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8")) as {
  name: string;
  size: string;
  description: string;
}[];
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );
const views = entries.filter((entry) => entry.size === "120x40");
writeFileSync(
  `${root}/index.html`,
  `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>diffdiff — UI review screenshots</title>
<style>
body{margin:0;background:#0b1620;color:#e3edf4;font:15px system-ui,sans-serif}
header,main{max-width:1800px;margin:auto;padding:24px}header{border-bottom:1px solid #324655}
h1{margin:0 0 12px}p{color:#afc1ce;line-height:1.6}a{color:#9edbff}
nav{display:flex;flex-wrap:wrap;gap:8px 16px}section{padding:18px 0 30px;border-bottom:1px solid #324655}
h2{font-size:20px}.pair{display:grid;grid-template-columns:3fr 2fr;gap:20px;align-items:start}
figure{margin:0;min-width:0}img{display:block;width:100%;height:auto;border:1px solid #324655}
figcaption{margin:10px 0;color:#afc1ce}code{font-size:13px}@media(max-width:900px){.pair{grid-template-columns:1fr}}
</style>
<header><h1>diffdiff UI review</h1><p>60 native-frame captures · 30 views · standard 120×40 and compact 80×24 · pierre-dark · synthetic GitHub data.<br>
Read <a href="README.md">the review handoff</a> for scope, caveats, and the next-agent brief. Captured 2026-10-14.</p>
<nav>${views.map((view) => `<a href="#${view.name}">${escape(view.name)}</a>`).join("\n")}</nav></header>
<main>${views.map((view) => `<section id="${view.name}"><h2>${escape(view.name)} — ${escape(view.description)}</h2><div class="pair">${["120x40", "80x24"].map((size) => `<figure><a href="${size}/${view.name}.png"><img loading="lazy" src="${size}/${view.name}.png" alt="${escape(view.description)} at ${size}"></a><figcaption>${size} · <a href="${size}/${view.name}.png">PNG</a> · <a href="${size}/${view.name}.txt">Text</a> · <a href="${size}/${view.name}.json">Native spans</a></figcaption></figure>`).join("")}</div></section>`).join("\n")}</main></html>`,
);
console.log(`Gallery: ${views.length} views, ${entries.length} screenshots`);
