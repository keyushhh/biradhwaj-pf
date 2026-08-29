/* ============================================================
   v2 — desk interactions
   ============================================================ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------ content */

const WORK = [
  {
    kind: 'Fintech · 0→1',
    title: 'Grid.Pe',
    blurb: 'Doorstep cash withdrawal, taken from problem definition to a shipped mobile product.',
    img: '/assets/work/gridpe.webp',
    links: [{ href: 'https://gridpe.framer.website/', label: 'Live site', icon: 'link' }]
  },
  {
    kind: 'Enterprise',
    title: 'eSIM CRM',
    blurb: 'Carrier-scale eSIM operations: CRM, billing and analytics made legible without losing the power.',
    img: '/assets/work/esim-crm.webp',
    links: [{ href: 'https://www.behance.net/gallery/243223895/Enterprise-CRM-for-Scalable-eSIM-Operations', label: 'Case study', icon: 'doc' }]
  },
  {
    kind: 'Dev tools',
    title: 'System Studio',
    blurb: '182 tokens, 18 primitives. A living token pipeline designers and engineers both read from.',
    img: '/assets/work/design-system-studio.webp',
    links: [{ href: 'https://biradhwaj-design-tokens.vercel.app/', label: 'Live site', icon: 'link' }]
  },
  {
    kind: 'Systems',
    title: 'Design System',
    blurb: 'Components and foundations built to stay usable as the team and the surface area grew.',
    img: '/assets/work/design-system.webp',
    links: [{ href: 'https://www.behance.net/gallery/237864037/Design-System-for-Scalable-Digital-Experiences', label: 'Case study', icon: 'doc' }]
  }
];

const CAPS = [
  { n: '01', title: 'Product Architecture & Flows', kicker: 'Figma · State Mapping',
    desc: 'Transforming ambiguous product specs into clear, deterministic user journeys and information architecture before visual polish.',
    chips: ['Information Architecture', 'State Machines', 'User Flows'], glyph: 'flow' },
  { n: '02', title: 'Design Systems & Scalability', kicker: 'Tokens · React · Foundations',
    desc: 'Zero-drift token architecture, scalable primitives, and living documentation that designers and engineers both build from.',
    chips: ['Token Pipelines', 'Primitive Libraries', 'Living Docs'], glyph: 'grid' },
  { n: '03', title: 'Complex SaaS & Data Density', kicker: 'Enterprise B2B',
    desc: 'Making dense CRM, billing, table, and data-heavy interfaces legible, lightning fast, and effortless to navigate.',
    chips: ['Data Density', 'CRM & Billing', 'Keyboard Nav'], glyph: 'chart' },
  { n: '04', title: 'Rapid Code Prototyping', kicker: 'Framer · React · Code',
    desc: 'Testing interactive ideas in real code environments early so decisions are made with working software instead of static assumptions.',
    chips: ['Working Prototypes', 'Physics & Springs', 'Micro-Interactions'], glyph: 'spark' },
  { n: '05', title: '0→1 Product Discovery', kicker: 'Hypothesis → Ship',
    desc: 'Scoping MVPs, running rapid customer discovery loops, and balancing craft precision with fast shipping cadence.',
    chips: ['MVP Scoping', 'Customer Discovery', 'Roadmap Alignment'], glyph: 'arrow' },
  { n: '06', title: 'AI-Assisted Craft & Build', kicker: 'Claude · Cursor · Git',
    desc: 'Accelerating design-to-production workflows with AI tooling, closing the handoff gap so production builds match design intent 1:1.',
    chips: ['Zero-Handoff Drift', 'Cursor & Git', 'AI Workflows'], glyph: 'code' }
];

/* Drop a cut-out PNG/WebP at `img` and it takes over; `svg` is only the
   stand-in that shows until the file is there (or if it fails to load).
   Captions are placeholders — say whatever you actually want. */
