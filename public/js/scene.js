/* =====================================================================
   Scene Engine — 3D WebGL runtime.
   Everything on this page is generated at runtime: no photographs,
   no video, no external assets beyond three.js and two subset fonts.
   ===================================================================== */
(function () {
'use strict';

/* ------------------------------------------------------------ 0 · basics */
const Q      = new URLSearchParams(location.search);
const qs     = (k, d) => { const v = Q.get(k); return v === null ? d : v; };
const qn     = (k, d) => { const v = Q.get(k); return v === null ? d : parseFloat(v); };
/* The browser restores the scroll position of a reload, and it does it around
   the load event — which is long before the last build job finishes, so nothing
   written during boot can outlive it. Taking it off manual has to happen here,
   in the first task the script gets, or a reload halfway down the page comes
   back with the camera parked in the colophon and the hero never plays. */
try { history.scrollRestoration = 'manual'; } catch (e) {}

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(hover: none)').matches;

const clamp  = (v, a, b) => v < a ? a : (v > b ? b : v);
const sat    = v => clamp(v, 0, 1);
const lerp   = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const easeOut= t => 1 - Math.pow(1 - t, 3);
const TAU    = Math.PI * 2;
/* frame-rate independent damping */
const damp   = (cur, to, rate, dt) => lerp(cur, to, 1 - Math.exp(-rate * dt));

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/* classic 2-D gradient noise */
function noise2D(seed) {
  const rnd = mulberry32(seed), p = new Uint8Array(256), perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0, t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const X = xi & 255, Y = yi & 255, xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    const g = (h, dx, dy) => { const q = G[h & 7]; return q[0] * dx + q[1] * dy; };
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return lerp(lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u),
                lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u), v);
  };
}
function fbm(n, x, y, oct, lac, gain) {
  let a = .5, f = 1, s = 0, m = 0;
  for (let i = 0; i < (oct || 4); i++) { s += a * n(x * f, y * f); m += a; a *= (gain || .5); f *= (lac || 2); }
  return s / m;                                    /* −1 … 1 */
}

/* ------------------------------------------------------------ 1 · canvas */
function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const hex = (r, g, b) => 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';

/* stacked, up-scaled value noise — 30× faster than a per-pixel fbm and
   indistinguishable once it is multiplied under a dark base colour */
function fbmCanvas(W, H, seed, octaves, baseCells, contrast) {
  const out = cvs(W, H), o = out.getContext('2d');
  o.fillStyle = '#808080'; o.fillRect(0, 0, W, H);
  let cells = baseCells || 3, alpha = 1;
  for (let i = 0; i < (octaves || 5); i++) {
    const n = cvs(cells, cells), nx = n.getContext('2d');
    const im = nx.createImageData(cells, cells), d = im.data, r = mulberry32(seed + i * 977);
    for (let k = 0; k < cells * cells; k++) {
      const v = 128 + (r() - .5) * 255 * (contrast || 1);
      d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = clamp(v, 0, 255); d[k * 4 + 3] = 255;
    }
    nx.putImageData(im, 0, 0);
    o.globalAlpha = alpha;
    o.globalCompositeOperation = i === 0 ? 'source-over' : 'overlay';
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    o.drawImage(n, 0, 0, W, H);
    cells *= 2; alpha *= .62;
  }
  o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
  return out;
}

/* height → tangent-space normal map (blur first, then Sobel) */
function normalFromHeight(hc, strength) {
  const W = hc.width, H = hc.height;
  const b = cvs(W, H), bx = b.getContext('2d');
  bx.filter = 'blur(1.1px)'; bx.drawImage(hc, 0, 0); bx.filter = 'none';
  const src = bx.getImageData(0, 0, W, H).data;
  const out = cvs(W, H), ox = out.getContext('2d');
  const im = ox.createImageData(W, H), d = im.data;
  const at = (x, y) => src[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  const s = strength || 2.4;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = (at(x + 1, y) - at(x - 1, y)) * s;
    const gy = (at(x, y + 1) - at(x, y - 1)) * s;
    let nx = -gx, ny = gy, nz = 1;
    const il = 1 / Math.hypot(nx, ny, nz);
    const i = (y * W + x) * 4;
    d[i]     = (nx * il * .5 + .5) * 255;
    d[i + 1] = (ny * il * .5 + .5) * 255;
    d[i + 2] = (nz * il * .5 + .5) * 255;
    d[i + 3] = 255;
  }
  ox.putImageData(im, 0, 0);
  return out;
}

/* ------------------------------------------------------- 2 · surfaces */
/* one maple leaf, white on transparent — tinted per instance */
function texLeaf() {
  const S = 128, c = cvs(S, S), x = c.getContext('2d');
  x.translate(S / 2, S * .92); x.scale(S / 2.2, -S / 2.2);
  x.beginPath();
  const lobes = 5, spread = 1.9;
  for (let i = 0; i < lobes; i++) {
    const a = -spread / 2 + spread * (i / (lobes - 1)) + Math.PI / 2;
    const len = i === 2 ? .96 : (i === 1 || i === 3 ? .82 : .60);
    const wob = .17;
    x.moveTo(0, .02);
    x.lineTo(Math.cos(a - wob) * len * .55, Math.sin(a - wob) * len * .55);
    x.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    x.lineTo(Math.cos(a + wob) * len * .55, Math.sin(a + wob) * len * .55);
    x.closePath();
  }
  x.fillStyle = '#fff'; x.fill();
  x.lineWidth = .05; x.strokeStyle = '#fff'; x.stroke();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'destination-out';
  const rnd = mulberry32(3);
  for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(rnd() * S, rnd() * S, rnd() * 3, 0, TAU); x.fill(); }
  return c;
}

/* the night sky itself: black at altitude, going to the fog colour at the
   horizon so the backdrop and the depth cue meet without a seam */
/* The backdrop, and the plane it is mapped to. They live in one place because
   the gradient has to stay anchored to the same world height however large the
   plane grows, and the plane had to grow: at 1000 x 460 it did not cover the
   frustum. Measured across the whole walk at 16:9, the frame needs the plate
   to reach x +/-658 and y -181..423 at this depth, and the plate reached +/-500
   and 326. So in the chapters where the rig yaws hardest its top corner came
   inside the frame and left a hard-edged wedge of clear colour in the sky —
   a straight diagonal seam with nothing behind it.

   Growing the plane and letting the texture stretch would have dragged the
   horizon lift hundreds of units below the ground, so instead the gradient
   keeps its original 460-unit band in its original position and the plate is
   padded above and below with the flat colours the band ends on. `gTop` and
   `gBot` are that band; everything else is derived.

   Sized against the widest frame worth supporting rather than against 16:9.
   The first correction covered 16:9 with two hundred units to spare and was
   still 192 units short at 21:9, because a wider viewport widens the frustum
   without the rig compensating — `fitAspect` only steps back on *tall* frames.
   Measured margins now: 16:9 ~500 a side, 21:9 ~200, 430x932 ~150 at the
   tightest edge. */
const SKY = { w: 2500, h: 1200, y: 140, z: -300, gTop: 326, gBot: -134 };

function texSky() {
  /* one canvas row per world unit, so the band lands on exact rows */
  const W = 1024, H = SKY.h, c = cvs(W, H), x = c.getContext('2d');
  const top = SKY.y + SKY.h / 2;                       /* world y of row 0 */
  const r0 = top - SKY.gTop, r1 = top - SKY.gBot;      /* the band, in rows */

  x.fillStyle = 'rgb(6,10,15)';  x.fillRect(0, 0, W, r0);
  x.fillStyle = 'rgb(14,22,28)'; x.fillRect(0, r1, W, H - r1);
  const g = x.createLinearGradient(0, r0, 0, r1);
  g.addColorStop(0, 'rgb(6,10,15)');    g.addColorStop(.34, 'rgb(13,22,31)');
  g.addColorStop(.66, 'rgb(17,26,34)'); g.addColorStop(.88, 'rgb(24,35,42)');
  g.addColorStop(1, 'rgb(14,22,28)');
  x.fillStyle = g; x.fillRect(0, r0, W, r1 - r0);

  /* cloud, and a low warm bloom off the valley behind the ridge */
  x.globalAlpha = .34; x.globalCompositeOperation = 'overlay';
  x.drawImage(fbmCanvas(W, H, 313, 5, 3, .9), 0, 0);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  /* the bloom keeps its world position: it used to sit at .68 of a plate that
     spanned x +/-500, which is x = 180, and just under the foot of the band */
  const gx = (180 + SKY.w / 2) / SKY.w * W, gy = r1 - (SKY.gTop - SKY.gBot) * .05;
  const gr = 440 / SKY.w * W;                          /* .44 of the old plate */
  const wg = x.createRadialGradient(gx, gy, 4, gx, gy, gr);
  wg.addColorStop(0, 'rgba(150,66,26,.30)'); wg.addColorStop(.5, 'rgba(96,44,22,.12)');
  wg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = wg; x.fillRect(0, 0, W, H);

  /* a scatter of stars, faint enough to survive the bloom. Density is held to
     what it was, so the wider plate simply carries more of them rather than
     the same 420 spread thin. */
  const rnd = mulberry32(881), horizon = r1 - (SKY.gTop - SKY.gBot) * .22;
  const N = Math.round(420 * (W * horizon) / (512 * 399));
  for (let i = 0; i < N; i++) {
    const sx = rnd() * W, sy = rnd() * horizon, r = .5 + rnd() * rnd() * 1.7;
    /* faded toward the horizon exactly as before — against the band, not the
       plate, or the padding above would wash every star out */
    const f = clamp(1 - (sy - r0) / (r1 - r0), 0, 1);
    x.fillStyle = 'rgba(214,232,240,' + ((.12 + rnd() * .42) * f).toFixed(3) + ')';
    x.beginPath(); x.arc(sx, sy, r, 0, TAU); x.fill();
  }
  return c;
}

/* -------------------------------------------------------- the blood moon
   A real lunar disc, not a glow sprite and not a noise field. Three things do
   the work, in this order of importance:

     1 · the maria. The dark seas are the Moon's signature and they are not
         fbm — they are a handful of large, lobed, soft-edged basins in a
         layout everyone has known since childhood. Drawn at their real
         near-side positions and blurred, they are what makes the disc read as
         the Moon at a glance instead of as a planet.
     2 · the ray systems. Fine bright streaks thrown out of Tycho and
         Copernicus, straight across the maria. Nothing else on the surface
         looks like this, so nothing else identifies it as fast.
     3 · the craters, thickest in the bright highlands, each with a rim lit
         from the same side as the rest of the frame.

   The tint is measured off the reference plate, not invented: a blood moon
   sits at G/R ≈ B/R ≈ .48 — a rose red with green and blue level. Grading it
   as an orange (blue well under green) is what makes a CG moon read as a
   fireball, and that is what this was doing. The disc is authored here in
   near-neutral albedo and the colour is applied once, on the material. */
function texMoon() {
  const S = 512, c = cvs(S, S), x = c.getContext('2d');
  const R = S / 2 - 1, rnd = mulberry32(91);
  const px = (u, v) => [S / 2 + u * R, S / 2 + v * R];        /* disc coords */

  x.beginPath(); x.arc(S / 2, S / 2, R, 0, TAU); x.closePath();
  x.save(); x.clip();

  /* highland base. The reference disc is very slightly brighter at the limb,
     not darker — during totality the rim keeps its forward scatter — so this
     ramp opens outward instead of falling off. */
  const g = x.createRadialGradient(S * .46, S * .44, S * .05, S / 2, S / 2, R);
  g.addColorStop(0, 'rgb(150,150,150)'); g.addColorStop(.55, 'rgb(158,158,158)');
  g.addColorStop(.86, 'rgb(178,178,178)'); g.addColorStop(1, 'rgb(196,196,196)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);

  /* fine highland mottle */
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = .5;
  x.drawImage(fbmCanvas(256, 256, 517, 6, 4, 1.1), 0, 0, S, S);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';

  /* --- 1 · the maria, at their near-side places (u right, v down) --------- */
  const seas = [
    [-.52, -.06, .46, .80],   /* Oceanus Procellarum */
    [-.26, -.38, .31, .92],   /* Imbrium             */
    [ .13, -.31, .20, .88],   /* Serenitatis         */
    [ .30, -.08, .23, .84],   /* Tranquillitatis     */
    [ .45,  .12, .15, .78],   /* Fecunditatis        */
    [ .27,  .27, .12, .74],   /* Nectaris            */
    [ .57, -.30, .12, .95],   /* Crisium, the one that stands on its own */
    [-.27,  .30, .19, .70],   /* Nubium              */
    [-.47,  .25, .13, .72],   /* Humorum             */
  ];
  const sea = cvs(S, S), sx = sea.getContext('2d');
  seas.forEach(([u, v, rad, dk]) => {
    /* a basin is a cluster of lobes, never a circle */
    for (let i = 0; i < 22; i++) {
      const a = rnd() * TAU, off = rnd() * rad * .66;
      const [bx, by] = px(u + Math.cos(a) * off, v + Math.sin(a) * off * .8);
      const rr = rad * R * (.30 + rnd() * .46);
      const bg = sx.createRadialGradient(bx, by, rr * .2, bx, by, rr);
      bg.addColorStop(0, 'rgba(0,0,0,' + (dk * .14).toFixed(3) + ')');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      sx.fillStyle = bg; sx.beginPath(); sx.arc(bx, by, rr, 0, TAU); sx.fill();
    }
  });
  /* a sea is dark, not black: the real mare/highland contrast is about 4:3,
     and anything heavier turns the disc into a skull */
  x.save(); x.filter = 'blur(9px)'; x.globalAlpha = .90;
  x.drawImage(sea, 0, 0); x.restore();
  /* mottle riding on top of the basins so their floors are not flat washes */
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = .18;
  x.drawImage(fbmCanvas(256, 256, 811, 4, 11, 1.2), 0, 0, S, S);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';

  /* --- 2 · ray systems, thrown clear across the disc ---------------------- */
  const ray = cvs(S, S), rx2 = ray.getContext('2d');
  [[-.10, .54, 150, 1], [-.28, -.07, 80, .6], [-.46, -.04, 60, .45]].forEach(([u, v, n, str]) => {
    const [ox, oy] = px(u, v);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, len = R * (.30 + rnd() * rnd() * 1.3);
      /* start clear of the crater — rays converging on a point read as a
         lens flare, and the real ones begin outside the ejecta blanket */
      const t0 = R * (.08 + rnd() * .06);
      const p0 = [ox + Math.cos(a) * t0, oy + Math.sin(a) * t0];
      const p1 = [ox + Math.cos(a) * len, oy + Math.sin(a) * len];
      const rg = rx2.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
      rg.addColorStop(0, 'rgba(255,255,255,' + (.085 * str).toFixed(3) + ')');
      rg.addColorStop(.4, 'rgba(255,255,255,' + (.055 * str).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      rx2.strokeStyle = rg; rx2.lineWidth = .8 + rnd() * 2.4; rx2.lineCap = 'round';
      rx2.beginPath(); rx2.moveTo(p0[0], p0[1]);
      rx2.quadraticCurveTo(ox + Math.cos(a + .06) * len * .55, oy + Math.sin(a + .06) * len * .55,
                           p1[0], p1[1]);
      rx2.stroke();
    }
  });
  x.save(); x.filter = 'blur(2.4px)'; x.globalCompositeOperation = 'lighter';
  x.globalAlpha = .62; x.drawImage(ray, 0, 0); x.restore();

  /* --- 3 · the crater field ----------------------------------------------
     A crater is not a ring. Stroked with a gradient running across it, the
     same circle gives a rim lit on the sun side and thrown into shadow on the
     other — which is the read — where a radial ring gives a bubble. */
  const inSea = (u, v) => seas.some(([su, sv, rad]) =>
    Math.hypot(u - su, (v - sv) * 1.15) < rad * .82);
  for (let i = 0; i < 620; i++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()) * .97;
    const u = Math.cos(a) * rr, v = Math.sin(a) * rr;
    /* the seas are young and nearly unmarked — that contrast is the point */
    if (inSea(u, v) && rnd() > .12) continue;
    const [cx2, cy] = px(u, v);
    const big = rnd() > .975;
    const r = (1 + rnd() * rnd() * rnd() * (big ? 34 : 11)) * (S / 512);
    const fade = .55 + .45 * Math.sqrt(Math.max(0, 1 - rr * rr));   /* limb falloff */
    /* foreshortened toward the limb, like anything on a sphere */
    const sq = Math.sqrt(Math.max(0, 1 - rr * rr)) * .72 + .28;
    x.save(); x.translate(cx2, cy); x.rotate(Math.atan2(v, u)); x.scale(sq, 1);
    x.rotate(-Math.atan2(v, u));                       /* keep the sun direction */
    const rimW = Math.max(.8, r * .26);
    const lg = x.createLinearGradient(-r, -r, r, r);   /* sun sits up-left */
    lg.addColorStop(0, 'rgba(255,255,255,' + (.34 * fade).toFixed(3) + ')');
    lg.addColorStop(.5, 'rgba(255,255,255,0)');
    lg.addColorStop(1, 'rgba(0,0,0,' + (.38 * fade).toFixed(3) + ')');
    x.strokeStyle = lg; x.lineWidth = rimW;
    x.beginPath(); x.arc(0, 0, Math.max(.6, r - rimW * .5), 0, TAU); x.stroke();
    if (r > 3) {                                        /* the floor it encloses */
      const fg = x.createLinearGradient(-r, -r, r, r);
      fg.addColorStop(0, 'rgba(0,0,0,' + (.21 * fade).toFixed(3) + ')');
      fg.addColorStop(1, 'rgba(255,255,255,' + (.07 * fade).toFixed(3) + ')');
      x.fillStyle = fg; x.beginPath(); x.arc(0, 0, r - rimW, 0, TAU); x.fill();
    }
    if (r > 13) {                                       /* central peak */
      x.fillStyle = 'rgba(255,255,255,' + (.14 * fade).toFixed(3) + ')';
      x.beginPath(); x.arc(-r * .04, -r * .04, r * .11, 0, TAU); x.fill();
    }
    x.restore();
  }

  /* surface tooth: genuinely fine, or it just adds another layer of cloud
     and the basins disappear under it */
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = .13;
  x.drawImage(fbmCanvas(S, S, 977, 2, 210, 1.3), 0, 0, S, S);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';

  /* the terminator side: the disc is not lit dead-on */
  const sh = x.createRadialGradient(S * .40, S * .38, S * .18, S * .52, S * .56, S * .72);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.30)');
  x.fillStyle = sh; x.fillRect(0, 0, S, S);
  x.restore();

  /* a one-pixel feather on the limb so it is a moon in air, not a cut disc */
  const fe = x.createRadialGradient(S / 2, S / 2, R - 2.5, S / 2, S / 2, R);
  fe.addColorStop(0, 'rgba(0,0,0,1)'); fe.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'destination-in';
  x.fillStyle = fe; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'source-over';
  return c;
}

