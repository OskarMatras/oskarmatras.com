// Repo Atlas build script.
//
//   node tools/repo-atlas/build.mjs            rebuild from atlas.txt + cached meta.json
//   node tools/repo-atlas/build.mjs --fetch    re-check every repo on GitHub first (needs `gh`)
//
// The site has no build step, so this runs by hand and its output is committed:
//   Projects/RepoAtlas/index.html   the human page (all content is in the HTML, JS only filters)
//   Projects/RepoAtlas/llms.txt     the AI entry point: rules + a compact index of every repo
//   Projects/RepoAtlas/atlas.md     the same data with stats, as one markdown file
//   Projects/RepoAtlas/atlas.json   the same data, structured
//   Projects/repo-atlas-preview.svg the card image on the Projects page
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'Projects', 'RepoAtlas');
const SITE = 'https://OskarMatras.com';
const BASE = SITE + '/Projects/RepoAtlas';

// ---------------------------------------------------------------- parse
function parse() {
  const cats = [];
  let cur = null;
  const lines = fs.readFileSync(path.join(HERE, 'atlas.txt'), 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      const f = line.slice(3).split('||').map(s => s.trim());
      if (f.length !== 7) throw new Error('Category line needs 7 fields: ' + line.slice(0, 60));
      cur = { id: f[0], en: f[1], da: f[2], blurbEn: f[3], blurbDa: f[4], when: f[5], rule: f[6], repos: [] };
      cats.push(cur);
      continue;
    }
    if (line.startsWith('#')) continue;
    if (!cur) throw new Error('Repo before any category: ' + line.slice(0, 60));
    const f = line.split('|').map(s => s.trim());
    if (f.length < 4 || !/^[\w.-]+\/[\w.-]+$/.test(f[0])) throw new Error('Bad repo line: ' + line.slice(0, 80));
    cur.repos.push({
      key: f[0], what: f[1], use: f[2],
      tags: (f[3] || '').split(',').map(s => s.trim()).filter(Boolean),
      flags: (f[4] || '').split(',').map(s => s.trim()).filter(Boolean),
      notFor: f[5] || '',
    });
  }
  return cats;
}

// ---------------------------------------------------------------- GitHub
const metaFile = path.join(HERE, 'meta.json');

function fetchMeta(keys) {
  const FIELDS = 'nameWithOwner description stargazerCount pushedAt createdAt isArchived isFork url primaryLanguage{name} licenseInfo{spdxId name}';
  const repos = {};
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    const body = chunk.map((k, j) => {
      const [o, n] = k.split('/');
      return `r${j}: repository(owner:${JSON.stringify(o)}, name:${JSON.stringify(n)}){${FIELDS}}`;
    }).join('\n');
    let out;
    try {
      out = execFileSync('gh', ['api', 'graphql', '-f', `query=query{${body}}`], { encoding: 'utf8', maxBuffer: 1 << 24 });
    } catch (e) {
      out = e.stdout; // gh exits non-zero when any alias is NOT_FOUND but still prints the rest
      if (!out) throw e;
    }
    const data = JSON.parse(out).data || {};
    chunk.forEach((k, j) => {
      const r = data['r' + j];
      repos[k] = r ? {
        full: r.nameWithOwner, desc: r.description || '', stars: r.stargazerCount,
        lang: r.primaryLanguage ? r.primaryLanguage.name : '',
        license: r.licenseInfo ? (r.licenseInfo.spdxId && r.licenseInfo.spdxId !== 'NOASSERTION' ? r.licenseInfo.spdxId : r.licenseInfo.name) : '',
        pushed: r.pushedAt.slice(0, 10), created: r.createdAt.slice(0, 10),
        archived: r.isArchived, fork: r.isFork, url: r.url,
      } : null;
    });
  }
  return { fetched: new Date().toISOString().slice(0, 10), repos };
}