const STICKERS = [
  /* --- Left Side (Experience area) --- */
  { id: 'field-notes', side: 'left', tip: 'ideas start on paper',
    style: 'top:2rem;left:max(-13.5rem, calc(-50vw + 50% + 1rem));width:6.8rem;z-index:2', rot: -6,
    img: '/assets/stickers/field-notes.webp' },
  { id: 'pantone', side: 'left', tip: 'obsessed with color accuracy',
    style: 'top:11rem;left:max(-15.8rem, calc(-50vw + 50% + 0.2rem));width:5rem;z-index:3', rot: 13,
    svg: `<svg viewBox="0 0 140 180"><rect x="6" y="6" width="128" height="168" rx="8" fill="#fcfbf9" stroke="#17221c" stroke-width="4"/><rect x="14" y="14" width="112" height="106" rx="4" fill="#002fa7"/><text x="18" y="138" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-weight="800" font-size="13" fill="#17221c" letter-spacing="0.5">PANTONE®</text><text x="18" y="153" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-weight="600" font-size="10" fill="#54615a">072 C</text></svg>` },
  { id: 'pen-tool', side: 'left', tip: 'bezier curve whisperer',
    style: 'top:18rem;left:max(-10.2rem, calc(-50vw + 50% + 3.8rem));width:4.4rem;z-index:4', rot: -16,
    svg: `<svg viewBox="0 0 160 160"><path d="M28 132 C 45 60, 115 60, 132 28" fill="none" stroke="#000000" stroke-width="4" stroke-linecap="round"/><line x1="28" y1="132" x2="65" y2="70" stroke="#0d99ff" stroke-width="2.5" stroke-dasharray="4 3"/><circle cx="65" cy="70" r="5" fill="#0d99ff" stroke="#ffffff" stroke-width="2"/><circle cx="28" cy="132" r="6" fill="#ffffff" stroke="#0d99ff" stroke-width="3"/><g transform="translate(132, 28) rotate(45)"><path d="M0 0 L-14 -32 L-7 -36 L0 -24 L7 -36 L14 -32 Z" fill="#2c2c2c" stroke="#ffffff" stroke-width="2"/><path d="M0 0 L0 -22" stroke="#ffffff" stroke-width="2"/><circle cx="0" cy="-22" r="2.5" fill="#ffffff"/><path d="M-12 -34 L-12 -54 L12 -54 L12 -34 Z" fill="#e056fd" stroke="#ffffff" stroke-width="2"/></g></svg>` },
  { id: 'steel-ruler', side: 'left', tip: 'sub-pixel precision',
    style: 'top:25.5rem;left:max(-16.8rem, calc(-50vw + 50% - 0.2rem));width:8rem;z-index:2', rot: 55,
    svg: `<svg viewBox="0 0 240 60"><rect x="4" y="6" width="232" height="48" rx="6" fill="#d4d8dd" stroke="#17221c" stroke-width="3.5"/><line x1="16" y1="8" x2="16" y2="28" stroke="#17221c" stroke-width="2.5"/><line x1="30" y1="8" x2="30" y2="18" stroke="#54615a" stroke-width="1.5"/><line x1="44" y1="8" x2="44" y2="22" stroke="#17221c" stroke-width="1.8"/><line x1="58" y1="8" x2="58" y2="18" stroke="#54615a" stroke-width="1.5"/><line x1="72" y1="8" x2="72" y2="28" stroke="#17221c" stroke-width="2.5"/><line x1="86" y1="8" x2="86" y2="18" stroke="#54615a" stroke-width="1.5"/><line x1="100" y1="8" x2="100" y2="22" stroke="#17221c" stroke-width="1.8"/><line x1="114" y1="8" x2="114" y2="18" stroke="#54615a" stroke-width="1.5"/><line x1="128" y1="8" x2="128" y2="28" stroke="#17221c" stroke-width="2.5"/><line x1="142" y1="8" x2="142" y2="18" stroke="#54615a" stroke-width="1.5"/><line x1="156" y1="8" x2="156" y2="22" stroke="#17221c" stroke-width="1.8"/><line x1="170" y1="8" x2="170" y2="18" stroke="#54615a" stroke-width="1.5"/><line x1="184" y1="8" x2="184" y2="28" stroke="#17221c" stroke-width="2.5"/><line x1="198" y1="8" x2="198" y2="18" stroke="#54615a" stroke-width="1.5"/><line x1="212" y1="8" x2="212" y2="22" stroke="#17221c" stroke-width="1.8"/><line x1="226" y1="8" x2="226" y2="28" stroke="#17221c" stroke-width="2.5"/><text x="16" y="42" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#17221c" text-anchor="middle">0</text><text x="72" y="42" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#17221c" text-anchor="middle">5</text><text x="128" y="42" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#17221c" text-anchor="middle">10</text><text x="184" y="42" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#17221c" text-anchor="middle">15</text><text x="226" y="42" font-family="ui-monospace, monospace" font-size="9" font-weight="700" fill="#54615a" text-anchor="middle">cm</text></svg>` },
  { id: 'macbook', side: 'left', tip: 'this is where the magic happens',
    style: 'top:36rem;left:max(-13.4rem, calc(-50vw + 50% + 0.6rem));width:8.6rem;z-index:3', rot: 7,
    img: '/assets/stickers/macbook.webp' },
  { id: 'airpods', side: 'left', tip: 'literally cannot function without music',
    style: 'top:46.5rem;left:max(-15.6rem, calc(-50vw + 50% + 0.2rem));width:5.8rem;z-index:4', rot: -10,
    img: '/assets/stickers/airpods.webp' },
  { id: 'diet-coke', side: 'left', tip: 'creative fuel',
    style: 'top:54.5rem;left:max(-11.2rem, calc(-50vw + 50% + 2.8rem));width:3.3rem;z-index:5', rot: -12,
    img: '/assets/stickers/diet-coke.webp' },
  { id: 'wip-stamp', side: 'left', tip: 'perpetual work in progress',
    style: 'top:61.5rem;left:max(-14rem, calc(-50vw + 50% + 1.2rem));width:5.4rem;z-index:3', rot: -8,
    svg: `<svg viewBox="0 0 160 80"><g transform="rotate(-6 80 40)"><rect x="8" y="8" width="144" height="64" rx="8" fill="none" stroke="#ef4444" stroke-width="5" stroke-dasharray="144 4 20 4"/><rect x="14" y="14" width="132" height="52" rx="5" fill="#fef2f2" opacity="0.15"/><text x="80" y="49" font-family="Impact, Arial Black, sans-serif" font-size="26" font-weight="900" fill="#ef4444" text-anchor="middle" letter-spacing="3">WIP DRAFT</text></g></svg>` },

  /* --- Right Side (Capabilities area) --- */
  { id: 'cmd-z', side: 'right', tip: 'my most pressed shortcut',
    style: 'bottom:24rem;right:max(-11.8rem, calc(-50vw + 50% + 2.2rem));width:4.8rem;z-index:3', rot: -12,
    svg: `<svg viewBox="0 0 140 110"><rect x="6" y="6" width="128" height="98" rx="20" fill="#18181b" stroke="#ffffff" stroke-width="4"/><rect x="12" y="12" width="116" height="86" rx="16" fill="#27272a"/><text x="50" y="64" font-family="ui-sans-serif, system-ui, sans-serif" font-size="34" font-weight="700" fill="#f4f4f5" text-anchor="middle">⌘</text><text x="92" y="65" font-family="ui-sans-serif, system-ui, sans-serif" font-size="32" font-weight="800" fill="#f57050" text-anchor="middle">Z</text></svg>` },
  { id: 'buildable-seal', side: 'right', tip: 'no un-codeable Figma dreams',
    style: 'bottom:18rem;right:max(-15.6rem, calc(-50vw + 50% + 0.3rem));width:5.4rem;z-index:4', rot: 8,
    svg: `<svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="66" fill="#047857" stroke="#ffffff" stroke-width="4" stroke-dasharray="5 3"/><circle cx="75" cy="75" r="54" fill="#065f46" stroke="#a7f3d0" stroke-width="2"/><text x="75" y="52" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9" font-weight="800" fill="#a7f3d0" text-anchor="middle" letter-spacing="1.5">SPEC READY</text><text x="75" y="78" font-family="ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">100%</text><text x="75" y="96" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="800" fill="#34d399" text-anchor="middle" letter-spacing="1">BUILDABLE</text><polygon points="75,102 77,108 83,108 78,112 80,118 75,114 70,118 72,112 67,108 73,108" fill="#fbbf24"/></svg>` },
  { id: 'gameboy', side: 'right', tip: '90s UI nostalgia',
    style: 'bottom:11.5rem;right:max(-12.4rem, calc(-50vw + 50% + 1.8rem));width:5.2rem;z-index:3', rot: -9,
    svg: `<svg viewBox="0 0 130 190"><rect x="8" y="8" width="114" height="174" rx="14" fill="#d1d5db" stroke="#1f2937" stroke-width="4"/><path d="M20 22 H110 V90 H30 L20 80 Z" fill="#6b7280" stroke="#1f2937" stroke-width="3"/><rect x="36" y="32" width="58" height="46" rx="4" fill="#84cc16" stroke="#3f6212" stroke-width="2"/><text x="65" y="60" font-family="ui-monospace, monospace" font-size="10" font-weight="900" fill="#365314" text-anchor="middle">▶ PLAY</text><rect x="26" y="112" width="28" height="10" rx="2" fill="#1f2937"/><rect x="35" y="103" width="10" height="28" rx="2" fill="#1f2937"/><circle cx="96" cy="116" r="7" fill="#dc2626" stroke="#991b1b" stroke-width="1.5"/><circle cx="82" cy="124" r="7" fill="#dc2626" stroke="#991b1b" stroke-width="1.5"/><line x1="84" y1="160" x2="102" y2="148" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/><line x1="90" y1="164" x2="108" y2="152" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/></svg>` },
  { id: 'keycap', side: 'right', tip: 'clack clack ship',
    style: 'bottom:5.8rem;right:max(-15.4rem, calc(-50vw + 50% + 0.6rem));width:4.4rem;z-index:4', rot: 14,
    svg: `<svg viewBox="0 0 130 130"><polygon points="12,24 118,24 104,8 26,8" fill="#e4e4e7" stroke="#18181b" stroke-width="4"/><polygon points="118,24 126,110 114,124 104,8" fill="#d4d4d8" stroke="#18181b" stroke-width="4"/><polygon points="12,24 4,110 16,124 26,8" fill="#d4d4d8" stroke="#18181b" stroke-width="4"/><rect x="16" y="24" width="98" height="94" rx="14" fill="#f43f5e" stroke="#18181b" stroke-width="4"/><rect x="26" y="32" width="78" height="74" rx="10" fill="#fb7185"/><text x="65" y="76" font-family="ui-monospace, SFMono-Regular, monospace" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">ESC</text></svg>` },
  { id: 'dunk-panda', side: 'right', tip: 'always a sneakerhead',
    style: 'bottom:-1rem;right:max(-16.2rem, calc(-50vw + 50% + 0.1rem));width:9rem;z-index:5', rot: -6,
    img: '/assets/stickers/dunk-panda.webp' },
  { id: 'mug', side: 'right', tip: 'i need more kawwwffeeee',
    style: 'bottom:-8.5rem;right:max(-10.8rem, calc(-50vw + 50% + 3.2rem));width:5.6rem;z-index:6', rot: 10,
    img: '/assets/stickers/black-coffee.webp' }
];

