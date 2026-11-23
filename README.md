# christmas qr

A link turns into a Christmas tree that **is** a scannable QR code — and back again with a tap.

This is a faithful rebuild of [xmasqr.vercel.app](https://xmasqr.vercel.app/?tree=classic):
the same 3D ASCII point-cloud engine, the same page structure, the same ten trees. On top of the
original it adds **share** and **embed**, so you can send your tree to someone and put it on a site.

```
public/
  index.html        the page: brand, hint, panel with the URL row, ten trees, snow / baubles
  embed.html        the same tree as a standalone widget for <iframe>
  styles.css        the original's tokens, panel, picker, switches, credits, toast
  js/tree-engine.js the engine: QR encoder, 62k-point canopy, z-buffered glyph grid, camera
  js/app.js         page logic: assemble → pick a tree → tilt up → tap to look down
scripts/
  verify-scan.mjs   renders the flat frame and decodes it with jsQR (every tree, phone + desktop)
  verify-receive.mjs  jsdom: a shared link opens as a standing tree, share URL round-trips
  verify-embed.mjs  jsdom: the widget cycles the camera on its own
```

No framework, no bundler step — the page is the same plain ES5 the original ships.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static copy in dist/
npm run verify   # scan + receive + embed checks, no browser needed
```

## How the tree works

The engine builds one point per glyph. Every dark QR module is sampled for needle points inside a
scalloped spruce cone: the module's position picks the tier radius, a jittered radius window keeps
the surface loose, and each point carries a type — needle, bauble body, bauble cap, light, garland,
snow cap, lace edge, trunk, ground. Each frame all points are rotated by the camera spin, tilted by
the camera angle, perspective-divided and dropped into a **z-buffer of glyph cells**. One character
per cell wins, the nearest — that is the whole 3D look: `#`, `%`, `*`, `+`, `=`, `o`, `O`, `♥`, `●`.

- **camera** 0 → 1: straight down on the code, then tilted 80° to a side-on tree with a slow spin,
  a ±10° sway and a shallow perspective.
- **grow** 0 → 1: the canopy grows up out of the ground, point by point.
- **drop** 0 → 1: the code reassembles from the centre out, finder squares landing as single blocks.
- **star, baubles, snow, bloom**: a five-spike ASCII star above the crown, 44 spheres (or an even
  scatter for the ribbon tree) with specular and rim shading, drifting flakes, and a blurred copy of
  the frame composited with `lighter` for glow.

## Why it still scans

- Looking down, `cam` is exactly 0, so every module is drawn as a **pixel-aligned square** in a
  projected quad — no gaps, no fractional edges, no glyph strokes.
- The flat state renders with `clean: true`, which drops the canopy glyphs, the star, snow and the
  background field, leaving a clean code in the tree's colours.
- The code is framed with `fill` chosen so even a 33-module payload keeps ≈5 px per module on a
  390 px phone screen.
- `scripts/verify-scan.mjs` decodes 96 frames — all ten trees × four payloads (up to 173 bytes,
  Cyrillic + emoji) × desktop and phone — both at native size and downscaled to a 640 px capture.

## Sharing a tree

State lives in the URL: `?link=<your link>&tree=<palette>`, plus `snow=0` / `baubles=0`.
Open such a link and the tree is already standing, in the sender's palette.

- **Send a tree** — the native share sheet where it exists, a copied link everywhere else.
- The share button in the panel offers copy, **Download QR** (a 1000 px PNG, rendered at 2000 px
  and downscaled so edges stay crisp), X, Facebook and WhatsApp.

## Embedding

The share menu's **Embed on a site** gives you:

```html
<iframe src="https://your.site/?embed=1&link=…&tree=classic" title="Christmas QR"
        style="width:360px;height:480px;border:0;border-radius:16px;overflow:hidden"
        loading="lazy"></iframe>
```

The widget hides the page furniture, cycles code → tilt → tree → back on a 24 s loop, and takes
`tree`, `snow` and `baubles` from the URL too. `embed.html` answers with
`Content-Security-Policy: frame-ancestors *` so it can live in any page.

## Trees

`classic`, `silver` (`dots`), `blush`, `snowy` (`snow`), `midnight` (`blue`), `fairy`, `neon`,
`lace`, `glitch`, `pink` (`ribbon`) — the palette ids stay the engine's (`snow`, `dots`, `ribbon`…),
the picker shows the original's names and order.