// GitHub reports "Other" or nothing for repos with a custom or mixed licence.
// These labels were read from each repo's LICENSE file, not guessed.
const LICENSE_LABEL = {
  'modelcontextprotocol/servers': 'MIT → Apache-2.0',
  'anthropics/skills': 'Per skill',
  'anthropics/claude-code': 'Proprietary',
  'vercel/ai': 'Apache-2.0',
  'BerriAI/litellm': 'MIT + enterprise',
  'jqlang/jq': 'MIT',
  'n8n-io/n8n': 'Sustainable Use',
  'FFmpeg/FFmpeg': 'LGPL / GPL',
};

// ---------------------------------------------------------------- helpers
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = s => s.replace(/[^\w]+/g, '-').toLowerCase();
const stars = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  : n >= 1e4 ? Math.round(n / 1e3) + 'k'
  : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// Marching squares over a sum of sines: the same trick the site's background
// uses, frozen into a path. Each category gets its own terrain, seeded by id.
function contours(seed, w, h, cell, levels) {
  const rnd = mulberry32(hash(seed));
  const waves = [0, 1, 2, 3].map(() => ({
    kx: (rnd() - .5) * .09, ky: (rnd() - .5) * .09, p: rnd() * 6.283, a: .6 + rnd() * .6,
  }));
  const cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
  const f = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let v = 0;
    for (const k of waves) v += k.a * Math.sin(c * cell * k.kx + r * cell * k.ky + k.p);
    f[r * cols + c] = v;
  }
  const lerp = (v1, v2, p1, p2, L) => { const d = v2 - v1; const s = Math.abs(d) < 1e-6 ? .5 : (L - v1) / d; return p1 + (p2 - p1) * s; };
  const n = x => Math.round(x * 10) / 10;
  return levels.map(L => {
    let d = '';
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c, tl = f[i], tr = f[i + 1], bl = f[i + cols], br = f[i + cols + 1];
      const idx = (tl > L ? 8 : 0) | (tr > L ? 4 : 0) | (br > L ? 2 : 0) | (bl > L ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x0 = c * cell, y0 = r * cell, x1 = x0 + cell, y1 = y0 + cell;
      const a = [lerp(tl, tr, x0, x1, L), y0], b = [x1, lerp(tr, br, y0, y1, L)];
      const cc = [lerp(bl, br, x0, x1, L), y1], dd = [x0, lerp(tl, bl, y0, y1, L)];
      const S = (p, q) => `M${n(p[0])} ${n(p[1])}L${n(q[0])} ${n(q[1])}`;
      switch (idx) {
        case 1: case 14: d += S(dd, cc); break;
        case 2: case 13: d += S(cc, b); break;
        case 3: case 12: d += S(dd, b); break;
        case 4: case 11: d += S(a, b); break;
        case 6: case 9: d += S(a, cc); break;
        case 7: case 8: d += S(dd, a); break;
        case 5: d += S(dd, a) + S(cc, b); break;
        case 10: d += S(a, b) + S(dd, cc); break;
      }
    }
    return d;
  });
}