/* soft round falloff — haze, embers, glows */
function texGlow(inner, mid) {
  const S = 256, c = cvs(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner || 'rgba(255,255,255,1)');
  g.addColorStop(.28, mid || 'rgba(255,255,255,.36)');
  g.addColorStop(.62, 'rgba(255,255,255,.07)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}

/* one wisp — a round mote, not a streak. The whole read is a hard bright
   point sitting in a soft halo, so the falloff is deliberately uneven: almost
   all of the light is spent inside the first eighth of the radius and the rest
   is a wide, very faint bloom. A smooth gradient across the full radius gives
   an evenly lit blob with no centre to it. */
function texWisp() {
  const S = 128, c = cvs(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0,   'rgba(255,255,255,1)');      /* the point itself */
  g.addColorStop(.07, 'rgba(236,250,250,.92)');
  g.addColorStop(.16, 'rgba(190,230,238,.40)');
  g.addColorStop(.34, 'rgba(132,192,212,.13)');
  g.addColorStop(.62, 'rgba(88,146,172,.035)');
  g.addColorStop(1,   'rgba(70,120,142,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}

/* ---------------------------------------------- 3 · the foreground cut-outs
   These are the "transparent PNG" layers: painted at high resolution with
   a ragged alpha edge, then hung in front of the type as real geometry so
   they parallax and sway.                                                */
function texGrassCutout(seed, opt) {
  opt = opt || {};
  const W = opt.w || 2048, H = opt.h || 1024;
  const c = cvs(W, H), x = c.getContext('2d');
  const rnd = mulberry32(seed), n = noise2D(seed * 13 + 5);

  /* --- silhouette ------------------------------------------------- */
  const crest = opt.crest !== undefined ? opt.crest : .46;
  const peak  = opt.peak  !== undefined ? opt.peak  : .60;
  const wide  = opt.wide  !== undefined ? opt.wide  : .40;
  const prof = new Float32Array(W);
  for (let i = 0; i < W; i++) {
    const t = i / W;
    let m = Math.exp(-Math.pow((t - crest) / wide, 2) * 2.1);
    m += .46 * Math.exp(-Math.pow((t - crest - (opt.crest2 || .40)) / (wide * .62), 2) * 3.1);
    m += .30 * Math.exp(-Math.pow((t - crest + (opt.crest3 || .46)) / (wide * .70), 2) * 3.4);
    const g = fbm(n, t * 4.2, .5, 4, 2.05, .52) * .5 + .5;
    prof[i] = m * (.80 + .38 * g);
  }
  let pk = 0; for (let i = 0; i < W; i++) pk = Math.max(pk, prof[i]);
  for (let i = 0; i < W; i++) prof[i] *= H * peak / pk;
  const surf = i => H - prof[clamp(i | 0, 0, W - 1)];

  /* --- body ------------------------------------------------------- */
  x.beginPath(); x.moveTo(0, H);
  for (let i = 0; i < W; i += 3) x.lineTo(i, surf(i));
  x.lineTo(W, surf(W - 1)); x.lineTo(W, H); x.closePath();
  const bg = x.createLinearGradient(0, H - H * peak, 0, H);
  bg.addColorStop(0, '#1a2416'); bg.addColorStop(.38, '#0e150c'); bg.addColorStop(1, '#040604');
  x.fillStyle = bg; x.fill();
  x.save(); x.clip();
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = .5;
  x.drawImage(fbmCanvas(1024, 512, seed + 3, 5, 3, 1), 0, 0, W, H);
  x.restore();
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';

  /* --- blades ----------------------------------------------------- */
  const LIGHT = opt.light || [-.42, -.91];            /* light comes from up-left */
  const N = opt.blades || 15000;
  const blades = [];
  for (let k = 0; k < N; k++) {
    const i = (rnd() * W) | 0;
    const s = surf(i);
    /* bias the population toward the silhouette so the edge stays ragged */
    const depth = Math.pow(rnd(), 2.3);
    const by = s + depth * (H - s) + (rnd() - .5) * 6;
    if (by > H + 20) continue;
    blades.push({ i: i, by: by, depth: depth, r: rnd(), r2: rnd(), r3: rnd() });
  }
  blades.sort((a, b) => a.by - b.by);                 /* far (high) first */

  const LEN = (opt.len || 46) * (W / 2048);
  for (let k = 0; k < blades.length; k++) {
    const b = blades[k];
    const bx = b.i + (b.r - .5) * 5;
    const grow = 1 - .52 * b.depth;
    const len = LEN * (.36 + 1.05 * b.r2 * b.r2) * grow;
    let lean = (b.r3 - .5) * 1.5 + (opt.wind || .16);
    /* blades on the sunward flank lean into frame */
    const tipx = bx + lean * len * .95, tipy = b.by - len;
    const cx2 = bx + lean * len * .30, cy2 = b.by - len * .62;
    const w = (.9 + 1.9 * b.r) * grow * (W / 2048);

    /* shade: facing the key light, plus exposure to the sky at the crest */
    const dx = tipx - bx, dy = tipy - b.by, il = 1 / Math.hypot(dx, dy);
    const ndl = sat((-(dx * il) * LIGHT[0] - (dy * il) * LIGHT[1]) * .5 + .5);
    const open = Math.pow(1 - b.depth, 1.35);
    let l = .10 + .46 * open + .34 * ndl * open;
    const warm = sat(open * 1.25 - .42) * (opt.warm !== undefined ? opt.warm : 1);
    const r = (10 + 78 * l + 44 * warm) * (opt.tintR || 1);
    const g = (16 + 106 * l + 24 * warm) * (opt.tintG || 1);
    const bl = (12 + 80 * l + 16 * warm) * (opt.tintB || 1);
    x.fillStyle = hex(r, g, bl);
    x.beginPath();
    x.moveTo(bx - w, b.by);
    x.quadraticCurveTo(cx2 - w * .35, cy2, tipx, tipy);
    x.quadraticCurveTo(cx2 + w * .35, cy2, bx + w, b.by);
    x.closePath(); x.fill();
  }

  /* --- grade: red bounce from the sun, cold sky on the crest ------- */
  x.globalCompositeOperation = 'source-atop';
  const rb = x.createLinearGradient(opt.bounceFrom || W, 0, opt.bounceTo || 0, 0);
  rb.addColorStop(0, 'rgba(180,40,16,.24)'); rb.addColorStop(.55, 'rgba(140,32,14,.07)'); rb.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = rb; x.fillRect(0, 0, W, H);
  const sk = x.createLinearGradient(0, H - H * peak * 1.05, 0, H);
  sk.addColorStop(0, 'rgba(146,182,180,.13)'); sk.addColorStop(.5, 'rgba(0,0,0,0)'); sk.addColorStop(1, 'rgba(0,0,0,.70)');
  x.fillStyle = sk; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  return c;
}

/* wet foreground boulders */
function texRockCutout(seed, opt) {
  opt = opt || {};
  const W = opt.w || 1536, H = opt.h || 1024;
  const c = cvs(W, H), x = c.getContext('2d');
  const rnd = mulberry32(seed), n = noise2D(seed * 7 + 11);
  const blobs = opt.blobs || [[.30, .70, .40, .34], [.66, .82, .38, .28], [.46, .96, .52, .34]];

  blobs.forEach((b, bi) => {
    const cx2 = b[0] * W, cy = b[1] * H, rx = b[2] * W * .5, ry = b[3] * H * .8;
    x.beginPath();
    for (let a = 0; a <= 128; a++) {
      const t = a / 128 * TAU;
      const k = 1 + .17 * fbm(n, Math.cos(t) * 1.7 + bi * 9, Math.sin(t) * 1.7, 4, 2.1, .55);
      const px = cx2 + Math.cos(t) * rx * k, py = cy + Math.sin(t) * ry * k;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    const g = x.createLinearGradient(cx2 - rx, cy - ry, cx2 + rx * .4, cy + ry);
    const s = 1 - bi * .16;
    g.addColorStop(0, hex(30 * s, 39 * s, 40 * s));
    g.addColorStop(.42, hex(14 * s, 19 * s, 20 * s));
    g.addColorStop(1, hex(6, 9, 9));
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    x.globalCompositeOperation = 'overlay'; x.globalAlpha = .62;
    x.drawImage(fbmCanvas(768, 512, seed + bi * 31, 6, 4, 1.1), 0, 0, W, H);
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    /* facets */
    for (let f = 0; f < 26; f++) {
      x.beginPath();
      const fx = cx2 + (rnd() - .5) * rx * 2, fy = cy + (rnd() - .5) * ry * 1.6;
      x.moveTo(fx, fy);
      for (let v = 0; v < 3; v++) x.lineTo(fx + (rnd() - .5) * rx * .8, fy + (rnd() - .5) * ry * .6);
      x.closePath();
      x.fillStyle = rnd() > .5 ? 'rgba(255,255,255,.030)' : 'rgba(0,0,0,.14)';
      x.fill();
    }
    /* wet highlight along the upper rim */
    x.lineWidth = 3 + rnd() * 4; x.strokeStyle = 'rgba(178,206,206,.20)';
    x.beginPath();
    for (let a = 0; a <= 60; a++) {
      const t = Math.PI + a / 60 * Math.PI * .78;
      const k = 1 + .17 * fbm(n, Math.cos(t) * 1.7 + bi * 9, Math.sin(t) * 1.7, 4, 2.1, .55);
      const px = cx2 + Math.cos(t) * rx * k * .97, py = cy + Math.sin(t) * ry * k * .97;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
    x.restore();
  });

  /* a little moss where they meet the ground */
  x.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 2600; i++) {
    const px = rnd() * W, py = H - Math.pow(rnd(), 1.7) * H * .5;
    x.fillStyle = 'rgba(' + (40 + rnd() * 40 | 0) + ',' + (60 + rnd() * 46 | 0) + ',34,' + (.05 + rnd() * .22) + ')';
    x.fillRect(px, py, 1.6 + rnd() * 2.4, 3 + rnd() * 9);
  }
  const rb = x.createLinearGradient(W, 0, 0, 0);
  rb.addColorStop(0, 'rgba(190,48,22,.16)'); rb.addColorStop(.7, 'rgba(0,0,0,0)');
  x.fillStyle = rb; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  return c;
}

/* a maple bough leaning into the top of frame */
function texBranchCutout(seed) {
  const W = 1536, H = 1024;
  const c = cvs(W, H), x = c.getContext('2d');
  const rnd = mulberry32(seed);
  const leaves = [];

  function bough(px, py, ang, len, wid, depth) {
    const steps = 7;
    let cx2 = px, cy = py, a = ang;
    x.beginPath(); x.moveTo(cx2, cy);
    for (let s = 0; s < steps; s++) {
      a += (rnd() - .5) * .30;
      cx2 += Math.cos(a) * len / steps; cy += Math.sin(a) * len / steps;
      x.lineTo(cx2, cy);
    }
    x.lineCap = 'round'; x.lineWidth = wid;
    x.strokeStyle = 'rgba(' + (26 + depth * 5 | 0) + ',' + (22 + depth * 4 | 0) + ',' + (22 + depth * 4 | 0) + ',1)';
    x.stroke();
    if (depth < 4 && len > 34) {
      const k = depth === 0 ? 3 : 2;
      for (let i = 0; i < k; i++) bough(cx2, cy, a + (rnd() - .5) * 1.25, len * (.58 + rnd() * .18), wid * .58, depth + 1);
    } else {
      for (let i = 0; i < 9; i++)
        leaves.push([cx2 + (rnd() - .5) * 78, cy + (rnd() - .5) * 78, rnd() * TAU, 12 + rnd() * 20, rnd()]);
    }
  }
  bough(W * 1.02, H * .06, Math.PI * .78, 420, 26, 0);
  bough(W * .86, -H * .02, Math.PI * .62, 330, 18, 1);

  const leafImg = texLeaf();
  const tint = cvs(128, 128), tx = tint.getContext('2d');
  leaves.forEach(l => {
    tx.clearRect(0, 0, 128, 128);
    tx.drawImage(leafImg, 0, 0);
    tx.globalCompositeOperation = 'source-in';
    const v = l[4];
    /* The near bough was carrying autumn: red driven to six times green, which
       at this depth — four metres off the lens and the widest thing in the
       lower right of every frame — was the single most saturated object on the
       page. Green over olive instead, so it reads as the foliage the rest of
       the planting is, rather than as a season. */
    tx.fillStyle = hex(44 + v * 46, 62 + v * 52, 38 + v * 30);
    tx.fillRect(0, 0, 128, 128);
    tx.globalCompositeOperation = 'source-over';
    x.save(); x.translate(l[0], l[1]); x.rotate(l[2]);
    x.globalAlpha = .78 + v * .22;
    x.drawImage(tint, -l[3], -l[3], l[3] * 2, l[3] * 2);
    x.restore();
  });
  x.globalAlpha = 1;
  return c;
}
/* ================================================================= 4 · gl */
const canvas = document.getElementById('gl');
/* The layout viewport, not the window. On mobile `innerWidth` follows the
   initial containing block, which can run wider than the visual viewport —
   measured at 437 against a 390 screen — while `clientWidth` tracks what CSS
   actually lays out against. Sizing the canvas from `innerWidth` therefore
   renders a frame wider than the phone shows and drops the right edge of the
   scene off-screen, which is how the wordmark lost its last letter. Every
   size, aspect and pointer mapping below goes through these. */
const vpW = () => document.documentElement.clientWidth  || innerWidth;
const vpH = () => document.documentElement.clientHeight || innerHeight;
let renderer, scene, camera, maxAniso = 1;
const HI = qs('q', COARSE ? 'low' : 'high');
const LOW = HI === 'low';
const WANT_POST    = qs('post', '1') !== '0';
const WANT_SHADOW  = qs('shadow', LOW ? '0' : '1') !== '0';
const DPR_CAP      = qn('dpr', LOW ? 1.4 : 1.8);
/* the renderer trades resolution for frame rate on its own — the scene is
   fill-bound (five big alpha-blended veils plus a bloom chain), so pixels
   are the only knob worth turning on unknown hardware */
const PERF = { scale: 1, acc: 0, n: 0, locked: qs('adapt', '1') === '0' };

function initGL() {
  const T = (typeof window !== 'undefined' && window.THREE) || (typeof globalThis !== 'undefined' && globalThis.THREE) || (typeof THREE !== 'undefined' && THREE);
  if (qs('nogl', '0') !== '0' || !T) throw new Error('webgl disabled');
  if (typeof window !== 'undefined' && !window.THREE) window.THREE = T;
  renderer = new T.WebGLRenderer({ canvas: canvas, antialias: !WANT_POST, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, DPR_CAP));
  /* updateStyle stays on: the stylesheet sizes the canvas at 100% of the
     initial containing block, which is the very box that runs wide on a
     phone. Writing the CSS size in pixels pins the element to the layout
     viewport the buffer was built for. */
  renderer.setSize(vpW(), vpH(), true);
  renderer.outputEncoding = WANT_POST ? THREE.LinearEncoding : THREE.sRGBEncoding;
  renderer.toneMapping = WANT_POST ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x05070a, 1);
  if (WANT_SHADOW) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  maxAniso = renderer.capabilities.getMaxAnisotropy();
  scene = new THREE.Scene();
    /* Density puts the hall back in the air; the colour is what decides how
     dark it is back there. At this depth most of the building's pixel is
     fog rather than its own material — darkening the timber and the tiles
     moved the hall by 0.18 of a luminance unit, the fog colour moves it
     properly. And it reaches by distance, so the foreground does not
     follow it down. */
  scene.fog = new THREE.FogExp2(0x050a0e, 0.0168);
  scene.background = new THREE.Color(0x060a0d);
  /* Far enough for the *corners* of the backdrop, not just its centre. A plate
     wide enough to cover a 70-degree half-angle has corners better than three
     times its axial distance away, and geometry past the far plane is clipped —
     which would have put the seam straight back, as a curve instead of a
     diagonal. Precision is governed by the near plane, which has not moved. */
  camera = new THREE.PerspectiveCamera(36, vpW() / vpH(), .35, 1900);
  scene.add(camera);
}

function tx(canvasEl, o) {
  o = o || {};
  const t = new THREE.CanvasTexture(canvasEl);
  t.wrapS = t.wrapT = o.wrap || THREE.ClampToEdgeWrapping;
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  t.anisotropy = Math.min(o.aniso || 8, maxAniso);
  if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
  t.needsUpdate = true;
  return t;
}
/* HDR-bright emitters: values above 1 survive because the scene is rendered
   into a half-float buffer, and they are what the bloom feeds on */
const hdr = (r, g, b) => new THREE.Color().setRGB(r, g, b);

/* A {map, normal, rough} set hung on a standard material at one tiling. The
   colour is a multiplier on an already-dark albedo, so it is how a shared
   board or block library is re-tinted per use rather than regenerated.
   roughness stays at 1: the map carries the variation, and anything less
   scales the whole surface toward a polish it should not have. */
function surface(t, rep, o) {
  o = o || {};
  const wrap = THREE.RepeatWrapping, aniso = o.aniso || 8;
  const m = new THREE.MeshStandardMaterial({
    map: tx(t.map, { wrap: wrap, repeat: rep, aniso: aniso }),
    normalMap: tx(t.normal, { wrap: wrap, repeat: rep, srgb: false, aniso: aniso }),
    normalScale: new THREE.Vector2(o.normal === undefined ? .8 : o.normal,
                                   o.normal === undefined ? .8 : o.normal),
    color: o.color === undefined ? 0xffffff : o.color,
    roughness: o.roughness === undefined ? 1 : o.roughness,
    metalness: o.metalness === undefined ? .02 : o.metalness
  });
  if (t.rough) m.roughnessMap = tx(t.rough, { wrap: wrap, repeat: rep, srgb: false });
  return m;
}
function mergeGeos(list) {
  let vN = 0, iN = 0;
  list.forEach(g => { vN += g.attributes.position.count; iN += g.index.count; });
  const pos = new Float32Array(vN * 3), nor = new Float32Array(vN * 3), uv = new Float32Array(vN * 2);
  const idx = vN > 65535 ? new Uint32Array(iN) : new Uint16Array(iN);
  let vo = 0, io = 0;
  list.forEach(g => {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    io += gi.length; vo += g.attributes.position.count;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/* ========================================================== 5 · the world */
const WORLD = {};                 /* named handles the page can animate */

function buildShell() {
  /* The court used to be a roofless box. It is now an open mountain approach:
     nothing encloses the frame but the night, the ridge and the fog. */

  /* The sky, hung far enough back that the whole frustum sits inside it — and
     large enough, which took two tries. See SKY and texSky(). */
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(SKY.w, SKY.h),
    new THREE.MeshBasicMaterial({ color: hdr(.60, .70, .80), map: tx(texSky()),
      depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
  sky.position.set(0, SKY.y, SKY.z); sky.renderOrder = -100; scene.add(sky);
  WORLD.sky = sky;

  /* The valley used to be closed by two low wooded ridges, kept deliberately
     under the eave line so they read as depth behind a building. There is no
     building now and the flight tops out in the open, so the close is a range
     instead — buildRange(), a displaced height field. */

  /* floor + podium */
  /* The valley floor is a lake now — see buildWater(). It keeps the one job
     the old ground plane had beyond being ground: it is 600 x 600 and centred
     well back, so its own far edge can never come into frame.

     That mattered, and still does. The range is a height field deliberately
     sunk below y = 0 for its first fifty units so it cannot z-fight this
     plane, and it only climbs back above zero sixty to a hundred units out.
     The ground plane used to stop at z = -93, and between the two there was a
     strip that *nothing* covered — measured at the hero waypoint, screen rows
     0.60 to 0.66 hit no geometry at all — so the sky showed through the floor
     as a hard-edged pale band. The water plane inherits the large footprint
     and is fully opaque for the same reason: nothing can show through it. */

  /* Nothing is built between the near grass and the range any more.

     There was a forty-riser flight here, a seven-unit podium for it to climb
     to, and a stone coping around the top of that. All three existed to serve
     a building that was removed several passes ago, and once the range behind
     them became real geometry they were the only thing left in the frame
     asserting that this is a *site* rather than a landscape. A flight of
     stairs is a very strong figure: the eye follows it whether or not there is
     anything at the top, and it kept converting the mountains into scenery
     behind an approach.

     So the valley floor now runs unbroken from the grass in the near plane out
     to the foot of the range, where the height field flattens back into it at
     about ninety units and the junction is filled with haze. The stair lamp
     and the lanterns stay; they are re-sited on to the flat court in
     buildLights() and the JOBS entry that places them, because the warm
     accents are what the page's whole exposure is balanced against and they
     were never really about the stairs. */
}

/* ------------------------------------------------- the head of the valley
   Nothing is built here, and nothing is hung in the air here either.

   This was a worship hall, then a stone terrace, then a pair of glowing
   planes standing in for the terrace's light. That last version was the
   wrong call: two flat, hard-edged rectangles — a 26-unit pool and a 96-unit
   mist band — sitting at a fixed height in the middle of the valley read
   exactly like a lit dock or boardwalk crossing the water, complete with the
   lanterns either side of it standing in as its lamp posts. Every built
   thing that has stood at this depth (hall, terrace, then this) has ended up
   reading as a structure, because a flat glowing plane at a fixed height and
   width IS a structure's silhouette, regardless of what texture is on it.

   The valley floor now carries its own light with no plane to stand in for
   it, and nothing standing in it to be lit: the lamp posts and every warm
   point light on the valley floor have gone too. The moon lights this valley
   and nothing else. Nothing here needs its own function any more. */

/* ============================================================ the range
   Real geometry, not painted plates.

   Four generations of this were flat billboards: a silhouette drawn on a
   canvas, tinted, stacked, and sorted by hand. They can be made to read as
   mountains — the last pass did — but they are a trick, and the trick has
   costs that show. Every layer needs an explicit renderOrder because they are
   transparent and depth-write-off, so draw order *is* stacking order and one
   wrong index paints the far ridge over the near one. The parallax has to be
   faked, because a plate two hundred units out will not answer a pointer drift
   of under a unit. And nothing on them can ever catch the light, because there
   is no surface there to catch it — the moon hangs behind the range and the
   crests in front of it stay exactly as dark as they were drawn.

   This is a displaced height field instead. One mesh, opaque, depth-tested
   like anything else in the scene. The parallax is true perspective and needs
   no weighting. The crests are lit, so the moon rims them. Nothing has to be
   sorted.

   The height field is built with the same two ideas the last pass arrived at,
   promoted from a line to a surface:

     · a ridged multifractal, each octave folded at 1 − |noise| so its zero
       crossings become creases and squared so the creases sharpen into
       summits, each octave weighted by the one above it so fine detail only
       lands where there is already mass to carry it;

     · and then the angle of repose. Loose rock will not stand steeper than
       about a third, so real flanks are straight and real profiles are
       triangles. Four sweeps across the grid — ±x, ±z — lift every sample to
       at least its neighbour minus one slope step. It only raises, so summits
       stay where the noise put them and the ground between them straightens.

   Without that second pass this is a field of rounded lumps and reads as
   cloud. It is the single most important thing in this function.

   The x axis is sampled at about half the frequency of z, which stretches the
   forms crosswise so they arrive as *ridge lines* running across the view
   rather than isolated cones — a range, not a mountain.                    */
function buildRange() {
  /* the ground the field is drawn on */
  const X0 = -230, X1 = 230, Z0 = -26, Z1 = -206;
  /* 288 across put a grid step of 1.6 units on a crest a hundred out, which
     is about a degree per segment and visibly facets the skyline. */
  const NX = LOW ? 192 : 384, NZ = LOW ? 104 : 184;
  const dx = (X1 - X0) / NX, dz = (Z1 - Z0) / NZ;

  const n = noise2D(9137);
  const ss = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* the amplitude envelope. Zero where the field meets the court, so the range
     never breaks the floor plane in front of the camera, and growing with
     distance so the far ridges are the tall ones — which is both what a valley
     opening on to a range looks like and what keeps the moon in clear sky. */
  /* The range has to be tall, because the last two chapters look straight up
     the valley and a low range arrives there as a thin line on the horizon —
     but a tall range crowds the moon, which is the thing that was wrong with
     the version before this one.

     Both, then: it is tall everywhere except along the moon's own bearing,
     where the amplitude is notched back and the crest drops into a pass. That
     is not a dodge, it is what a landscape photographer does — you put the
     light in the gap. The notch is angular rather than a fixed x, so it tracks
     the moon's azimuth at every depth instead of shearing across the field. */
  const MOON_AZ = MOON.x / -MOON.z;                     /* the moon's bearing */
  const amp  = d => ss(44, 104, d) * (18 + 74 * ss(70, 205, d));
  const pass = (x, d) => {                     /* the notch under the moon */
    const t = (x / d - MOON_AZ) / .125;
    return 1 - .42 * Math.exp(-t * t);
  };
  /* Was 8.5, which raised the whole far field into a plateau: with the repose
     fill on top of it the far crests measured min 25 / max 38, so the range
     was a high flat mass with a ragged top rather than summits with valleys
     between them. The floor barely needs to climb at all — the amplitude
     envelope already does that work, and honestly. */
  const climb = d => ss(48, 206, d) * 2.5;

  /* ---- the height grid */
  const H = new Float32Array((NX + 1) * (NZ + 1));
  let hMax = 0;
  for (let j = 0; j <= NZ; j++) {
    const z = Z0 + j * dz, d = -z;
    const a = amp(d), c = climb(d);
    for (let i = 0; i <= NX; i++) {
      const x = X0 + i * dx;
      /* ridged multifractal, anisotropic: x at .46 of z's frequency, so the
         forms come out as ridge lines lying across the view */
      let sum = 0, norm = 0, w = 1, wt = 1, fx = .0136, fz = .0295;
      for (let o = 0; o < 5; o++) {
        let r = 1 - Math.abs(n(x * fx + o * 31.7, z * fz + o * 17.3));
        r *= r; r *= w;
        w = clamp(r * 2.5, 0, 1);
        sum += r * wt; norm += wt;
        wt *= .47; fx *= 2.04; fz *= 2.04;
      }
      /* one octave far below the others, so the range has a massif at one end
         and a pass at the other instead of one uniform altitude */
      const env = .40 + .60 * (fbm(n, x * .0043 + 61, z * .0031 + 13, 2, 2.1, .5) * .5 + .5);
      /* the exponent biases the field low, so most of it is valley and the
         summits are the exception — which is the ratio a range actually has */
      const h = c + a * pass(x, d) * Math.pow(clamp(sum / norm, 0, 1), 1.65) * env;
      H[j * (NX + 1) + i] = h;
      if (h > hMax) hMax = h;
    }
  }

  /* ---- the angle of repose, four sweeps. See the note above: this is what
     turns lumps into ridges. The step is per grid cell, so it is the slope
     times the cell size in that axis. */
  /* This has to be read against the amplitude, and getting that wrong is the
     single most destructive mistake available in this function. The sweeps only
     ever raise, so each summit fills outward until the slope runs out: a summit
     of height A reaches A / slope units before it stops. At .25 and a range
     fifty-five units tall that is two hundred and twenty units of fill — wider
     than the whole visible frame — so every summit's cone merged into its
     neighbours' and the range arrived as one smooth mound with a valley in it.
     Not a mountain: a dune.

     The slope wants to be about A divided by half the crest wavelength, so the
     flank reaches the next saddle and no further. The forms here are roughly
     seventy units across, so half is thirty-five, and A / 35 lands near 1.1.
     Measured: the far crests go from min 48 / max 71 at .25 — a plateau — to
     min 25 / max 66 at 1.15, which is summits with valleys between them. */
  const REPOSE = 1.15;
  const sx = REPOSE * Math.abs(dx), sz = REPOSE * Math.abs(dz);
  const at = (i, j) => H[j * (NX + 1) + i];
  const set = (i, j, v) => { H[j * (NX + 1) + i] = v; };
  for (let j = 0; j <= NZ; j++) {
    for (let i = 1; i <= NX; i++) { const v = at(i - 1, j) - sx; if (at(i, j) < v) set(i, j, v); }
    for (let i = NX - 1; i >= 0; i--) { const v = at(i + 1, j) - sx; if (at(i, j) < v) set(i, j, v); }
  }
  for (let i = 0; i <= NX; i++) {
    for (let j = 1; j <= NZ; j++) { const v = at(i, j - 1) - sz; if (at(i, j) < v) set(i, j, v); }
    for (let j = NZ - 1; j >= 0; j--) { const v = at(i, j + 1) - sz; if (at(i, j) < v) set(i, j, v); }
  }
  /* The sweeps only ever raise, so the near edge has to be clamped back down or
     the fill comes forward over the court. It is also pushed *under* the floor
     plane as it fades: the two surfaces were both at exactly y = 0 across the
     whole near strip, and coplanar depth-writing geometry z-fights — a
     stippled crosshatch right across the middle of the valley. Sinking the
     tail a unit and a half puts it behind an opaque floor and the interference
     goes away. */
  for (let j = 0; j <= NZ; j++) {
    const g = ss(40, 92, -(Z0 + j * dz));
    for (let i = 0; i <= NX; i++) set(i, j, at(i, j) * g - 1.6 * (1 - g));
  }
  hMax = 0;
  for (let k = 0; k < H.length; k++) if (H[k] > hMax) hMax = H[k];

  /* ---- vertices, and the shading baked into them.

     Nothing here moves and no light near it changes, so the lighting is
     resolved once on the CPU and written to vertex colours. The material is
     unlit as a result, which also means the range cannot be blown out by the
     six warm point lights down on the court — the reason the first billboard
     pass washed the whole frame out.

     Scene fog is off for the same reason it was off for the plates: FogExp2 at
     0.0168 is effectively total by a hundred units and its colour is almost
     black, so it would take the range out rather than push it back. Aerial
     perspective is a mix toward a pale cool haze instead, which is what
     distance actually does — it lifts the shadows, it does not darken them. */
  const V = new Float32Array((NX + 1) * (NZ + 1) * 3);
  const C = new Float32Array((NX + 1) * (NZ + 1) * 3);

  /* the moon is behind the range, so this is back-light: the slopes facing the
     camera are the dark ones and the crests are rimmed. That is the whole
     reason for putting real geometry here. */
  const L = (() => { const v = [MOON.x, MOON.y - 6, MOON.z + 40];
    const m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; })();
  const EYE = [0, 6.5, 4];
  /* Authored as display values and converted, which is not a formality: a
     vertex colour is consumed as *linear* light, so writing .15 here asks for
     a mid-grey around .43 on screen. The first pass did exactly that and the
     range came back as a pale flat wall filling the middle of the frame — the
     tone was four times too light, which flattened every tonal step in the
     shading model at the same time. */
  const srgb = c => c.map(v => Math.pow(v, 2.2));
  const ROCK = srgb([.085, .108, .135]),
        HIGH = srgb([.42, .47, .54]),
        HAZE = srgb([.175, .235, .295]);

  for (let j = 0; j <= NZ; j++) {
    const z = Z0 + j * dz;
    for (let i = 0; i <= NX; i++) {
      const x = X0 + i * dx, k = j * (NX + 1) + i, h = H[k];
      V[k * 3] = x; V[k * 3 + 1] = h; V[k * 3 + 2] = z;

      /* normal by central difference on the grid */
      const hl = at(Math.max(0, i - 1), j), hr = at(Math.min(NX, i + 1), j);
      const hb = at(i, Math.max(0, j - 1)), hf = at(i, Math.min(NZ, j + 1));
      let nx = -(hr - hl) / (2 * dx), nz = -(hf - hb) / (2 * dz), ny = 1;
      const nm = Math.hypot(nx, ny, nz); nx /= nm; ny /= nm; nz /= nm;

      const alt = clamp(h / (hMax * .92), 0, 1);
      let lit = .14
              + .60 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])   /* the moon */
              + .19 * Math.max(0, ny);                                 /* the sky  */
      /* high ground catches more of everything, and holds what snow there is */
      lit *= .52 + .48 * alt;
      lit += .20 * ss(.68, 1, alt);
      lit = clamp(lit, 0, 1.15);

      const dist = Math.hypot(x - EYE[0], h - EYE[1], z - EYE[2]);
      /* The first constants here put the haze at 96% by two hundred units, so
         every vertex in the range arrived at the haze colour and the whole
         thing came back as one flat wash — measured luminance spread across
         the entire range was 24%. The range *lives* between ninety and two
         hundred units, so the curve has to do its work inside that window:
         about .15 at the near foot and .57 at the far crest. */
      const haze = clamp(1 - Math.exp(-Math.pow(dist * .0045, 2)), 0, .70);
      for (let c = 0; c < 3; c++) {
        const rock = lerp(ROCK[c], HIGH[c], clamp(lit, 0, 1));
        C[k * 3 + c] = lerp(rock, HAZE[c], haze);
      }
    }
  }

  const IDX = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    IDX.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(V, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setIndex(IDX);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, fog: false, toneMapped: true
  }));
  mesh.frustumCulled = false;
  scene.add(mesh); WORLD.terrain = mesh; WORLD.terrainMax = hMax;

  /* There were three additive haze bands here, one per gap in the range, to
     fill the junction where the field flattens back into the floor plane. They
     went: at any opacity strong enough to soften the junction they read as
     pale horizontal ramps lying across the dark valley — light with no source,
     stacked in bands, the exact artefact the billboard passes kept producing.

     They also turned out to be unnecessary. The junction does not need
     covering: the field's near edge is faded to nothing over fifty units and
     sunk below the floor plane, so there is no line there to hide, and the
     range now reads by its own tonal recession rather than by veils drawn
     between its layers. What lights the valley floor now is buildLights()'
     point sources and the lanterns, not a plane standing in for either. */
}

/* --------------------------------------------------- the vermilion moon
   Hung well behind the hall so the roof crosses its lower left — near
   enough to the ridge to sit in the mist, far enough that it never moves
   against the buildings when the rig drifts.                             */
/* Out past the third ridge rather than in front of everything. At z −72 it
   was level with the nearest layer and had to be drawn over the lot; sitting
   between the third and fourth it gets ridges in front of it, which is what
   puts it *in* the valley instead of on top of the picture. */
const MOON = { x: 21.5, y: 58.0, z: -166, r: 11.0 };
function buildMoon() {
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(MOON.r * 2, MOON.r * 2),
    /* The whole blood-moon grade lives here, on a near-neutral albedo. The
       plate measures G/R ≈ B/R ≈ .48, but that is a *display* ratio: the map
       is decoded out of sRGB before this multiplies it, so the tint has to be
       written in linear, where the same look is ≈ .21. Reading the ratio
       straight off the reference is what left the moon a pale pink. */
    /* A pale moon, not a blood one. The red disc was the single loudest thing
       in the frame and it read as an event — an eclipse, a warning — which is
       a story, and a portfolio's background should not be telling one. Cool
       and close to neutral, it goes back to being weather. */
    new THREE.MeshBasicMaterial({ map: tx(texMoon()), color: hdr(1.34, 1.42, 1.52),
      transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  /* Depth-tested, at last. While the range was four transparent plates the
     moon had to ignore depth and be sorted by hand between them — and that
     hand-sorting was wrong twice, because a renderOrder that puts the disc
     behind one ridge necessarily puts it behind every ridge drawn with the
     same or a later order, whatever their actual distance. The range is real
     geometry now, so the depth buffer answers the question exactly: it is
     opaque and drawn first, this is transparent and drawn after, and the crests
     in front of the moon occlude it while the ones behind it do not. */
  disc.position.set(MOON.x, MOON.y, MOON.z); disc.renderOrder = 0;
  scene.add(disc); WORLD.moon = disc;

  /* the air around it — a wide, weak corona that the bloom picks up */
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(MOON.r * 6.4, MOON.r * 6.4),
    new THREE.MeshBasicMaterial({ map: tx(texGlow('rgba(206,224,236,.72)', 'rgba(120,152,176,.20)')),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: .30 }));
  halo.position.set(MOON.x, MOON.y, MOON.z - .3); halo.renderOrder = 0;
  scene.add(halo); WORLD.moonHalo = halo;
}
/* On a tall frame the rig steps back and its horizontal reach narrows, which
   would slide the moon off the right edge — draw it in by the same amount. */
function placeMoon() {
  if (!WORLD.moon) return;
  const x = MOON.x * (1 - .40 * aspectFix());
  WORLD.moon.position.x = x;
  WORLD.moonHalo.position.x = x;
}

function buildMaple(seed, x, z, scale) {
  const rnd = mulberry32(seed);
  const parts = [], tips = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3(), pos = new THREE.Vector3();

  function seg(from, to, r0, r1) {
    dir.subVectors(to, from);
    const len = dir.length(); dir.normalize();
    const geo = new THREE.CylinderGeometry(r1, r0, len, 6, 1, true);
    Q.setFromUnitVectors(UP, dir);
    pos.addVectors(from, to).multiplyScalar(.5);
    M.compose(pos, Q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(M);
    parts.push(geo);
  }
  function branch(from, dirV, len, rad, depth) {
    const to = from.clone().addScaledVector(dirV, len);
    to.y += len * .10;
    seg(from, to, rad, rad * .68);
    if (depth >= 4 || len < .34) { tips.push(to.clone()); return; }
    const n = depth < 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const d = dirV.clone();
      d.x += (rnd() - .5) * 1.25; d.z += (rnd() - .5) * 1.25; d.y += .30 + rnd() * .5;
      d.normalize();
      branch(to, d, len * (.62 + rnd() * .16), rad * .66, depth + 1);
    }
  }
  const root = new THREE.Vector3(0, 0, 0);
  seg(root, new THREE.Vector3(0, 1.5, 0), .22, .16);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + rnd();
    branch(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(Math.cos(a) * .8, .8, Math.sin(a) * .8).normalize(), 1.45, .155, 0);
  }
  const trunk = new THREE.Mesh(mergeGeos(parts),
    new THREE.MeshStandardMaterial({ color: 0x171413, roughness: .94, metalness: .0, side: THREE.DoubleSide }));
  trunk.castShadow = true;

  const leafGeo = new THREE.PlaneGeometry(.36, .36);
  const leafMat = new THREE.MeshStandardMaterial({
    map: tx(texLeaf()), color: 0x2f2617, alphaTest: .42, side: THREE.DoubleSide,
    roughness: .86, metalness: 0, emissive: 0x0a0703, emissiveIntensity: .10
  });
  const per = LOW ? 5 : 9;
  const inst = new THREE.InstancedMesh(leafGeo, leafMat, tips.length * per);
  const m4 = new THREE.Matrix4(), e = new THREE.Euler(), q2 = new THREE.Quaternion(), sc = new THREE.Vector3();
  let k = 0;
  tips.forEach(t => {
    for (let i = 0; i < per; i++) {
      const p = new THREE.Vector3(t.x + (rnd() - .5) * .95, t.y + (rnd() - .5) * .8, t.z + (rnd() - .5) * .95);
      e.set(rnd() * TAU, rnd() * TAU, rnd() * TAU);
      q2.setFromEuler(e);
      const s = .7 + rnd() * .75; sc.set(s, s, s);
      m4.compose(p, q2, sc);
      inst.setMatrixAt(k++, m4);
    }
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = false; inst.frustumCulled = false;

  const g = new THREE.Group();
  g.add(trunk); g.add(inst);
  g.position.set(x, 0, z); g.scale.setScalar(scale || 1);
  g.rotation.y = rnd() * TAU;
  scene.add(g);
  /* leaves breathe in the wind */
  leafMat.onBeforeCompile = sh => {
    sh.uniforms.uT = WORLD.uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n' +
      'vec3 wp = (instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;\n' +
      'float ph = wp.x*1.7 + wp.z*1.3 + wp.y*.7;\n' +
      'transformed.x += sin(uT*1.35 + ph)*0.055;\n' +
      'transformed.z += cos(uT*1.05 + ph*1.3)*0.045;\n');
  };
  return g;
}

function buildRocks() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x141a1c, roughness: .46, metalness: .10 });
  const rnd = mulberry32(404), n = noise2D(88);
  const spots = [[-6.2, -5.4, .95], [-7.4, -2.1, .7], [6.6, -7.2, .8], [8.0, -4.0, 1.05],
                 [-9.0, -8.4, 1.15], [9.6, -9.2, .9], [3.4, -7.8, .55], [-3.2, -8.6, .6]];
  spots.forEach((s, i) => {
    const geo = new THREE.IcosahedronGeometry(s[2], 2);
    const p = geo.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const vx = p.getX(v), vy = p.getY(v), vz = p.getZ(v);
      const d = 1 + .34 * fbm(n, vx * 1.6 + i * 7, vz * 1.6 + vy, 3, 2.2, .5);
      p.setXYZ(v, vx * d, vy * d * .68, vz * d);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.set(s[0], s[2] * .30, s[1]);
    m.rotation.set(rnd(), rnd() * TAU, rnd() * .4);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  });
}

/* ------------------------------- the transparent-PNG foreground layers */
function cutoutMaterial(canvasEl, sway) {
  const mat = new THREE.MeshBasicMaterial({
    map: tx(canvasEl, { aniso: 16 }), transparent: true, depthWrite: true,
    alphaTest: .012, side: THREE.DoubleSide, fog: true, color: 0xffffff
  });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = WORLD.uT;
    sh.uniforms.uSway = { value: sway || .07 };
    sh.vertexShader = 'uniform float uT;\nuniform float uSway;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n' +
      'float h = uv.y;\n' +
      'float ph = position.x*0.30 + float(gl_InstanceID)*0.0;\n' +
      'transformed.x += sin(uT*0.85 + ph)*uSway*h*h;\n' +
      'transformed.y += cos(uT*0.62 + ph*1.7)*uSway*0.35*h*h;\n');
    /* These plates are drawn to the edge of their own canvas — the grass runs
       straight off the left and the bottom — so every sheet ends on a hard
       straight line wherever its plane stops. Feathering the alpha at the
       edges lets each one dissolve into the scene instead of being cut out of
       it. Sides get the widest margin because that is where a bank of grass
       is read as ending; the crest needs none, the blades already taper. */
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>',
      'float feX = smoothstep(0.0, 0.11, vUv.x) * (1.0 - smoothstep(0.89, 1.0, vUv.x));\n' +
      'float feY = smoothstep(0.0, 0.07, vUv.y);\n' +
      'diffuseColor.a *= feX * feY;\n' +
      '#include <alphatest_fragment>');
  };
  return mat;
}

