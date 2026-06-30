/* Hero contour lines — iso-contours generated from the hero text.
   Renders the hero text to an offscreen mask, builds a Euclidean distance
   field (Felzenszwalb exact transform), then strokes marching-squares
   iso-lines at increasing distances. The lines hug the letterforms and
   re-wrap whenever the text reflows. Drawn once per layout; static at rest. */
(function () {
  var hero = document.querySelector('.hero');
  var canvas = document.querySelector('.hero-contours-canvas');
  if (!hero || !canvas) return;
  var ctx = canvas.getContext('2d');

  // ---- Tunables (mirrors the Figma "Outlines" plugin) -----------------
  var COUNT     = 51;    // max number of contour rings
  var THRESHOLD = 0.35;  // luma threshold for the text mask
  var SPACING   = 88;    // px between rings
  var OFFSET    = 20;    // px from the text to the first ring
  var PHASE     = 0.344; // fraction of a spacing to shift the rings
  var LINE_W    = 1.5;   // stroke width, css px (Figma thickness 3 @2x)
  var SOFTNESS  = 0.7;   // blur radius, css px
  var ALPHA     = 0.62;  // line opacity
  var Q         = 0.45;  // working resolution (lower = smoother)
  var SMOOTH_PX = 26;    // distance-field blur, css px (straightens far rings)
  var INF       = 1e9;

  function cssVar(name, fallback) {
    var c = getComputedStyle(hero).getPropertyValue(name).trim();
    return c || fallback;
  }

  // Collect every visual line of hero text with position + font, by walking
  // the text nodes and reading per-line rects via Range.
  function collectLines() {
    var o = hero.getBoundingClientRect();
    var content = hero.querySelector('.container') || hero;
    var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    var range = document.createRange();
    var lines = [];
    var node;
    while ((node = walker.nextNode())) {
      var txt = node.nodeValue;
      if (!txt || !txt.trim()) continue;
      var el = node.parentElement;
      var cs = getComputedStyle(el);
      var fontSize = parseFloat(cs.fontSize) || 16;
      var fontDecl = cs.fontStyle + ' ' + cs.fontWeight + ' ' + fontSize + 'px ' + cs.fontFamily;
      var ls = (cs.letterSpacing && cs.letterSpacing !== 'normal') ? cs.letterSpacing : '0px';
      var n = txt.length, i = 0;
      while (i < n) {
        range.setStart(node, i); range.setEnd(node, Math.min(i + 1, n));
        var top0 = range.getBoundingClientRect().top;
        var j = i + 1;
        while (j < n) {
          range.setStart(node, j); range.setEnd(node, j + 1);
          var r = range.getBoundingClientRect();
          if (r.height && Math.abs(r.top - top0) > 1) break;
          j++;
        }
        range.setStart(node, i); range.setEnd(node, j);
        var lr = range.getBoundingClientRect();
        var s = txt.slice(i, j);
        if (s.trim()) {
          lines.push({
            text: s,
            x: lr.left - o.left,
            top: lr.top - o.top,    // real glyph-ink box top
            width: lr.width,        // real rendered ink width
            height: lr.height,      // real rendered ink height
            fontSize: fontSize,
            font: fontDecl,
            ls: ls
          });
        }
        i = j;
      }
    }
    return lines;
  }

  // Felzenszwalb 1D squared-distance transform.
  function dt1d(f, n) {
    var d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    var k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (var q = 1; q < n; q++) {
      var s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
    return d;
  }

  // Exact separable box blur (edge windows shrink), one pass.
  function boxBlur(src, w, h, r) {
    if (r < 1) return src;
    var tmp = new Float64Array(w * h), out = new Float64Array(w * h);
    var x, y, lo, hi, sum, pre = new Float64Array(Math.max(w, h) + 1);
    for (y = 0; y < h; y++) {
      var base = y * w;
      for (x = 0; x < w; x++) pre[x + 1] = pre[x] + src[base + x];
      for (x = 0; x < w; x++) {
        lo = x - r < 0 ? 0 : x - r; hi = x + r > w - 1 ? w - 1 : x + r;
        tmp[base + x] = (pre[hi + 1] - pre[lo]) / (hi - lo + 1);
      }
    }
    for (x = 0; x < w; x++) {
      for (y = 0; y < h; y++) pre[y + 1] = pre[y] + tmp[y * w + x];
      for (y = 0; y < h; y++) {
        lo = y - r < 0 ? 0 : y - r; hi = y + r > h - 1 ? h - 1 : y + r;
        out[y * w + x] = (pre[hi + 1] - pre[lo]) / (hi - lo + 1);
      }
    }
    return out;
  }

  function render() {
    var W = hero.clientWidth, H = hero.clientHeight;
    if (!W || !H) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    var lines = collectLines();

    // ---- Render text into a low-res mask -------------------------------
    var gw = Math.max(1, Math.round(W * Q));
    var gh = Math.max(1, Math.round(H * Q));
    var mask = document.createElement('canvas');
    mask.width = gw; mask.height = gh;
    var mctx = mask.getContext('2d');
    mctx.scale(Q, Q);
    mctx.fillStyle = '#fff';
    // Render each line to a scratch canvas, find its actual ink box, then blit
    // it stretched to the real DOM rect. Metric-independent, so variable fonts
    // (Literata opsz/weight) can't shift the mask off the real glyphs.
    var tmp = document.createElement('canvas');
    var tctx = tmp.getContext('2d');
    for (var li = 0; li < lines.length; li++) {
      var ln = lines[li];
      tctx.font = ln.font;
      try { tctx.letterSpacing = ln.ls; } catch (e) {}
      var mw = Math.ceil(tctx.measureText(ln.text).width) + 4;
      tmp.width = Math.max(2, mw);
      tmp.height = Math.ceil(ln.fontSize * 2.2) + 4;
      // resizing clears state — re-apply
      tctx.font = ln.font;
      try { tctx.letterSpacing = ln.ls; } catch (e) {}
      tctx.textBaseline = 'alphabetic';
      tctx.fillStyle = '#fff';
      tctx.fillText(ln.text, 2, Math.round(ln.fontSize * 1.5));

      var td = tctx.getImageData(0, 0, tmp.width, tmp.height).data;
      var minX = tmp.width, minY = tmp.height, maxX = -1, maxY = -1, tx, ty;
      for (ty = 0; ty < tmp.height; ty++) {
        for (tx = 0; tx < tmp.width; tx++) {
          if (td[(ty * tmp.width + tx) * 4 + 3] > 40) {
            if (tx < minX) minX = tx;
            if (tx > maxX) maxX = tx;
            if (ty < minY) minY = ty;
            if (ty > maxY) maxY = ty;
          }
        }
      }
      if (maxX < 0) continue; // no ink

      // Map the scratch ink box straight onto the real glyph-ink rect.
      mctx.drawImage(
        tmp, minX, minY, (maxX - minX + 1), (maxY - minY + 1),
        ln.x, ln.top, ln.width, ln.height
      );
    }

    // ---- Distance field ------------------------------------------------
    var img = mctx.getImageData(0, 0, gw, gh).data;
    var Ncells = gw * gh;
    var f = new Float64Array(Ncells);
    var alphaCut = THRESHOLD * 255;
    for (var p = 0; p < Ncells; p++) f[p] = img[p * 4 + 3] > alphaCut ? 0 : INF;

    var colF = new Float64Array(gh), x, y, d, k;
    for (x = 0; x < gw; x++) {
      for (y = 0; y < gh; y++) colF[y] = f[y * gw + x];
      d = dt1d(colF, gh);
      for (y = 0; y < gh; y++) f[y * gw + x] = d[y];
    }
    var rowF = new Float64Array(gw);
    for (y = 0; y < gh; y++) {
      for (x = 0; x < gw; x++) rowF[x] = f[y * gw + x];
      d = dt1d(rowF, gw);
      for (x = 0; x < gw; x++) f[y * gw + x] = d[x];
    }
    var dist = new Float64Array(Ncells), maxd = 0;
    for (p = 0; p < Ncells; p++) dist[p] = Math.sqrt(f[p]);

    // Smooth the field so iso-lines lose their medial-axis kinks (two passes
    // approximate a Gaussian). Far rings straighten; near rings stay tight.
    var blurR = Math.round(SMOOTH_PX * Q);
    if (blurR >= 1) { dist = boxBlur(dist, gw, gh, blurR); dist = boxBlur(dist, gw, gh, blurR); }
    for (p = 0; p < Ncells; p++) if (dist[p] > maxd) maxd = dist[p];

    // ---- Marching-squares iso-lines ------------------------------------
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = LINE_W;
    // Horizontal gradient: periwinkle on the left → warm linen on the right.
    var grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, cssVar('--accent-light', '#B0BEE3'));
    grad.addColorStop(1, cssVar('--line', '#E8D5BE'));
    ctx.strokeStyle = grad;
    ctx.globalAlpha = ALPHA;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.filter = SOFTNESS > 0 ? 'blur(' + SOFTNESS + 'px)' : 'none';

    function at(ix, iy) { return dist[iy * gw + ix]; }
    var invQ = 1 / Q;
    ctx.beginPath();
    for (k = 0; k < COUNT; k++) {
      var L = (OFFSET + (PHASE + k) * SPACING) * Q;
      if (L > maxd) break;
      for (y = 0; y < gh - 1; y++) {
        for (x = 0; x < gw - 1; x++) {
          var tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
          var idx = 0;
          if (tl >= L) idx |= 8;
          if (tr >= L) idx |= 4;
          if (br >= L) idx |= 2;
          if (bl >= L) idx |= 1;
          if (idx === 0 || idx === 15) continue;

          var topX = x + (L - tl) / ((tr - tl) || 1e-6);
          var rightY = y + (L - tr) / ((br - tr) || 1e-6);
          var botX = x + (L - bl) / ((br - bl) || 1e-6);
          var leftY = y + (L - tl) / ((bl - tl) || 1e-6);

          switch (idx) {
            case 1: case 14: seg(x, leftY, botX, y + 1); break;
            case 2: case 13: seg(botX, y + 1, x + 1, rightY); break;
            case 3: case 12: seg(x, leftY, x + 1, rightY); break;
            case 4: case 11: seg(topX, y, x + 1, rightY); break;
            case 6: case 9:  seg(topX, y, botX, y + 1); break;
            case 7: case 8:  seg(x, leftY, topX, y); break;
            case 5:  seg(x, leftY, topX, y); seg(botX, y + 1, x + 1, rightY); break;
            case 10: seg(topX, y, x + 1, rightY); seg(x, leftY, botX, y + 1); break;
          }
        }
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.filter = 'none';

    function seg(ax, ay, bx, by) {
      ctx.moveTo(ax * invQ, ay * invQ);
      ctx.lineTo(bx * invQ, by * invQ);
    }
  }

  // Render after layout, and again once webfonts settle (metrics change).
  function boot() {
    requestAnimationFrame(render);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', render);

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(render, 150);
  });
})();
