#!/usr/bin/env node
/**
 * build-devplan-pdf.mjs
 * --------------------------------------------------------------------------
 * Renders specs/DEVELOPMENT-PLAN.md (Mermaid diagram included) to a PDF.
 *
 *   node scripts/build-devplan-pdf.mjs          # -> specs/DEVELOPMENT-PLAN.pdf
 *   pnpm devplan:pdf                            # same, via package.json script
 *
 * Offline by design: mermaid is injected from node_modules (no CDN/network).
 * Edit the markdown, re-run this — the PDF always reflects the current steps.
 * --------------------------------------------------------------------------
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MD_PATH = resolve(ROOT, 'specs/DEVELOPMENT-PLAN.md');
const PDF_PATH = resolve(ROOT, 'specs/DEVELOPMENT-PLAN.pdf');
const MERMAID_JS = resolve(ROOT, 'node_modules/mermaid/dist/mermaid.min.js');

// Brand palette from stack.md.
const PRIMARY = '#3498db';
const SECONDARY = '#f1c40f';

/**
 * Custom marked renderer: leave ```mermaid fenced blocks as <pre class="mermaid">
 * so the browser-side mermaid runtime can turn them into SVG. Everything else
 * renders as normal HTML.
 */
function buildRenderer() {
  const renderer = new marked.Renderer();
  const baseCode = renderer.code.bind(renderer);
  renderer.code = function code(codeObj, infoString) {
    // marked v18 passes a token object: { text, lang, ... }.
    // Older signatures pass (text, lang) — handle both.
    const text = typeof codeObj === 'string' ? codeObj : codeObj.text;
    const lang = typeof codeObj === 'string' ? infoString : codeObj.lang;
    if ((lang || '').trim() === 'mermaid') {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre class="mermaid">${escaped}</pre>`;
    }
    return baseCode(codeObj);
  };
  return renderer;
}

function pageHtml(bodyHtml, mermaidSource) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');
  :root { --primary: ${PRIMARY}; --secondary: ${SECONDARY}; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Open Sans', -apple-system, Segoe UI, Roboto, sans-serif;
    color: #1f2933; line-height: 1.55; margin: 0; padding: 32px 40px;
    font-size: 13px;
  }
  h1, h2, h3 { color: var(--primary); line-height: 1.25; }
  h1 { font-size: 26px; border-bottom: 3px solid var(--secondary); padding-bottom: 8px; }
  h2 { font-size: 19px; margin-top: 26px; border-bottom: 1px solid #e4e7eb; padding-bottom: 4px; }
  h3 { font-size: 15px; margin-top: 18px; color: #334e68; }
  a { color: var(--primary); }
  code { background: #f0f4f8; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  pre code { background: none; padding: 0; }
  pre:not(.mermaid) { background: #f0f4f8; padding: 12px; border-radius: 8px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 12px; }
  th, td { border: 1px solid #d9e2ec; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: var(--primary); color: #fff; }
  tr:nth-child(even) td { background: #f7f9fb; }
  blockquote { border-left: 4px solid var(--secondary); margin: 10px 0; padding: 4px 14px; background: #fffdf2; }
  pre.mermaid { text-align: center; background: none; padding: 8px 0; }
  pre.mermaid svg { max-width: 100%; height: auto; }
  hr { border: none; border-top: 1px solid #e4e7eb; margin: 22px 0; }
  @page { margin: 14mm; }
</style>
</head>
<body>
${bodyHtml}
<script>${mermaidSource}</script>
<script>
  window.mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose', flowchart: { useMaxWidth: true } });
</script>
</body>
</html>`;
}

async function main() {
  const md = await readFile(MD_PATH, 'utf8');
  const mermaidSource = await readFile(MERMAID_JS, 'utf8');

  marked.setOptions({ renderer: buildRenderer(), gfm: true });
  const bodyHtml = marked.parse(md);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(pageHtml(bodyHtml, mermaidSource), { waitUntil: 'networkidle0' });
    // Render every mermaid block to SVG, then wait for them to settle.
    await page.evaluate(async () => {
      await window.mermaid.run({ querySelector: 'pre.mermaid' });
    });
    await page.pdf({
      path: PDF_PATH,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    console.log(`✓ Wrote ${PDF_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('✗ Failed to build dev-plan PDF:', err);
  process.exit(1);
});
