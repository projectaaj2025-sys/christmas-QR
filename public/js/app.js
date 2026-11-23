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
  var ctx = canvas.getContext('2d');
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // the picker order from the original page: the eight originals, then the newer three
  var PICKER = ['classic', 'dots', 'blush', 'snow', 'blue', 'fairy', 'neon', 'lace', 'glitch', 'ribbon'];
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
      b.title = v.name + ' — ' + (v.blurb || '');
      b.innerHTML = '<span class="dot" style="--c:' + (v.leaf && v.leaf[1] || '#888') + '"></span>' +
        '<span class="chip-label">' + v.short + '</span>';
      b.addEventListener('click', function () { pickTree(key); });
      treesBox.appendChild(b);
    });
  }
  function syncChips() {
    [].forEach.call(treesBox.children, function (b) {
      b.setAttribute('aria-pressed', b.dataset.tree === state.tree ? 'true' : 'false');
    });
    var v = engine.V[state.tree];
    if (v) treeName.textContent = v.short;
  }

  // ---------------------------------------------------------------- camera
  function setHint() {
    if (!hasLink()) { hint.textContent = 'Paste a link to grow your own'; return; }
    hint.textContent = state.camTarget > 0.5 ? 'Tap the tree to see QR code' : 'Tap the code to grow the tree';
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
    if (!next) { hint.textContent = 'Paste a link to grow your own'; pushURL(); return; }
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
    toast('QR saved');
  }

  function embedSnippet() {
    var src = shareURL().replace('?', '?embed=1&');
    if (src.indexOf('?') < 0) src += '?embed=1';
    return '<iframe src="' + src + '" title="Christmas QR" ' +
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
  });
  menu.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var url = shareURL();
    var text = 'This QR code grows into a Christmas tree';
    closeMenu();
    if (action === 'copy') {
      copyText(url).then(function () { toast('Link copied'); }, function () { toast('Copy failed'); });
    } else if (action === 'download') {
      downloadQR();
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
    var data = { title: 'Christmas QR', text: 'This QR code grows into a Christmas tree', url: url };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    copyText(url).then(function () { toast('Link copied — send it to a friend'); }, function () { toast(url); });
  }

  // ----------------------------------------------------------------- panel
  $('embed-open').addEventListener('click', openEmbed);
  $('embed-copy').addEventListener('click', function () {
    copyText(embedCode.value).then(function () { toast('Embed code copied'); }, function () { toast('Copy failed'); });
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

  if (!hasLink()) setTimeout(function () { if (!hasLink()) toast('Paste a link, pick a tree'); }, 1400);

  // a small surface for the checks in scripts/
  window.__qrTree = {
    state: state, pickTree: pickTree, enterLink: enterLink, flip: flip,
    shareURL: shareURL, embedSnippet: embedSnippet, sendTree: sendTree, picker: PICKER,
  };
})();
