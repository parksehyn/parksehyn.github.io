// data/resume.yml → dist/ (정적 HTML)
// 사용: node src/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const data = YAML.parse(readFileSync(join(root, 'data/resume.yml'), 'utf8'));
const css = readFileSync(join(root, 'src/style.css'), 'utf8');

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (v) => (Array.isArray(v) ? v.filter(has).length > 0 : v !== undefined && v !== null && String(v).trim() !== '');
const list = (v) => (Array.isArray(v) ? v.filter(has) : []);
// **굵게** 와 `코드`만 지원하는 아주 작은 인라인 마크업
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
const join_ = (arr, sep = ' · ') => list(arr).map(esc).join(sep);
const chips = (items) => (has(items) ? `<ul class="chips">${list(items).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
const bullets = (items) => (has(items) ? `<ul class="bullets">${list(items).map((t) => `<li>${md(t)}</li>`).join('')}</ul>` : '');
const section = (id, title, body) => (body.trim() ? `<section id="${id}"><h2>${esc(title)}<span class="dot">.</span></h2>${body}</section>` : '');
const row = (meta, body) => `<div class="row"><div class="row-meta">${meta}</div><div class="row-body">${body}</div></div>`;
const extLinks = (links) =>
  has(links)
    ? `<p class="links">${list(links).filter((l) => has(l.href)).map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</p>`
    : '';

const projects = list(data.projects);
// 상세 페이지는 카드에 없는 내용(이미지, 문제·결과)이 있을 때만 만든다. 카드와 같은 내용만 반복하는 페이지는 만들지 않음.
const hasDetail = (p) => has(p.images) || list(p.details).some((d) => has(d.problem) || has(d.result));

/* ---------- layout ---------- */
const page = ({ title, description, body, depth = 0 }) => {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<link rel="icon" href="${up}assets/favicon.png">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>${css}</style>
</head>
<body>
<main class="wrap">
${body}
</main>
<footer class="wrap foot">
  <span>© ${new Date().getFullYear()} ${esc(data.profile.name)}</span>
  <span>Last updated ${new Date().toISOString().slice(0, 10)}</span>
</footer>
</body>
</html>
`;
};

/* ---------- index ---------- */
function header() {
  const p = data.profile;
  const contacts = list(p.contacts).filter((c) => has(c.value));
  return `<header class="hero">
  <div class="hero-text">
    <h1>${esc(p.name)}</h1>
    ${has(p.role) ? `<p class="role">${esc(p.role)}</p>` : ''}
    ${contacts.length ? `<dl class="contacts">${contacts.map((c) => `<dt>${esc(c.label)}</dt><dd>${has(c.href) ? `<a href="${esc(c.href)}">${esc(c.value)}</a>` : esc(c.value)}</dd>`).join('')}</dl>` : ''}
  </div>
  ${has(p.photo) ? `<img class="photo" src="${esc(p.photo)}" alt="${esc(p.name)} 사진" width="132" height="176">` : ''}
</header>
${has(p.intro) ? `<div class="intro">${list(p.intro).map((t) => `<p>${md(t)}</p>`).join('')}</div>` : ''}`;
}

const education = () =>
  list(data.education)
    .map((e) => row(esc(e.period), `<h3>${esc(e.title)}</h3>${has(e.sub) ? `<p class="sub">${esc(e.sub)}</p>` : ''}${bullets(e.notes)}`))
    .join('');

// 수상 · 자격 공용: 제목, 보조 설명(기관 등), 날짜
const plainList = (items) =>
  list(items).length
    ? `<ul class="awards">${list(items)
        .map((a) => `<li><span class="what">${esc(a.title)}${has(a.sub) ? ` <span class="sub-inline">${esc(a.sub)}</span>` : ''}</span><span class="when">${esc(a.date)}</span></li>`)
        .join('')}</ul>`
    : '';

const activities = () =>
  list(data.activities)
    .map((a) => row(esc(a.period), `<h3>${esc(a.title)}</h3>${has(a.sub) ? `<p class="sub">${esc(a.sub)}</p>` : ''}${bullets(a.notes)}`))
    .join('');

const skills = () =>
  list(data.skills)
    .map((s) => row(`<span class="label">${esc(s.group)}</span>`, `${chips(s.items)}${has(s.note) ? `<p class="sub">${md(s.note)}</p>` : ''}`))
    .join('');

// 경력: 왼쪽 회사 · 기간 · 직위, 오른쪽 참여 프로젝트별 블록
const expProject = (p) => `<div class="xproj">
  ${has(p.tags) ? `<p class="xtags">${list(p.tags).map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
  <h3>${esc(p.title)}</h3>
  ${has(p.period) ? `<p class="meta">${esc(p.period)}</p>` : ''}
  ${has(p.role) ? `<p class="sub">${md(p.role)}</p>` : ''}
  ${chips(p.tech)}
  ${bullets(p.items)}
</div>`;

const experience = () =>
  list(data.experience)
    .map((x) =>
      row(
        `<h3 class="company">${esc(x.company)}</h3><span>${esc(x.period)}</span>${has(x.role) ? `<span class="xrole">${esc(x.role)}</span>` : ''}`,
        list(x.projects).map(expProject).join('')
      )
    )
    .join('');

function projectCard(p) {
  const icon = has(p.icon) ? `<img class="picon" src="${esc(p.icon)}" alt="" width="28" height="28">` : '';
  const meta = [p.period, ...list(p.meta)].filter(has);
  return `<article class="project">
  <h3 class="ptitle">${icon}${hasDetail(p) ? `<a href="projects/${esc(p.slug)}/">${esc(p.title)}</a>` : esc(p.title)}</h3>
  ${meta.length ? `<p class="meta">${join_(meta, ' | ')}</p>` : ''}
  ${has(p.summary) ? `<p class="summary">${md(p.summary)}</p>` : ''}
  ${chips(p.tech)}
  ${bullets(p.highlights)}
  <p class="links">${hasDetail(p) ? `<a href="projects/${esc(p.slug)}/">자세히 보기 →</a>` : ''}${list(p.links).filter((l) => has(l.href)).map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</p>
</article>`;
}

const index = page({
  title: `${data.profile.name} | ${data.profile.role}`,
  description: list(data.profile.intro)[0] || '',
  body: [
    header(),
    section('education', '학력', education()),
    section('awards', '수상', plainList(data.awards)),
    section('certs', '자격', plainList(data.certs)),
    section('activities', '활동', activities()),
    section('skills', '기술', skills()),
    section('experience', '경력', experience()),
    section('projects', '프로젝트', projects.map(projectCard).join('')),
  ].join('\n'),
});

/* ---------- project detail ---------- */
function detailPage(p) {
  const meta = [p.period, ...list(p.meta)].filter(has);
  const blocks = list(p.details)
    .map((d) => {
      const parts = [
        has(d.problem) ? `<div class="pr"><span class="k">문제</span><div>${md(d.problem)}</div></div>` : '',
        has(d.solution) ? `<div class="pr"><span class="k">해결</span><div>${Array.isArray(d.solution) ? bullets(d.solution) : `<p>${md(d.solution)}</p>`}</div></div>` : '',
        has(d.result) ? `<div class="pr"><span class="k">결과</span><div>${md(d.result)}</div></div>` : '',
      ].join('');
      return parts ? `<div class="detail"><h3>${esc(d.title)}</h3>${parts}</div>` : '';
    })
    .join('');
  const figs = list(p.images)
    .map((im) => `<figure><img src="../../${esc(im.src)}" alt="${esc(im.caption || p.title)}" loading="lazy">${has(im.caption) ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`)
    .join('');
  return page({
    title: `${p.title} | ${data.profile.name}`,
    description: p.summary || '',
    depth: 2,
    body: `<p class="back"><a href="../../#projects">← ${esc(data.profile.name)}</a></p>
<header class="phead">
  <h1 class="ptitle big">${has(p.icon) ? `<img class="picon" src="../../${esc(p.icon)}" alt="" width="40" height="40">` : ''}${esc(p.title)}</h1>
  ${meta.length ? `<p class="meta">${join_(meta, ' | ')}</p>` : ''}
  ${has(p.summary) ? `<p class="summary">${md(p.summary)}</p>` : ''}
  ${chips(p.tech)}
  ${extLinks(p.links)}
</header>
${figs ? `<div class="figs">${figs}</div>` : ''}
${blocks ? `<section><h2>무엇을 했나<span class="dot">.</span></h2>${blocks}</section>` : ''}`,
  });
}

/* ---------- write ---------- */
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), index);
for (const p of projects.filter(hasDetail)) {
  mkdirSync(join(out, 'projects', p.slug), { recursive: true });
  writeFileSync(join(out, 'projects', p.slug, 'index.html'), detailPage(p));
}
if (existsSync(join(root, 'assets'))) cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });
writeFileSync(join(out, '.nojekyll'), '');
console.log(`built: index + ${projects.filter(hasDetail).length} project pages`);
