# Biradhwaj Senapati — portfolio

My personal portfolio, hosted at [biradhwaj-pf.vercel.app](https://biradhwaj-pf.vercel.app).

It's a scroll-driven site built on a live WebGL scene: six chapters walking up
a misty hillside at night. The camera moves as you scroll and drifts with the
pointer; every chapter hands its foreground to the next. The whole world —
concrete, granite, grass, rock, the mist, the moon, the lake — is generated
procedurally at runtime in Three.js, built from scratch for this site. No
photographs and no video anywhere in the scene; the only images on the page
are the project screenshots and my portrait.

## Getting Started

### Local Development

Install dependencies and start the Vite dev server with Hot Module Replacement:

```bash
npm install
npm run dev
```

Then open the local URL shown in your terminal (usually [http://localhost:5173/](http://localhost:5173/)).

### Production Build & Preview

```bash
# Build optimized assets to dist/
npm run build

# Preview the production build locally
npm run preview
```

## Layout

```
index.html                    all markup and copy — the content lives here
css/scene.css                 the base 3D scene stylesheet
css/portfolio.css             portfolio overlay stylesheet, loaded after
js/scene.js                   the engine: textures, world, camera rig, cloth, post
assets/work/                  project screenshots and the portrait
secret-pathways-assets/
  fonts.css                   Onest and the Wordmark face, base64-inlined
  three.min.js                Three.js r149, local
  foreground/png/*.webp       five ground-cover layers for the near plane
```

Nothing is fetched from a CDN. Fully self-contained and static — any file host
will serve it.

`css/scene.css` provides the scene structure and foundations;
`css/portfolio.css` holds portfolio-specific overrides.

## The six chapters

| # | Section | Camera |
|---|---------|--------|
| 0 | Hero — headline, four metrics, portrait window | `CAM[0]` |
| 1 | `#about` — positioning, figures, experience table | `CAM[1]` |
| 2 | `#work` — four project plates | `CAM[2]` |
| 3 | `#skills` — six capability plates | `CAM[3]` |
| 4 | `#contact` — the ask, and the email | `CAM[4]` |
| 5 | Footer | `CAM[5]` |

Scroll position maps to a point on a Catmull-Rom spline through those six
waypoints. **`CAM` and the `names` array in `wireNav()` must stay the same
length as the number of `[data-cam]` sections** — adding or removing a section
without adding a waypoint will break the walk.

## How the page is put together

**Live card viewports.** Each project plate is a hole punched in the page: the
same scene rendered from its own camera into its own buffer, blitted into the
composite at the element's screen rect. The `defs` array in `buildCards()` holds
those cameras and `data-view="n"` picks one. There are five — four plates plus
the hero portrait window. The lookup is by index, so `defs` must stay the same
length as the set of `[data-view]` elements: a stale entry hands the wrong
camera to the wrong frame silently.

**The cloth.** On any device with a pointer, each plate's `background-image` is
lifted onto a cloth simulation and hung as fabric you can brush with the cursor.
It reads the URL straight off the computed style, so **swapping a project image
is a one-line CSS change** and the cloth picks it up automatically. Touch
devices skip the shader and keep the plain CSS background.

`clothPlate()` fits each screenshot *whole* and fills the rest of the frame with
the same image over-scaled and blurred. That matters because the frames are 4:5
and 16:10 while the screenshots are 1.4:1 and 2:1 — a cover crop cut 45% off the
width of the widest one.

**Load position.** `history.scrollRestoration` is set to `manual` in the first
task the script gets. The browser restores a reload's scroll around the load
event, which is long before the last build job finishes, so nothing written
during boot survives it — a reload halfway down the page came back with the
camera parked in the colophon and the hero never played.

**The foreground plane.** Each section owns a `.fg` stage of cut-outs. When a
chapter takes the viewport its stage is re-parented into `#fg-sky` and becomes a
fixed, bottom-anchored plane standing in front of both the layout and the nav;
the outgoing stage blurs away and returns home. Placement is keyed off
`[data-fg]`, not the section id, because the stage stops being a descendant of
its own section while it is live. The class names (`.fg-wall`, `.fg-lantern`)
are placement slots, not descriptions of what stands in them — a naming
convention carried over from an earlier layout pass, kept because renaming a
CSS hook is pure risk for zero benefit.

**The wordmark.** "DESIGN" in the hero is not text — it is six textured planes
in the 3-D scene, measured and scaled to the frame width in `layoutWord()` so it
always reaches the viewport edges. The string and its tracking are both in
`buildWordmark()`; tracking is derived from the letter count, because four
letters need to be spaced out to reach the edge and six do not.

## Debug and review flags

| Flag | Effect |
| --- | --- |
| `?shot=0`…`?shot=5` | Jump to a chapter with the intro finished and reveals open |
| `?driver=timer` | Drive the loop from `setTimeout` instead of `rAF` — the only way to get frames in a background tab |
| `?nogl=1` | Force the no-WebGL fallback |
| `?q=low` | Low-quality path (also the default on touch) |
| `?post=0` / `?shadow=0` | Disable bloom / shadows |
| `?dpr=1` / `?adapt=0` | Pin pixel ratio / lock the adaptive resolution governor |

`window.__scene` exposes the rig, world, camera, renderer and scroll anchors.