function buildForeground() {
  /* the plane widths are sized against the frustum at their own depth: a
     26-unit sheet two metres from the lens only shows its middle tenth */
  const layers = [
    /* name        canvas                                                                     x     y     z     w     h   sway */
    ['grassFar',  texGrassCutout(101, { crest: .30, peak: .46, wide: .42, blades: 11000, len: 34, warm: .70, crest2: .46, crest3: .40 }),
                  -3.4,  2.85, -0.4, 24, 12, .040],
    ['rockLeft',  texRockCutout(404, { blobs: [[.24, .78, .48, .38], [.58, .94, .46, .30], [.84, 1.06, .42, .28]] }),
                  -7.2,  2.55,  1.8, 17, 11.3, .010],
    ['grassMid',  texGrassCutout(202, { crest: .60, peak: .55, wide: .40, blades: 13000, len: 40, warm: .95, crest2: -.44, crest3: .34 }),
                   3.9,  2.86,  3.6, 15,  7.5, .062],
    ['grassNear', texGrassCutout(303, { crest: .42, peak: .62, wide: .48, blades: 16000, len: 50, warm: .85, crest2: .42, crest3: .44 }),
                  -1.9,  2.92,  5.6, 12,  6, .092],
    ['bough',     texBranchCutout(505), 4.6, 2.95, 6.4, 13, 8.7, .045],
    ['rockNear',  texRockCutout(606, { blobs: [[.18, .86, .54, .44], [.54, 1.02, .50, .36], [.86, .92, .40, .32]] }),
                  -6.6,  1.70,  6.0, 9, 6, .008]
  ];
  WORLD.fg = [];
  layers.forEach(L => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L[5], L[6], 12, 12), cutoutMaterial(L[1], L[7]));
    m.position.set(L[2], L[3], L[4]);
    m.renderOrder = 20 + WORLD.fg.length;
    m.name = L[0];
    m.frustumCulled = false;
    scene.add(m);
    WORLD.fg.push(m);
  });
}

/* --------------------------------------------------- the giant wordmark */
const WORD_Z = 3.0;
function buildWordmark() {
  /* The word is set to the frame width, so a short word is a *taller* word.
     Four letters at the old tracking put a 400-pixel cap height across the
     scene; the letters are spaced out instead, which keeps the type edge to
     edge while the caps come back down to the height of the headline block. */
  /* Tracking pays for the letters the word does not have. Four letters needed
     .40 to reach the frame edge; six reach it on their own advances, and at
     that tracking they would run off both sides of it. */
  const word = 'DESIGN';
  const SZ = 320, TRACK = word.length > 4 ? .11 : .40, PAD = 26;
  const m = cvs(4, 4).getContext('2d');
  m.font = '600 ' + SZ + 'px Wordmark, sans-serif';
  m.textBaseline = 'alphabetic'; m.textAlign = 'left';
  const gl = [];
  let pen = 0, ascMax = 0, descMax = 0, xMin = 1e9, xMax = -1e9;
  for (const ch of word) {
    const t = m.measureText(ch);
    const g = { ch: ch, adv: t.width, asc: t.actualBoundingBoxAscent, desc: t.actualBoundingBoxDescent,
                l: t.actualBoundingBoxLeft, r: t.actualBoundingBoxRight, pen: pen };
    gl.push(g);
    ascMax = Math.max(ascMax, g.asc); descMax = Math.max(descMax, g.desc);
    xMin = Math.min(xMin, pen - g.l); xMax = Math.max(xMax, pen + g.r);
    pen += t.width + TRACK * SZ;
  }
  const group = new THREE.Group();
  WORD.glyphs = [];
  gl.forEach((g, i) => {
    const cw = Math.ceil(g.l + g.r) + PAD * 2, chh = Math.ceil(g.asc + g.desc) + PAD * 2;
    const c = cvs(cw, chh), x = c.getContext('2d');
    x.font = '600 ' + SZ + 'px Wordmark, sans-serif';
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    /* the vertical wash is baked per glyph so the whole word shares one ramp */
    const gy0 = PAD + g.asc - ascMax, gy1 = PAD + g.asc + descMax * .4;
    const grad = x.createLinearGradient(0, gy0, 0, gy1);
    grad.addColorStop(0, 'rgb(226,236,229)');
    grad.addColorStop(.52, 'rgb(198,214,203)');
    grad.addColorStop(1, 'rgb(150,170,157)');
    x.fillStyle = grad;
    x.fillText(g.ch, PAD + g.l, PAD + g.asc);

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, chh),
      new THREE.MeshBasicMaterial({ map: tx(c, { aniso: 16 }), transparent: true,
        depthWrite: false, side: THREE.DoubleSide, fog: true, opacity: 1 }));
    mesh.position.set(g.pen + (g.r - g.l) / 2, (g.asc - g.desc) / 2 + (PAD - PAD) , 0);
    mesh.position.y = (g.asc - g.desc) / 2;
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    mesh.userData.baseY = mesh.position.y;
    group.add(mesh);
    WORD.glyphs.push(mesh);
  });
  group.position.z = WORD_Z;
  scene.add(group);
  WORD.group = group;
  WORD.ink = { xMin: xMin, xMax: xMax, cx: (xMin + xMax) / 2, w: xMax - xMin, asc: ascMax };
}
const WORD = { glyphs: [], group: null, ink: null, reveal: 0 };