/* ------------------------------------------------ sound
   Kenney's CC0 sample set (assets/sfx, see CREDITS.txt). Decoded once
   into AudioBuffers so a fast drag can retrigger without re-fetching.
   Muted until you ask for it. */
const Sound = (() => {
  const KEY = 'v2:sounds-muted';
  const SFX = '/assets/sfx/';

  const CLICK = 'click-soft', SLICE = 'knife-slice', WHOOSH = 'maximize-004';
  const SCRATCH = ['scratch-001', 'scratch-002', 'scratch-003'];

  const VOLUME   = { click: .42, stickerPick: .42, stickerDrop: .42,
                     scratch: .3, cut: .5, fall: .4, swoosh: .4 };
  const THROTTLE = { click: 50, scratch: 100 };            // ms
  const RATE     = { fall: .86, swoosh: 1.06 };

  let ctx = null, scratchN = 0;
  const buffers = new Map(), lastAt = {};

  let muted = (() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === '1') return true;
      if (v === '0') return false;
    } catch {}
    return true;                                            // silent by default
  })();

  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

  async function load(name) {
    if (buffers.has(name)) return buffers.get(name);
    const res = await fetch(SFX + name + '.mp3');
    const buf = await ac().decodeAudioData(await res.arrayBuffer());
    buffers.set(name, buf);
    return buf;
  }

  const preload = () => [CLICK, SLICE, WHOOSH, ...SCRATCH].forEach(n => load(n).catch(() => {}));

  // consecutive scratches cycle samples and nudge the pitch, so scoring a
  // long line doesn't sound like one clip stuttering
  function sampleFor(voice) {
    if (voice === 'cut') return SLICE;
    if (voice === 'fall' || voice === 'swoosh') return WHOOSH;
    if (voice === 'scratch') return SCRATCH[scratchN++ % SCRATCH.length];
    return CLICK;
  }

  function fire(buf, voice) {
    const c = ac(), src = c.createBufferSource(), gain = c.createGain();
    src.buffer = buf;
    src.playbackRate.value = voice === 'scratch'
      ? 0.92 + (scratchN % 5) * 0.04
      : (RATE[voice] ?? 1);
    gain.gain.value = VOLUME[voice] ?? 0.4;
    src.connect(gain).connect(c.destination);
    src.start();
  }

  function play(voice) {
    if (muted || !(voice in VOLUME)) return;
    const gap = THROTTLE[voice], now = performance.now();
    if (gap !== undefined && now - (lastAt[voice] ?? -1e9) < gap) return;
    lastAt[voice] = now;

    try {
      const c = ac();
      if (c.state === 'suspended') c.resume();
      const name = sampleFor(voice);
      const buf = buffers.get(name);
      if (buf) fire(buf, voice);
      else load(name).then(b => fire(b, voice)).catch(() => {});
    } catch {}
  }

  return {
    play, preload,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch {}
      if (!muted) { preload(); play('click'); }
      return muted;
    }
  };
})();

