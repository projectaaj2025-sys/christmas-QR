# christmas qr

Turn any link into a Christmas tree that **is** a scannable QR code.

A rebuild of the [xmasqr](https://xmasqr.vercel.app/?tree=classic) tree site, written from
scratch in React + Canvas, with two extras on top of the original:

- **Send a tree** — share your own tree, invite a friend to grow one for you, or plant a tree
  somebody sent by pasting a link or photographing its code.
- **Embed anywhere** — an iframe snippet, a one-file `<script>` widget, or a direct link, so the
  tree can live inside any site.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ + dist/embed.js
npm run verify   # scan + embed + receive checks, no browser needed
```

![four tree styles](public/preview.png)

## How the tree works

Every dark module of the QR code becomes one **character** of the canopy — `#`, `%`, `@`, `*`,
`o`, hearts and flowers, the way the original draws it. Each character is mapped onto a scalloped
spruce cone: its row picks the height, its column picks the side, so the code's own pattern decides
where the tree looks dense or thin. A warm bloom sits behind the crown and gold flecks catch the
light near the top.

Tap the tree and every character leaves its branch, drifts, and lands exactly on its module, where
it turns into a solid tile. Tap again and the tree grows back — both directions are reversible
mid-flight.

Four details make it actually scan:

- **Integer-aligned modules.** The flat code is laid out at a whole-pixel cell size and every
  landed module is snapped to the pixel grid. Fractional module edges are the usual reason a
  pretty QR code fails on a phone.
- **Two inks per glyph.** The colour a character shows on the branch is separate from the colour
  it uses once flat, so light palettes (Silver, Lace) never paint white modules onto white snow.
- **A plaza that floods with light.** The flat code starts out as coloured modules on a dark
  plaza — as in the original — then the plaza fades to snow and the modules invert past the
  halfway point of the morph, keeping the code darker than its background either way.
- **Error correction `M`** (dropping to `L` past ~180 characters) with a full quiet zone, so a
  thumb over one corner or a glyph still in the air does not break the read.

`npm run verify` renders the flat frame for all ten palettes and several payloads, decodes each
with jsQR, round-trips the whole "receive a tree" flow through the scanner, and checks the widget
bundle.

## Sharing

| Flow | What happens |
| --- | --- |
| **Share my tree** | Builds `?t=<style>&u=<payload>&m=<greeting>`. Sends through the native share sheet, Telegram/WhatsApp, or the clipboard. Exports a card PNG, a plain code PNG or an SVG. |
| **Invite a friend** | Sends a bare tree link. Your friend opens it, enters their own link, and sends the resulting tree back. |
| **Receive a tree** | Paste a link, or upload a screenshot/photo of a QR code — jsQR reads it in the browser, no upload to a server. Received trees are kept in a local inbox (`localStorage`) and can be re-opened later, with the chime and confetti on first reveal. |

## Embedding

**iframe** — `?embed=1` renders a chromeless tree that is itself tappable:

```html
<div style="max-width:720px;margin:0 auto">
  <iframe
    src="https://your-site/?t=classic&u=https%3A%2F%2Fexample.com&embed=1"
    style="width:100%;height:640px;border:0;border-radius:18px"
    loading="lazy"
  ></iframe>
</div>
```

**script widget** — one self-contained file, no framework needed on the host page:

```html
<div id="xmas-tree"></div>
<script src="https://your-site/embed.js?t=aurora&u=https%3A%2F%2Fexample.com" async></script>
```

Query parameters: `t` (tree style), `u` (payload the code encodes), `m` (greeting), `embed=1`
(chromeless), `view=code` (start flat), `mount` (placeholder id for the script widget), `h`
(widget height).

If `u` is omitted, the code points back at the tree itself.

## URL parameters

| Param | Meaning |
| --- | --- |
| `u` / `url` | payload behind the QR code |
| `m` / `msg` | greeting shown on the card |
| `t` / `tree` | `classic`, `silver`, `blush`, `snowy`, `midnight`, `fairy`, `neon`, `lace`, `glitch`, `pink` |
| `snow` | `0` turns the snowfall off |
| `baubles` | `0` hides the ornaments |
| `embed` | `1` hides the site chrome (for iframes) |
| `view` | `code` starts on the flat code instead of the tree |

## Project layout

```
src/
  lib/qr.ts         QR encoding (UTF-8 payloads, EC level, SVG export)
  lib/scene.ts      the canvas renderer: sky, glyph canopy, morph, flat code
  lib/looks.ts      the ten palettes (canopy, baubles and flat-code inks)
  lib/urlState.ts   share-link parsing and building
  lib/export.ts     card PNG / code PNG / SVG / embed snippets
  lib/celebrate.ts  chime + confetti, no dependencies
  lib/store.ts      local inbox
  components/       Stage (canvas + tap), ShareDialog, EmbedDialog
  embed.ts          the drop-in widget, built to dist/embed.js
scripts/
  verify-scan.mjs   headless render + jsQR decode
  build-embed.mjs   bundles the widget as a single IIFE
```

Everything runs in the browser: no accounts, no analytics, no server calls. Trees are drawn on
the fly, and the local inbox never leaves the device.