/* --------------------------------------------------------- atmospherics */
function buildAtmosphere() {
  /* drifting haze slabs */
  const hazeTex = tx(texGlow('rgba(160,205,210,.55)', 'rgba(110,165,175,.18)'));
  WORLD.haze = [];
  const rnd = mulberry32(66);
  for (let i = 0; i < (LOW ? 4 : 6); i++) {
    const s = 12 + rnd() * 15;
    const h = new THREE.Mesh(new THREE.PlaneGeometry(s, s * .55),
      new THREE.MeshBasicMaterial({ map: hazeTex, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, opacity: .05 + rnd() * .07 }));
    h.position.set((rnd() - .5) * 44, 1.5 + rnd() * 10, -38 + rnd() * 40);
    h.renderOrder = 4;
    h.userData = { sp: .06 + rnd() * .12, ph: rnd() * TAU, x0: h.position.x };
    scene.add(h); WORLD.haze.push(h);
  }

  /* embers around the lantern and the disc */
  const N = LOW ? 220 : 460;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rnd() - .5) * 30; pos[i * 3 + 1] = rnd() * 11; pos[i * 3 + 2] = -26 + rnd() * 36;
    seed[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const emb = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uT: WORLD.uT, uTex: { value: tx(texGlow('rgba(255,190,140,1)', 'rgba(255,120,60,.35)')) },
      uSize: { value: vpH() * .5 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader:
      'attribute float aSeed; uniform float uT; uniform float uSize; varying float vA;\n' +
      'void main(){ vec3 p=position;\n' +
      ' p.y = mod(p.y + uT*(0.14+aSeed*0.28), 11.5);\n' +
      ' p.x += sin(uT*0.36 + aSeed*22.0)*0.85;\n' +
      ' p.z += cos(uT*0.29 + aSeed*17.0)*0.7;\n' +
      ' vec4 mv = modelViewMatrix * vec4(p,1.0);\n' +
      ' vA = (0.25+aSeed*0.75) * smoothstep(11.5,7.0,p.y) * smoothstep(0.0,1.4,p.y);\n' +
      ' gl_PointSize = uSize*(0.010+aSeed*0.020)/max(-mv.z,0.6);\n' +
      ' gl_Position = projectionMatrix * mv; }',
    fragmentShader:
      'uniform sampler2D uTex; varying float vA;\n' +
      'void main(){ vec4 t=texture2D(uTex, gl_PointCoord);\n' +
      ' gl_FragColor = vec4(t.rgb*vec3(1.6,0.78,0.42), t.a*vA*0.75); }'
  }));
  emb.frustumCulled = false; emb.renderOrder = 5;
  scene.add(emb); WORLD.embers = emb;

  /* rain in the slot of open sky */
  if (!LOW) {
    const D = 900, rp = new Float32Array(D * 2 * 3), rt = new Float32Array(D * 2), rs = new Float32Array(D * 2), rl = new Float32Array(D * 2);
    for (let i = 0; i < D; i++) {
      const x = (rnd() - .5) * 40, z = -30 + rnd() * 34, y = rnd() * 17, sp = 7 + rnd() * 9, ln = .30 + rnd() * .55;
      for (let k = 0; k < 2; k++) {
        const o = (i * 2 + k) * 3;
        rp[o] = x; rp[o + 1] = y; rp[o + 2] = z;
        rt[i * 2 + k] = k; rs[i * 2 + k] = sp; rl[i * 2 + k] = ln;
      }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rg.setAttribute('aTop', new THREE.BufferAttribute(rt, 1));
    rg.setAttribute('aSpeed', new THREE.BufferAttribute(rs, 1));
    rg.setAttribute('aLen', new THREE.BufferAttribute(rl, 1));
    const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      uniforms: { uT: WORLD.uT },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader:
        'attribute float aTop; attribute float aSpeed; attribute float aLen; uniform float uT; varying float vA;\n' +
        'void main(){ vec3 p=position;\n' +
        ' float y = mod(p.y - uT*aSpeed, 17.0);\n' +
        ' p.y = y + aTop*aLen;\n' +
        ' vA = smoothstep(0.0,3.0,y)*smoothstep(17.0,11.0,y);\n' +
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }',
      fragmentShader: 'varying float vA;\nvoid main(){ gl_FragColor = vec4(0.55,0.74,0.82, vA*0.024); }'
    }));
    rain.frustumCulled = false; rain.renderOrder = 6;
    scene.add(rain); WORLD.rain = rain;
  }

  /* ripples on the standing water */
  const ringC = cvs(256, 256), rx2 = ringC.getContext('2d');
  const rg2 = rx2.createRadialGradient(128, 128, 84, 128, 128, 128);
  rg2.addColorStop(0, 'rgba(255,255,255,0)'); rg2.addColorStop(.62, 'rgba(255,255,255,.55)');
  rg2.addColorStop(.86, 'rgba(255,255,255,.22)'); rg2.addColorStop(1, 'rgba(255,255,255,0)');
  rx2.fillStyle = rg2; rx2.fillRect(0, 0, 256, 256);
  const ringTex = tx(ringC);
  WORLD.ripples = [];
  for (let i = 0; i < (LOW ? 6 : 13); i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: true, opacity: 0 }));
    r.rotation.x = -Math.PI / 2; r.renderOrder = 7;
    r.userData = { t: rnd() * 4, x: (rnd() - .5) * 22, z: -8 + rnd() * 22, sp: .5 + rnd() * .5 };
    scene.add(r); WORLD.ripples.push(r);
  }
}

/* ====================================================== 6b · the leaf fall
   The maples shed all the way through the chapter. The fall is anchored to
   the rig rather than to the court: every leaf keeps a real world position so
   its drift is honest, but any leaf that ends up further than LEAF_R from the
   camera in x or z is wrapped back across it. That way the count is what one
   screenful needs — a hundred and seventy — instead of what filling the whole
   valley would cost, and the frame is never empty however far the walk goes.

   A falling leaf is read by its tumble, not by its path. Each one turns on
   two axes at its own rate, so it presents its face, thins to an edge and
   comes back — which is the whole reason these are instanced quads and not
   points, since a point sprite cannot turn away from the camera. */
/* LEAF_AHEAD/LEAF_SPREAD is the disc leaves are recycled into, hung down the
   camera's own sight line; LEAF_R is only the far backstop for a rig that has
   walked out from under its weather. */
const LEAF_AHEAD = 11, LEAF_SPREAD = 12, LEAF_R = 30;
function buildLeafFall() {
  const N = LOW ? 90 : 170;
  const mat = new THREE.MeshStandardMaterial({
    map: tx(texLeaf()), alphaTest: .42, side: THREE.DoubleSide,
    color: 0x4a3623, roughness: .84, metalness: 0,
    /* These were lit almost to a pure emissive red, which at this count read
       as a fall of embers rather than of leaves — and against the pale moon it
       was the loudest thing left in the frame. A muted amber, barely lifted,
       lets them drift instead of burn. */
    emissive: 0x35200c, emissiveIntensity: .26
  });
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(.40, .40), mat, N);
  inst.frustumCulled = false; inst.renderOrder = 5;
  inst.castShadow = inst.receiveShadow = false;
  const rnd = mulberry32(404), list = [];
  for (let i = 0; i < N; i++) list.push({
    x: (rnd() - .5) * 2 * LEAF_R, z: (rnd() - .5) * 2 * LEAF_R, y: rnd() * 26,
    fall: .5 + rnd() * .9,
    sway: .45 + rnd() * 1.5, swayPh: rnd() * TAU, swayAmp: .30 + rnd() * .95,
    spin: (rnd() - .5) * 2.6, roll: rnd() * TAU, rollSp: .5 + rnd() * 2.0,
    tilt: rnd() * TAU, s: .55 + rnd() * .9
  });
  scene.add(inst);
  WORLD.leaves = { mesh: inst, list: list };
}
const LEAF_M = new THREE.Matrix4(), LEAF_Q = new THREE.Quaternion();
const LEAF_E = new THREE.Euler(), LEAF_P = new THREE.Vector3(), LEAF_S = new THREE.Vector3();
const LEAF_F = new THREE.Vector3();
function updateLeaves(dt) {
  const LV = WORLD.leaves; if (!LV) return;
  const cy = camera.position.y, L = LV.list;
  /* Respawn ahead of the rig, not around it. A band centred on the camera
     spends nearly all of itself behind and beside the frustum — of a couple of
     hundred leaves only a dozen were ever on screen. Recycling them into the
     cone the camera is actually looking down puts the same count in frame
     several times over, and costs nothing. */
  camera.getWorldDirection(LEAF_F);
  LEAF_F.y = 0;
  if (LEAF_F.lengthSq() < 1e-6) LEAF_F.set(0, 0, -1); else LEAF_F.normalize();
  const fx = camera.position.x + LEAF_F.x * LEAF_AHEAD;
  const fz = camera.position.z + LEAF_F.z * LEAF_AHEAD;
  const seed = !LV.seeded; LV.seeded = true;
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    l.y -= l.fall * dt;
    l.roll += l.rollSp * dt;
    l.tilt += l.spin * dt;
    if (seed || l.y < cy - 10) {                /* back to the top of the band */
      l.y = seed ? cy - 10 + Math.random() * 26 : cy + 16;
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * LEAF_SPREAD;
      l.x = fx + Math.cos(a) * r;
      l.z = fz + Math.sin(a) * r;
    }
    /* the far wrap is a backstop for a rig that has walked away from its own
       leaves — it sits well outside the fog, so nothing is seen to jump */
    const cx = camera.position.x, cz = camera.position.z;
    if (l.x - cx > LEAF_R) l.x -= 2 * LEAF_R; else if (l.x - cx < -LEAF_R) l.x += 2 * LEAF_R;
    if (l.z - cz > LEAF_R) l.z -= 2 * LEAF_R; else if (l.z - cz < -LEAF_R) l.z += 2 * LEAF_R;
    /* the side-slip of a leaf shedding air off one edge, then the other */
    const sw = Math.sin(clock * l.sway + l.swayPh);
    LEAF_P.set(l.x + sw * l.swayAmp, l.y,
               l.z + Math.cos(clock * l.sway * .7 + l.swayPh) * l.swayAmp * .6);
    LEAF_E.set(l.roll, l.tilt, sw * .55);
    LEAF_Q.setFromEuler(LEAF_E);
    LEAF_S.setScalar(l.s);
    LEAF_M.compose(LEAF_P, LEAF_Q, LEAF_S);
    LV.mesh.setMatrixAt(i, LEAF_M);
  }
  LV.mesh.instanceMatrix.needsUpdate = true;
}

/* ==================================================== 6c · the cursor wisps
   A drift of cold motes that follows the pointer.

   It hangs as a child of the camera, so the pointer maps straight into camera
   space through the frustum's own half-height. Unprojecting onto a world
   plane each frame would instead pin the trail to the court, and the rig is
   always drifting — the wisps would swim across the screen whenever the
   camera moved rather than staying under the hand.

   Emission is by distance travelled, not elapsed time. A slow hand then lays
   a continuous drift and a fast one throws the motes apart, which is how a
   moving source actually sheds them; emitting on a timer gives an evenly
   spaced string of beads at every speed. */
const WISP_D = 3.4;
const WISP = { list: [], i: 0, acc: 0, ex: 0, ey: 0, lx: 0, ly: 0, idle: 0, seen: false };
function buildWisps() {
  if (COARSE) return;
  /* The motes are round, so nothing here is oriented: no per-particle angle,
     no rotated lookup. They are also small — a few pixels of core inside a
     faint halo — which is what lets the count go up without the additive fill
     that a screenful of big sprites costs. */
  const N = LOW ? 90 : 190;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(N), 1));
  g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(N), 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tx(texWisp()) }, uPx: { value: vpH() } },
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, fog: false,
    vertexShader:
      'attribute float aA; attribute float aS;\n' +
      'uniform float uPx; varying float vA;\n' +
      'void main(){ vA = aA;\n' +
      ' vec4 mv = modelViewMatrix * vec4(position,1.0);\n' +
      ' gl_PointSize = uPx * aS / max(-mv.z, 0.4);\n' +
      ' gl_Position = projectionMatrix * mv; }',
    fragmentShader:
      'uniform sampler2D uTex; varying float vA;\n' +
      'void main(){ if (vA <= 0.0) discard;\n' +
      ' vec4 t = texture2D(uTex, gl_PointCoord);\n' +
      ' gl_FragColor = vec4(t.rgb, t.a * vA); }'
  }));
  pts.frustumCulled = false; pts.renderOrder = 9;
  pts.layers.set(1);                    /* near the lens: never in the mirror */
  camera.add(pts);
  WISP.mesh = pts;
  for (let i = 0; i < N; i++) WISP.list.push({ life: 0, max: 1, vx: 0, vy: 0, sz: 0, ph: 0 });
}
/* the pointer, in camera space, on the plane the trail hangs on */
function wispPoint(nx, ny) {
  const hh = Math.tan(camera.fov * Math.PI / 360) * WISP_D;
  return [nx * hh * camera.aspect, ny * hh];
}
function updateWisps(dt) {
  if (!WISP.mesh) return;
  const g = WISP.mesh.geometry;
  const P = g.attributes.position.array, A = g.attributes.aA.array;
  const S = g.attributes.aS.array;
  const L = WISP.list, N = L.length;

  const pt = wispPoint(RIG.tmx, RIG.tmy);
  if (!WISP.seen) { WISP.ex = WISP.lx = pt[0]; WISP.ey = WISP.ly = pt[1]; WISP.seen = true; }
  /* the emitter trails the pointer slightly, which is what gives the drift
     its lag on a fast flick instead of snapping rigidly to the cursor */
  WISP.ex = damp(WISP.ex, pt[0], 16, dt);
  WISP.ey = damp(WISP.ey, pt[1], 16, dt);

  const dx = WISP.ex - WISP.lx, dy = WISP.ey - WISP.ly;
  const moved = Math.hypot(dx, dy);
  const ang = moved > 1e-5 ? Math.atan2(dy, dx) : 0;
  const spawn = (x, y, a, weak) => {
    const i = WISP.i; WISP.i = (i + 1) % N;      /* slot and state must pair:
       advancing first would put the position in the next slot and the life in
       this one, and every mote appears where the one before it started */
    const w = L[i], k = i * 3;
    /* The plane the trail hangs on is only about 2.2 units tall, so the
       scatter has to be read against that: a few hundredths of a unit is a
       thread stitched to the cursor, not a drift of motes. */
    P[k] = x + (Math.random() + Math.random() - 1) * .30;
    P[k + 1] = y + (Math.random() + Math.random() - 1) * .30;
    P[k + 2] = -WISP_D + (Math.random() - .5) * .9;
    w.life = 0; w.max = (weak ? 2.1 : 1.45) + Math.random() * 1.3;
    w.vx = -Math.cos(a) * .09 + (Math.random() - .5) * .38;
    w.vy = -Math.sin(a) * .09 + (Math.random() - .5) * .32 + .02;
    w.sz = (weak ? .018 : .024) + Math.random() * .026;
    w.ph = Math.random() * TAU;
  };

  WISP.acc += moved;
  const STEP = .030;
  let guard = 0;
  while (WISP.acc >= STEP && guard++ < 14) {
    WISP.acc -= STEP;
    /* lay each one at the distance along the segment it is actually owed, so a
       flick draws a spaced-out line instead of a clump at one end of it */
    const t = moved > 1e-6 ? Math.min(1, guard * STEP / moved) : 0;
    spawn(WISP.lx + dx * t, WISP.ly + dy * t, ang, false);
  }
  /* the faintest breath when the hand is still, so the cursor keeps an aura.
     Rarely, and barely buoyant: emit often here and a stationary pointer
     grows a permanent column of smoke up the middle of the frame. */
  WISP.idle += dt;
  if (WISP.idle > .42) { WISP.idle = 0; spawn(WISP.ex, WISP.ey, Math.random() * TAU, true); }
  WISP.lx = WISP.ex; WISP.ly = WISP.ey;

  for (let i = 0; i < N; i++) {
    const w = L[i], k = i * 3;
    if (w.life >= w.max) { A[i] = 0; continue; }
    w.life += dt;
    const u = w.life / w.max;
    /* curl, so the drift frays rather than blowing along one straight line */
    P[k]     += (w.vx + Math.sin(clock * 1.3 + w.ph) * .17) * dt;
    P[k + 1] += (w.vy + Math.cos(clock * 1.1 + w.ph * 1.7) * .14) * dt;
    /* light damping: they have to coast to carry the scatter outward, where
       the old rate stopped every mote within a tenth of a unit of its spawn */
    w.vx *= 1 - .5 * dt; w.vy = w.vy * (1 - .5 * dt) + .022 * dt;    /* it rises */
    A[i] = smooth(0, .12, u) * (1 - smooth(.22, 1, u)) * .9;
    S[i] = w.sz * (1 + u * .55);       /* a mote softens, it does not swell */
  }
  g.attributes.position.needsUpdate = true;
  g.attributes.aA.needsUpdate = true;
  g.attributes.aS.needsUpdate = true;
}

/* ====================================================== cloth · the plates
   Canvas UI's Cloth, ported off React and off the experimental html-in-canvas
   path it ships with. That path exists so the effect can hang arbitrary live
   HTML on the fabric — it captures the subtree with drawElementImage(), which
   is Chrome-behind-a-flag only, and the component falls back to a flat render
   everywhere else.

   Here the fabric only ever carries a still, so the capture is not needed at
   all: the plate is drawn cover-cropped into a 2-D canvas with the card's own
   two scrims baked on, and that canvas is uploaded straight to the texture.
   The simulation, both shader passes and the option set are the component's,
   unchanged. The result is that the effect runs in every WebGL2 browser
   rather than one flag.

   The grid is the component's 96 squared. Three of these on one page is a
   third of a million cell updates a second, so each one hard-stops when its
   card leaves the viewport and again once the wind dies and the fabric has
   settled — both already in the component, and both load-bearing here. */