/* ------------------------------------------------ the mat overlay */
function buildMat() {
  const rays = $('#mat-rays'), ticks = $('#mat-ticks');
  if (!rays) return;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a) => { const n = document.createElementNS(NS, t);
    for (const k in a) n.setAttribute(k, a[k]); return n; };

  // dashed rays fanning out of the bottom-left corner, labelled by angle
  for (const deg of [15, 30, 45, 60]) {
    const r = deg * Math.PI / 180, L = 2400;
    const g = el('g');
    g.append(el('line', {
      x1: 0, y1: 1200, x2: Math.cos(r) * L, y2: 1200 - Math.sin(r) * L,
      'stroke-dasharray': '8 7', 'vector-effect': 'non-scaling-stroke'
    }));
    const t = el('text', {
      x: Math.cos(r) * 390, y: 1200 - Math.sin(r) * 390 + 14,
      fill: 'var(--color-mat-guide)', 'font-size': 11, stroke: 'none',
      'font-family': 'ui-sans-serif, system-ui, sans-serif'
    });
    t.textContent = deg + '°';
    g.append(t); rays.append(g);
  }

  // ruler along the top edge: a tick every 24 units, numbered every 5th
  for (let x = 0, i = 0; x <= 1920; x += 24, i++) {
    const major = i % 5 === 0;
    ticks.append(el('line', { x1: x, y1: 10, x2: x, y2: major ? 24 : 17,
                              'vector-effect': 'non-scaling-stroke' }));
    if (major && i > 0) {
      const t = el('text', { x, y: 38, 'text-anchor': 'middle', stroke: 'none',
        fill: 'var(--color-mat-guide)', 'font-size': 10,
        'font-family': 'ui-sans-serif, system-ui, sans-serif' });
      t.textContent = i;
      ticks.append(t);
    }
  }
}