function plateSvg(seed, cls) {
  const ls = contours(seed, 240, 120, 8, [-1.3, -.65, 0, .65, 1.3]);
  const gold = ls[0] + ls[2] + ls[4], ink = ls[1] + ls[3];
  return `<svg class="${cls}" viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
    `<path class="ink" d="${ink}"/><path class="gold" d="${gold}"/></svg>`;
}

// ---------------------------------------------------------------- build
const cats = parse();
const allKeys = cats.flatMap(c => c.repos.map(r => r.key));
if (new Set(allKeys).size !== allKeys.length) throw new Error('Duplicate repo in atlas.txt');

let meta;
if (process.argv.includes('--fetch') || !fs.existsSync(metaFile)) {
  meta = fetchMeta(allKeys);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
} else {
  meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
}

const problems = [];
for (const c of cats) for (const r of c.repos) {
  const m = meta.repos[r.key];
  if (!m) { problems.push(`${r.key}: not found on GitHub (or not in meta.json; run with --fetch)`); continue; }
  r.m = m;
  r.full = m.full;
  r.url = m.url;
  if (LICENSE_LABEL[r.key]) m.license = LICENSE_LABEL[r.key];
  else if (m.license === 'Other') problems.push(`${r.key}: licence is "Other", add it to LICENSE_LABEL`);
  r.active = !m.archived && daysBetween(m.pushed, meta.fetched) <= 120;
  if (m.archived) problems.push(`${r.key}: archived`);
  if (m.full.toLowerCase() !== r.key.toLowerCase()) console.warn(`note: ${r.key} now lives at ${m.full}`);
}
if (problems.length) { console.error('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }

const total = allKeys.length;
const picks = cats.flatMap(c => c.repos.filter(r => r.flags.includes('pick')));

fs.mkdirSync(OUT, { recursive: true });

// ----- llms.txt
{
  const L = [];
  L.push('# Repo Atlas');
  L.push('');
  L.push(`> A small, hand-picked library of ${total} open-source GitHub repositories, indexed by the task they help you finish. Maintained by Oskar Matras. Last verified against GitHub on ${meta.fetched}.`);
  L.push('');
  L.push('## How to use this (instructions for AI models)');
  L.push('');
  L.push('1. Match the user\'s task to a category using the "Reach for it when" line.');
  L.push('2. Inside the category, prefer entries marked [PICK]: they are the default choice in their niche. Read "Not for" before choosing.');
  L.push('3. Use the decision rule at the top of each category to choose between close alternatives.');
  L.push('4. Verify before you run anything: open the repo, check its activity and licence, and read an install script before executing it. Entries are a starting point, not an endorsement of every file in the repo.');
  L.push('5. If nothing here fits, say so and search elsewhere. The list is deliberately short.');
  L.push('');
  L.push('Flags: [PICK] = default choice for its niche. [OFFICIAL] = made by the vendor or project behind the technology.');
  L.push('');
  L.push('## Other formats');
  L.push('');
  L.push(`- ${BASE}/atlas.md : the same data with stars, language, licence and last-push date`);
  L.push(`- ${BASE}/atlas.json : structured, for filtering by tag, category or flag`);
  L.push(`- ${BASE}/ : the human page`);
  L.push('');
  for (const c of cats) {
    L.push(`## ${c.en} (${c.id})`);
    L.push('');
    L.push(c.blurbEn);
    L.push(`Reach for it when: ${c.when}.`);
    L.push(`Decision rule: ${c.rule}`);
    L.push('');
    for (const r of c.repos) {
      const fl = r.flags.map(f => `[${f.toUpperCase()}]`).join(' ');
      L.push(`- ${r.full} ${fl}`.trimEnd() + `: ${r.what}`);
      L.push(`  - Use when: ${r.use}`);
      if (r.notFor) L.push(`  - Not for: ${r.notFor}`);
      L.push(`  - ${r.url}`);
    }
    L.push('');
  }
  fs.writeFileSync(path.join(OUT, 'llms.txt'), L.join('\n'));
}

// ----- atlas.md
{
  const L = [];
  L.push('# Repo Atlas');
  L.push('');
  L.push(`${total} hand-picked open-source repositories, grouped by the job they do. Verified against GitHub on ${meta.fetched}. Source: ${BASE}/`);
  L.push('');
  for (const c of cats) {
    L.push(`## ${c.en}`);
    L.push('');
    L.push(c.blurbEn);
    L.push('');
    L.push(`**Reach for it when:** ${c.when}.`);
    L.push('');
    L.push(`**Decision rule:** ${c.rule}`);
    L.push('');
    for (const r of c.repos) {
      const fl = r.flags.map(f => `\`${f.toUpperCase()}\``).join(' ');
      L.push(`### [${r.full}](${r.url}) ${fl}`.trimEnd());
      L.push('');
      L.push(r.what);
      L.push('');
      L.push(`- **Use when:** ${r.use}`);
      if (r.notFor) L.push(`- **Not for:** ${r.notFor}`);
      L.push(`- **Tags:** ${r.tags.join(', ')}`);
      L.push(`- **Stats:** ${r.m.stars} stars · ${r.m.lang || 'n/a'} · ${r.m.license || 'no licence listed'} · last push ${r.m.pushed}`);
      L.push('');
    }
  }
  fs.writeFileSync(path.join(OUT, 'atlas.md'), L.join('\n'));
}