const CLOTH_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
layout(location = 1) in vec4 aData;
layout(location = 2) in vec2 aOffset;
uniform vec2 uRes; uniform vec2 uOut; uniform float uBleed; uniform float uFocal;
out vec2 vUv; out vec3 vNormal; out float vFold; out vec2 vLocal;
void main () {
  vUv = aGrid;
  float z = aData.x;
  vec2 nxy = aData.yz;
  vNormal = vec3(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.04)));
  vFold = aData.w;
  vLocal = aGrid * uRes;
  vec2 px = vLocal + aOffset + vec2(uBleed);
  vec2 ndc = (px / uOut) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  float w = (uFocal - z) / uFocal;
  gl_Position = vec4(ndc, -z / uFocal, w);
}`;
const CLOTH_SDF = `
float fabricDist (vec2 p, vec2 size, float radius) {
  vec2 half_ = size * 0.5;
  float r = min(radius, min(half_.x, half_.y));
  vec2 q = abs(p - half_) - (half_ - vec2(r));
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}`;
const CLOTH_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; in vec3 vNormal; in float vFold; in vec2 vLocal;
out vec4 outColor;
uniform sampler2D uContent; uniform float uMaxX; uniform float uLight;
uniform float uSheen; uniform vec3 uBacking; uniform vec2 uRes;
uniform float uRadius; uniform float uDark; uniform float uEdge;
${CLOTH_SDF}
void main () {
  vec2 uv = clamp(vUv, vec2(0.001), vec2(uMaxX - 0.001, 0.999));
  vec4 tex = texture(uContent, uv);
  vec3 fabric = mix(uBacking, tex.rgb, tex.a);
  vec3 n = normalize(vNormal);
  vec3 lightDir = normalize(vec3(-0.3, 0.42, 0.86));
  float diffFlat = 0.58 + 0.42 * lightDir.z;
  float diff = 0.58 + 0.42 * dot(n, lightDir);
  float shade = mix(1.0, (diff / diffFlat) * vFold, uLight);
  vec3 lit = fabric * shade;
  vec3 halfway = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float specFlat = pow(halfway.z, 34.0);
  float spec = max(pow(max(dot(n, halfway), 0.0), 34.0) - specFlat, 0.0) / (1.0 - specFlat);
  lit += uSheen * spec * mix(vec3(1.0), fabric, 0.35);
  float broadFlat = pow(halfway.z, 6.0);
  float broad = max(pow(max(dot(n, halfway), 0.0), 6.0) - broadFlat, 0.0) / (1.0 - broadFlat);
  lit += uDark * uLight * 0.3 * broad * vec3(1.0);
  float d = fabricDist(vLocal, uRes, uRadius);
  float hemT = smoothstep(0.0, 6.0, -d);
  lit *= mix(1.0, mix(0.93, 1.0, hemT), uLight * (1.0 - uDark));
  lit += vec3(uDark * uLight * 0.08 * (1.0 - hemT));
  /* The card's outline, drawn here rather than as a rule on the box: off the
     same distance field that cuts the fabric out, so it rides every fold,
     takes the perspective with it and rounds itself on the corners. A CSS
     outline can only ever trace the flat rectangle the cloth has left. */
  /* A hairline: the band is under a pixel wide and pulled tight against the
     cut, so it reads as an edge on the fabric rather than a drawn stroke. */
  float rim = smoothstep(1.05, 0.2, abs(d + 0.7));
  lit += rim * uEdge * vec3(0.874, 0.906, 0.878);

  float alpha = clamp(0.5 - d, 0.0, 1.0);
  outColor = vec4(clamp(lit, 0.0, 1.0), 1.0) * alpha;
}`;
const CLOTH_SHADOW_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
layout(location = 1) in vec4 aData;
layout(location = 2) in vec2 aOffset;
uniform vec2 uRes; uniform vec2 uOut; uniform float uBleed;
out vec2 vLocal; out float vLift;
void main () {
  float z = aData.x;
  vLift = z;
  vLocal = aGrid * uRes;
  vec2 px = vLocal + aOffset + vec2(uBleed) + vec2(10.0, 14.0) + vec2(0.3, 0.42) * z;
  vec2 ndc = (px / uOut) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;
const CLOTH_SHADOW_FRAG = `#version 300 es
precision highp float;
in vec2 vLocal; in float vLift;
out vec4 outColor;
uniform float uShadow; uniform vec2 uRes; uniform float uRadius; uniform float uDark;
${CLOTH_SDF}
void main () {
  float d = fabricDist(vLocal, uRes, uRadius);
  float a = uShadow * smoothstep(0.0, 30.0, -d);
  a *= mix(1.0, 0.55, clamp(vLift / 50.0, 0.0, 1.0));
  a *= mix(1.0, 0.55, uDark);
  outColor = vec4(vec3(uDark) * a, a);
}`;

const CL_SEG = 96, CL_NODES = CL_SEG + 1, CL_DT = 1 / 120;
const CL_WAVE = 30, CL_STIFF = 0.55, CL_GAIN = 5.0, CL_BLEED = 48;
const CLOTH_DEFAULTS = {
  pin: 'top', wind: 3, speed: .5, amplitude: 30, drape: 40, brush: 2.05,
  brushSize: 150, damping: 1, light: .5, sheen: .1, shadow: .25,
  cornerRadius: 20, backing: 'auto', perspective: 1200
};

function createCloth(output, plate, options) {
  const config = Object.assign({}, CLOTH_DEFAULTS, options || {});
  const wrapper = output.parentElement || output;
  output.style.top = output.style.left = -CL_BLEED + 'px';
  output.style.width = 'calc(100% + ' + CL_BLEED * 2 + 'px)';
  output.style.height = 'calc(100% + ' + CL_BLEED * 2 + 'px)';

  const gl = output.getContext('webgl2', { alpha: true, depth: false, stencil: false,
    antialias: true, premultipliedAlpha: true });
  if (!gl || gl.isContextLost()) return null;

  const compile = (type, text) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, text); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error('Cloth:', gl.getShaderInfoLog(sh));
    return sh;
  };
  const link = (v, f) => {
    const prog = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, v), fs = compile(gl.FRAGMENT_SHADER, f);
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    const u = {}, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(prog, i);
      u[info.name] = gl.getUniformLocation(prog, info.name); }
    return { program: prog, vert: vs, frag: fs, uniforms: u };
  };
  const cloth = link(CLOTH_VERT, CLOTH_FRAG);
  const shadow = link(CLOTH_SHADOW_VERT, CLOTH_SHADOW_FRAG);

  const gridVerts = new Float32Array(CL_NODES * CL_NODES * 2);
  for (let y = 0; y < CL_NODES; y++) for (let x = 0; x < CL_NODES; x++) {
    const i = (y * CL_NODES + x) * 2;
    gridVerts[i] = x / CL_SEG; gridVerts[i + 1] = y / CL_SEG;
  }
  const idx = new Uint32Array(CL_SEG * CL_SEG * 6);
  let o = 0;
  for (let y = 0; y < CL_SEG; y++) for (let x = 0; x < CL_SEG; x++) {
    const a = y * CL_NODES + x, b = a + 1, c = a + CL_NODES, d = c + 1;
    idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const gridBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
  gl.bufferData(gl.ARRAY_BUFFER, gridVerts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const dataBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dataBuf);
  gl.bufferData(gl.ARRAY_BUFFER, CL_NODES * CL_NODES * 16, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  const offBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, offBuf);
  gl.bufferData(gl.ARRAY_BUFFER, CL_NODES * CL_NODES * 8, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]));

  /* the one place this differs from the component: the plate goes straight in */
  function upload() {
    const c = plate();
    if (!c || !c.width) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }

  function syncSize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(output.clientWidth * dpr));
    const h = Math.max(1, Math.round(output.clientHeight * dpr));
    if (output.width !== w || output.height !== h) { output.width = w; output.height = h; }
  }

  let hCur = new Float32Array(CL_NODES * CL_NODES);
  let hPrev = new Float32Array(CL_NODES * CL_NODES);
  let hNext = new Float32Array(CL_NODES * CL_NODES);
  const vData = new Float32Array(CL_NODES * CL_NODES * 4);
  const oData = new Float32Array(CL_NODES * CL_NODES * 2);
  const zF = new Float32Array(CL_NODES * CL_NODES);
  const rowF = new Float32Array(CL_NODES), colF = new Float32Array(CL_NODES);
  const hang = new Float32Array(CL_NODES);
  for (let a = 0; a < CL_NODES; a++) hang[a] = Math.pow(a / CL_SEG, 1.3);

  let simTime = Math.random() * 60, gust = .5, energy = 1;
  let edge = .048, edgeTo = .048;   /* barely there at rest, found on hover */
  const ptr = { x: -1e5, y: -1e5, inside: false };
  const touch = { x: -1e5, y: -1e5, vx: 0, vy: 0, s: 0 };
  const axisA = (x, y) => config.pin === 'top' ? y : config.pin === 'bottom' ? CL_SEG - y
    : config.pin === 'left' ? x : CL_SEG - x;
  const axisB = (x, y) => (config.pin === 'top' || config.pin === 'bottom') ? x : y;

  function stepSim(dt) {
    simTime += dt * Math.max(config.speed, 0);
    const t = simTime, windAmp = CL_GAIN * Math.max(config.wind, 0) * gust;
    const kb1 = (Math.PI * 2) / (CL_SEG / 1.5), kb2 = (Math.PI * 2) / (CL_SEG / 3.8);
    const ka = (Math.PI * 2) / (CL_SEG / 2.2);
    const w1 = CL_WAVE * kb1, w2 = CL_WAVE * kb2, drift = 1.8 * Math.sin(.23 * t);
    for (let b = 0; b < CL_NODES; b++)
      rowF[b] = Math.sin(kb1 * b - w1 * t + drift) + .45 * Math.sin(kb2 * b + w2 * t * .8 + 3);
    for (let a = 0; a < CL_NODES; a++)
      colF[a] = (.7 + .3 * Math.sin(ka * a - 1.7 * t)) * hang[a];
    const c2 = CL_WAVE * CL_WAVE, dt2 = dt * dt;
    const decay = Math.exp(-Math.min(Math.max(config.damping, .05), 8) * dt);
    for (let y = 0; y < CL_NODES; y++) {
      const up = Math.max(y - 1, 0) * CL_NODES, down = Math.min(y + 1, CL_SEG) * CL_NODES;
      const row = y * CL_NODES;
      for (let x = 0; x < CL_NODES; x++) {
        const i = row + x;
        const h = hCur[i];
        const lap = hCur[row + Math.max(x - 1, 0)] + hCur[row + Math.min(x + 1, CL_SEG)]
          + hCur[up + x] + hCur[down + x] - 4 * h;
        const force = windAmp * rowF[axisB(x, y)] * colF[axisA(x, y)];
        const next = 2 * h - hPrev[i] + dt2 * (c2 * lap - CL_STIFF * h + force);
        let v = h + (next - h) * decay;
        if (v > 3.5) v = 3.5; else if (v < -3.5) v = -3.5;
        hNext[i] = v;
      }
    }
    for (let b = 0; b < CL_NODES; b++) {
      let x = b, y = 0;
      if (config.pin === 'bottom') y = CL_SEG;
      else if (config.pin === 'left') { x = 0; y = b; }
      else if (config.pin === 'right') { x = CL_SEG; y = b; }
      hNext[y * CL_NODES + x] = 0;
    }
    const spent = hPrev; hPrev = hCur; hCur = hNext; hNext = spent;
  }

  function imprint(delta, width, height) {
    if (config.brush <= 0 || touch.s < .01) return;
    const cw = width / CL_SEG, ch = height / CL_SEG;
    const rx = Math.max(config.brushSize, 12) / cw, ry = Math.max(config.brushSize, 12) / ch;
    const gx = touch.x / cw, gy = touch.y / ch;
    const x0 = Math.max(Math.ceil(gx - 2.5 * rx), 0), x1 = Math.min(Math.floor(gx + 2.5 * rx), CL_SEG);
    const y0 = Math.max(Math.ceil(gy - 2.5 * ry), 0), y1 = Math.min(Math.floor(gy + 2.5 * ry), CL_SEG);
    const lift = 1.1 * Math.min(config.brush, 3) * touch.s, rate = Math.min(delta * 4, 1);
    for (let y = y0; y <= y1; y++) {
      const oy = (y - gy) / ry, row = y * CL_NODES;
      for (let x = x0; x <= x1; x++) {
        const ox = (x - gx) / rx, g = Math.exp(-(ox * ox + oy * oy));
        if (g < .02) continue;
        const i = row + x, pull = rate * g, goal = lift * g;
        hCur[i] += (goal - hCur[i]) * pull;
        hPrev[i] += (goal - hPrev[i]) * pull;
      }
    }
  }

  function foreshorten(stride, lineStride, ds, anchor, comp) {
    const ds2 = ds * ds;
    for (let l = 0; l < CL_NODES; l++) {
      const base = l * lineStride;
      oData[(base + anchor * stride) * 2 + comp] = 0;
      let cum = 0;
      for (let k = anchor + 1; k < CL_NODES; k++) {
        const i = base + k * stride, dz = zF[i] - zF[i - stride];
        cum += ds - Math.sqrt(Math.max(ds2 - dz * dz, 0));
        oData[i * 2 + comp] = -cum;
      }
      cum = 0;
      for (let k = anchor - 1; k >= 0; k--) {
        const i = base + k * stride, dz = zF[i] - zF[i + stride];
        cum += ds - Math.sqrt(Math.max(ds2 - dz * dz, 0));
        oData[i * 2 + comp] = cum;
      }
    }
  }

  function compose(width, height) {
    const amp = Math.max(config.amplitude, 0);
    const drape = config.drape * (.3 + .7 * gust);
    const cw = width / CL_SEG, ch = height / CL_SEG;
    let e = 0;
    for (let y = 0; y < CL_NODES; y++) {
      const row = y * CL_NODES;
      for (let x = 0; x < CL_NODES; x++) {
        const i = row + x, h = hCur[i];
        if (Math.abs(h) > e) e = Math.abs(h);
        zF[i] = amp * Math.tanh(h) + drape * hang[axisA(x, y)];
      }
    }
    energy = e;
    for (let y = 0; y < CL_NODES; y++) {
      const up = Math.max(y - 1, 0) * CL_NODES, down = Math.min(y + 1, CL_SEG) * CL_NODES;
      const row = y * CL_NODES;
      for (let x = 0; x < CL_NODES; x++) {
        const i = row + x;
        const l = row + Math.max(x - 1, 0), r = row + Math.min(x + 1, CL_SEG);
        const dzdx = (zF[r] - zF[l]) / (2 * cw), dzdy = (zF[down + x] - zF[up + x]) / (2 * ch);
        const inv = 1 / Math.hypot(dzdx, dzdy, 1);
        const curve = zF[l] + zF[r] + zF[up + x] + zF[down + x] - 4 * zF[i];
        let fold = 1 - curve * .01;
        if (fold < .86) fold = .86; else if (fold > 1.06) fold = 1.06;
        const q = i * 4;
        vData[q] = zF[i]; vData[q + 1] = -dzdx * inv; vData[q + 2] = -dzdy * inv; vData[q + 3] = fold;
      }
    }
    const mid = CL_SEG >> 1;
    if (config.pin === 'top' || config.pin === 'bottom') {
      foreshorten(CL_NODES, 1, ch, config.pin === 'top' ? 0 : CL_SEG, 1);
      foreshorten(1, CL_NODES, cw, mid, 0);
    } else {
      foreshorten(1, CL_NODES, cw, config.pin === 'left' ? 0 : CL_SEG, 0);
      foreshorten(CL_NODES, 1, ch, mid, 1);
    }
  }

  const backing = config.backing === 'auto' ? [.02, .026, .035] : config.backing;

  function draw() {
    const resW = Math.max(wrapper.clientWidth, 1), resH = Math.max(wrapper.clientHeight, 1);
    const outW = Math.max(output.clientWidth, 1), outH = Math.max(output.clientHeight, 1);
    const light = Math.min(Math.max(config.light, 0), 1);
    const radius = Math.max(config.cornerRadius, 0);
    const lum = .299 * backing[0] + .587 * backing[1] + .114 * backing[2];
    const dark = Math.min(Math.max((.5 - lum) / .35, 0), 1);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, output.width, output.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, dataBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, vData);
    gl.bindBuffer(gl.ARRAY_BUFFER, offBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, oData);

    gl.useProgram(shadow.program);
    gl.uniform2f(shadow.uniforms.uRes, resW, resH);
    gl.uniform2f(shadow.uniforms.uOut, outW, outH);
    gl.uniform1f(shadow.uniforms.uBleed, CL_BLEED);
    gl.uniform1f(shadow.uniforms.uShadow, Math.min(Math.max(config.shadow, 0), 1));
    gl.uniform1f(shadow.uniforms.uRadius, radius);
    gl.uniform1f(shadow.uniforms.uDark, dark);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);

    gl.useProgram(cloth.program);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(cloth.uniforms.uContent, 0);
    gl.uniform2f(cloth.uniforms.uRes, resW, resH);
    gl.uniform2f(cloth.uniforms.uOut, outW, outH);
    gl.uniform1f(cloth.uniforms.uBleed, CL_BLEED);
    gl.uniform1f(cloth.uniforms.uFocal, Math.max(config.perspective, 200));
    gl.uniform1f(cloth.uniforms.uMaxX, 1);
    gl.uniform1f(cloth.uniforms.uLight, light);
    gl.uniform1f(cloth.uniforms.uSheen, Math.max(config.sheen, 0));
    gl.uniform1f(cloth.uniforms.uRadius, radius);
    gl.uniform1f(cloth.uniforms.uDark, dark);
    gl.uniform1f(cloth.uniforms.uEdge, edge);
    gl.uniform3f(cloth.uniforms.uBacking, backing[0], backing[1], backing[2]);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  let raf = 0, last = performance.now(), debt = 0, running = false, visible = false, dead = false;
  function frame(now) {
    if (dead) return;
    if (!visible) { running = false; return; }
    const delta = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    const width = Math.max(wrapper.clientWidth, 1), height = Math.max(wrapper.clientHeight, 1);
    if (!REDUCE) {
      const t = simTime;
      const target = Math.max(.55 + .35 * Math.sin(t * .31 + 1.3)
        + .25 * Math.sin(t * .83) * (.5 + .5 * Math.sin(t * .17)), .15);
      gust += (target - gust) * Math.min(delta * 2, 1);
      const sT = ptr.inside && config.brush > 0 ? 1 : 0;
      touch.s += (sT - touch.s) * Math.min(delta * (ptr.inside ? 8 : 2.5), 1);
      const om = 14;
      touch.vx += ((ptr.x - touch.x) * om * om - 2 * om * touch.vx) * delta;
      touch.vy += ((ptr.y - touch.y) * om * om - 2 * om * touch.vy) * delta;
      touch.x += touch.vx * delta; touch.y += touch.vy * delta;
      imprint(delta, width, height);
      edge += (edgeTo - edge) * Math.min(delta * 5, 1);
      debt = Math.min(debt + delta, CL_DT * 5);
      while (debt >= CL_DT) { stepSim(CL_DT); debt -= CL_DT; }
    }
    compose(width, height);
    draw();
    if (REDUCE || (config.wind <= .001 && energy < .004 && touch.s < .01)) { running = false; return; }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (dead || running || !visible) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(() => { syncSize(); upload(); start(); });
  ro.observe(output);
  const io = new IntersectionObserver(es => {
    visible = es[es.length - 1] ? es[es.length - 1].isIntersecting : false;
    if (visible) start();
  });
  io.observe(output);
  const onMove = e => {
    const r = wrapper.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (touch.s < .01) { touch.x = x; touch.y = y; touch.vx = touch.vy = 0; }
    ptr.x = x; ptr.y = y; ptr.inside = true; start();
  };
  const onLeave = () => { ptr.inside = false; };
  wrapper.addEventListener('pointermove', onMove, { passive: true });
  wrapper.addEventListener('pointerleave', onLeave, { passive: true });
  const onHidden = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else start(); };
  document.addEventListener('visibilitychange', onHidden);

  syncSize(); upload(); compose(Math.max(wrapper.clientWidth, 1), Math.max(wrapper.clientHeight, 1));
  return { refresh(){ syncSize(); upload(); start(); }, wake: start,
           setEdge(v){ edgeTo = v; start(); } };
}

/* the plate: the card's own still, cover-cropped, carrying the two scrims the
   CSS used to lay over it — baked in so they ripple with the cloth instead of
   sitting flat on top of it */
/* The plates used to carry scenery, where a centre-weighted cover crop is
   free: trim a photograph of a garden and it is still a photograph of a
   garden. They carry product screenshots now, and those crop badly — the
   frames are 4:5 and 16:10 while the shots are 1.4:1 and 2:1, so cover was
   cutting 45% off the width of the widest one and taking the client's name
   with it.

   So the screenshot is fitted whole, and what fills the rest of the frame is
   the same image over-scaled and blurred behind it. A letterbox bar would read
   as a mistake; its own colours, out of focus, read as depth of field. */
function clothPlate(img, w, h) {
  const c = cvs(Math.max(1, w | 0), Math.max(1, h | 0)), x = c.getContext('2d');
  x.fillStyle = '#080b0f'; x.fillRect(0, 0, c.width, c.height);
  /* the backdrop, pushed past the frame so the blur has no edge to find */
  const bs = Math.max(c.width / img.width, c.height / img.height) * 1.22;
  const bw = img.width * bs, bh = img.height * bs;
  x.save();
  x.filter = 'blur(' + Math.max(10, Math.round(Math.min(c.width, c.height) * .055)) + 'px)';
  x.globalAlpha = .62;
  x.drawImage(img, (c.width - bw) / 2, (c.height - bh) / 2, bw, bh);
  x.restore();
  /* and the whole screenshot over it */
  const s = Math.min(c.width / img.width, c.height / img.height);
  const dw = img.width * s, dh = img.height * s;
  x.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  let g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(.36, 'rgba(3,6,9,.05)'); g.addColorStop(1, 'rgba(3,6,9,.73)');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(.46, 'rgba(4,6,9,0)'); g.addColorStop(1, 'rgba(4,6,9,.80)');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  return c;
}

