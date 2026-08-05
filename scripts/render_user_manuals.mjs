import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const sourceDirs = [
  join(root, 'docs', 'user_guide'),
  join(root, 'docs', 'implementation', 'documentation'),
];
const outputDir = join(root, 'toot');

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
const generatedFiles = [];

function slugifyHeading(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/\-+/g, '-');
}

const defaultHeadingOpen = md.renderer.rules.heading_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = function(tokens, idx, options, env, self) {
  const titleToken = tokens[idx + 1];
  if (titleToken && titleToken.type === 'inline') {
    const titleText = titleToken.children
      .filter(t => t.type === 'text' || t.type === 'code_inline')
      .map(t => t.content)
      .join('');
    const slug = slugifyHeading(titleText);
    tokens[idx].attrSet('id', slug);
  }
  return defaultHeadingOpen(tokens, idx, options, env, self);
};

function renderPageHtml(title, body, sourcePath) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      color: #111827;
      background: #f8fafc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 45%, #f8fafc 100%); color: #111827; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .background { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
    .background svg { width: 120%; height: 120%; position: absolute; top: -10%; left: -10%; }
    .page-shell { width: 100%; min-height: 100vh; padding: 32px 20px 60px; }
    .panel { max-width: 1100px; margin: 0 auto; padding: 36px; background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 32px; box-shadow: 0 24px 64px rgba(15, 23, 42, 0.12); backdrop-filter: blur(18px); }
    .brand { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 30px; }
    .brand-title { display: grid; gap: 10px; }
    .brand-title h1 { margin: 0; font-size: clamp(2rem, 3vw, 3rem); line-height: 1.05; letter-spacing: -0.03em; }
    .brand-title p { margin: 0; color: #475569; }
    .tag { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.92rem; }
    .hero { display: grid; gap: 24px; margin-bottom: 24px; }
    .hero p { max-width: 720px; color: #475569; font-size: 1.02rem; line-height: 1.8; }
    .hero-visual { display: grid; justify-items: center; align-items: center; }
    .hero-visual svg { width: min(100%, 420px); height: auto; }
    .hero-visual .illustration-fill { fill: #eff6ff; }
    .hero-visual .illustration-stroke { stroke: #2563eb; stroke-width: 2; fill: none; }
    .hero-visual .illustration-accent { fill: #2563eb; opacity: 0.92; }
    .content h2 { margin-top: 40px; font-size: 1.55rem; letter-spacing: -0.03em; border-bottom: 1px solid #dbeafe; padding-bottom: 10px; color: #0f172a; }
    .content h3 { margin-top: 30px; color: #111827; }
    .content p, .content li { color: #334155; line-height: 1.9; }
    .content ul, .content ol { margin: 16px 0 16px 1.5rem; }
    .content li { margin-bottom: 10px; }
    .content table { width: 100%; border-collapse: collapse; margin-top: 18px; background: #ffffff; border: 1px solid rgba(148, 163, 184, 0.22); }
    .content th, .content td { padding: 16px; border-bottom: 1px solid rgba(148, 163, 184, 0.18); }
    .content th { color: #0f172a; background: #eff6ff; }
    .content pre { margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 20px; overflow-x: auto; border: 1px solid rgba(148, 163, 184, 0.14); }
    .content code { background: rgba(229, 231, 235, 0.8); padding: 2px 6px; border-radius: 8px; color: #0f172a; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 0.9rem; margin-top: 8px; }
    .footer { margin-top: 32px; border-top: 1px solid rgba(148, 163, 184, 0.18); padding-top: 22px; color: #64748b; font-size: 0.95rem; }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-18px); }
    }
    @keyframes drift {
      0% { transform: translateX(0px) translateY(0px) scale(1); }
      25% { transform: translateX(20px) translateY(-10px) scale(1.04); }
      50% { transform: translateX(0px) translateY(-20px) scale(1.08); }
      75% { transform: translateX(-18px) translateY(-10px) scale(1.04); }
      100% { transform: translateX(0px) translateY(0px) scale(1); }
    }
    .circle-animate { animation: drift 14s ease-in-out infinite; transform-origin: center; }
    @media (max-width: 720px) {
      .panel { padding: 24px; }
      .brand { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="background" aria-hidden="true">
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#93c5fd" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#bfdbfe" stop-opacity="0.12" />
        </linearGradient>
      </defs>
      <circle class="circle-animate" cx="240" cy="140" r="120" fill="url(#glow)" />
      <circle class="circle-animate" style="animation-delay: -4s;" cx="980" cy="190" r="140" fill="#dbeafe" opacity="0.38" />
      <circle class="circle-animate" style="animation-delay: -8s;" cx="780" cy="630" r="180" fill="#e0f2fe" opacity="0.32" />
      <circle cx="110" cy="680" r="90" fill="#f8fafc" opacity="0.32" />
      <rect x="-100" y="520" width="420" height="240" rx="120" fill="#e0f2fe" opacity="0.22" />
      <g fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">
        <path d="M140 540 C 220 500 310 620 420 590" stroke="#93c5fd" stroke-width="3" opacity="0.24" />
        <path d="M460 120 L 690 180 L 820 100" stroke="#bfdbfe" stroke-width="2" opacity="0.28" />
        <path d="M330 320 C 430 260 580 380 700 330" stroke="#dbeafe" stroke-dasharray="8 10" stroke-width="1.5" />
        <circle cx="680" cy="120" r="6" fill="#93c5fd" opacity="0.75" />
        <circle cx="480" cy="680" r="6" fill="#dbeafe" opacity="0.75" />
      </g>
    </svg>
  </div>
  <div class="page-shell">
    <div class="panel">
      <div class="brand">
        <div class="brand-title">
          <h1>${title}</h1>
          <p>Generated from ${relative(root, sourcePath)}. Light mode documentation with animated SVG background for SMRITI Retail OS.</p>
        </div>
        <span class="tag">Light theme</span>
      </div>
      <div class="hero">
        <p>Enjoy a bright, modern documentation layout with subtle motion in the background and clean readability for every manual page.</p>
        <div class="hero-visual" aria-hidden="true">
          <svg viewBox="0 0 420 240" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="hero-tag-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#dbeafe" />
                <stop offset="100%" stop-color="#93c5fd" stop-opacity="0.82" />
              </linearGradient>
            </defs>
            <rect x="16" y="44" width="168" height="146" rx="28" class="illustration-fill" />
            <circle cx="100" cy="92" r="30" fill="#ffffff" />
            <circle cx="100" cy="92" r="12" class="illustration-accent" />
            <path d="M72 132c10-12 28-12 38 0v24H72v-24Z" fill="#bfdbfe" />
            <path d="M228 38h148a18 18 0 0 1 18 18v118a18 18 0 0 1-18 18H228a18 18 0 0 1-18-18V56a18 18 0 0 1 18-18Z" fill="#ffffff" stroke="#93c5fd" stroke-width="3" />
            <path d="M254 88h96M254 124h68" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
            <path d="M324 38v-12a16 16 0 0 0-32 0v12" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" />
            <rect x="274" y="152" width="96" height="56" rx="14" fill="url(#hero-tag-gradient)" opacity="0.92" />
            <text x="322" y="188" text-anchor="middle" font-size="28" font-weight="700" fill="#1e3a8a">₹</text>
            <path d="M148 220c36-20 60-60 60-104 0-14-2-28-6-40" stroke="#93c5fd" stroke-width="3" fill="none" opacity="0.8" />
            <path d="M190 58c22 10 48 16 76 16" stroke="#bfdbfe" stroke-width="3" fill="none" opacity="0.85" />
            <circle cx="340" cy="180" r="8" fill="#2563eb" opacity="0.9" />
          </svg>
        </div>
      </div>
      <div class="content">
        ${body}
      </div>
      <div class="footer">SMRITI Retail OS documentation generated as sleek HTML. Open the generated file for a polished reading experience.</div>
    </div>
  </div>
</body>
</html>`;
}

function renderIndexHtml(files) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SMRITI Retail OS Docs — Sleek Index</title>
  <style>
    :root { color-scheme: light; color: #0f172a; background: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); color: #0f172a; }
    .background { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
    .background svg { width: 120%; height: 120%; position: absolute; top: -10%; left: -10%; }
    .page-shell { width: 100%; min-height: 100vh; display: grid; place-items: center; padding: 36px 24px; }
    .panel { width: min(1100px, 100%); padding: 34px; background: rgba(255, 255, 255, 0.94); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 36px; box-shadow: 0 30px 60px rgba(15, 23, 42, 0.12); backdrop-filter: blur(14px); }
    .header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 32px; }
    .header h1 { margin: 0; font-size: clamp(2.2rem, 3vw, 3rem); line-height: 1.02; letter-spacing: -0.04em; }
    .header p { margin: 0; max-width: 720px; color: #475569; line-height: 1.75; }
    .hero-visual { display: grid; justify-items: center; margin-top: 22px; }
    .hero-visual svg { width: min(100%, 420px); height: auto; }
    .tag { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.92rem; }
    .search { margin-top: 22px; }
    .search input { width: 100%; border: none; border-radius: 999px; padding: 16px 20px; background: #f8fafc; color: #0f172a; border: 1px solid rgba(148, 163, 184, 0.18); outline: none; font-size: 1rem; }
    .search input::placeholder { color: #64748b; }
    .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 32px; }
    .card { padding: 24px; border-radius: 28px; background: #ffffff; border: 1px solid rgba(148, 163, 184, 0.18); transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
    .card:hover { transform: translateY(-6px); border-color: rgba(59, 130, 246, 0.28); box-shadow: 0 22px 50px rgba(15, 23, 42, 0.12); }
    .card a { display: inline-block; color: #1d4ed8; font-size: 1rem; font-weight: 700; margin-bottom: 12px; }
    .card p { margin: 0; color: #475569; }
    .footer { margin-top: 32px; color: #64748b; font-size: 0.95rem; }
    @media (max-width: 720px) {
      .panel { padding: 24px; }
      .search { margin-top: 18px; }
    }
  </style>
</head>
<body>
  <div class="background" aria-hidden="true">
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg-index" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#bfdbfe" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#f8fafc" stop-opacity="0.16" />
        </linearGradient>
      </defs>
      <circle class="circle-animate" cx="260" cy="120" r="130" fill="url(#bg-index)" />
      <circle class="circle-animate" style="animation-delay: -5s;" cx="980" cy="170" r="110" fill="#dbeafe" opacity="0.35" />
      <circle class="circle-animate" style="animation-delay: -10s;" cx="720" cy="650" r="180" fill="#e0f2fe" opacity="0.28" />
      <rect x="-80" y="540" width="420" height="240" rx="120" fill="#f8fafc" opacity="0.32" />
      <g fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">
        <path d="M120 500 C 190 470 260 540 340 520" stroke="#bfdbfe" stroke-width="3" opacity="0.24" />
        <path d="M590 120 L 760 180 L 900 120" stroke="#dbeafe" stroke-width="2" opacity="0.28" />
        <path d="M250 360 C 330 320 430 390 520 360" stroke="#e0f2fe" stroke-dasharray="8 12" stroke-width="1.5" />
        <circle cx="740" cy="110" r="5" fill="#bfdbfe" opacity="0.75" />
        <circle cx="190" cy="680" r="5" fill="#dbeafe" opacity="0.75" />
      </g>
    </svg>
  </div>
  <div class="page-shell">
    <div class="panel">
      <div class="header">
        <div>
          <h1>SMRITI Retail OS Docs</h1>
          <p>Access your sleek, modern documentation set for SMRITI Retail OS. Click any card to open a generated HTML manual.</p>
        </div>
        <span class="tag">Light theme</span>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <svg viewBox="0 0 420 220" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="index-hero-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#bfdbfe" />
              <stop offset="100%" stop-color="#93c5fd" stop-opacity="0.9" />
            </linearGradient>
          </defs>
          <rect x="24" y="24" width="136" height="136" rx="28" fill="#ffffff" stroke="#c7d2fe" stroke-width="3" />
          <circle cx="92" cy="92" r="30" fill="#eff6ff" />
          <circle cx="92" cy="92" r="11" fill="#2563eb" />
          <rect x="228" y="30" width="148" height="112" rx="20" fill="#ffffff" stroke="#93c5fd" stroke-width="3" />
          <path d="M254 72h96M254 106h52" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
          <path d="M320 30v-10a14 14 0 0 0-28 0v10" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" />
          <path d="M98 174c22-18 48-46 72-48" stroke="#bfdbfe" stroke-width="3" fill="none" opacity="0.85" />
          <circle cx="360" cy="170" r="8" fill="url(#index-hero-gradient)" opacity="0.96" />
          <text x="360" y="176" text-anchor="middle" font-size="24" fill="#1d4ed8" font-weight="700">₹</text>
        </svg>
      </div>
      <div class="search">
        <input placeholder="Search by title or file name (static preview only)" disabled />
      </div>
      <div class="grid">
        ${files.map(file => `<article class="card"><a href="./${file.fileName}">${file.title}</a><p>${file.fileName}</p></article>`).join('\n        ')}
      </div>
      <div class="footer">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · SMRITI Retail OS documentation hub</div>
    </div>
  </div>
</body>
</html>`;
}

await mkdir(outputDir, { recursive: true });

for (const sourceDir of sourceDirs) {
  const files = await readdir(sourceDir);
  const inputFiles = files.filter(name => name.endsWith('.md') && name !== 'USER_GUIDE.md');

  for (const fileName of inputFiles) {
    const filePath = join(sourceDir, fileName);
    let markdown = await readFile(filePath, 'utf8');
    markdown = markdown.replace(/^\uFEFF/, '');
    const titleMatch = markdown.match(/^#\s+(.*)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'SMRITI Retail OS Manual';
    const bodyMarkdown = markdown.replace(/^#\s+.*(?:\r?\n)+/, '');
    const htmlBody = md.render(bodyMarkdown);
    const outputFile = join(outputDir, fileName.replace(/\.md$/i, '.html'));
    const html = renderPageHtml(title, htmlBody, filePath);
    await writeFile(outputFile, html, 'utf8');
    generatedFiles.push({ title, fileName: fileName.replace(/\.md$/i, '.html') });
    console.log(`Generated: ${outputFile}`);
  }
}

const indexHtml = renderIndexHtml(generatedFiles);
await writeFile(join(outputDir, 'index.html'), indexHtml, 'utf8');
console.log(`Generated: ${join(outputDir, 'index.html')}`);