// ----- atlas.json
{
  const j = {
    name: 'Repo Atlas', url: BASE + '/', maintainer: 'Oskar Matras', verified: meta.fetched,
    howToUse: [
      'Match the task to a category using reach_for_it_when.',
      'Prefer repos flagged pick, and read not_for before choosing.',
      'Use decision_rule to choose between close alternatives.',
      'Verify activity, licence and install scripts before running anything.',
    ],
    categories: cats.map(c => ({
      id: c.id, title: c.en, summary: c.blurbEn, reach_for_it_when: c.when, decision_rule: c.rule,
      repos: c.repos.map(r => ({
        repo: r.full, url: r.url, what: r.what, use_when: r.use, not_for: r.notFor || null,
        tags: r.tags, pick: r.flags.includes('pick'), official: r.flags.includes('official'),
        stars: r.m.stars, language: r.m.lang || null, license: r.m.license || null,
        last_push: r.m.pushed, archived: r.m.archived,
      })),
    })),
  };
  fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(j, null, 2));
}

// ----- index.html
{
  const tpl = fs.readFileSync(path.join(HERE, 'template.html'), 'utf8');

  const plates = cats.map((c, i) => {
    const num = String(i + 1).padStart(2, '0');
    return `<a class="plate" href="#${c.id}" data-jump="${c.id}">
      ${plateSvg(c.id, 'terrain')}
      <span class="plate-num">${num}</span>
      <span class="plate-body">
        <span class="plate-count">${c.repos.length} <span data-da="repos" data-en="repos">repos</span></span>
        <strong class="plate-title" data-da="${esc(c.da)}" data-en="${esc(c.en)}">${esc(c.da)}</strong>
        <span class="plate-when">When ${esc(c.when)}.</span>
      </span>
    </a>`;
  }).join('\n');

  const sections = cats.map((c, i) => {
    const num = String(i + 1).padStart(2, '0');
    const repos = c.repos.map(r => {
      const text = [r.full, r.what, r.use, r.notFor, r.tags.join(' '), c.en, c.when].join(' ').toLowerCase();
      const badges = [
        r.flags.includes('pick') ? '<span class="badge pick" title="Default choice for its niche">PICK</span>' : '',
        r.flags.includes('official') ? '<span class="badge official" title="Made by the vendor or project behind the technology">OFFICIAL</span>' : '',
      ].join('');
      const [owner, name] = r.full.split('/');
      const status = r.m.archived ? 'archived' : r.active ? 'active' : 'quiet';
      const meta2 = [
        `<span class="stat stars" title="GitHub stars">★ ${stars(r.m.stars)}</span>`,
        r.m.lang ? `<span class="stat">${esc(r.m.lang)}</span>` : '',
        r.m.license ? `<span class="stat">${esc(r.m.license)}</span>` : '',
        `<span class="stat ${status}" title="Last push"><i></i>${r.m.pushed}</span>`,
      ].join('');
      return `<article class="repo" id="${slug(r.full)}" data-cat="${c.id}" data-pick="${r.flags.includes('pick') ? 1 : 0}" data-official="${r.flags.includes('official') ? 1 : 0}" data-text="${esc(text)}">
        <div class="repo-head">
          <a class="repo-name" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="owner">${esc(owner)} /</span><span class="nm">${esc(name)}</span></a>
          <span class="badges">${badges}</span>
        </div>
        <p class="what">${esc(r.what)}</p>
        <p class="use"><b data-da="Brug når" data-en="Use when">Use when</b> ${esc(r.use)}</p>
        ${r.notFor ? `<p class="not"><b data-da="Ikke til" data-en="Not for">Not for</b> ${esc(r.notFor)}</p>` : ''}
        <div class="repo-foot">
          <span class="stats">${meta2}</span>
          <span class="tags">${r.tags.map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')}</span>
        </div>
      </article>`;
    }).join('\n');
    return `<section class="cat" id="${c.id}" data-cat="${c.id}">
      <div class="cat-head">
        ${plateSvg(c.id, 'terrain mini')}
        <div class="cat-titles">
          <span class="cat-num">${num} · <span data-da="Kort-plade" data-en="Plate">Plate</span></span>
          <h2 data-da="${esc(c.da)}" data-en="${esc(c.en)}">${esc(c.da)}</h2>
          <p class="cat-blurb" data-da="${esc(c.blurbDa)}" data-en="${esc(c.blurbEn)}">${esc(c.blurbDa)}</p>
        </div>
      </div>
      <div class="router">
        <p><b data-da="Brug den når" data-en="Reach for it when">Reach for it when</b> ${esc(c.when)}.</p>
        <p><b data-da="Beslutningsregel" data-en="Decision rule">Decision rule</b> ${esc(c.rule)}</p>
      </div>
      <div class="repos">
${repos}
      </div>
    </section>`;
  }).join('\n');

  const html = tpl
    .replace(/<!--@PLATES-->/g, plates)
    .replace(/<!--@SECTIONS-->/g, sections)
    .replace(/@TOTAL@/g, String(total))
    .replace(/@CATS@/g, String(cats.length))
    .replace(/@PICKS@/g, String(picks.length))
    .replace(/@DATE@/g, meta.fetched)
    .replace(/@BASE@/g, BASE);
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
}