function buildCardCloth() {
  if (COARSE) return;                     /* no pointer to brush it with */
  $$('.cards .card-fr').forEach(fr => {
    const url = (getComputedStyle(fr).backgroundImage.match(/url\(["']?([^"')]+)/) || [])[1];
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      let plate = null, pw = 0, ph = 0;
      const get = () => {
        const w = Math.round(fr.clientWidth * dpr), h = Math.round(fr.clientHeight * dpr);
        if (!plate || w !== pw || h !== ph) { plate = clothPlate(img, w, h); pw = w; ph = h; }
        return plate;
      };
      const out = document.createElement('canvas');
      out.className = 'cloth-out'; out.setAttribute('aria-hidden', 'true');
      fr.appendChild(out);
      const inst = createCloth(out, get, { wind: 3, speed: .5, amplitude: 30, drape: 40,
        brush: 2.05, brushSize: 150, damping: 1, light: .5, sheen: .1, shadow: .25,
        cornerRadius: 20, perspective: 1200, pin: 'top' });
      /* only hide the card's own painting once the fabric is really carrying it */
      if (!inst) { out.remove(); return; }
      fr.classList.add('on-cloth');
      const card = fr.closest('.card') || fr;
      card.addEventListener('pointerenter', () => inst.setEdge(.185), { passive: true });
      card.addEventListener('pointerleave', () => inst.setEdge(.048), { passive: true });
    };
    img.onerror = () => {};
    img.src = url;
  });
}

function buildLights() {
  scene.add(new THREE.HemisphereLight(0x53838f, 0x060a08, .13));

  const key = new THREE.DirectionalLight(0xb6dbe4, 1.22);
  key.position.set(2.6, 21, 2.5);
  key.target.position.set(0, 2.2, -12.5); scene.add(key.target);
  if (WANT_SHADOW) {
    key.castShadow = true;
    const S = LOW ? 1024 : 2048;
    key.shadow.mapSize.set(S, S);
    const c = key.shadow.camera;
    c.left = -26; c.right = 26; c.top = 34; c.bottom = -16; c.near = 3; c.far = 78;
    key.shadow.bias = -0.0012; key.shadow.normalBias = .035; key.shadow.radius = 2.2;
  }
  scene.add(key); WORLD.key = key;

  /* moonlight: no shadow, no fill, purely a rim down the right-hand slope of
     every roof — without it the hall is a flat black cut-out against the sky */
  const moonKey = new THREE.DirectionalLight(0xbcd6e6, .46);
  moonKey.position.set(26, 30, -60);
  moonKey.target.position.set(0, 8, -40); scene.add(moonKey.target);
  scene.add(moonKey);

  /* The three warm point lights that used to sit down on the valley floor have
     gone with the lamp posts. They were the last thing painting bright pools on
     to a flat plane, and a flat plane with warm pools on it is a lit deck no
     matter what the plane is textured with. What lights this valley now is the
     moon and nothing else — which is what a valley at night looks like. */

  /* the moon throws almost nothing, but a trace of its own colour high on the
     right keeps it attached to the scene instead of floating on top of it */
  const moonL = new THREE.PointLight(0x9fc4dc, 1.5, 46, 2);
  moonL.position.set(11.0, 17.0, -24.0); scene.add(moonL); WORLD.moonLight = moonL;

  const fill = new THREE.PointLight(0x86c6d2, 0.95, 30, 2);
  fill.position.set(-1, 13.5, -16.0); scene.add(fill);

  /* A cool fill low over the ground in place of the warm path lamp. It reads as
     more moonlight rather than as a source standing in the scene, which is the
     whole point: the ground should be *lit*, not *lamplit*. */
  const groundFill = new THREE.PointLight(0x7fa8c4, 1.15, 34, 2);
  groundFill.position.set(0, 3.2, -24.0); scene.add(groundFill);
}
/* ============================================================== the lake
   The surface is real displaced geometry — a graded grid carrying a five-wave
   Gerstner swell, see waterGrid() and WATER_VS — and not a flat plane wearing
   a normal map. That distinction is the difference between water you are
   looking at and water you are looking *along*: a normal map can light a
   surface convincingly but it cannot occlude, it cannot break a reflection
   across a crest, and it cannot put anything on the horizon. With the rig
   sitting two units above the waterline for a third of the page, all three of
   those are load-bearing.

   On top of the geometry, four things, and all four are reflections of one
   kind or another:

     1. A real planar reflection. The mountains and the moon have to be *in*
        the surface, and no amount of shading a flat plane substitutes for it.
        The scene is rendered a second time from the camera mirrored through
        the water plane, into its own half-resolution buffer, and the surface
        samples that buffer projectively.
     2. Fresnel. Water looking straight down is nearly black; water at a
        grazing angle is nearly a mirror. That ramp is the single strongest
        "this is a liquid" cue there is, and it is what makes the far half of
        a lake bright and the near half dark. Without it a reflective plane
        reads as polished stone — which is exactly the failure this scene
        already had once.
     3. The moon path. A specular lobe against a rippled normal is physically
        what a glitter track is: the small share of wave facets momentarily
        tilted to send the moon at the eye. Two lobes, one tight and one wide.
     4. Foam on the breaking crests, driven by the Gerstner folding term rather
        than by a threshold on height — so it appears where the surface is
        actually pinching, which is where a real wave whitens.

   The surface is opaque. A dark lake at night shows nothing of its bed, so
   there is nothing to gain from transparency and something to lose — an
   opaque surface is also what guarantees no sky can leak through the seam
   between the water and the foot of the range. */
const WATER = { y: 0, rt: null, cam: null, mat: null, mesh: null,
                mtx: null, clip: null, planes: null };
/* The reflection costs a second full scene pass — 141k triangles of range plus
   the sky and the moon — every frame. That is affordable next to what this page
   already does (a main pass, up to four live card viewports and ten post
   passes) but it is not affordable on the devices that trigger the low-quality
   path, so they fall back to a flat sky reflectance instead. They keep the
   Fresnel ramp and the moon path, which is most of the read. */
const WANT_REFL = qs('refl', '1') !== '0' && !LOW;

/* A seamless wave height field. The wave numbers are whole numbers of cycles
   across the plate, which is what makes it tile without a seam —
   normalFromHeight() already samples with wraparound, so the normal map comes
   out seamless too. Amplitude falls as 1/k, roughly how real wave energy is
   distributed across scales, and it is what stops the result looking like
   corrugated iron. */
function texRipple() {
  const S = 512, c = cvs(S, S), x = c.getContext('2d');
  const im = x.createImageData(S, S), d = im.data;
  const rnd = mulberry32(4242), waves = [];
  for (let i = 0; i < 20; i++) {
    const kx = Math.round((rnd() - .5) * 13), ky = Math.round((rnd() - .5) * 13);
    if (!kx && !ky) continue;
    waves.push([kx, ky, rnd() * TAU, 1 / Math.hypot(kx, ky)]);
  }
  const buf = new Float32Array(S * S);
  let lo = 1e9, hi = -1e9;
  for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
    let v = 0;
    for (let w = 0; w < waves.length; w++) {
      const q = waves[w];
      v += q[3] * Math.sin(TAU * (q[0] * i / S + q[1] * y / S) + q[2]);
    }
    buf[y * S + i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const inv = 255 / Math.max(1e-6, hi - lo);
  for (let i = 0; i < S * S; i++) {
    const g = (buf[i] - lo) * inv;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g; d[i * 4 + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return normalFromHeight(c, 3.4);
}

function waterRTSize() {
  const k = LOW ? .25 : .5;
  return [Math.max(16, Math.round(renderer.domElement.width * k)),
          Math.max(16, Math.round(renderer.domElement.height * k))];
}

/* ---------------------------------------------------- the swell, on the CPU
   Each entry is [heading in degrees off the far axis, wavelength, amplitude].

   The headings are measured from -z, so a heading of zero is a wave whose
   crests lie square across the view and which travels toward the camera. They
   are spread over about two hundred degrees: a sea running in one direction
   is a corrugated roof, and a sea running in every direction is noise. A
   dominant set within thirty degrees of the axis plus two obliques is what a
   real fetch looks like.

   The wavelengths are geometric and the amplitudes fall with them, which is
   the same 1/k energy distribution texRipple() uses one scale further down —
   the swell here and the ripple texture there are meant to read as two ends
   of one spectrum, so they are built on the same rule.

   Scale matters more than it looks. The rig sits between 2.1 and 10.5 units
   above the surface, so this is an eye barely above the water: total crest
   height is 0.71, about a third of the lowest eye height. Measured at the
   craft waypoint (eye 2.1, pitch +16 degrees, 46 degree fov) the frame bottom
   sits at -6.6 degrees of elevation and a near crest at twelve units subtends
   -6.7, so the swell only ever enters at the very bottom edge and never rises
   into the range. Doubling these numbers would put water across the
   mountains, which is the whole composition. */
const SWELL = [
  [   8, 34.0, 0.300 ],
  [ -26, 19.0, 0.200 ],
  [  52, 11.0, 0.115 ],
  [ -74,  6.5, 0.062 ],
  [ 118,  3.7, 0.030 ]
];

/* Gerstner, straight out of GPU Gems 1 ch.1, and worth saying why rather than
   a plain sum of sines: a sine surface has round crests and round troughs,
   which is the one thing water never has. Gerstner also displaces the surface
   *horizontally*, bunching vertices toward the crest, and that alone is the
   difference between a rolling swell and a quilted blanket. The steepness
   term uChop is what scales that horizontal bunching.

   The normal is analytic — the closed form from the same chapter — not a
   finite difference, so it costs three multiply-adds per wave and is exact at
   any tessellation. That matters here because the grid is deliberately graded
   (see waterGrid()) and a finite-difference normal would change character
   between the fine near cells and the coarse far ones.

   uFold accumulates the same sum that drives the normal's y term. When it
   approaches 1 the surface is pinching to a point — mathematically where a
   Gerstner wave would begin to self-intersect, physically where a real wave
   starts to break — so it is exactly the right signal to hang foam on, and it
   is free. */
const WATER_VS = [
  'uniform float uTime, uSwell, uChop, uSpeed;',
  'uniform vec4  uW[NW];',
  'varying vec3  vW, vSN;',
  'varying vec2  vB;',
  'varying float vFold, vH;',
  'void main(){',
  '  vec4  wp0 = modelMatrix * vec4(position, 1.0);',
  '  vec2  b   = wp0.xz;',
  '  vB = b;',
  /* The rim is flattened off. Everything past 180 units is buried in the
     water's own fog long before this bites, so it is purely defensive: it
     guarantees the plate's far edge is dead flat and can never lift into the
     horizon or open a gap under the foot of the range. */
  '  float tap = 1.0 - smoothstep(180.0, 300.0, length(b));',
  '  vec3  disp = vec3(0.0);',
  '  vec3  nrm  = vec3(0.0, 1.0, 0.0);',
  '  float fold = 0.0, foldMax = 0.0, amp = 0.0;',
  '  for (int i = 0; i < NW; i++) {',
  '    vec2  D = uW[i].xy;',
  '    float k = uW[i].z;',
  '    float a = uW[i].w * uSwell * tap;',
  /* Deep-water dispersion: long waves outrun short ones, which is why a real
     sea never looks like one texture scrolling. */
  '    float w  = sqrt(9.81 * k) * uSpeed;',
  '    float f  = k * dot(D, b) + uTime * w;',
  '    float S = sin(f), C = cos(f), ka = k * a;',
  '    disp.xz += uChop * a * D * C;',
  '    disp.y  += a * S;',
  '    nrm.x   -= D.x * ka * C;',
  '    nrm.z   -= D.y * ka * C;',
  '    nrm.y   -= uChop * ka * S;',
  '    fold    += uChop * ka * S;',
  '    foldMax += uChop * ka;',
  '    amp     += a;',
  '  }',
  '  vec3 wpos = wp0.xyz + disp;',
  '  vW    = wpos;',
  '  vSN   = normalize(nrm);',
  /* Both of these go out normalised to -1..1, and that is deliberate rather
     than tidy. The fragment shader hangs foam on thresholds against them, and
     the raw sums scale with uSwell and uChop — so an absolute threshold is
     silently correct at one setting and dead at every other. It was: the first
     version thresholded the raw fold at 0.30 when the set could only ever
     reach 0.298, so the folding term contributed nothing anywhere and the foam
     was running on the height term alone. Dividing by the sums' own maxima
     makes the thresholds mean what they say at any tuning. */
  '  vFold = fold / max(foldMax, 1e-4);',
  '  vH    = disp.y / max(amp, 1e-4);',
  '  gl_Position = projectionMatrix * viewMatrix * vec4(wpos, 1.0);',
  '}'
].join('\n');

const WATER_FS = [
  'uniform sampler2D tRefl;',
  'uniform sampler2D tNorm;',
  'uniform mat4  uReflMtx;',
  'uniform float uHasRefl, uTime, uFogD, uWave, uGlint, uPlaneY, uFoam, uSss;',
  'uniform vec3  uMoon, uDeep, uSky, uTint, uFogCol, uFoamCol;',
  'varying vec3  vW, vSN;',
  'varying vec2  vB;',
  'varying float vFold, vH;',
  'vec2 slope(vec2 uv){ return texture2D(tNorm, uv).xy * 2.0 - 1.0; }',
  'void main(){',
  '  vec3  toCam = cameraPosition - vW;',
  '  float dist  = length(toCam);',
  '  vec3  V     = toCam / max(dist, 1e-4);',
  /* Three octaves on different headings so the surface never shows one
     travelling direction. The finest is attenuated with distance: without that
     it aliases into static fizz about forty units out and the lake turns to
     sandpaper. */
  '  float fade = exp(-dist * 0.055);',
  /* Sampled on the *undisplaced* position, not the displaced one. The chop
     drags the surface horizontally, and a detail map pinned to where the water
     ended up would slide across it; pinned to where the water came from it
     rides along with it, which is what the foam and the ripples both need. */
  '  vec2  p = vB;',
  '  vec2  s = slope(p * 0.034 + vec2( uTime * 0.0130, uTime * 0.0210))',
  '          + slope(p * 0.087 + vec2(-uTime * 0.0190, uTime * 0.0090)) * 0.55',
  '          + slope(p * 0.240 + vec2( uTime * 0.0310,-uTime * 0.0260)) * 0.30 * fade;',
  /* The ripple tilt is grafted on to the swell normal rather than replacing
     it. The swell normal stays inside about twenty degrees of vertical at this
     steepness, so adding the tilt in world xz is indistinguishable from
     building a proper tangent frame and costs nothing. */
  '  vec3  N = normalize(vSN + vec3(-s.x, 0.0, -s.y) * uWave);',
  /* Schlick, with water's real normal-incidence reflectance of about 2%. */
  '  float ndv = max(dot(N, V), 0.0);',
  '  float F   = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);',
  /* Projective lookup through the mirror camera, nudged by the surface slope.
     The nudge has to shrink with distance or the far water tears.

     Sampled at the mean plane, not at the crest. A planar reflection is only
     exact for points *on* the mirror, so feeding it the displaced height would
     smear the reflection by the wave amplitude. Dropping the y back to the
     plane keeps the lookup exact and lets the normal nudge — which is a real
     optical effect, not an error term — carry the distortion. */
  '  vec3 refl = uSky;',
  '  if (uHasRefl > 0.5) {',
  '    vec4 pr  = uReflMtx * vec4(vW.x, uPlaneY, vW.z, 1.0);',
  '    vec2 ruv = pr.xy / max(pr.w, 1e-4);',
  '    ruv += N.xz * (0.075 / (1.0 + dist * 0.030));',
  '    refl = texture2D(tRefl, clamp(ruv, 0.002, 0.998)).rgb * uTint;',
  '  }',
  /* Crests sit a little above the body colour and troughs below it: light
     gets further into a thin crest than into the bulk. Small, but it is what
     gives the swell form in the dark instead of only in the highlights. */
  '  vec3 body = uDeep * (1.0 + 0.55 * vH);',
  '  vec3 col  = mix(body, refl, F);',
  /* Back-lit crest. The moon is behind the range, so water coming toward the
     camera is lit from behind, and the tops of the waves carry a faint cool
     glow when the eye is looking into that light. This is the cue that reads
     as "a wave" rather than "a bumpy mirror". */
  '  vec3  Lh   = normalize(vec3(uMoon.x - vW.x, 0.0, uMoon.z - vW.z));',
  '  float back = pow(max(dot(-V, Lh), 0.0), 3.0);',
  '  col += uSss * back * smoothstep(0.20, 1.00, vH) * vec3(0.62, 0.86, 1.00);',
  /* Foam, from three terms that all have to agree: near the top of a wave,
     where the wave is pinching (see vFold), and broken up by the ripple
     texture so it is lace rather than a painted contour line. Because vH
     needs to be high and vFold needs to be high at the same moment, and the
     five waves are rarely in phase, foam only ever appears on the biggest
     crests — which is what a moderate sea does. */
  '  float crest = smoothstep(0.58, 1.00, vH);',
  '  float pinch = smoothstep(0.45, 0.95, vFold);',
  '  float lace  = 0.35 + 0.65 * smoothstep(0.05, 0.55, length(s));',
  '  float foam  = clamp(crest * (0.35 + 0.90 * pinch) * lace, 0.0, 1.0) * uFoam;',
  '  col = mix(col, uFoamCol, foam);',
  /* The glitter track: the small share of facets momentarily tilted to send
     the moon at the eye. Two lobes, one tight and one wide. Foam is rough, so
     it scatters instead of mirroring — the highlight is taken back out of it
     or the crests turn to chrome. */
  '  vec3 L  = normalize(uMoon - vW);',
  '  vec3 H  = normalize(L + V);',
  '  float nh = max(dot(N, H), 0.0);',
  '  col += vec3(1.00, 1.03, 1.10) * uGlint * (1.0 - foam * 0.85)',
  '       * (pow(nh, 240.0) * 2.30 + pow(nh, 22.0) * 0.105);',
  /* Its own aerial perspective, gentler than the scene fog: at the scene's
     0.0168 the water is effectively gone by a hundred units, which is exactly
     where the mountains it is meant to be reflecting stand. */
  '  float f = 1.0 - exp(-pow(dist * uFogD, 2.0));',
  '  col = mix(col, uFogCol, f);',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

/* A graded grid, not a uniform one, and this is the whole reason the swell can
   be displaced geometry at all.

   The plate has to be enormous — 600 across, running from 220 units behind the
   rig to 380 in front of it — because its far edge must never come into frame
   and nothing may show through it. A uniform grid fine enough to carry an
   11-unit wave would need half a metre cells over all of that: nine hundred
   thousand vertices, almost all of them past the fog and invisible.

   So the spacing is graded toward where the rig actually is. Cells run about
   half a unit under the camera, 1.3 at the foot of the near slope, 1.8 at a
   hundred units out where the water is already half fog, and coarsen to three
   from there. That is ~30k vertices for the same silhouette — thirty times
   less for a surface that is, where it counts, finer than the uniform one.

   The exponents are the whole trick: distance from the focus goes as t^k with
   k > 1, so spacing grows as t^(k-1) and the fine cells cost their share of
   the budget rather than all of it. */
function waterGrid() {
  const ZF = 16;                                  /* the focus: just behind waypoint 0 */
  const zs = [];
  /* behind the rig — six cells, only ever seen edge-on if at all */
  for (let i = 6; i >= 1; i--) zs.push(ZF + (220 - ZF) * Math.pow(i / 6, 1.6));
  const NF = LOW ? 104 : 200;
  for (let i = 0; i <= NF; i++) zs.push(ZF - (ZF + 380) * Math.pow(i / NF, 1.5));

  /* x is symmetric about the view axis, fine in the middle of the frame */
  const NX = (LOW ? 80 : 144), M = NX / 2, xs = new Float32Array(NX + 1);
  for (let i = 0; i <= M; i++) {
    const v = 300 * Math.pow(i / M, 1.55);
    xs[M + i] = v; xs[M - i] = -v;
  }

  const NZ = zs.length, pos = new Float32Array((NX + 1) * NZ * 3);
  let o = 0;
  for (let j = 0; j < NZ; j++) for (let i = 0; i <= NX; i++) {
    pos[o] = xs[i]; pos[o + 1] = 0; pos[o + 2] = zs[j]; o += 3;
  }
  /* Uint32 indices: 30k vertices fits in 16 bits, but the LOW/high split and
     any future retessellation should not be one edit away from silent
     wraparound. WebGL2 and the OES_element_index_uint extension both cover it. */
  const idx = new Uint32Array((NX) * (NZ - 1) * 6);
  let q = 0;
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + (NX + 1), d = c + 1;
    idx[q] = a; idx[q + 1] = c; idx[q + 2] = b;
    idx[q + 3] = b; idx[q + 4] = c; idx[q + 5] = d; q += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

function buildWater() {
  const [rw, rh] = WANT_REFL ? waterRTSize() : [4, 4];
  WATER.rt = new THREE.WebGLRenderTarget(rw, rh, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false
  });
  WATER.cam = new THREE.PerspectiveCamera(36, 1, .35, 1900);
  WATER.cam.layers.set(0);                 /* no near foreground, no wordmark */
  WATER.mtx = new THREE.Matrix4();

  /* One clipping plane, installed once and never added or removed again. The
     count of global clipping planes is baked into every shader program, so
     toggling it per frame would recompile the entire scene twice a frame. It
     is parked at y >= -1e5 (clipping nothing) and only swung up to the water
     line for the reflection pass. */
  WATER.clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5);
  WATER.planes = [WATER.clip];
  renderer.clippingPlanes = WATER.planes;

  /* The low path drops the shortest wave. It is the one whose wavelength is
     closest to the grid step there, so it is the one that would alias, and it
     is also the cheapest thing to lose — the ripple texture covers that scale. */
  const NW = LOW ? 4 : 5;
  const waves = SWELL.slice(0, NW).map(w => {
    const th = w[0] * Math.PI / 180;
    /* headings are measured off -z, so a crest travels toward the camera */
    return new THREE.Vector4(Math.sin(th), -Math.cos(th), TAU / w[1], w[2]);
  });

  WATER.mat = new THREE.ShaderMaterial({
    defines: { NW: NW },
    uniforms: {
      tRefl:    { value: WATER.rt.texture },
      tNorm:    { value: tx(texRipple(), { wrap: THREE.RepeatWrapping, srgb: false, aniso: 8 }) },
      uReflMtx: { value: WATER.mtx },
      uHasRefl: { value: WANT_REFL ? 1 : 0 },
      uTime:    { value: 0 },
      uW:       { value: waves },
      /* A Gerstner surface self-intersects when the sum of Q*k*a reaches 1, and
         it looks like cling film well before that. The set sums to 0.298 at
         swell and chop of 1, so these two are the budget: 1.25 * 1.5 puts it at
         0.56, which is the steepest the crests get before the troughs start to
         read as creases rather than water.

         Total crest height at 1.25 is 0.88 against a rig that comes down to
         2.1 above the surface. Measured at the craft waypoint that puts a near
         crest at -5.8 degrees of elevation against a frame bottom of -6.6, so
         the swell grazes the bottom edge and no more. There is not much room
         above these numbers, which is the point of having them here in one
         place rather than folded into SWELL's amplitudes. */
      uSwell:   { value: qn('swell', 1.25) },
      uChop:    { value: qn('chop', 1.50) },
      /* A shade under real, which reads calmer without reading like slow
         motion. The primary swell's period goes from 4.7 seconds to 5.7. */
      uSpeed:   { value: qn('wspeed', 0.82) },
      uWave:    { value: 0.78 },
      uGlint:   { value: 1.0 },
      uFoam:    { value: qn('foam', 0.85) },
      uSss:     { value: 0.030 },
      uPlaneY:  { value: WATER.y },
      uMoon:    { value: new THREE.Vector3(MOON.x, MOON.y, MOON.z) },
      /* authored linear: the scene renders untonemapped into a half-float
         buffer and POST.comp does exposure and ACES at the end */
      uDeep:    { value: new THREE.Color().setRGB(.0040, .0105, .0165) },
      uSky:     { value: new THREE.Color().setRGB(.0230, .0450, .0680) },
      uTint:    { value: new THREE.Color().setRGB(.820, .900, 1.000) },
      uFoamCol: { value: new THREE.Color().setRGB(.0550, .0700, .0860) },
      uFogCol:  { value: new THREE.Color().setRGB(.0050, .0115, .0170) },
      uFogD:    { value: 0.0108 }
    },
    vertexShader: WATER_VS, fragmentShader: WATER_FS,
    /* DoubleSide because the grid is generated rather than a PlaneGeometry, so
       its winding is not something a reader should have to verify to trust that
       the lake is visible. The eye is never under the surface, so the back
       faces are never drawn and this costs nothing. */
    side: THREE.DoubleSide,
    fog: false, transparent: false, depthWrite: true
  });

  /* No rotation and no offset: waterGrid() emits world xz directly, because the
     vertex shader needs world coordinates to phase the waves and threading them
     through a rotated local frame only creates a place to get a sign wrong. */
  const mesh = new THREE.Mesh(waterGrid(), WATER.mat);
  mesh.position.set(0, WATER.y, 0);
  mesh.frustumCulled = false;
  scene.add(mesh);
  WATER.mesh = mesh; WORLD.water = mesh;
}

/* NDC -> texture coordinates, for the projective reflection lookup. */
const _bias = new THREE.Matrix4().set(.5, 0, 0, .5,  0, .5, 0, .5,  0, 0, .5, .5,  0, 0, 0, 1);
const _wFwd = new THREE.Vector3(), _wUp = new THREE.Vector3(), _wTgt = new THREE.Vector3();

function renderReflection() {
  if (!WANT_REFL || !WATER.rt || !WATER.mesh) return;
  const c = camera, m = WATER.cam, h = WATER.y;
  if (c.position.y <= h + .05) return;             /* eye at or below the surface */

  /* Size the buffer here rather than only at build time and on resize. The
     canvas can legitimately be zero-sized when the build jobs run — a
     background tab, a collapsed pane, a container that has not laid out yet —
     and a buffer sized from a zero canvas clamps to 16x16 and then stays there
     until something happens to fire a resize. setSize() is a no-op when the
     dimensions already match, so this costs nothing per frame and cannot drift. */
  const want = waterRTSize();
  if (want[0] < 32 || want[1] < 32) return;        /* nothing worth rendering into */
  if (WATER.rt.width !== want[0] || WATER.rt.height !== want[1]) WATER.rt.setSize(want[0], want[1]);

  /* The mirror camera: position and target reflected through the plane, and
     the up vector reflected with them. Reflecting a basis reverses its
     handedness, which is why the mirrored camera's right vector comes out
     negated — and why the reflection has to be sampled projectively through
     *this* camera's own matrices rather than by main-camera screen UV. */
  m.position.set(c.position.x, 2 * h - c.position.y, c.position.z);
  _wUp.set(0, 1, 0).applyQuaternion(c.quaternion);
  m.up.set(_wUp.x, -_wUp.y, _wUp.z);
  _wFwd.set(0, 0, -1).applyQuaternion(c.quaternion);
  _wTgt.copy(c.position).addScaledVector(_wFwd, 60);
  m.lookAt(_wTgt.x, 2 * h - _wTgt.y, _wTgt.z);
  m.fov = c.fov; m.aspect = c.aspect; m.near = c.near; m.far = c.far;
  m.updateProjectionMatrix(); m.updateMatrixWorld(true);
  WATER.mtx.copy(_bias).multiply(m.projectionMatrix).multiply(m.matrixWorldInverse);

  WATER.mesh.visible = false;                       /* or it samples itself */
  WATER.clip.constant = -(h - 0.04);                /* keep only what is above */
  renderer.setRenderTarget(WATER.rt);
  renderer.clear(true, true, false);
  renderer.render(scene, m);
  WATER.clip.constant = 1e5;                        /* park it again */
  WATER.mesh.visible = true;
}

/* ================================================== 7 · post-processing */
const POST = { levels: [] };
const QUAD_VS = 'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';

function initPost() {
  POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  POST.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  POST.quad.frustumCulled = false;
  POST.qScene = new THREE.Scene(); POST.qScene.add(POST.quad);
  POST.up = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uAmt: { value: 1 } }, vertexShader: QUAD_VS,
    fragmentShader: 'uniform sampler2D tS; uniform float uAmt; varying vec2 vUv;\nvoid main(){ gl_FragColor = vec4(texture2D(tS,vUv).rgb*uAmt, 1.0); }',
    blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false
  });
  if (!WANT_POST) return;
  const w = renderer.domElement.width, h = renderer.domElement.height;
  const O = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
  POST.scene = new THREE.WebGLRenderTarget(w, h, Object.assign({}, O, { depthBuffer: true, samples: LOW ? 0 : 2 }));
  let lw = Math.max(2, w >> 1), lh = Math.max(2, h >> 1);
  const N = 4;
  for (let i = 0; i < N; i++) {
    POST.levels.push({ a: new THREE.WebGLRenderTarget(lw, lh, O), b: new THREE.WebGLRenderTarget(lw, lh, O), w: lw, h: lh });
    lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1);
  }
  POST.bright = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uThr: { value: .86 }, uKnee: { value: .50 } },
    vertexShader: QUAD_VS,
    fragmentShader:
      'uniform sampler2D tS; uniform float uThr; uniform float uKnee; varying vec2 vUv;\n' +
      'void main(){ vec3 c = texture2D(tS, vUv).rgb;\n' +
      ' float l = dot(c, vec3(0.2126,0.7152,0.0722));\n' +
      ' float k = smoothstep(uThr, uThr+uKnee, l);\n' +
      ' gl_FragColor = vec4(c*k, 1.0); }'
  });
  POST.blur = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: QUAD_VS,
    fragmentShader:
      'uniform sampler2D tS; uniform vec2 uDir; varying vec2 vUv;\n' +
      'void main(){ vec3 c = texture2D(tS, vUv).rgb * 0.2270270270;\n' +
      ' c += texture2D(tS, vUv + uDir*1.3846153846).rgb * 0.3162162162;\n' +
      ' c += texture2D(tS, vUv - uDir*1.3846153846).rgb * 0.3162162162;\n' +
      ' c += texture2D(tS, vUv + uDir*3.2307692308).rgb * 0.0702702703;\n' +
      ' c += texture2D(tS, vUv - uDir*3.2307692308).rgb * 0.0702702703;\n' +
      ' gl_FragColor = vec4(c, 1.0); }'
  });
  POST.comp = new THREE.ShaderMaterial({
    uniforms: {
      tS: { value: null }, tB: { value: null }, uRes: { value: new THREE.Vector2(w, h) },
      uT: { value: 0 }, uBloom: { value: .34 }, uCA: { value: 1 }, uGrain: { value: .020 },
      uVig: { value: 1 }, uExp: { value: .62 }, uFade: { value: 1 }, uSat: { value: 1.05 }
    },
    vertexShader: QUAD_VS,
    fragmentShader:
      'uniform sampler2D tS; uniform sampler2D tB; uniform vec2 uRes;\n' +
      'uniform float uT, uBloom, uCA, uGrain, uVig, uExp, uFade, uSat;\n' +
      'varying vec2 vUv;\n' +
      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }\n' +
      'void main(){\n' +
      ' vec2 d = vUv - 0.5; float r2 = dot(d,d);\n' +
      ' float ca = uCA * (0.30 + r2*2.6) * 0.0013;\n' +
      ' vec3 c;\n' +
      ' c.r = texture2D(tS, vUv + d*ca).r;\n' +
      ' c.g = texture2D(tS, vUv).g;\n' +
      ' c.b = texture2D(tS, vUv - d*ca).b;\n' +
      ' c += texture2D(tB, vUv).rgb * uBloom;\n' +
      ' c *= uExp;\n' +
      ' c = aces(c);\n' +
      ' float l = dot(c, vec3(0.2126,0.7152,0.0722));\n' +
      ' c = mix(vec3(l), c, uSat);\n' +
      ' c = mix(c, c*vec3(0.74,1.03,1.11), smoothstep(0.55,0.0,l)*0.80);\n' +    /* teal shadows */
      ' c = mix(c, c*vec3(1.035,0.995,0.968), smoothstep(0.50,1.0,l)*0.26);\n' + /* warm highs   */
      ' float v = smoothstep(1.22, 0.26, length(d*vec2(1.0,0.94))*1.42);\n' +
      ' c *= mix(1.0, v, uVig);\n' +
      ' float g = fract(sin(dot(vUv*uRes + uT*137.0, vec2(12.9898,78.233)))*43758.5453);\n' +
      ' c += (g-0.5)*uGrain;\n' +
      ' c *= uFade;\n' +
      ' vec3 e = pow(max(c,0.0), vec3(1.0/2.2));\n' +
      /* A touch of contrast, applied after the encode rather than before it:
         in linear the same curve mostly crushes the shadows, and this frame is
         nearly all shadow. Pivoted low, at 0.30, so it deepens the night
         without pulling the lit paper of the hall down with it. */
      ' e = clamp((e - 0.30) * 1.00 + 0.30, 0.0, 1.0);\n' +
      ' gl_FragColor = vec4( e, 1.0 );\n' +
      '}'
  });
}
function pass(mat, target, additive) {
  POST.quad.material = mat;
  renderer.setRenderTarget(target || null);
  if (!additive) renderer.clear(true, false, false);
  renderer.render(POST.qScene, POST.cam);
}
function renderPost() {
  const L = POST.levels;
  POST.bright.uniforms.tS.value = POST.scene.texture;
  pass(POST.bright, L[0].a);
  for (let i = 0; i < L.length; i++) {
    if (i > 0) { POST.up.blending = THREE.NoBlending; POST.up.uniforms.uAmt.value = 1; POST.up.uniforms.tS.value = L[i - 1].a; pass(POST.up, L[i].a); }
    POST.blur.uniforms.tS.value = L[i].a; POST.blur.uniforms.uDir.value.set(1 / L[i].w, 0); pass(POST.blur, L[i].b);
    POST.blur.uniforms.tS.value = L[i].b; POST.blur.uniforms.uDir.value.set(0, 1 / L[i].h); pass(POST.blur, L[i].a);
  }
  POST.up.blending = THREE.AdditiveBlending; POST.up.uniforms.uAmt.value = .52;
  for (let i = L.length - 1; i > 0; i--) { POST.up.uniforms.tS.value = L[i].a; pass(POST.up, L[i - 1].a, true); }
  POST.comp.uniforms.tS.value = POST.scene.texture;
  POST.comp.uniforms.tB.value = L[0].a;
  pass(POST.comp, null);
}