/* mat scratches heal themselves, so they're append-and-forget */
function scratch(x1, y1, x2, y2) {
  const svg = $('#scratches');
  if (!svg || reduced.matches) return;
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + (Math.random() * 8 - 4);
  const X = v => v / innerWidth * 1000, Y = v => v / innerHeight * 1000;
  p.setAttribute('d', `M ${X(x1)} ${Y(y1)} Q ${X(mx)} ${Y(my)} ${X(x2)} ${Y(y2)}`);
  p.setAttribute('class', 'mat-scratch');
  p.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(p);
  p.addEventListener('animationend', () => p.remove());
}

/* ------------------------------------------------ clothesline */
const ICONS = {
  link: '<svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 11 11 3M5 3h6v6"/></svg>',
  doc:  '<svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.5 1.5h5L11 4v8.5h-7.5z"/><path d="M5.5 7h4M5.5 9.5h4"/></svg>'
};

const CLIP = `<svg viewBox="0 0 44 100" fill="none">
  <rect x="6" y="4" width="14" height="92" rx="5" fill="var(--color-clothespin)" stroke="var(--color-clothespin-shadow)" stroke-width="2"/>
  <rect x="24" y="4" width="14" height="92" rx="5" fill="var(--color-clothespin-highlight)" stroke="var(--color-clothespin-shadow)" stroke-width="2"/>
  <circle cx="22" cy="27" r="8" fill="none" stroke="var(--color-clothespin-spring)" stroke-width="3.5"/>
  <path d="M14 27h16" stroke="var(--color-clothespin-spring-dark)" stroke-width="3"/>
</svg>`;

let order = WORK.map((_, i) => i);

function renderHangers(entering) {
  const box = $('#hangers');
  // The rope sags in the middle, so each card hangs a little lower the
  // closer it is to the centre — that's the whole trick.
  const n = order.length;
  box.innerHTML = order.map((idx, i) => {
    const w = WORK[idx];
    const t = n === 1 ? 0.5 : i / (n - 1);
    const sag = Math.sin(t * Math.PI) * 26 + 30;           // px below the rope
    const tilt = [2, 1, 0, -1.5, 1.5][i % 5];
    return `
      <div class="hanger" role="listitem" style="margin-top:${sag}px">
        <div class="hanger__inner ${entering ? 'arc-enter-forward' : ''}"
             style="--cut-delay:${i * 45}ms;--cut-tilt:${i % 2 ? -9 : 7}deg">
          <div class="polaroid-sway" style="--sway-delay:${(-i * 0.9).toFixed(2)}s">
            <div class="polaroid" style="transform:rotate(${tilt}deg)">
              <div class="polaroid__img">
                <img src="${w.img}" alt="${w.title}" loading="lazy">
              </div>
              <div class="hanger__cap">
                <span class="hanger__kind">${w.kind}</span>
                <h3>${w.title}</h3>
                <p>${w.blurb}</p>
                <div class="hanger__links">
                  ${w.links.map(l => `<a href="${l.href}" target="_blank" rel="noopener"
                      aria-label="${l.label} for ${w.title}" data-preview="${w.img}">${ICONS[l.icon]}</a>`).join('')}
                </div>
              </div>
            </div>
          </div>
          <span class="clip">${CLIP}</span>
        </div>
      </div>`;
  }).join('');
}

/* ------------------------------------------------ cutting the line */
let cutting = false;

function cutLine(x1, y1, x2, y2, drawScratch) {
  if (cutting || reduced.matches) return;
  cutting = true;

  Sound.play('cut');
  // a pointer drag already leaves its own trail; only the keyboard cut
  // needs one drawn for it
  if (drawScratch) scratch(x1, y1, x2, y2);

  const rope = $('#rope');
  const halves = [...rope.querySelectorAll('g[data-half]')];
  halves.forEach(g => g.classList.add(`rope-cut-${g.dataset.half}`));

  // cards let go, drop, then the line is re-strung with them in a new order
  $$('.hanger__inner').forEach(el => el.classList.add('is-cut'));
  setTimeout(() => Sound.play('fall'), 120);

  setTimeout(() => {
    $$('.hanger__inner').forEach(el => el.classList.add('arc-exit-forward'));
    Sound.play('swoosh');
  }, 520);

  setTimeout(() => {
    order = order.slice(1).concat(order[0]);   // rotate, so nothing is lost
    renderHangers(true);
    halves.forEach(g => g.classList.add('is-healing'));
  }, 860);

  setTimeout(() => {
    halves.forEach(g => g.classList.remove('rope-cut-left', 'rope-cut-right', 'is-healing'));
    cutting = false;
  }, 1600);
}