// ----- Projects card image (SVG)
{
  const ls = contours('atlas-card', 1120, 480, 14, [-1.5, -1, -.5, 0, .5, 1, 1.5]);
  const gold = ls[0] + ls[3] + ls[6], ink = ls[1] + ls[2] + ls[4] + ls[5];
  const rows = picks.slice(0, 6);
  const chips = rows.map((r, i) => {
    const y = 96 + i * 54;
    const label = r.full.length > 30 ? r.full.slice(0, 29) + '…' : r.full;
    return `<g transform="translate(700 ${y})"><rect width="360" height="40" rx="10" fill="#0c1424" fill-opacity=".82" stroke="#e8eefa" stroke-opacity=".14"/>` +
      `<circle cx="20" cy="20" r="4" fill="#c99a4b"/><text x="36" y="25" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="14" fill="#e8eefa" fill-opacity=".88">${esc(label)}</text>` +
      `<text x="344" y="25" text-anchor="end" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="12" fill="#c99a4b">★ ${stars(r.m.stars)}</text></g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 480" width="1120" height="480">
<rect width="1120" height="480" fill="#080d16"/>
<path d="${ink}" fill="none" stroke="#7f9bc4" stroke-opacity=".22" stroke-width="1"/>
<path d="${gold}" fill="none" stroke="#c99a4b" stroke-opacity=".55" stroke-width="1.3"/>
<text x="64" y="210" font-family="Fraunces,Georgia,'Times New Roman',serif" font-weight="600" font-size="84" fill="#f4efe4" letter-spacing="-2">Repo Atlas</text>
<text x="68" y="262" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="19" fill="#c99a4b" letter-spacing="3">${total} HAND-PICKED TOOLS · ${cats.length} PLATES</text>
<text x="68" y="304" font-family="Inter,system-ui,sans-serif" font-size="20" fill="#e8eefa" fill-opacity=".72">Indexed by task. Written for people and for AI models.</text>
${chips}
</svg>`;
  fs.writeFileSync(path.join(ROOT, 'Projects', 'repo-atlas-preview.svg'), svg);
}

console.log(`Repo Atlas built: ${total} repos, ${cats.length} categories, ${picks.length} picks. Metadata from ${meta.fetched}.`);