/* ================================================= 8 · the camera rig */
const CAM = [
  { p: [  0.0, 4.05, 13.6 ], t: [  0.0, 6.60, -18.0 ], fov: 36 },  /* 0 hero        */
  { p: [ -5.6, 2.35, 11.6 ], t: [  1.2, 5.60, -14.0 ], fov: 48 },  /* 1 the sanmon  */
  { p: [  1.2, 3.60,  2.2 ], t: [ -0.6, 7.50, -22.0 ], fov: 40 },  /* 2 gardens     */
  { p: [  5.2, 2.10, -3.4 ], t: [ -2.6, 7.00, -20.0 ], fov: 46 },  /* 3 craft       */
  { p: [  0.0, 7.60, -16.0 ], t: [  0.0, 13.0, -40.0 ], fov: 42 }, /* 4 afterlight  */
  { p: [  0.0, 10.5, -20.0 ], t: [  0.0, 3.00, -34.0 ], fov: 46 }  /* 5 footer      */
];
const RIG = { prog: 0, smooth: 0, mx: 0, my: 0, tmx: 0, tmy: 0, intro: 0, focus: -1, focusAmt: 0 };
let curveP, curveT, tmpCam;

function buildRig() {
  curveP = new THREE.CatmullRomCurve3(CAM.map(c => new THREE.Vector3(c.p[0], c.p[1], c.p[2])), false, 'catmullrom', .42);
  curveT = new THREE.CatmullRomCurve3(CAM.map(c => new THREE.Vector3(c.t[0], c.t[1], c.t[2])), false, 'catmullrom', .42);
  tmpCam = new THREE.PerspectiveCamera(CAM[0].fov, vpW() / vpH(), .35, 1900);
  camera.layers.enable(1); camera.layers.enable(2);
}
const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3();
/* Every waypoint is composed for a wide frame. On a tall one the same
   numbers crop the gate in half, so the rig steps back along its own view
   axis and opens up a little instead of letting the sides fall away. */
function aspectFix() { return clamp((1.62 - vpW() / vpH()) / 1.05, 0, 1); }
function fitAspect(p, t, fov) {
  const nf = aspectFix();
  if (nf <= 0) return fov;
  _d.subVectors(p, t).normalize();
  p.addScaledVector(_d, nf * 8.2);
  p.y += nf * 1.1;
  return fov * (1 + nf * .40);
}
function applyCamera() {
  const N = CAM.length - 1;
  const u = clamp(RIG.smooth / N, 0, 1);
  curveP.getPoint(u, _p); curveT.getPoint(u, _t);
  const i = clamp(Math.floor(RIG.smooth), 0, N - 1), f = clamp(RIG.smooth - i, 0, 1);
  let fov = lerp(CAM[i].fov, CAM[i + 1].fov, f);

  fov = fitAspect(_p, _t, fov);

  /* the opening dolly: a long lens easing in from further back */
  const io = 1 - RIG.intro;
  _p.z += io * 5.6; _p.y += io * 0.65; fov += io * 8;

  /* parallax — a hand-held drift, never enough to break the frame */
  const par = 1 - smooth(0, 1.6, RIG.smooth) * .55;
  _p.x += RIG.mx * 0.62 * par; _p.y += RIG.my * 0.34 * par;
  _t.x -= RIG.mx * 0.20 * par; _t.y -= RIG.my * 0.12 * par;

  camera.position.copy(_p);
  camera.lookAt(_t);
  if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

/* ============================================== 9 · scroll ↔ chapters */
const SECS = [].slice.call(document.querySelectorAll('[data-cam]'));
let anchors = [], maxScroll = 1, activeSec = 0;
function measure() {
  maxScroll = Math.max(1, document.documentElement.scrollHeight - vpH());
  anchors = SECS.map((el, i) => {
    if (i === 0) return 0;
    if (i === SECS.length - 1) return maxScroll;
    return clamp(el.offsetTop + el.offsetHeight * .5 - vpH() * .5, 0, maxScroll);
  });
  for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
}
function progressFor(y) {
  if (y <= anchors[0]) return 0;
  for (let i = 0; i < anchors.length - 1; i++)
    if (y <= anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
  return anchors.length - 1;
}

/* ============================================ 10 · the wordmark layout */
function layoutWord() {
  if (!WORD.group) return;
  const c = CAM[0];
  const hp = new THREE.Vector3(c.p[0], c.p[1], c.p[2]);
  const ht = new THREE.Vector3(c.t[0], c.t[1], c.t[2]);
  tmpCam.fov = fitAspect(hp, ht, c.fov);
  tmpCam.aspect = vpW() / vpH();
  tmpCam.position.copy(hp);
  tmpCam.lookAt(ht);
  tmpCam.updateProjectionMatrix(); tmpCam.updateMatrixWorld(true);
  const hit = (nx, ny) => {
    const v = new THREE.Vector3(nx, ny, .5).unproject(tmpCam).sub(tmpCam.position).normalize();
    return tmpCam.position.clone().addScaledVector(v, (WORD_Z - tmpCam.position.z) / v.z);
  };
  const L = hit(-1, 0), R = hit(1, 0);
  /* Judge the frame by its shape, not its width. What forces the word up and
     in is a *tall* frame, and a 768-wide tablet held upright is as tall as a
     phone — on a width test it took the desktop baseline and sat below the
     fold with only the top of the G showing. */
  const narrow = vpW() / vpH() < 1.05;
  /* Four wide-tracked letters reach the frame edge exactly; pushing past it,
     as the six-letter word could afford to, decapitates the K and the E. The
     narrow branch is held a little inside the edge because a phone frame has
     no gutter to lose the tracking that trails the final letter into. */
  const fill = narrow ? .96 : 1.00;
  const s = (R.x - L.x) * fill / WORD.ink.w;
  /* on a tall frame the mounds sit near mid-height, so the baseline has to
     ride above them or the whole word disappears into the grass */
  const base = hit(0, narrow ? -.16 : -.585);
  WORD.group.scale.setScalar(s);
  WORD.group.position.set(-WORD.ink.cx * s, base.y, WORD_Z);
  WORD.rise = WORD.ink.asc * s * 1.25;
}

/* =================================================== 11 · page wiring */
const $  = s => document.querySelector(s);
const $$ = s => [].slice.call(document.querySelectorAll(s));
const nav = $('#nav'), preEl = $('#pre'), preFill = $('#pre-fill'), prePct = $('#pre-pct');

function wireReveals() {
  splitHeadingWords();
  const groups = new Map();
  const items = $$('[data-rv], .mask-line');
  items.forEach(el => {
    const key = el.parentElement;
    const arr = groups.get(key) || []; arr.push(el); groups.set(key, arr);
  });
  groups.forEach(arr => arr.forEach((el, i) => el.dataset.rvd = i * 85));
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const d = parseFloat(e.target.dataset.rvd || 0);
      setTimeout(() => e.target.classList.add('rv-in'), REDUCE ? 0 : d);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: .04 });
  items.forEach(el => { if (!el.closest('#hero')) io.observe(el); });
}

/* Word-level masks let every display heading arrive at a human reading pace.
   The original text remains the accessible label, while the visual words are
   explicitly presentational. The existing section observer still controls
   when each heading starts. */
function splitHeadingWords() {
  if (REDUCE) return;
  $$('h1.display, h2.display').forEach(heading => {
    const lines = heading.querySelectorAll('.mask-line');
    const targets = lines.length ? [].slice.call(lines) : [heading];
    targets.forEach(target => {
      if (target.dataset.wordReady === 'true') return;
      const phrase = target.textContent.replace(/\s+/g, ' ').trim();
      if (!phrase) return;
      target.dataset.wordReady = 'true';
      target.classList.add('word-reveal');
      target.setAttribute('aria-label', phrase);
      target.textContent = '';
      phrase.split(' ').forEach((word, i) => {
        if (i) target.appendChild(document.createTextNode(' '));
        const mask = document.createElement('span');
        const inner = document.createElement('span');
        mask.className = 'word-mask'; mask.setAttribute('aria-hidden', 'true');
        inner.className = 'word'; inner.textContent = word;
        inner.style.setProperty('--word-delay', (i * 72) + 'ms');
        mask.appendChild(inner); target.appendChild(mask);
      });
    });
  });
}

/* Foreground PNGs are section-owned until their chapter is called. At that
   point the active stage becomes a fixed lower viewport plane; its predecessor
   remains there just long enough to blur and fade out before returning home.

   While it holds that plane the stage is re-parented into #fg-sky, which lives
   outside .page and so is not capped by its stacking context — that is the
   only way a cut-out can pass in front of the nav and the chapter rail. The
   move costs nothing in layout: the stage is position:fixed either way, and
   its placement rules key off [data-fg], not off the section it came from. */
function wireForegroundStages() {
  const pairs = $$('.sec .fg, .foot .fg').map(stage => ({
    section:stage.closest('.sec, .foot'), stage
  })).filter(pair => pair.section);
  if (!pairs.length) return;

  const sky = $('#fg-sky');
  const ratios = new Map(pairs.map(pair => [pair.section, 0]));
  const homes = new WeakMap(pairs.map(pair => [pair.stage, pair.section]));
  const timers = new WeakMap();
  let activeStage = null;

  const lift = stage => {
    if (!sky || stage.parentNode === sky) return;
    sky.appendChild(stage);
    /* A re-inserted element has no previous computed style, so the entrance
       would land already finished. Resolve the parked state in its new parent
       first and the pieces have something to rise from. */
    void stage.offsetWidth;
  };
  const park = stage => {
    const home = homes.get(stage);
    if (home && stage.parentNode !== home) home.insertBefore(stage, home.firstChild);
  };

  const retire = stage => {
    if (!stage || stage === activeStage) return;
    const pending = timers.get(stage);
    if (pending) clearTimeout(pending);
    stage.classList.remove('fg-active');
    if (REDUCE) { park(stage); return; }
    stage.classList.add('fg-retiring');
    timers.set(stage, setTimeout(() => {
      stage.classList.remove('fg-retiring');
      timers.delete(stage);
      park(stage);
    }, 820));
  };

  const activate = stage => {
    if (!stage || stage === activeStage) return;
    const pending = timers.get(stage);
    if (pending) clearTimeout(pending);
    stage.classList.remove('fg-retiring');
    lift(stage);
    stage.classList.add('fg-active');
    const prior = activeStage;
    activeStage = stage;
    retire(prior);
  };

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0));
    const next = pairs.reduce((best, pair) =>
      (ratios.get(pair.section) || 0) > (ratios.get(best.section) || 0) ? pair : best
    );
    const nextRatio = ratios.get(next.section) || 0;
    if (nextRatio > 0) activate(next.stage);
    else if (activeStage) {
      const prior = activeStage;
      activeStage = null;
      retire(prior);
    }
  }, { rootMargin:'-12% 0px -12% 0px', threshold:[0, .12, .32, .55] });

  pairs.forEach(pair => observer.observe(pair.section));
}

/* ------------------------------------------------------ leaving the hero
   Everything along the foot of the hero is spent the moment the walk starts:
   the cue has been read, the four chapters have been offered, the preview has
   been seen, and the scrim under them is only there to hold the type off the
   sanctuary. Letting the block slide away together reads as the page moving;
   giving each piece its own window empties the foot one element at a time
   instead, which reads as the hero standing down.

   The preview window is not staggered with the rest. It is the largest,
   flattest thing in the frame and a slow fade just dims it in place, so it
   goes early, goes quickly, and dissolves rather than fades: the blur is what
   makes the frame look like it is letting go of it rather than turning it
   down.

   Nothing is written until the scroll actually leaves zero, and everything is
   handed back the moment it returns: these elements carry the page's own
   entrance reveal, and an inline opacity set at rest would pre-empt it. */
function wireHeroExit() {
  const hero = $('#hero'); if (!hero) return;
  /* at = where in the exit it starts, span = how long it takes to go */
  const seq = [
    { el: $('.peek'),      at: .00, span: .26, blur: 10 },
    { el: $('.hero-cue'),  at: .10, span: .30, shift: true },
    ...$$('.chip').map((el, i) => ({ el: el, at: .20 + i * .10, span: .30, shift: true })),
    { el: $('.chapters'),  at: .60, span: .30 },  /* shifting it carries the chips twice */
    { el: $('.hero-side'), at: .70, span: .30 }   /* its transform is the centring -50% */
  ].filter(o => o.el);
  let on = false;
  const apply = () => {
    const t = clamp(scrollY / Math.max(1, vpH() * .58), 0, 1);
    if (t <= 0) {
      if (!on) return;
      seq.forEach(o => {
        o.el.style.opacity = ''; o.el.style.transform = ''; o.el.style.filter = '';
        o.el.style.pointerEvents = ''; o.el.style.transition = '';
      });
      on = false; return;
    }
    on = true;
    seq.forEach(o => {
      /* these carry the reveal's own .9s opacity transition, which would
         animate every value written here — the fade would then trail the
         scroll by most of a second and stop reading as scroll-driven */
      o.el.style.transition = 'none';
      const a = 1 - smooth(o.at, o.at + o.span, t);
      o.el.style.opacity = a.toFixed(3);
      if (o.shift) o.el.style.transform = 'translate3d(0,' + ((1 - a) * 15).toFixed(1) + 'px,0)';
      if (o.blur) o.el.style.filter = a > .999 ? '' : 'blur(' + ((1 - a) * o.blur).toFixed(1) + 'px)';
      o.el.style.pointerEvents = a < .05 ? 'none' : '';
    });
  };
  addEventListener('scroll', apply, { passive: true });
  addEventListener('resize', apply, { passive: true });
  apply();
}

function wireNav() {
  let last = 0;
  const rail = $('#rail');
  const names = ['Introduction', 'About', 'Selected work', 'Skillset', 'Contact', 'Colophon'];
  SECS.forEach((s, i) => {
    const b = document.createElement('button');
    b.innerHTML = '<i></i>'; b.title = names[i] || '';
    b.setAttribute('aria-label', names[i] || 'section');
    b.addEventListener('click', () => scrollTo({ top: anchors[i], behavior: REDUCE ? 'auto' : 'smooth' }));
    rail.appendChild(b);
  });
  const dots = $$('#rail button');
  const links = $$('.nav-link');
  const burger = $('.nav-burger');
  const closeMenu = () => {
    nav.classList.remove('menu-open');
    burger.classList.remove('active');
    burger.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('nav-open');
  };
  const setMenu = open => {
    /* clear the scroll-hide before the sheet opens: leaving it set would ease
       the bar back down on close, promoting it again under the outgoing sheet */
    if (open) nav.classList.remove('hide');
    nav.classList.toggle('menu-open', open);
    burger.classList.toggle('active', open);
    burger.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('nav-open', open);
  };
  burger.setAttribute('aria-controls', 'navlinks');
  burger.setAttribute('aria-expanded', 'false');
  burger.addEventListener('click', () => {
    if (vpW() > 820) return;
    setMenu(!nav.classList.contains('menu-open'));
  });
  links.forEach(link => link.addEventListener('click', closeMenu));
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  addEventListener('resize', () => { if (vpW() > 820) closeMenu(); }, { passive:true });
  /* Which chapter each link actually points at, read off its href. The old
     rule was positional — link i lit for section i+1 — which silently assumed
     one link per section in matching order. With five links over four chapters
     every entry past the third lit for its neighbour: standing in Afterlight
     highlighted Stories. Reading the destination cannot drift. */
  const linkSec = links.map(l => {
    const href = l.getAttribute('href');
    return href && href[0] === '#' ? SECS.indexOf(document.querySelector(href)) : -1;
  });
  window.addEventListener('scroll', () => {
    const y = scrollY;
    nav.classList.toggle('stuck', y > 40);
    /* and don't even mark it hidden while the menu is open, or the class lands
       the moment the sheet closes and the bar blinks away under the thumb */
    nav.classList.toggle('hide',
      !nav.classList.contains('menu-open') && y > last + 4 && y > vpH() * .8);
    last = y;
    const a = Math.round(progressFor(y));
    if (a !== activeSec) {
      activeSec = a;
      dots.forEach((d, i) => d.classList.toggle('on', i === a));
      links.forEach((l, i) => l.classList.toggle('on', linkSec[i] === a));
    }
  }, { passive: true });
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    scrollTo({ top: a.getAttribute('href') === '#top' ? 0 : t.offsetTop - 40, behavior: REDUCE ? 'auto' : 'smooth' });
  }));
}