function initKnife() {
  const knife = $('#knife'), rope = $('#rope');
  if (!knife || !rope) return;

  const tipEl = $('.knife__tip', knife);
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  let last = null, crossed = false, lastHiss = 0;

  // the marker element is inside the rotated blade, so its rect already
  // accounts for the rotation — no trigonometry needed here
  const tipOf = () => {
    const r = tipEl.getBoundingClientRect();
    return { x: r.left, y: r.top };
  };

  const inRope = (p) => {
    const r = rope.getBoundingClientRect();
    return p.x >= r.left && p.x <= r.right && p.y >= r.top - 8 && p.y <= r.bottom + 8;
  };

  knife.addEventListener('pointerdown', e => {
    dragging = true; crossed = false;
    sx = e.clientX; sy = e.clientY; last = tipOf();
    try { knife.setPointerCapture(e.pointerId); } catch {}
    knife.dataset.dragging = 'true';
    Sound.play('stickerPick');
  });

  knife.addEventListener('pointermove', e => {
    if (!dragging) return;
    knife.style.transform =
      `translate3d(${e.clientX - sx + ox}px, ${e.clientY - sy + oy}px, 0) rotate(24deg)`;

    const tip = tipOf();

    // the blade scores the mat wherever it goes
    if (last && Math.hypot(tip.x - last.x, tip.y - last.y) > 5) {
      scratch(last.x, last.y, tip.x, tip.y);
      // one hiss per ~110ms, or a fast drag machine-guns the speakers
      const now = performance.now();
      if (now - lastHiss > 110) { Sound.play('scratch'); lastHiss = now; }
      last = tip;
    } else if (!last) last = tip;

    if (!crossed && inRope(tip)) {
      crossed = true;
      const r = rope.getBoundingClientRect();
      cutLine(Math.max(r.left, tip.x - 160), tip.y - 6, Math.min(r.right, tip.x + 160), tip.y + 6);
    }
  });

  const end = e => {
    if (!dragging) return;
    dragging = false; crossed = false; last = null;
    ox += e.clientX - sx; oy += e.clientY - sy;
    delete knife.dataset.dragging;
    Sound.play('stickerDrop');
  };
  knife.addEventListener('pointerup', end);
  knife.addEventListener('pointercancel', end);

  // keyboard equivalent, so the blade isn't pointer-only
  knife.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const r = rope.getBoundingClientRect();
    cutLine(r.left + 40, r.top + 14, r.right - 40, r.top + 20, true);
  });
}

/* ------------------------------------------------ draggable steel ruler */
const RULER_KEY = 'v2:ruler:pos';

