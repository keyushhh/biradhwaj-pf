# Biradhwaj Senapati — portfolio

A scroll-driven portfolio built on a live WebGL scene: six chapters walking up a
misty hillside at night. The camera moves as you scroll and drifts with the
pointer; every chapter hands its foreground to the next. The whole world —
concrete, granite, grass, rock, the mist, the moon — is generated procedurally
at runtime in Three.js. No photographs and no video anywhere in the scene; the
only images on the page are the project screenshots.

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
  generated/*.webp            unused — the plates carry real screenshots
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
are placement slots inherited from the reference, not descriptions of what now
stands in them.

**The wordmark.** "DESIGN" in the hero is not text — it is six textured planes
in the 3-D scene, measured and scaled to the frame width in `layoutWord()` so it
always reaches the viewport edges. The string and its tracking are both in
`buildWordmark()`; tracking is derived from the letter count, because four
letters need to be spaced out to reach the edge and six do not.

## What changed from the reference

The engine is the reference's and is what makes the page work: the camera walks
a Catmull-Rom spline through the world as you scroll, the rig carries a damped
pointer parallax, each chapter hands its foreground plane to the next, and the
project plates are live windows cut into the scene. None of that was touched.

What changed is what the walk goes *past*. The reference was a Kyoto temple
precinct, and a portfolio's background should not be a picture of a specific
place — the eye reads the place before it reads the page in front of it. So the
architecture and the seasonal dressing came out and the landscape stayed:

- **The worship hall → a stone terrace.** The two-storey Sanmon, its flaring
  tiled roofs, bracket bands, finials and name plaque are gone. Three courses of
  board-formed concrete step back as they rise, with a lit lip along the front
  edge. The lip matters: every exposure decision on the page is balanced against
  a warm source at that depth, so the light had to stay even though the thing it
  was coming out of did not.
- **The stairs are gone, and so is everything they climbed to.** There was a
  forty-riser flight, a seven-unit podium for it to reach, and a stone coping
  around the top of that. All three survived from the reference because the
  camera walk climbs them — but they existed to serve a building removed
  several passes earlier, and once the range behind them became real geometry
  they were the only thing left in frame asserting that this is a *site*
  rather than a landscape. A flight of stairs is a very strong figure: the eye
  follows it whether or not anything is at the top, and it kept turning the
  mountains into scenery behind an approach. The valley floor now runs unbroken
  from the near grass out to the foot of the range, where the height field
  flattens back into it and the junction is filled with haze.

  The warm light stayed, because every exposure decision on the page — the
  scrims, the text shadows, the bloom threshold — is balanced against a source
  at that depth, and removing the thing the light came out of is not the same
  as removing the light. It is a tight pool low in the mist now, plus the six
  lanterns re-sited from the stair cheeks on to the flat court, where they
  splay and shrink as they recede and give the eye a path to follow instead of
  a flight to climb.

- **The range is real geometry.** `buildRange()` — one displaced height field,
  opaque, depth-tested like anything else in the scene: 141k triangles, one
  draw call, built once.

  Four generations of it were painted billboards, and they can be made to read
  as mountains, but the trick has costs that show. Every layer needs an
  explicit `renderOrder`, because transparent depth-write-off planes stack in
  draw order and one wrong index paints the far ridge over the near one — that
  bug shipped twice. The parallax has to be faked, because a plate two hundred
  units out will not answer a pointer drift of under a unit. And nothing on
  them can catch the light, because there is no surface there to catch it: the
  moon hung behind the range and every crest in front of it stayed exactly as
  dark as it was drawn. All three problems are gone. The parallax is true
  perspective — 105 px of measured differential between a crest ninety units
  out and one at a hundred and ninety, over the walk — and the moon rims the
  crests because there is something there for it to rim.

  The height field keeps the two ideas the billboard passes arrived at,
  promoted from a line to a surface, and adds one more:

  1. **A ridged multifractal, not noise.** Plain fbm has no summits in it, only
     bulges. Each octave is folded at `1 − |noise|` so its zero crossings
     become creases, squared to sharpen the crease into a summit, and weighted
     by the octave above it so fine detail only lands where there is already
     mass to carry it. `x` is sampled at about half the frequency of `z`, which
     stretches the forms crosswise so they arrive as ridge *lines* across the
     view rather than isolated cones.
  2. **The angle of repose is what makes it rock.** Loose rock will not stand
     steeper than about a third, so real flanks are straight and real profiles
     are triangles, and the hollows between them are filled with what came off
     them. Four sweeps across the grid lift every sample to at least its
     neighbour minus one slope step. It only ever raises, so summits stay where
     the noise put them and the ground between them straightens. Without this
     pass the field is rounded lumps and reads as **cloud** — that was the
     single most-repeated failure across every version of this.
  3. **The repose slope has to scale with the amplitude**, and this is the most
     destructive thing to get wrong here. The sweeps fill outward until the
     slope runs out, so a summit of height A reaches `A / slope` before it
     stops. At `.25` against a range fifty-five units tall that is 220 units of
     fill — wider than the visible frame — so every summit's cone merged into
     its neighbours' and the range arrived as one smooth mound with a valley in
     it. Not a mountain: a dune. The slope wants to be about A over half the
     crest wavelength. Measured, far crests went from min 48 / max 71 (a
     plateau) at `.25` to min 25 / max 66 at `1.15`.

  Two more things were needed to make it sit in the frame:

  - **The vertex colours are authored as display values and converted.** A
     vertex colour is consumed as *linear* light, so writing `.15` asks for a
     mid-grey near `.43` on screen. The first pass did exactly that and the
     range came back as a pale flat wall across the middle of the frame — four
     times too light, which flattened every tonal step in the shading model at
     once. Shading is baked per vertex rather than lit at runtime, which is
     free (nothing here moves, no light near it changes) and also means the
     range cannot be blown out by the six warm point lights down on the court.
  - **Aerial perspective is a mix toward pale haze, not scene fog.** `FogExp2`
     at `0.0168` is effectively total by a hundred units and its colour is
     almost black, so it would take the range out rather than push it back.
     Distance lifts shadows; it does not darken them. The first haze curve
     saturated at 96% by two hundred units — the range *lives* between ninety
     and two hundred, so the whole thing arrived as one flat wash with a 24%
     luminance spread. The curve has to do its work inside that window.

- **The ground is one plane, and it is deliberately enormous.** The floor is
  600 x 600 rather than the reference's 150 x 150, and this is not padding — it
  is the fix for the longest-running visual bug in this scene. The range is a
  height field sunk below `y = 0` for its first fifty units so it cannot
  z-fight the floor, and it only climbs back above zero sixty to a hundred
  units out. The floor used to stop at `z = -93`. Between the two there was a
  strip of ground that **nothing covered** — measured at the hero waypoint,
  screen rows 0.60 to 0.66 hit no geometry at all — so the sky showed through
  the floor.

  A straight-edged band of pale sky lying between dark ground and dark
  mountains is, to the eye, a lit dock seen end-on; the lanterns standing along
  it finished the illusion. It survived three separate attempts to remove it,
  because every attempt went after the *lights* — which were innocent. The
  give-away, once measured, was unambiguous: the band's upper edge was
  perfectly horizontal across the entire frame, to the pixel. Terrain never
  does that. A plane's edge always does.

  The plane now extends 300 units past the range's footprint in every
  direction, so the junction is the terrain's own `y = 0` contour, following
  the hills. Verified the way it should have been the first time: of the 1525
  camera rays (six waypoints x five aspect ratios) that overshoot the plane
  near the horizon, every one is intercepted by the terrain's *minimum* height
  before it could reach sky. The band is not fixed at one camera — it is
  geometrically unreachable.

- **The moon hangs in a pass.** The range has to be tall, because the last two
  chapters look straight up the valley and a low range arrives there as a line
  on the horizon — but a tall range crowds the moon, which was the complaint
  about the version before this one. So it is tall everywhere except along the
  moon's own bearing, where the amplitude is notched back and the crest drops
  into a saddle. Not a dodge: it is what a landscape photographer does, which
  is put the light in the gap. The notch is angular rather than a fixed `x`, so
  it tracks the moon's azimuth at every depth instead of shearing across the
  field.

- **The gate is gone.** It was rebuilt once as a plain rectangular frame, which
  was still wrong — two uprights and a lintel at the foot of a stone flight is
  the torii silhouette however plainly you draw it.
- **The blood moon → a pale one.** The red came entirely from a colour
  multiplier on a neutral texture, so the disc only needed re-tinting; its two
  red lights are now cool. It sits at `z = −166`, inside the range rather than
  in front of it, and it is depth-tested — while the range was four transparent
  plates the disc had to ignore depth and be sorted by hand between them, and
  that hand-sorting was wrong twice, because a `renderOrder` putting the disc
  behind one ridge necessarily puts it behind every ridge drawn at the same or
  a later order whatever their actual distance.
- **There is no warm light in the scene at all, and no lamp posts.** This took
  five passes to get right, and every pass but the last was aimed at the wrong
  thing.

  The complaint each time was a "dock": a flat, pale, lit surface running across
  the valley with lights along it. I removed a glow plane, then a mist band,
  then the floor's far edge — symptoms, all of them — and it kept coming back,
  because the dock was never one object. It was an *assembly*: a flat ground
  plane in mid-grey wet-flagstone (`0x69757a`, roughness .74, a trace of
  metalness) plus eight lit lamp posts standing on it in a receding double row
  plus three warm point lights down at ground level pooling on it. Each part is
  defensible on its own. Together they are a promenade, and no amount of
  re-tinting a promenade turns it into a landscape.

  So: the eight posts are gone, the three warm ground lights are gone, and the
  ground is `0x1b2226` at roughness .96 with zero metalness — near-black and
  fully diffuse, returning almost nothing. The moon is the only light source
  left; the six remaining lights are all cool. Verified by inventory rather
  than by eye, because the artefact was global geometry and therefore appeared
  in every chapter at once: zero warm lights in the scene, and the only
  warm-emitting mesh left anywhere is the drifting leaf fall.

  The general lesson, since it cost five attempts: **a flat plane with lights
  on it reads as built, whatever it is textured with.** Fix the assembly, not
  the tint.
- **The near bough** was tinted six parts red to one part green — the most
  saturated object on the page, four metres off the lens. It is green now.
- **The leaf fall** was an emissive red at 260 instances, which read as embers.
  Muted amber, 170.
- **Foreground cut-outs** are ground cover only: grass, planting, rock, pine,
  hill. The tiled gatehouse wall, the stone lantern, the shrine ruins, the
  sakura branch and the maple spray are deleted from the repo.
- **The mark** was a torii; it is a frame around a vermilion disc.
- Japanese text labels were dropped throughout. The scene can be what it is;
  Japanese subtitles on someone's own projects would be costume.

The class names in the near plane (`.fg-wall`, `.fg-sakura`) are inherited
placement slots, not descriptions — `.fg-wall` means "wide, hard against an
edge" and holds planting; `.fg-sakura` means "sweeping in from a lower corner"
and holds grass.

### One thing that was tried and reverted

The background was briefly replaced wholesale with ThreeUI's
`SylvaLivingWorldScene` — a procedural moss-root world, no cultural reading at
all. It was abandoned because it is a *fixed hero composition*: one camera at
one distance, geometry laid out against a 1600×880 reference frame. It has
pointer parallax and its own scan-light entrance, but nothing that survives a
camera walking through it, so adopting it meant losing the scroll-driven
transitions that are the best thing about this page. Kept here as a note so the
option is not re-litigated: the two are not interchangeable.

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

## Behaviour worth knowing before editing

- **Resolution adapts.** The scene is fill-bound, so the renderer trims its own
  pixel ratio when frame times slip. Pass `?adapt=0` while profiling — in a
  throttled background tab the governor will otherwise collapse to its floor.
- **The scene pauses when the tab is hidden**, and `rAF` does not fire there at
  all, so screenshots of a background tab come back black. That is the pause
  working, not a bug.
- **Reduced motion is honoured** throughout.
- **If WebGL fails**, the page degrades to a static document — and the project
  screenshots survive that path, because a portfolio without its work is not a
  degraded portfolio but an empty one.
- `overflow-x: clip` on sections is deliberate: the cut-outs and cloth canvases
  hang past the frame on purpose.

## Where to edit what

Copy is all in `index.html`. The things that are *not* markup:

| To change | Edit |
| --- | --- |
| The hero wordmark | `buildWordmark()` in `js/scene.js` |
| A chapter's camera | `CAM` in `js/scene.js` |
| The progress rail tooltips | `names` in `wireNav()` |
| A card's live view | `defs` in `buildCards()` |
| A project screenshot | the `.card:nth-child(n) .card-fr` rule in `css/portfolio.css` |

## Known follow-ups

- **`assets/work/gridpe.png` is 808×556 and `design-system.png` is 718×588** —
  both come off the Framer CDN as 8-bit palettised PNGs. They hold up at the
  sizes used, but higher-resolution exports would sharpen the two plates that
  carry them, the lead plate especially.
- `secret-pathways-assets/` is an assets directory; it is referenced from `index.html` and from `css/scene.css`.
- `secret-pathways-assets/generated/*.webp` are reference stills and are no longer used by anything — safe to delete.
- **A downloaded terrain could drive the range instead of the noise.** Two
  Sketchfab models were suggested for this — `snowy-terrain` by Kubocarte and an
  Iceland landscape scan. Neither was used, for three reasons: the download
  needs a Sketchfab account, `snowy-terrain` is CC-BY so using it puts an
  attribution line on the page, and both are baked-lit *daylight* assets, which
  in a night scene graded through a bloom chain against `#05070a` produce a
  correct-looking object that is visibly pasted on to a picture lit by different
  rules. But `snowy-terrain` also ships a **displacement map intended for flat
  planes**, and that is exactly the input `buildRange()` already builds for
  itself. Swapping the procedural field for a loaded heightmap is a contained
  change — read the PNG into a canvas, sample it in place of the ridged
  multifractal, and keep the repose sweeps, the baked shading and the haze
  exactly as they are. No mesh loader, no FBX, no megabytes of baked albedo.
- **The trees are still `buildMaple`.** Their canopy is de-reddened to a muted
  brown and nothing about the silhouette is specifically Japanese, but the
  builder is a maple and the leaf texture is palmate. If they still read wrong,
  the honest fix is a different canopy generator rather than another re-tint —
  `buildMaple(seed, x, z, scale)` in `js/scene.js` is self-contained and its five
  call sites are all in one `JOBS` entry.
- **`buildLantern()` is now dead code.** All eight call sites are gone (see the
  note on warm light above); the function itself is left in place because it is
  self-contained and harmless, but nothing references it. Delete it if the file
  needs slimming.
