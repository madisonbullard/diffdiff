import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const entries = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8")) as {
  name: string;
  size: string;
  theme: string;
  description: string;
  before?: string;
}[];
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
const names = [
  ...new Set(entries.filter((entry) => entry.theme === "pierre-dark").map((entry) => entry.name)),
];
const figure = (src: string, caption: string) =>
  `<figure><a href="${src}"><img loading="lazy" src="${src}" alt="${escape(caption)}"></a><figcaption>${escape(caption)}</figcaption></figure>`;

const sections = names.map((name) => {
  const entry = entries.find((item) => item.name === name)!;
  const sizes = entries
    .filter((item) => item.name === name && item.theme === "pierre-dark")
    .map((item) => item.size);
  const terminal = entries.find((item) => item.name === name && item.theme !== "pierre-dark");
  const after = sizes
    .map((size) => figure(`pierre-dark/${size}/${name}.png`, `proposed · ${size}`))
    .join("");
  const before =
    entry.before == null
      ? ""
      : ["120x40", "80x24"]
          .map((size) =>
            figure(`../${size}/${entry.before}.png`, `current · ${size} · ${entry.before}`),
          )
          .join("");
  const themed =
    terminal == null
      ? ""
      : figure(
          `terminal-theme/${terminal.size}/${name}.png`,
          `proposed · terminal-derived theme · ${terminal.size}`,
        );
  return `<section id="${name}"><h2>${escape(name)} — ${escape(entry.description)}</h2><div class="grid">${after}${themed}</div>${before === "" ? "" : `<details><summary>Current (before)</summary><div class="grid">${before}</div></details>`}</section>`;
});

writeFileSync(
  `${root}/index.html`,
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>diffdiff — proposed dialog system</title>
<style>
body{margin:0;background:#0b1620;color:#e3edf4;font:15px system-ui,sans-serif}
header,main{max-width:1800px;margin:auto;padding:24px}header{border-bottom:1px solid #324655}
h1{margin:0 0 12px}p{color:#afc1ce;line-height:1.6;max-width:1100px}a{color:#9edbff}
nav{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px}section{padding:18px 0 30px;border-bottom:1px solid #324655}
h2{font-size:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(520px,1fr));gap:18px;align-items:start}
figure{margin:0;min-width:0}img{display:block;width:100%;height:auto;border:1px solid #324655}
figcaption{margin:8px 0;color:#afc1ce;font-size:13px}details{margin-top:14px}summary{cursor:pointer;color:#9edbff}
</style>
<header><h1>Proposed dialog system — native OpenTUI mockups</h1>
<p>Updated 2026-10-14 for Madison's decisions: borderless tinted panels over a dimmed app, sheets below 30 rows, inline merge confirmation, a Keys tab instead of Help, no Ctrl+X menu, and Esc that closes a dialog while its write keeps going. Key menus are non-modal, so the app behind them stays undimmed.</p>
<p>Each image is a real OpenTUI/Yoga frame rendered headlessly from <code>mockups.tsx</code> over the dimmed real app frame, rasterized with the same Menlo span renderer as the audit captures (thin vertical seams between spans are a rasterizer artifact in both sets). They prove geometry and hierarchy, not final copy or production code. Plan: <a href="../../../docs/plans/menu-modal-unification.md">docs/plans/menu-modal-unification.md</a>.</p>
<nav>${names.map((name) => `<a href="#${name}">${escape(name)}</a>`).join("")}</nav></header>
<main>${sections.join("\n")}</main></html>`,
);
console.log(`Proposal gallery: ${names.length} mockups`);