function initRuler() {
  const ruler = $('#ruler');
  if (!ruler) return;

  const rot = -0.3;
  let pos = { x: 0, y: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(RULER_KEY) || 'null');
    if (saved && typeof saved.x === 'number') pos = saved;
  } catch {}

  const paint = () => {
    ruler.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${rot}deg)`;
  };
  paint();

  let dragging = false, sx = 0, sy = 0, base = pos;

  ruler.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    base = { ...pos };
    try { ruler.setPointerCapture(e.pointerId); } catch {}
    ruler.dataset.dragging = 'true';
    Sound.play('stickerPick');
  });

  ruler.addEventListener('pointermove', e => {
    if (!dragging) return;
    pos = { x: base.x + e.clientX - sx, y: base.y + e.clientY - sy };
    paint();
  });

  const drop = () => {
    if (!dragging) return;
    dragging = false;
    delete ruler.dataset.dragging;
    try { localStorage.setItem(RULER_KEY, JSON.stringify(pos)); } catch {}
    Sound.play('stickerDrop');
  };

  ruler.addEventListener('pointerup', drop);
  ruler.addEventListener('pointercancel', drop);

  ruler.addEventListener('v2:reset', () => {
    pos = { x: 0, y: 0 };
    try { localStorage.removeItem(RULER_KEY); } catch {}
    paint();
  });
}

/* ------------------------------------------------ MetalFx WebGL Liquid Metal Engine */
function initMetalFx() {
  const host = $('#ruler');
  const canvas = host?.querySelector('.metal-fx-canvas');
  if (!host || !canvas) return;

  const ctx2d = canvas.getContext('2d', { alpha: true });
  if (!ctx2d) return;

  // Offscreen WebGL canvas for rendering the liquid metal shader
  const glCanvas = document.createElement('canvas');
  glCanvas.width = 128;
  glCanvas.height = 128;
  const gl = glCanvas.getContext('webgl', { alpha: true, antialias: false, preserveDrawingBuffer: true }) ||
             glCanvas.getContext('experimental-webgl');
  if (!gl) return;

  const vsSource = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const fsSource = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec3 u_c1, u_c2, u_c3, u_c4, u_c5;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289v2(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m; m = m * m;
      vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x_) - 0.5;
      vec3 ox = floor(x_ + 0.5);
      vec3 a0 = x_ - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float fbm(vec2 p) {
      float val = 0.0, amp = 0.5;
      for (int i = 0; i < 5; i++) {
        val += amp * snoise(p);
        p *= 2.0;
        amp *= 0.5;
      }
      return val;
    }

    vec3 palette(float t) {
      t = clamp(t, 0.0, 1.0);
      t = t * t * (3.0 - 2.0 * t);
      float k = 64.0;
      float w1 = exp(-k * t * t);
      float w2 = exp(-k * (t - 0.25) * (t - 0.25));
      float w3 = exp(-k * (t - 0.5)  * (t - 0.5));
      float w4 = exp(-k * (t - 0.75) * (t - 0.75));
      float w5 = exp(-k * (t - 1.0)  * (t - 1.0));
      float total = w1 + w2 + w3 + w4 + w5 + 0.0001;
      return (u_c1 * w1 + u_c2 * w2 + u_c3 * w3 + u_c4 * w4 + u_c5 * w5) / total;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      float aspect = u_res.x / u_res.y;
      vec2 p = (uv - 0.5) * 2.5;
      p.x *= aspect;
      p += vec2(cos(1.396), sin(1.396)) * u_time * 0.18;

      float val = sin(p.x * 5.0 + u_time) + sin(p.y * 5.0 + u_time * 1.3);
      val += sin((p.x + p.y) * 3.5 + u_time * 0.7);
      val += sin(length(p) * 4.0 - u_time * 1.5);
      vec2 w = vec2(fbm(p + vec2(u_time * 0.1, 0.0)), fbm(p + vec2(0.0, u_time * 0.12) + 5.0)) * 0.6;
      val += (w.x + w.y) * 0.3;
      val = val * 0.2 * 2.0 + 0.5;

      vec3 col = palette(clamp(val, 0.0, 1.0));
      col = pow(col, vec3(1.3));

      gl_FragColor = vec4(col, 0.95);
    }
  `;

  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, createShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, createShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const posAttr = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(posAttr);
  gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uC1 = gl.getUniformLocation(prog, 'u_c1');
  const uC2 = gl.getUniformLocation(prog, 'u_c2');
  const uC3 = gl.getUniformLocation(prog, 'u_c3');
  const uC4 = gl.getUniformLocation(prog, 'u_c4');
  const uC5 = gl.getUniformLocation(prog, 'u_c5');

  // Exact MetalFx Silver palette: ["#000000","#dedede","#747270","#e5e5e5","#ffffff"]
  const hex = h => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
  gl.uniform3fv(uC1, hex('#000000'));
  gl.uniform3fv(uC2, hex('#dedede'));
  gl.uniform3fv(uC3, hex('#747270'));
  gl.uniform3fv(uC4, hex('#e5e5e5'));
  gl.uniform3fv(uC5, hex('#ffffff'));
  gl.uniform2f(uRes, glCanvas.width, glCanvas.height);

  let startT = performance.now();
  let dpr = Math.min(2, window.devicePixelRatio || 1);

  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  let isVisible = true;
  let rafId = null;

  const render = () => {
    if (!isVisible || document.hidden) {
      rafId = null;
      return;
    }
    const now = (performance.now() - startT) / 1000 * 0.35;

    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.uniform1f(uTime, now);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const w = canvas.width;
    const h = canvas.height;
    if (w >= 4 && h >= 4) {
      ctx2d.clearRect(0, 0, w, h);
      ctx2d.drawImage(glCanvas, 0, 0, glCanvas.width, glCanvas.height, 0, 0, w, h);

      // Mask the interior with destination-out so only the 1.5px liquid metal border is left
      const ringPx = 1.5 * dpr;
      const radius = 6 * dpr;
      ctx2d.save();
      ctx2d.globalCompositeOperation = 'destination-out';
      ctx2d.fillStyle = '#000';
      ctx2d.beginPath();
      ctx2d.roundRect(ringPx, ringPx, w - 2 * ringPx, h - 2 * ringPx, Math.max(0, radius - ringPx));
      ctx2d.fill();
      ctx2d.restore();
    }
    rafId = requestAnimationFrame(render);
  };

  const startLoop = () => {
    if (!rafId && isVisible && !document.hidden) {
      rafId = requestAnimationFrame(render);
    }
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
      if (isVisible) startLoop();
    }, { threshold: 0.05 });
    io.observe(host);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isVisible) startLoop();
  });

  startLoop();
}

/* ------------------------------------------------ desk stickers */
const SKEY = id => `v2:sticker:${id}`;

