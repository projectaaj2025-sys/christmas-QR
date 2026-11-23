import qrcode from 'qrcode-generator';

export type Ecc = 'L' | 'M' | 'Q' | 'H';

// qrcode-generator ships a latin-1 converter by default; Cyrillic and emoji in a
// payload need real UTF-8 bytes, otherwise the scanned link comes out mangled.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

/**
 * Level M keeps a thumb or a stray ornament from breaking a normal link, but
 * long payloads would need a huge matrix — drop to L past a couple of hundred
 * characters so the tree keeps enough modules to look like a tree.
 */
export const eccFor = (text: string): Ecc => (text.length > 180 ? 'L' : 'M');

/** Encode `text` and return the module matrix as `grid[row][col] === isDark`. */
export function encodeQR(text: string, ecc: Ecc = 'M'): boolean[][] {
  const qr = qrcode(0, ecc);
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const grid: boolean[][] = [];
  for (let row = 0; row < count; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < count; col += 1) line.push(qr.isDark(row, col));
    grid.push(line);
  }
  return grid;
}

/** Standalone SVG markup for a single-colour code — handy for designers. */
export function qrSvg(text: string, ecc: Ecc = 'M', dark = '#0a1622', light = '#f6f9fc'): string {
  const qr = qrcode(0, ecc);
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true })
    .replace(/black/g, dark)
    .replace(/white/g, light);
}
