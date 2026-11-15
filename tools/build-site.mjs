// Builds the website copy of the C-Quest session from the one source file, artifact/c-quest.html.
//   node tools/build-site.mjs
// Writes quest.html (the page on the site) and server/rules.txt (Ali's instructions, used by the server).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "artifact/c-quest.html"), "utf8");

// Ali's instructions live in the page as a list of lines; the server needs the same text.
const rulesMatch = /var RULES=\[\n([\s\S]*?)\n\s*\]\.join\('\\n'\);/.exec(src);
if (!rulesMatch) throw new Error("Could not find Ali's instructions in artifact/c-quest.html");
const rules = new Function("return [" + rulesMatch[1] + "].join('\\n')")();
fs.writeFileSync(path.join(root, "server/rules.txt"), rules + "\n");

// Split the source into the parts that belong in <head> and the page itself.
const style = /<style>[\s\S]*?<\/style>/.exec(src)[0];
const fonts = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/.exec(src)[0];
let body = src.slice(src.indexOf("</style>") + "</style>".length).trim();
body = body
  .replaceAll('src="guide.webp"', 'src="artifact/guide.webp"')
  .replace(/<div class="logo">([\s\S]*?)<\/div>/, '<a class="logo" href="index.html" aria-label="Eluvo home">$1</a>');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="apple-touch-icon" href="icon-192.png">
<title>Talk to Ali · Eluvo C-Quest</title>
<meta name="description" content="Stuck with work or study? Talk it through with Ali, Eluvo's AI guide. He helps you name the inner voice that gets loud when something matters, and leaves you with one small thing to try.">
<meta name="theme-color" content="#3B2E6B">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Eluvo">
<meta property="og:title" content="Talk to Ali · Eluvo C-Quest">
<meta property="og:description" content="A casual chat with Ali, Eluvo's AI guide: find the voice that holds you back and leave with one small step.">
<meta property="og:image" content="https://haiderlse.github.io/eluvo/og.png">
<meta name="twitter:card" content="summary_large_image">
${fonts}
<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}a.logo{color:inherit;text-decoration:none}</style>
${style}
<!-- This page is generated from artifact/c-quest.html by tools/build-site.mjs. Edit that file, then rebuild. -->
<script src="config.js"></script>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(root, "quest.html"), page);

const config = path.join(root, "config.js");
if (!fs.existsSync(config)) {
  fs.writeFileSync(config, `// Where the Eluvo server lives (the small program in /server that holds the API keys).
//   ""  means "the same address as this page": use this when you open the site from the server itself.
//   When the site is on GitHub Pages and the server runs somewhere else, put the server's address here,
//   for example  window.ELUVO_API = "https://your-eluvo-server.example.com";
window.ELUVO_API = "";
`);
}
console.log("Built quest.html (" + page.length + " bytes) and server/rules.txt (" + rules.length + " characters).");