function renderStickers() {
  for (const side of ['left', 'right']) {
    const host = $(`#stickers-${side}`);
    if (!host) continue;
    host.innerHTML = STICKERS.filter(s => s.side === side).map(s => `
      <div class="cutout" data-id="${s.id}" tabindex="0" role="img" aria-label="${s.tip}"
           style="${s.style};--rot:${s.rot}deg;transform:translate3d(0,0,0) rotate(${s.rot}deg)">
        <div class="cutout__pop">${s.img
          ? `<img src="${s.img}" alt="" draggable="false" data-sticker-img>`
          : s.svg}</div>
        <span class="cutout__tip">${s.tip}</span>
      </div>`).join('');
  }

  // no PNG dropped in yet (or it failed) → fall back to the drawn stand-in
  $$('[data-sticker-img]').forEach(img => {
    const s = STICKERS.find(x => x.id === img.closest('.cutout').dataset.id);
    if (!s || !s.svg) return;          // no stand-in drawn for this one
    const swap = () => { img.parentElement.innerHTML = s.svg; };
    img.addEventListener('error', swap);
    if (img.complete && !img.naturalWidth) swap();
  });

  $$('.cutout').forEach(el => {
    const id = el.dataset.id;
    const rot = el.style.getPropertyValue('--rot');
    let pos = { x: 0, y: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem(SKEY(id)) || 'null');
      if (saved && typeof saved.x === 'number') pos = saved;
    } catch {}
    const paint = () => { el.style.transform =
      `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${rot})`; };
    paint();

    let dragging = false, sx = 0, sy = 0, base = pos;

    el.addEventListener('pointerdown', e => {
      dragging = true; sx = e.clientX; sy = e.clientY; base = { ...pos };
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.dataset.dragging = 'true';
      Sound.play('stickerPick');
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      pos = { x: base.x + e.clientX - sx, y: base.y + e.clientY - sy };
      paint();
    });
    const drop = () => {
      if (!dragging) return;
      dragging = false;
      delete el.dataset.dragging;
      el.dataset.justDropped = 'true';
      el.addEventListener('pointerleave', function off() {
        delete el.dataset.justDropped; el.removeEventListener('pointerleave', off);
      });
      try { localStorage.setItem(SKEY(id), JSON.stringify(pos)); } catch {}
      Sound.play('stickerDrop');
    };
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);

    el.addEventListener('v2:reset', () => { pos = { x: 0, y: 0 }; paint(); });
  });
}

/* ------------------------------------------------ link previews */
function initPreviews() {
  let card = null, hideT = null;

  const show = (a) => {
    const src = a.dataset.preview;
    if (!src || matchMedia('(pointer: coarse)').matches) return;
    hide();
    card = document.createElement('div');
    card.className = 'link-preview';
    card.innerHTML = `<img src="${src}" alt="">`;
    document.body.append(card);
    const r = a.getBoundingClientRect(), w = 144;
    card.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px';
    card.style.top  = Math.max(8, r.top - card.offsetHeight - 10) + 'px';
  };
  const hide = () => { clearTimeout(hideT); card?.remove(); card = null; };

  $$('[data-preview]').forEach(a => {
    a.addEventListener('pointerenter', () => show(a));
    a.addEventListener('focus', () => show(a));
    a.addEventListener('pointerleave', () => { hideT = setTimeout(hide, 80); });
    a.addEventListener('blur', hide);
  });
  addEventListener('scroll', hide, { passive: true });
}

/* ------------------------------------------------ misc wiring */
function initSound() {
  const btn = $('#sound');
  const paint = () => {
    const m = Sound.muted;
    btn.setAttribute('aria-pressed', String(!m));
    btn.setAttribute('aria-label', m ? 'Unmute sound effects' : 'Mute sound effects');
    btn.title = m ? 'Unmute' : 'Mute';
  };
  paint();
  if (!Sound.muted) Sound.preload();   // already on from a past visit
  btn.addEventListener('click', () => { Sound.toggle(); paint(); });

  // every other click on something clickable gets the paper tick
  document.addEventListener('click', e => {
    const t = e.target.closest('a[href], button, [role="button"]');
    if (t && t !== btn) Sound.play('click');
  });
}

/* ------------------------------------------------ reset stickers button */
function initReset() {
  const btn = $('#reset-stickers');
  if (!btn) return;
  btn.addEventListener('click', () => {
    Sound.play('peel');
    $$('.cutout').forEach(el => el.dispatchEvent(new Event('v2:reset')));
    $('#ruler')?.dispatchEvent(new Event('v2:reset'));
  });
}

/* sections fade up as they arrive rather than all at once on load */
function initReveal() {
  if (reduced.matches) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.style.animationPlayState = 'running';
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('.animate-fade-up').forEach((el, i) => {
    if (i === 0) return;                       // the profile is already in view
    el.style.animationPlayState = 'paused';
    io.observe(el);
  });
}

/* ------------------------------------------------ go */
buildMat();
renderHangers(false);
initRuler();
initMetalFx();
renderStickers();
initKnife();
initPreviews();
initSound();
initReset();
initReveal();

try {
  localStorage.removeItem('v2:sig-calibration');
  localStorage.removeItem('v2:photo-calibration');
  localStorage.removeItem('v2:sig-txt-calibration');
} catch {}

})();