function wireFocus() {
  const set = i => { RIG.focus = i; };
  $$('[data-chip]').forEach(el => {
    el.addEventListener('mouseenter', () => { set(+el.dataset.chip); $$('[data-chip]').forEach(o => o.classList.toggle('on', o === el)); });
    el.addEventListener('mouseleave', () => { set(-1); el.classList.remove('on'); });
  });
  $$('[data-les]').forEach(el => {
    el.addEventListener('mouseenter', () => set(+el.dataset.les % 4));
    el.addEventListener('mouseleave', () => set(-1));
  });
}

function wireCursor() {
  const dot = $('#cursor');
  if (COARSE) { dot.style.display = 'none'; return; }
  let x = vpW() / 2, y = vpH() / 2, tx2 = x, ty = y;
  addEventListener('pointermove', e => {
    tx2 = e.clientX; ty = e.clientY;
    RIG.tmx = (e.clientX / vpW()) * 2 - 1;
    RIG.tmy = -((e.clientY / vpH()) * 2 - 1);
  }, { passive: true });
  $$('[data-cursor]').forEach(el => {
    el.addEventListener('mouseenter', () => dot.classList.add('act'));
    el.addEventListener('mouseleave', () => dot.classList.remove('act'));
  });
  (function tick() {
    x = lerp(x, tx2, .18); y = lerp(y, ty, .18);
    dot.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    requestAnimationFrame(tick);
  })();
}

function makeGrain() {
  const S = 180, c = cvs(S, S), x = c.getContext('2d');
  const im = x.createImageData(S, S), d = im.data, r = mulberry32(9);
  for (let i = 0; i < S * S; i++) {
    const v = 110 + r() * 90;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  $('#grain').style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
}

/* ============================================ 12 · the card viewports */
const CARDS = [];
function buildCards() {
  const defs = [
    { p: [-2.0, 1.60, -2.0], t: [0, 10.0, -34.0], fov: 40 },    /* the long climb */
    { p: [4.2, 2.90, -9.5], t: [6.4, 2.90, -14.4], fov: 40 },   /* lantern court  */
    { p: [3.4, 2.40, 2.0], t: [-1.0, -.60, -6.0], fov: 40 },    /* the wet court  */
    /* the fourth plate looks back down the flight from near the top of it —
       the one view in the set that faces out of the sanctuary rather than into
       it, so four windows do not read as four angles on the same wall */
    { p: [0.0, 8.20, -30.0], t: [0.4, 1.20, -4.0], fov: 44 },   /* the way back   */
    /* index 4 used to be a wide establishing shot for the full-width "Mockup"
       banner plate. That plate is gone, so the hero portrait window moves down
       into its slot and this array stays the same length as the set of
       [data-view] elements — the lookup is by index, so a stale entry here
       would silently hand the wrong camera to the wrong frame. */
    { p: [0.6, 3.40, -12.0], t: [0, 12.0, -40.0], fov: 26 }     /* hero window    */
  ];
  $$('[data-view]').forEach(el => {
    const d = defs[+el.dataset.view]; if (!d) return;
    const c = new THREE.PerspectiveCamera(d.fov, 4 / 5, .3, 200);
    c.position.set(d.p[0], d.p[1], d.p[2]);
    c.lookAt(d.t[0], d.t[1], d.t[2]);
    c.layers.set(0);
    c.userData = { home: c.position.clone(), look: new THREE.Vector3(d.t[0], d.t[1], d.t[2]), push: 0, want: 0 };
    CARDS.push({ cam: c, el: el.querySelector('[data-frame]') || el, rect: null });
    el.addEventListener('mouseenter', () => c.userData.want = 1);
    el.addEventListener('mouseleave', () => c.userData.want = 0);
  });
}
/* A render target keeps its own viewport/scissor — renderer.setScissor()
   only ever reaches the default framebuffer, so the region has to be set on
   whichever surface we are actually drawing into, and re-bound to take. */
const _push = new THREE.Vector3();
function setRegion(rt, x, y, w, h) {
  if (rt) {
    const pr = renderer.getPixelRatio();
    rt.viewport.set(x * pr, y * pr, w * pr, h * pr);
    rt.scissor.set(x * pr, y * pr, w * pr, h * pr);
    rt.scissorTest = true;
    renderer.setRenderTarget(rt);
  } else {
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.setScissorTest(true);
  }
}
function clearRegion(rt) {
  if (rt) {
    rt.viewport.set(0, 0, rt.width, rt.height);
    rt.scissor.set(0, 0, rt.width, rt.height);
    rt.scissorTest = false;
    renderer.setRenderTarget(rt);
  } else {
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, vpW(), vpH());
    renderer.setScissor(0, 0, vpW(), vpH());
  }
}
function cardBuffer(C, w, h) {
  const pr = Math.min(renderer.getPixelRatio(), 2);
  const W = Math.max(8, Math.round(w * pr)), H = Math.max(8, Math.round(h * pr));
  if (C.rt && C.rt.width === W && C.rt.height === H) return C.rt;
  if (C.rt) C.rt.dispose();
  C.rt = new THREE.WebGLRenderTarget(W, H, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false
  });
  C.dirty = true;
  return C.rt;
}
function aimCard(C, aspect) {
  const c = C.cam, u = c.userData;
  c.aspect = aspect; c.updateProjectionMatrix();
  _push.subVectors(u.look, u.home).normalize();
  c.position.copy(u.home).addScaledVector(_push, u.push * .55);
  c.lookAt(u.look);
}
/* Each viewport keeps its own buffer and only re-renders when it is moving
   or when its slot in the refresh rota comes round — the views are static,
   so paying for four scene traversals every frame buys nothing. */
/* The blit lands in the composite at the element's screen rect, and the canvas
   knows nothing about the DOM stacked over it — so a card the page has faded
   goes on painting a live view into the frame with no card around it, which is
   what put a second lit hall in the corner once the hero exit started dimming
   the preview. Cull on the element's effective opacity, not just its rect.

   Below full opacity is the right place to stop: the card's own still is
   opaque, so the view behind it only ever shows through by (1 − alpha). At
   alpha just under one that is nothing, and the cut is invisible. */
function cardAlpha(el) {
  let a = 1;
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden') return 0;
    a *= +s.opacity;
    if (a < .001) return 0;
  }
  return a;
}
function renderCards(rt) {
  if (!CARDS.length) return;
  let drew = false;
  for (let i = 0; i < CARDS.length; i++) {
    const C = CARDS[i], r = C.el.getBoundingClientRect();
    if (r.bottom < -40 || r.top > vpH() + 40 || r.width < 4) continue;
    if (cardAlpha(C.el) < .995) continue;
    /* a card carrying cloth has no background left of its own, so the blit
       would show through the fabric's rounded corners and past its edges */
    if (C.el.classList.contains('on-cloth')) continue;
    if (!WANT_POST) {                              /* debug path: straight in */
      setRegion(rt, r.left, vpH() - r.bottom, r.width, r.height);
      renderer.clear(true, true, false);
      aimCard(C, r.width / r.height);
      renderer.render(scene, C.cam);
      drew = true; continue;
    }
    const buf = cardBuffer(C, r.width, r.height);
    const u = C.cam.userData;
    if (C.dirty || Math.abs(u.push - u.want) > .002 || (FRAME + i * 7) % 24 === 0) {
      aimCard(C, r.width / r.height);
      renderer.setRenderTarget(buf);
      renderer.clear(true, true, false);
      renderer.render(scene, C.cam);
      C.dirty = false;
    }
    setRegion(rt, r.left, vpH() - r.bottom, r.width, r.height);
    POST.up.blending = THREE.NoBlending;
    POST.up.uniforms.uAmt.value = 1;
    POST.up.uniforms.tS.value = buf.texture;
    pass(POST.up, rt);
    drew = true;
  }
  if (drew) clearRegion(rt);
}

/* ==================================================== 13 · the machine */
let running = false, tPrev = 0, clock = 0, fadeIn = 0;
const INTRO = { t0: 0 };

function resize() {
  const w = vpW(), h = vpH();
  document.documentElement.style.setProperty('--vw', w + 'px');
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, DPR_CAP) * PERF.scale);
  renderer.setSize(w, h, true);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const pw = renderer.domElement.width, ph = renderer.domElement.height;
  if (WANT_POST && POST.scene) {
    POST.scene.setSize(pw, ph);
    POST.comp.uniforms.uRes.value.set(pw, ph);
    let lw = Math.max(2, pw >> 1), lh = Math.max(2, ph >> 1);
    POST.levels.forEach(L => { L.a.setSize(lw, lh); L.b.setSize(lw, lh); L.w = lw; L.h = lh; lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1); });
  }
  if (WATER.rt && WANT_REFL) { const r = waterRTSize(); WATER.rt.setSize(r[0], r[1]); }
  /* multisampling is the first thing to go when the budget tightens */
  if (POST.scene) {
    const want = (!LOW && PERF.scale > .78) ? 2 : 0;
    if (POST.scene.samples !== want) { POST.scene.samples = want; POST.scene.dispose(); }
  }
  CARDS.forEach(C => { C.dirty = true; });
  if (WANT_SHADOW && WORLD.key) WORLD.key.shadow.needsUpdate = true;
  if (WORLD.embers) WORLD.embers.material.uniforms.uSize.value = h * renderer.getPixelRatio() * .5;
  if (WISP.mesh) WISP.mesh.material.uniforms.uPx.value = h * renderer.getPixelRatio();
  placeMoon();
  layoutWord();
  measure();
}

function updateWorld(dt) {
  WORLD.uT.value = clock;

  /* the focused chapter swells the disc */
  RIG.focusAmt = damp(RIG.focusAmt, RIG.focus >= 0 ? 1 : 0, 5, dt);
  const f = RIG.focusAmt;
  /* the moon only breathes — the haze in front of it is what actually moves */
  if (WORLD.moonHalo) WORLD.moonHalo.material.opacity = .44 + f * .10 + Math.sin(clock * .34) * .05;

  /* the range answers the pointer, near layers hardest — the slide between
     them is what reports the depth the tints only imply */

  /* haze slides across the courtyard */
  if (WORLD.haze) WORLD.haze.forEach(h => {
    h.position.x = h.userData.x0 + Math.sin(clock * h.userData.sp + h.userData.ph) * 5.5;
    h.quaternion.copy(camera.quaternion);
  });

  /* the lake surface. The moon is read from the mesh rather than the MOON
     constant, because placeMoon() slides it with the frame aspect and the
     glitter path has to point at where it actually is. */
  if (WATER.mat) {
    WATER.mat.uniforms.uTime.value = clock;
    if (WORLD.moon) WATER.mat.uniforms.uMoon.value.copy(WORLD.moon.position);
  }

  /* ripples on the standing water */
  if (WORLD.ripples) WORLD.ripples.forEach(r => {
    const u = r.userData;
    u.t += dt * u.sp;
    if (u.t > 4) { u.t = 0; u.x = (Math.random() - .5) * 22; u.z = -8 + Math.random() * 22; }
    const k = u.t / 4;
    const s = .3 + k * 4.2;
    r.scale.set(s, s, 1);
    r.position.set(u.x, .02, u.z);
    r.material.opacity = Math.sin(k * Math.PI) * .16;
  });

  /* the type rises from behind the grass, then dissolves as you close on it */
  if (WORD.group) {
    const near = smooth(0.02, 0.92, RIG.smooth);
    WORD.glyphs.forEach((g, i) => {
      const st = clamp((WORD.reveal - i * .075) / .62, 0, 1);
      const e = easeOut(st);
      g.position.y = g.userData.baseY - (1 - e) * (WORD.ink.asc * 1.15);
      g.material.opacity = e * (1 - near * .96);
      g.visible = g.material.opacity > .004;
    });
  }
  /* the cut-out layers dissolve as the camera reaches them, so the path can
     walk straight through the garden instead of steering around the veil */
  if (WORLD.fg) WORLD.fg.forEach(m => {
    const a = smooth(.9, 4.6, camera.position.z - m.position.z);
    m.material.opacity = a;
    m.visible = a > .006;
  });
  updateLeaves(dt);
  updateWisps(dt);
  if (CARDS.length) CARDS.forEach(C => { const u = C.cam.userData; u.push = damp(u.push, u.want, 3.4, dt); });
}

let FRAME = 0;
function render() {
  FRAME++;
  renderReflection();
  renderer.setRenderTarget(WANT_POST ? POST.scene : null);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);
  renderCards(WANT_POST ? POST.scene : null);
  renderer.setRenderTarget(null);
  if (WANT_POST) {
    POST.comp.uniforms.uT.value = clock;
    POST.comp.uniforms.uFade.value = fadeIn;
    renderPost();
  }
}

function frame(now) {
  if (!running) return;
  const raw = (now - tPrev) / 1000 || 0;
  const dt = Math.min(raw, .05);              /* animation never jumps … */
  tPrev = now; clock += dt;
  fadeIn = INTRO.t0 ? sat((now - INTRO.t0) / 700) : 1;

  if (!PERF.locked && clock > 2.2) {
    PERF.acc += raw; PERF.n++;      /* … but the governor reads the truth */
    if (PERF.n >= 40 || PERF.acc > .9) {
      const avg = PERF.acc / PERF.n; PERF.acc = 0; PERF.n = 0;
      if (avg > .0230 && PERF.scale > .55) { PERF.scale = Math.max(.55, PERF.scale * (avg > .05 ? .64 : .85)); resize(); }
      else if (avg < .0138 && PERF.scale < 1) { PERF.scale = Math.min(1, PERF.scale + .08); resize(); }
    }
  }
  RIG.prog = progressFor(scrollY);
  RIG.smooth = REDUCE ? RIG.prog : damp(RIG.smooth, RIG.prog, 5.2, dt);
  RIG.mx = damp(RIG.mx, RIG.tmx, 2.6, dt);
  RIG.my = damp(RIG.my, RIG.tmy, 2.6, dt);
  if (INTRO.t0) {
    const el = (now - INTRO.t0) / 1000;
    RIG.intro = sat(el / 2.4);
    WORD.reveal = Math.min(1.2, el / 1.5);
  }

  applyCamera();
  updateWorld(dt);
  render();
  queue();
}
const TIMER = qs('driver', 'raf') === 'timer';
function queue() { TIMER ? setTimeout(() => frame(performance.now()), 16) : requestAnimationFrame(frame); }

const JOBS = [
  ['Reading the type', () => (document.fonts ? Promise.race([document.fonts.load('600 320px Wordmark'), new Promise(res => setTimeout(res, 250))]) : null)],
  ['Pouring the ground', () => { initGL(); WORLD.uT = { value: 0 }; buildRig(); buildLights(); }],
  ['Cutting the approach', () => buildShell()],
  ['Filling the lake', () => buildWater()],
  ['Raising the range', () => buildRange()],
  ['Hanging the moon', () => buildMoon()],
  /* Rocks only. There were eight lit lamp posts standing in a receding double
     row across the valley floor, and together with the flat ground and the
     pools they threw on it they were the "dock": a paved surface, edged with
     lights, marching to a vanishing point. Nothing about that is landscape —
     it is a promenade, and it survived four separate attempts to fix it
     because each of those attempts went after the *symptoms* (a glow plane, a
     mist band, the floor's far edge) instead of the thing itself. Lamp posts
     on a lit path are a built structure. They are gone. */
  ['Placing the stones', () => buildRocks()],
  ['Growing the maples', () => {
    buildMaple(71, 12.6, -13.0, 1.05); buildMaple(72, -11.8, -9.4, .95);
    buildMaple(73, 9.2, -19.0, .82);   buildMaple(74, -14.5, -17.5, 1.0);
    buildMaple(75, 16.5, -6.0, .88);
  }],
  ['Painting the near grass', () => buildForeground()],
  ['Cutting the word', () => buildWordmark()],
  ['Raising the mist', () => { buildAtmosphere(); buildLeafFall(); buildWisps(); }],
  ['Polishing the water', () => {
    initPost(); buildCards(); buildCardCloth();
    WORLD.fg.forEach(m => m.layers.set(1));
    WORD.glyphs.forEach(m => m.layers.set(2));
    if (WORLD.rain) WORLD.rain.layers.set(1);
    if (WORLD.leaves) WORLD.leaves.mesh.layers.set(1);
    WORLD.ripples.forEach(r => r.layers.set(1));
    layoutWord(); measure();
    if (WANT_SHADOW && WORLD.key) { WORLD.key.shadow.autoUpdate = false; WORLD.key.shadow.needsUpdate = true; }
  }]
];

function boot() {
  try {
    makeGrain();
    wireReveals(); wireForegroundStages(); wireNav(); wireHeroExit(); wireFocus(); wireCursor();
    document.body.classList.add('is-locked');
  } catch (err) {
    console.error('[scene] init wiring failed', err);
  }

  /* This used to be a single 4-second timer from the start of boot. That is
     wrong for the same reason a flight departure gate doesn't close on a
     fixed clock regardless of whether passengers are still boarding: the jobs
     do real, variable synchronous work — buildRange() alone walks a grid that
     can run to 70k+ vertices with a 5-octave noise sample and a repose pass at
     every one of them — and totalling that across eleven jobs legitimately
     passed 4 seconds on ordinary hardware. The watchdog fired mid-boot, hid
     the canvas and showed the static fallback, while the real boot kept
     running underneath to a silent, complete success a couple of seconds
     later. The page was never broken; the loading screen just gave up on it
     early and nothing ever told it to stand down.

     A per-job deadline instead of a whole-boot one: it re-arms every time a
     job finishes, so a device slow enough to need eleven seconds for eleven
     honest jobs gets eleven seconds, and only a job that is genuinely stuck —
     not merely slow — ever trips it. */
  let watchdog;
  const armWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (preEl && !preEl.classList.contains('done')) {
        console.warn('[scene] preloader watchdog: no job finished in 6s, falling back');
        fallback('preloader stalled');
      }
    }, 6000);
  };
  armWatchdog();

  let i = 0;
  const step = () => {
    if (i >= JOBS.length) {
      clearTimeout(watchdog);
      setTimeout(start, 220);
      return;
    }
    const j = JOBS[i];
    const done = () => {
      i++;
      armWatchdog();
      const p = i / JOBS.length;
      if (preFill) preFill.style.right = ((1 - p) * 100).toFixed(1) + '%';
      if (prePct) prePct.textContent = Math.round(p * 100);
      if (i < JOBS.length) {
        setTimeout(step, 16);
      } else {
        clearTimeout(watchdog);
        setTimeout(start, 220);
      }
    };
    let r;
    try {
      r = j[1]();
    } catch (err) {
      console.error('[scene] job "' + j[0] + '" failed', err);
      if (i <= 1) {
        clearTimeout(watchdog);
        return fallback(err);
      }
    }
    if (r && typeof r.then === 'function') {
      Promise.race([
        r,
        new Promise(resolve => setTimeout(resolve, 600))
      ]).then(done, done);
    } else {
      done();
    }
  };
  setTimeout(step, 60);
}

function fallback(err) {
  document.documentElement.classList.add('no-webgl');
  document.body.classList.add('no-webgl');
  document.body.classList.remove('is-locked');
  if (preEl) preEl.classList.add('done');
  $$('[data-rv], .mask-line').forEach(e => e.classList.add('rv-in'));
  window.__scene = { fallback: true, error: String(err && err.message || err) };
}

function start() {
  addEventListener('resize', () => { resize(); }, { passive: true });
  addEventListener('orientationchange', () => setTimeout(resize, 250));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; }
    else if (!running) { running = true; tPrev = performance.now(); queue(); }
  });
  resize();

  const shot = Q.get('shot');
  if (shot !== null) {                       /* deterministic states for review */
    RIG.intro = 1; WORD.reveal = 1.2; fadeIn = 1; INTRO.t0 = 0;
    const n = clamp(parseInt(shot, 10) || 0, 0, SECS.length - 1);
    scrollTo(0, anchors[n]);
    RIG.smooth = RIG.prog = progressFor(anchors[n]);
    $$('[data-rv], .mask-line').forEach(e => e.classList.add('rv-in'));
    document.body.classList.remove('is-locked');
    preEl.classList.add('done');
  } else {
    /* and land at the top even if something scrolled while the world was being
       built — an anchor in the URL, a restored position that beat the flag, a
       stray focus */
    scrollTo(0, 0);
    RIG.smooth = RIG.prog = 0;
    preEl.classList.add('done');
    setTimeout(() => {
      document.body.classList.remove('is-locked');
      $('#hero').querySelectorAll('[data-rv], .mask-line').forEach((e, i) =>
        setTimeout(() => e.classList.add('rv-in'), REDUCE ? 0 : 120 + i * 95));
    }, REDUCE ? 0 : 340);
  }
  running = true; tPrev = performance.now();
  INTRO.t0 = shot !== null ? 0 : (REDUCE ? performance.now() - 4000 : performance.now());
  queue();
  window.__scene = { RIG: RIG, WORLD: WORLD, WORD: WORD, CAM: CAM, POST: POST, WATER: WATER, renderer: renderer, scene: scene, camera: camera, anchors: () => anchors };
}

if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 0);
else addEventListener('DOMContentLoaded', boot);
})();
