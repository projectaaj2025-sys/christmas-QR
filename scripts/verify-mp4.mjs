// MP4 path without a browser: drive mp4-muxer with stand-in H.264 chunks and
// check the file it produces is a real MP4 (ftyp + mdat), and that the code
// config in app.js is one browsers actually accept.
import { readFileSync } from 'node:fs';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

let fail = 0;
const check = (ok, label, extra = '') => { if (!ok) fail += 1; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); };

const source = readFileSync('js/app.js', 'utf8');
const cfg = /encoder.configure\(\{ codec: '([^']+)', width: side, height: side, bitrate: (\d+), framerate: fps \}\)/.exec(source);
check(!!cfg, 'MP4-кодек и параметры найдены в app.js', cfg ? cfg[1] : '');
check(cfg && /^avc1\.[0-9a-f]{6}$/.test(cfg[1]), 'кодек в форме avc1.xxxxxx', cfg ? cfg[1] : '');
check(cfg && Number(cfg[2]) >= 1000000, 'битрейт достаточный', cfg ? Number(cfg[2]) + ' бит/с' : '');
check(/new Muxer\(\{[\s\S]*?codec: 'avc'/.test(source), 'муксер настроен на H.264');
check(/fastStart: 'in-memory'/.test(source), 'fastStart включён — файл играется сразу');

// Node has no WebCodecs, so give the muxer a stand-in chunk class to talk to
class EncodedVideoChunk {
  constructor(init) { Object.assign(this, init); this.byteLength = init.data.byteLength; }
  copyTo(dst) { new Uint8Array(dst.buffer ?? dst).set(this.data.subarray(0, dst.byteLength ?? this.data.byteLength)); }
}
globalThis.EncodedVideoChunk = EncodedVideoChunk;

// the muxer itself, with fake frames, must produce a valid MP4 container
const side = 720, fps = 25, n = 60;
const target = new ArrayBufferTarget();
const muxer = new Muxer({ target, video: { codec: 'avc', width: side, height: side, frameRate: fps }, fastStart: 'in-memory' });
const chunk = new Uint8Array(2048).fill(7);
for (let i = 0; i < n; i++) {
  muxer.addVideoChunk(new EncodedVideoChunk({
    type: i === 0 ? 'key' : 'delta',
    timestamp: Math.round((i * 1e6) / fps),
    duration: Math.round(1e6 / fps),
    data: chunk,
  }), i === 0 ? { decoderConfig: { codec: 'avc1.4d0028', codedWidth: side, codedHeight: side, description: new Uint8Array([1, 2, 3]) } } : undefined);
}
muxer.finalize();
const bytes = new Uint8Array(target.buffer);
const head = Buffer.from(bytes.slice(4, 12)).toString('latin1');
check(head.startsWith('ftyp'), 'файл начинается с ftyp', head);
check(Buffer.from(bytes).includes(Buffer.from('moov')) && Buffer.from(bytes).includes(Buffer.from('mdat')), 'в контейнере есть moov и mdat');
check(bytes.length > n * 1024, 'данные кадров попали в файл', `${(bytes.length / 1024).toFixed(0)} КБ`);

console.log(fail ? `\n${fail} check(s) failed` : '\nMP4 OK');
process.exit(fail ? 1 : 0);
