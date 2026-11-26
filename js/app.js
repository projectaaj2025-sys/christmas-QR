/*
 * QR Tree — page logic.
 *
 * Flow (same as the original): a tree is already growing on arrival. Paste a
 * link and the code assembles underneath it; pick a tree and the camera tilts
 * up from the code to the tree; tap to look straight down again — a clean,
 * scannable QR in the tree's colours.
 *
 * URL state: ?link=&tree=  (snow=0, baubles=0, and embed=1 for the widget)
 */
(function () {
  var engine = window.QRTree;
  if (!engine) return;

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), canvas = $('tree'), hint = $('hint'), treesBox = $('trees');
  var urlInput = $('url'), shareBtn = $('share'), menu = $('menu'), toastEl = $('toast');
  var snowBox = $('snow'), baublesBox = $('baubles'), treeName = $('tree-name');
  var embedSheet = $('embed'), embedCode = $('embed-code'), embedPreview = $('embed-preview');
  var appEl = document.querySelector('.app'), panel = $('panel'), panelBody = $('panel-body');
  var panelToggle = $('panel-toggle'), panelOpen = $('panel-open');
  var ctx = canvas.getContext('2d');
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // the picker order from the original page: the eight originals, then the newer three
  var PICKER = ['classic', 'dots', 'blush', 'snow', 'blue', 'fairy', 'neon', 'lace', 'glitch', 'ribbon'];
  // Russian names for the picker (the engine keeps the original English metadata)
  var LABELS = {
    classic: ['Классика', 'зелёные ярусы, красные шары, золотая гирлянда и звезда'],
    dots: ['Серебро', 'серебряные точки-светодиоды и винные шары'],
    blush: ['Румянец', 'зелёная ёлка с розово-белой лентой и жемчужными шарами'],
    snow: ['Снежная', 'тёмная хвоя под толстым снегом, ледяные шары и холодные огни'],
    blue: ['Полночь', 'глубокий синий, лавандовый иней, синие и розовые огни'],
    fairy: ['Сказочная', 'тёмная ель с инеем на кончиках и тёплой золотой гирляндой'],
    neon: ['Неон', 'ярко-зелёные глифы и радужные огни'],
    lace: ['Кружево', 'тёмно-зелёные ярусы с белой кружевной кромкой'],
    glitch: ['Глитч', 'электрические синие тона, неоновые шары и блочные глифы'],
    ribbon: ['Розовая', 'розовая ёлка с яркой лентой и жемчужными шарами'],
  };
  function label(key) { return LABELS[key] || [engine.V[key] ? engine.V[key].short : key, '']; }
  var DEMO = 'https://xmasqr.vercel.app/?tree=classic'; // the tree that grows before you paste anything

  var params = new URLSearchParams(location.search);
  var isEmbed = params.get('embed') === '1';
  if (isEmbed) document.documentElement.classList.add('is-embed');

  var state = {
    link: (params.get('link') || params.get('u') || '').slice(0, 600),
    tree: params.get('tree') || params.get('t') || 'classic',
    snow: params.get('snow') !== '0',
    baubles: params.get('baubles') !== '0',
    cam: 0, camTarget: 0, grown: 0, drop: 0,
  };
  if (state.tree !== 'plain' && !engine.V[state.tree]) state.tree = 'classic';
  snowBox.checked = state.snow;
  baublesBox.checked = state.baubles;
  urlInput.value = state.link;

  var hasLink = function () { return urlInput.value.trim().length > 0; };
  var payload = function () { return urlInput.value.trim() || DEMO; };

  // ------------------------------------------------------------ canvas size
  var view = { w: 1, h: 1, dpr: 1, fs: 8, fill: 0.86 };
  function fit() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = stage.clientWidth || window.innerWidth;
    var h = stage.clientHeight || window.innerHeight;
    var fs = w < 520 ? 6 : w < 900 ? 7 : 8;
    if (w > 1600) fs = 9;
    if (w > 2300) fs = 10;
    view.w = w; view.h = h; view.dpr = dpr; view.fs = fs;
    // big screens can afford a wider code, phones need every pixel of module size
    view.fill = w < 520 ? 0.94 : w < 900 ? 0.9 : 0.86;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  fit();
  window.addEventListener('resize', function () { fit(); }, { passive: true });

  // ------------------------------------------------------------ tree picker
  function buildChips() {
    treesBox.innerHTML = '';
    PICKER.forEach(function (key) {
      var v = engine.V[key];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.tree = key;
      b.setAttribute('aria-pressed', 'false');
      var L = label(key);
      b.title = L[0] + (L[1] ? ' — ' + L[1] : '');
      b.innerHTML = '<span class="dot" style="--c:' + (v.leaf && v.leaf[1] || '#888') + '"></span>' +
        '<span class="chip-label">' + L[0] + '</span>';
      b.addEventListener('click', function () { pickTree(key); });
      treesBox.appendChild(b);
    });
  }
  function syncChips() {
    [].forEach.call(treesBox.children, function (b) {
      b.setAttribute('aria-pressed', b.dataset.tree === state.tree ? 'true' : 'false');
    });
    treeName.textContent = label(state.tree)[0];
  }

  // ---------------------------------------------------------------- camera
  function setHint() {
    if (!hasLink()) { hint.textContent = 'Вставьте ссылку, чтобы вырастить свою'; return; }
    hint.textContent = state.camTarget > 0.5 ? 'Нажмите на ёлку, чтобы увидеть QR-код' : 'Нажмите на код, чтобы вырастить ёлку';
  }
  function pickTree(key) {
    state.tree = key;
    state.camTarget = 1;
    if (reduced) { state.cam = 1; state.grown = 1; state.drop = 1; }
    syncChips(); setHint(); pushURL();
  }
  function enterLink() {
    var next = urlInput.value.trim();
    if (next === state.link) return;
    state.link = next;
    if (!next) { hint.textContent = 'Вставьте ссылку, чтобы вырастить свою'; pushURL(); return; }
    // a new link: the code re-assembles and the tree grows back out of it
    state.drop = reduced ? 1 : 0;
    state.grown = reduced ? 1 : 0;
    state.cam = reduced ? 1 : 0;
    state.camTarget = 1;
    setHint(); pushURL();
  }
  function flip() {
    state.camTarget = state.camTarget > 0.5 ? 0 : 1;
    setHint();
  }

  function shareURL() {
    var q = new URLSearchParams();
    if (state.link) q.set('link', state.link);
    if (state.tree !== 'classic') q.set('tree', state.tree);
    if (!snowBox.checked) q.set('snow', '0');
    if (!baublesBox.checked) q.set('baubles', '0');
    var qs = q.toString();
    return location.origin + location.pathname + (qs ? '?' + qs : '');
  }
  function pushURL() {
    if (isEmbed) return;
    var q = new URLSearchParams();
    if (state.link) q.set('link', state.link);
    if (state.tree !== 'classic') q.set('tree', state.tree);
    if (!snowBox.checked) q.set('snow', '0');
    if (!baublesBox.checked) q.set('baubles', '0');
    var qs = q.toString();
    try { history.replaceState(null, '', qs ? '?' + qs : location.pathname); } catch (e) { /* file:// */ }
  }

  // ------------------------------------------------------------------ draw
  var last = performance.now();
  function step(now) {
    var dt = Math.min(64, now - last); last = now;
    var t = now / 1000;

    var camSpeed = isEmbed ? dt / 1600 : dt / 1100;
    var dCam = state.camTarget - state.cam;
    state.cam += Math.sign(dCam) * Math.min(Math.abs(dCam), reduced ? 1 : camSpeed);

    var growTarget = state.camTarget > 0.5 ? 1 : state.cam;
    var dGrow = growTarget - state.grown;
    state.grown += Math.sign(dGrow) * Math.min(Math.abs(dGrow), reduced ? 1 : dt / 1500);

    var dropTarget = hasLink() ? 1 : 0;
    var dDrop = dropTarget - state.drop;
    state.drop += Math.sign(dDrop) * Math.min(Math.abs(dDrop), reduced ? 1 : dt / 1300);

    engine.draw(ctx, view.w, view.h, payload(), state.tree, {
      cam: state.cam,
      grow: Math.max(0.001, state.grown),
      drop: state.drop,
      time: reduced ? 0 : t,
      dpr: view.dpr,
      fs: view.fs,
      fill: view.fill,
      fall: state.snow && snowBox.checked,
      baubles: state.baubles && baublesBox.checked,
      plate: 'none',
      clean: true,
      ground: view.w >= 520,
      bloomScale: 0.9,
    });
    requestAnimationFrame(step);
  }

  // ------------------------------------------------------------------ toast
  var toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2400);
  }

  // ------------------------------------------------------------------ share
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); resolve(); } catch (err) { reject(err); }
      document.body.removeChild(ta);
    });
  }

  function downloadQR() {
    // render one clean flat frame big, then downscale so the glyph edges stay crisp
    var big = document.createElement('canvas');
    var W = 2000, OUT = 1000;
    big.width = big.height = W;
    var bctx = big.getContext('2d');
    engine.draw(bctx, W, W, payload(), state.tree, {
      cam: 0, grow: 1, drop: 1, time: 0, dpr: 1, fs: 13, fill: 0.7,
      fall: false, baubles: baublesBox.checked, plate: 'none', clean: true,
    });
    var out = document.createElement('canvas');
    out.width = out.height = OUT;
    var octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.fillStyle = '#0D0D0F';
    octx.fillRect(0, 0, OUT, OUT);
    octx.drawImage(big, 0, 0, OUT, OUT);
    var a = document.createElement('a');
    a.download = 'christmas-qr.png';
    a.href = out.toDataURL('image/png');
    a.click();
    toast('QR-код сохранён');
  }

  // ---------------------------------------------------------- animation
  // A short film of one tree: standing -> tilts down -> the QR code, held long
  // enough to scan -> eases back so the clip loops. Three formats:
  //   GIF  — drawn and quantised here, plays anywhere, any messenger;
  //   MP4  — H.264 through WebCodecs, the format Telegram/social want;
  //   WebM — what the browser's own MediaRecorder produces, the lightest.
  var REC = { active: false, start: 0, hold: 1.6, tilt: 1.9, tail: 3.0 };
  function recDuration() { return REC.hold + REC.tilt + REC.tail; }
  var FORMAT_KEY = 'xmasqr:anim-format';
  var FORMAT_NAMES = { gif: 'GIF', mp4: 'MP4', webm: 'WebM' };
  var format = 'gif';
  try { if (FORMAT_NAMES[localStorage.getItem(FORMAT_KEY)]) format = localStorage.getItem(FORMAT_KEY); } catch (e) { /* private mode */ }

  // the same camera curve for every format, so all three clips match
  function camAt(t) {
    var ease = engine.ease, tailBack = 0.9;
    if (t < REC.hold) return 1;
    if (t < REC.hold + REC.tilt) return 1 - ease((t - REC.hold) / REC.tilt);
    if (t < recDuration() - tailBack) return 0;
    return ease((t - (recDuration() - tailBack)) / tailBack);
  }
  function paintFrame(ctx, side, cam, t) {
    engine.draw(ctx, side, side, payload(), state.tree, {
      cam: cam, grow: 1, drop: 1, time: reduced ? 0 : t,
      dpr: 1, fs: side < 520 ? 6 : side < 760 ? 7 : 8, fill: 0.88,
      fall: snowBox.checked, baubles: baublesBox.checked,
      plate: 'none', clean: true,
    });
  }
  function saveBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function recordingUIBusy(busy) {
    REC.active = busy;
    document.body.classList.toggle('is-recording', busy);
    var btn = menu.querySelector('[data-action="record"]');
    if (btn) btn.disabled = busy;
  }

  // ---- GIF: frames -> palette -> LZW, no media APIs involved
  function recordGIF() {
    var enc = window.GIFEncoder, quant = window.quantize, pal = window.applyPalette;
    if (!enc || !quant || !pal) { toast('Не загрузился GIF-энкодер'); return; }
    var side = 480, fps = 10, total = recDuration();
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var gif = enc();
    var frame = 0, n = Math.round(total * fps);
    recordingUIBusy(true);
    toast('Собираю GIF — примерно ' + Math.round(total) + ' с');
    function next() {
      try { frameStep(); } catch (err) {
        recordingUIBusy(false);
        toast('GIF не собрался — попробуйте WebM');
      }
    }
    next();
    function frameStep() {
      if (frame > n) {
        gif.finish();
        saveBlob(new Blob([gif.bytes()], { type: 'image/gif' }), 'christmas-qr.gif');
        recordingUIBusy(false);
        toast('GIF сохранён');
        return;
      }
      var t = (frame / fps);
      paintFrame(ctx, side, camAt(t), 3.2 + t);
      var data = ctx.getImageData(0, 0, side, side).data;
      // 96 colours keeps the tree lively and the code readable; the dark page stays flat
      var palette = quant(data, 96, { format: 'rgb565' });
      gif.writeFrame(pal(data, palette, 'rgb565'), side, side, {
        palette: palette,
        delay: Math.round(1000 / fps),
        repeat: 0,
      });
      frame += 1;
      setTimeout(next, 0);
    }
  }

  // ---- MP4: H.264 via WebCodecs, muxed by mp4-muxer
  function recordMP4() {
    if (!window.VideoEncoder || !window.VideoFrame) { recordGIF(); toast('Нет WebCodecs — сохранил GIF'); return; }
    var Muxer = window.Mp4Muxer, Target = window.Mp4Target;
    if (!Muxer) { recordGIF(); toast('Нет MP4-упаковщика — сохранил GIF'); return; }
    var side = 720, fps = 25, total = recDuration(), n = Math.round(total * fps);
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    var ctx = canvas.getContext('2d');
    var muxer = new Muxer({
      target: new Target(),
      video: { codec: 'avc', width: side, height: side, frameRate: fps },
      fastStart: 'in-memory',
    });
    var encoder, finished = false;
    function done() {
      if (finished) return;
      finished = true;
      muxer.finalize();
      saveBlob(new Blob([muxer.target.buffer], { type: 'video/mp4' }), 'christmas-qr.mp4');
      recordingUIBusy(false);
      toast('MP4 сохранён');
    }
    try {
      encoder = new window.VideoEncoder({
        output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); },
        error: function () { toast('MP4 не получился — сохраняю GIF'); recordingUIBusy(false); recordGIF(); },
      });
      encoder.configure({ codec: 'avc1.4d0028', width: side, height: side, bitrate: 4000000, framerate: fps });
    } catch (err) { toast('Браузер не умеет MP4 — сохраняю GIF'); recordGIF(); return; }

    recordingUIBusy(true);
    toast('Кодирую MP4 — примерно ' + Math.round(total) + ' с');
    var f = 0;
    (function next() {
      if (f > n) { encoder.flush().then(done, done); return; }
      var t = f / fps;
      paintFrame(ctx, side, camAt(t), 3.2 + t);
      encoder.encode(new window.VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / fps) }));
      f += 1;
      // let the encoder breathe so its queue does not grow without bound
      setTimeout(next, 0);
    })();
  }

  // ---- WebM: the browser's own recorder
  function recordWebM() {
    if (typeof window.MediaRecorder !== 'function' || !HTMLCanvasElement.prototype.captureStream) {
      recordGIF(); toast('Нет MediaRecorder — сохранил GIF'); return;
    }
    var mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .filter(function (m) { return window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(m); })[0];
    if (!mime) { recordGIF(); toast('Нет WebM — сохранил GIF'); return; }
    var side = Math.min(960, Math.round(Math.min(window.innerWidth, window.innerHeight) * 1.2));
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    var ctx = canvas.getContext('2d');
    var chunks = [], mr;
    try { mr = new window.MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6000000 }); }
    catch (err) { recordGIF(); toast('Не удалось начать запись — сохранил GIF'); return; }
    mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = function () {
      saveBlob(new Blob(chunks, { type: mime.split(';')[0] }), 'christmas-qr.webm');
      recordingUIBusy(false);
      toast('WebM сохранён');
    };
    recordingUIBusy(true);
    toast('Записываю — ' + Math.round(recDuration()) + ' с');
    var start = performance.now();
    (function paint(now) {
      if (!REC.active) return;
      var t = (now - start) / 1000;
      paintFrame(ctx, side, camAt(t), 3.2 + t);
      requestAnimationFrame(paint);
    })(performance.now());
    mr.start(200);
    setTimeout(function () { if (mr.state !== 'inactive') mr.stop(); }, recDuration() * 1000 + 250);
  }

  function downloadAnimation() {
    if (REC.active) return;
    if (format === 'mp4') recordMP4();
    else if (format === 'webm') recordWebM();
    else recordGIF();
  }

  function embedSnippet() {
    var src = shareURL().replace('?', '?embed=1&');
    if (src.indexOf('?') < 0) src += '?embed=1';
    return '<iframe src="' + src + '" title="Christmas QR — ёлка из QR-кода" ' +
      'style="width:360px;height:480px;border:0;border-radius:16px;overflow:hidden" ' +
      'loading="lazy" allowtransparency="true"></iframe>';
  }

  function openEmbed() {
    embedCode.value = embedSnippet();
    embedPreview.href = shareURL().replace('?', '?embed=1&').replace('?$', '?embed=1');
    if (embedPreview.href.indexOf('embed=1') < 0) embedPreview.href += (embedPreview.href.indexOf('?') < 0 ? '?' : '&') + 'embed=1';
    embedSheet.hidden = false;
    embedCode.focus();
    embedCode.select();
  }
  function closeEmbed() { embedSheet.hidden = true; }

  function closeMenu() { menu.hidden = true; shareBtn.setAttribute('aria-expanded', 'false'); }
  shareBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var willOpen = menu.hidden;
    menu.hidden = !willOpen;
    shareBtn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) { var first = menu.querySelector('button'); if (first) first.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== shareBtn && !shareBtn.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeMenu();
    if (!embedSheet.hidden) closeEmbed();
    if (!licenceSheet.hidden) closeLicence();
  });
  menu.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var url = shareURL();
    var text = 'Этот QR-код вырастает в ёлку';
    closeMenu();
    if (action === 'copy') {
      copyText(url).then(function () { toast('Ссылка скопирована'); }, function () { toast('Не удалось скопировать'); });
    } else if (action === 'download') {
      downloadQR();
    } else if (action === 'record') {
      downloadAnimation();
    } else if (action === 'embed') {
      openEmbed();
    } else if (action === 'x') {
      window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text), '_blank', 'noopener');
    } else if (action === 'facebook') {
      window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank', 'noopener');
    } else if (action === 'whatsapp') {
      window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank', 'noopener');
    }
  });

  // share sheet first, clipboard as the fallback
  function sendTree() {
    var url = shareURL();
    var data = { title: 'Christmas QR', text: 'Этот QR-код вырастает в ёлку', url: url };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    copyText(url).then(function () { toast('Ссылка скопирована — отправьте её другу'); }, function () { toast(url); });
  }

  // ------------------------------------------------------- foldable panel
  // The panel can slide away so the tree gets the whole screen: the tab on its
  // edge, a chip in the corner, or the H key. The choice is remembered.
  var PANEL_KEY = 'xmasqr:panel';
  function setPanel(hidden, announce) {
    appEl.classList.toggle('panel-hidden', hidden);
    panelToggle.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    panelToggle.title = hidden ? 'Показать панель (клавиша H)' : 'Скрыть панель (клавиша H)';
    panelOpen.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    panelOpen.hidden = !hidden;
    panelBody.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    try { localStorage.setItem(PANEL_KEY, hidden ? '0' : '1'); } catch (e) { /* private mode */ }
    if (hidden) closeMenu();
    if (announce) toast(hidden ? 'Панель скрыта — клавиша H вернёт её' : 'Панель вернулась');
  }
  function togglePanel(announce) { setPanel(!appEl.classList.contains('panel-hidden'), announce); }
  var startHidden = false;
  try { startHidden = localStorage.getItem(PANEL_KEY) === '0'; } catch (e) { /* private mode */ }
  if (params.get('panel') === '0') startHidden = true;
  setPanel(startHidden, false);
  panelToggle.addEventListener('click', function () { togglePanel(true); });
  panelOpen.addEventListener('click', function () { setPanel(false, true); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'h' && e.key !== 'H' && e.key !== 'р' && e.key !== 'Р') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    e.preventDefault();
    togglePanel(true);
  });

  // ----------------------------------------------------------------- panel
  // "ссылка сразу с ёлкой": hand over the exact URL that opens as a standing tree
  $('tree-link').addEventListener('click', function () {
    var url = shareURL();
    copyText(url).then(function () { toast('Ссылка с ёлкой скопирована — откройте её у получателя'); },
      function () { toast(url); });
  });

  var licenceSheet = $('licence');
  function openLicence() { licenceSheet.hidden = false; licenceSheet.querySelector('.btn-ghost').focus(); }
  function closeLicence() { licenceSheet.hidden = true; }
  $('licence-open').addEventListener('click', openLicence);
  $('licence-close').addEventListener('click', closeLicence);
  licenceSheet.addEventListener('click', function (e) { if (e.target === licenceSheet) closeLicence(); });

  // format picker inside the share menu
  var fmtButtons = [].slice.call(document.querySelectorAll('.menu-formats .fmt'));
  function syncFormats() {
    fmtButtons.forEach(function (b) {
      var on = b.dataset.format === format;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var label = $('anim-label');
    if (label) label.textContent = FORMAT_NAMES[format] || 'GIF';
  }
  fmtButtons.forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      format = b.dataset.format;
      try { localStorage.setItem(FORMAT_KEY, format); } catch (err) { /* private mode */ }
      syncFormats();
      toast('Анимация сохранится как ' + FORMAT_NAMES[format]);
    });
  });
  syncFormats();

  $('embed-open').addEventListener('click', openEmbed);
  $('embed-copy').addEventListener('click', function () {
    copyText(embedCode.value).then(function () { toast('Код для вставки скопирован'); }, function () { toast('Не удалось скопировать'); });
  });
  $('embed-close').addEventListener('click', closeEmbed);
  embedSheet.addEventListener('click', function (e) { if (e.target === embedSheet) closeEmbed(); });

  stage.addEventListener('click', flip);
  urlInput.addEventListener('change', enterLink);
  urlInput.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    enterLink();
    urlInput.blur();
  });
  snowBox.addEventListener('change', function () { state.snow = snowBox.checked; pushURL(); });
  baublesBox.addEventListener('change', function () { state.baubles = baublesBox.checked; pushURL(); });

  buildChips();
  syncChips();

  // arrival: a shared link opens as a standing tree, everything else starts on the code
  if (state.link) {
    state.cam = state.camTarget = 1;
    state.grown = 1;
    state.drop = 1;
  }
  setHint();

  if (isEmbed) {
    // the widget owns its own clock and ignores the panel
    var start = performance.now();
    (function widget(now) {
      var t = (now - start) / 1000;
      var cam = reduced ? 0.5 : engine.cycle(t, 24).cam;
      engine.draw(ctx, view.w, view.h, payload(), state.tree, {
        cam: cam, grow: 1, drop: 1, time: reduced ? 0 : t, dpr: view.dpr, fs: view.fs,
        fill: view.fill, fall: state.snow, baubles: state.baubles, plate: 'none', clean: true,
      });
      requestAnimationFrame(widget);
    })(performance.now());
  } else {
    requestAnimationFrame(step);
  }

  if (!hasLink()) setTimeout(function () { if (!hasLink()) toast('Вставьте ссылку и выберите ёлку'); }, 1400);

  // a small surface for the checks in scripts/
  window.__qrTree = {
    state: state, pickTree: pickTree, enterLink: enterLink, flip: flip,
    shareURL: shareURL, embedSnippet: embedSnippet, sendTree: sendTree, picker: PICKER,
    setPanel: setPanel, togglePanel: togglePanel, isPanelHidden: function () { return appEl.classList.contains('panel-hidden'); },
    downloadAnimation: downloadAnimation, recordDuration: recDuration, camAt: camAt,
    downloadQR: downloadQR, setFormat: function (f) { format = f; try { localStorage.setItem(FORMAT_KEY, f); } catch (e) {} syncFormats(); },
  };
})();
