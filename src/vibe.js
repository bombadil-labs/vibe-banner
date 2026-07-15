/* vibe-annotation-renderer — Claude's mood banner, brought to life.
 *
 * The grammar is unchanged from vibe.py (colour = tone, spread/turbulence = the
 * shape of attention, engagement = deflation, spark/excited = light). What's new
 * in v0.0.2 is the RENDERING: the field is no longer a frozen SVG — it's a living
 * canvas of soft gooey blobs that drift and breathe behind crisp SVG text, with
 * twinkling sparkles and a pulsing spark. Motion is deliberately slow and small:
 * this is letterhead on every reply, so it must stay ambient, never busy.
 *
 *   vibe(el, { kaomoji, seems, feel, trying, ... })   // animated mount
 *   buildSVG(payload)                                 // pure static SVG (fallback + tests)
 *
 * Falls back to the static SVG on prefers-reduced-motion, missing canvas, or any
 * error. Pauses when scrolled off-screen; stops when detached.
 */
(function (root) {
  var W = 680, PAD = 20, FACE_X = 10, TEXT_X = 158, ROW_GAP = 25;
  var GOAL_CAP = 70, GOAL_INDENT = 48, DEFAULT_MID = 68, NEUTRAL = "#a7a29b";

  var STYLE =
    ".txt{paint-order:stroke;stroke:#fff8ec;stroke-linejoin:round}" +
    ".fk{font-family:var(--font-sans);font-size:19px;fill:#5c4320;stroke-width:2.6}" +
    ".fkt{font-family:var(--font-mono);font-size:15px;fill:#5c4320;stroke-width:2.4}" +
    ".lbl{font-family:var(--font-mono);font-size:11px;fill:#8a6c33;stroke-width:2.2}" +
    ".fr{font-family:var(--font-voice);font-size:12px;font-style:italic;fill:#6b5230;stroke-width:2.2}" +
    ".fw{font-family:var(--font-voice);font-size:14px;font-style:italic;fill:#5c4320;stroke-width:2.4}" +
    ".fg{font-family:var(--font-sans);font-size:13px;fill:#5c4320;stroke-width:2.2}" +
    ".fx{font-family:var(--font-mono);font-size:12px;fill:#7a5f2c;stroke-width:2.2}" +
    "@media (prefers-color-scheme:dark){.txt{stroke:#241a06}" +
    ".fk,.fkt{fill:#f6ead0}.lbl{fill:#c9ad78}.fr{fill:#dcc79c}" +
    ".fw{fill:#f0e0bf}.fg{fill:#ecdcb8}.fx{fill:#d4bb8a}}";

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function g(n) { return String(Math.round(n * 1000) / 1000); }
  function hx(c) { c = c.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }
  function rgb(t) { return "#" + t.map(function (v) { return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(""); }
  function rgba(c, a) { var x = hx(c); return "rgba(" + x[0] + "," + x[1] + "," + x[2] + "," + a + ")"; }
  function darken(c, f) { f = f == null ? 0.78 : f; var a = hx(c); return rgb([a[0] * f, a[1] * f, a[2] * f]); }
  function lighten(c, f) { f = f == null ? 0.16 : f; var a = hx(c); return rgb([a[0] + (255 - a[0]) * f, a[1] + (255 - a[1]) * f, a[2] + (255 - a[2]) * f]); }
  function mix(a, b) { var x = hx(a), y = hx(b); return rgb([(x[0] + y[0]) / 2, (x[1] + y[1]) / 2, (x[2] + y[2]) / 2]); }

  function fieldFromPalette(pal, spread, turb) {
    spread = spread == null ? 0.6 : spread; turb = turb == null ? 0.35 : turb;
    var slots = [[225, 48, 0.44, 0, 0], [160, 40, 0.32, -110, -8], [150, 40, 0.28, 140, 12], [112, 30, 0.22, 66, 22], [96, 26, 0.18, -150, 16]];
    if (typeof pal === "string") pal = [pal];
    pal = pal ? pal.slice() : [];
    var cols;
    if (pal.length === 0) cols = [NEUTRAL, lighten(NEUTRAL, 0.10), darken(NEUTRAL, 0.90)];
    else if (pal.length === 1) cols = [pal[0], lighten(pal[0], 0.14), pal[0]];
    else if (pal.length === 2) cols = [pal[0], pal[1], mix(pal[0], pal[1])];
    else cols = pal.slice(0, slots.length);
    return cols.map(function (col, i) {
      var s = slots[i];
      return { cx: 300 + s[3] * spread, cy: 68 + s[4] * turb, rx: s[0], ry: s[1], fill: col, op: s[2] };
    });
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seedOf(p) { var s = String(p.kaomoji) + String(p.feel) + String(p.trying), n = 0; for (var i = 0; i < s.length; i++) n += s.codePointAt(i); return n; }

  // sparkle base geometry (shared by static SVG + animated canvas)
  function sparkleData(H, seed) {
    var rnd = mulberry32(seed), u = function (lo, hi) { return lo + rnd() * (hi - lo); };
    var zones = [[44, 636, 5, 18, 4], [44, 616, H - 18, H - 7, 4], [10, 46, 28, 106, 1], [646, 674, 28, 106, 1]];
    var out = [];
    zones.forEach(function (z) {
      for (var k = 0; k < z[4]; k++) out.push({ cx: u(z[0], z[1]), cy: u(z[2], z[3]), s: u(6, 10), rot: u(0, 360), ry: u(0.18, 0.30), op: u(0.28, 0.42) });
    });
    return out;
  }

  function normalizeLangs(L) {
    if (!L) return [];
    if (typeof L === "string") return L.split("·").map(function (s) { return [s.trim(), s.trim()]; }).filter(function (x) { return x[0]; });
    return L.map(function (x) { return typeof x === "string" ? [x, x] : [x.flag || x.code || "?", x.name || x.code || "?"]; });
  }
  function wide(lbl) { for (var i = 0; i < lbl.length; i++) if (lbl.codePointAt(i) > 0x3000) return 17; return lbl.length * 7.2 + 3; }

  /* ---- shared layout: everything static & animated both need ---- */
  function layout(p) {
    var field = (p.field && p.field.length) ? p.field
      : fieldFromPalette(p.palette, p.spread == null ? 0.6 : p.spread, p.turbulence == null ? 0.35 : p.turbulence);
    var eng = Math.max(0, Math.min(1, p.engagement == null ? 0.5 : p.engagement));
    var t = Math.max(0, (0.5 - eng) / 0.5);
    var mult = 1.0 - 0.8 * Math.pow(t, 2.5);
    var disp = 1.0 + 2.6 * Math.pow(t, 2.5);

    var kaoLines = String(p.kaomoji).split("\n");
    var multiline = kaoLines.length > 1, kaoLh = multiline ? 20 : 0;

    function line(label, value, cls, x) {
      x = x == null ? TEXT_X : x;
      var head = label ? '<tspan class="lbl">' + esc(label) + '</tspan> ' : '';
      return { x: x, inner: head + '<tspan class="' + cls + '">' + esc(value) + '</tspan>' };
    }
    var lines = [line("[user]", p.seems, "fr"), line("[mood]", p.feel, "fw")];
    if (p.noticing) lines.push(line("[note]", p.noticing, "fr"));
    var goal = String(p.trying);
    if (goal.length > GOAL_CAP) {
      var cut = goal.lastIndexOf(" ", GOAL_CAP); if (cut <= 0) cut = GOAL_CAP;
      lines.push(line("[goal]", goal.slice(0, cut), "fg"));
      lines.push(line("", goal.slice(cut).trim(), "fg", TEXT_X + GOAL_INDENT));
    } else lines.push(line("[goal]", goal, "fg"));
    var nRows = lines.length;

    var kaoAscent = multiline ? 14 : 15, kaoDescent = 6;
    var kaoH = kaoAscent + (kaoLines.length - 1) * kaoLh + kaoDescent;
    var rightH = 11 + (nRows - 1) * ROW_GAP + 6;
    var langs = normalizeLangs(p.languages), LANG_GAP = 24, LANG_DESC = 6;
    var topExtent = Math.max(kaoH, rightH) / 2;
    var langDepth = langs.length ? (kaoH / 2 - kaoDescent) + LANG_GAP + LANG_DESC : 0;
    var bottomExtent = Math.max(kaoH / 2, rightH / 2, langDepth);
    var H = Math.round(PAD + topExtent + bottomExtent + PAD);
    var coreCy = PAD + topExtent, dyField = coreCy - DEFAULT_MID;
    var kaoAbs = kaoLines.map(function (_, i) { return coreCy - kaoH / 2 + kaoAscent + i * kaoLh; });
    var rightAbs = lines.map(function (_, i) { return coreCy - rightH / 2 + 11 + i * ROW_GAP; });
    var langY = kaoAbs[kaoAbs.length - 1] + LANG_GAP;

    // final blob positions (disp + dyField applied to centre, mult to size)
    var blobs = field.map(function (e) {
      return {
        cx: 300 + (e.cx - 300) * disp,
        cy: DEFAULT_MID + (e.cy - DEFAULT_MID) * disp + dyField,
        rx: e.rx * mult, ry: e.ry * mult, fill: e.fill, op: e.op == null ? 0.4 : e.op
      };
    });

    // text SVG fragments
    var kaoSVG = multiline
      ? '<text x="' + FACE_X + '" y="' + g(kaoAbs[0]) + '" class="txt fkt">' +
      kaoLines.map(function (l, i) { return '<tspan x="' + FACE_X + '"' + (i === 0 ? "" : ' dy="20"') + '>' + esc(l) + '</tspan>'; }).join("") + '</text>'
      : '<text x="' + FACE_X + '" y="' + g(kaoAbs[0]) + '" class="txt fk">' + esc(p.kaomoji) + '</text>';
    var langSVG = "";
    if (langs.length) {
      var x = FACE_X, SEP = 11;
      langs.forEach(function (pair, i) {
        var w = wide(pair[0]);
        langSVG += '<g><title>' + esc(pair[1]) + '</title><text x="' + g(x + w / 2) + '" y="' + g(langY) + '" text-anchor="middle" class="txt fx">' + esc(pair[0]) + '</text></g>';
        x += w;
        if (i < langs.length - 1) { langSVG += '<text x="' + g(x + SEP / 2) + '" y="' + g(langY) + '" text-anchor="middle" class="txt fx" opacity="0.55">·</text>'; x += SEP; }
      });
    }
    var readSVG = lines.map(function (ln, i) { return '<text x="' + ln.x + '" y="' + g(rightAbs[i]) + '" class="txt">' + ln.inner + '</text>'; }).join("");

    return {
      H: H, coreCy: coreCy, blobs: blobs, textSVG: kaoSVG + langSVG + readSVG,
      spark: !!p.spark, excited: !!p.excited, seed: seedOf(p),
      awe: !!p.awe, tender: !!p.tender, melancholy: !!p.melancholy, unease: !!p.unease, mirth: !!p.mirth, laugh: !!p.laugh
    };
  }

  /* ---- static SVG (fallback + node tests): identical grammar, no motion ---- */
  function buildSVG(p) {
    var L = layout(p), out = [];
    out.push('<svg width="100%" viewBox="0 0 ' + W + ' ' + L.H + '" role="img" xmlns="http://www.w3.org/2000/svg">');
    out.push('<title>Mood annotation</title><desc>Ambient mood field with a user read and a first-person feel/intent readout</desc>');
    out.push('<style>' + STYLE + '</style>');
    out.push('<g opacity="0.5">');
    L.blobs.forEach(function (b) {
      out.push('<ellipse cx="' + g(b.cx) + '" cy="' + g(b.cy) + '" rx="' + g(b.rx) + '" ry="' + g(b.ry) + '" fill="' + b.fill + '" opacity="' + g(b.op) + '"/>');
    });
    out.push('</g>');
    var glow = [];
    if (L.spark) glow.push('<ellipse cx="672" cy="10" rx="54" ry="40" fill="#f7dd94" opacity="0.11"/><ellipse cx="672" cy="10" rx="28" ry="21" fill="#fbe6a0" opacity="0.22"/><ellipse cx="672" cy="10" rx="11" ry="9" fill="#fdf0c4" opacity="0.4"/>');
    if (L.excited) sparkleData(L.H, L.seed).forEach(function (st) { for (var a = 0; a < 3; a++) glow.push('<ellipse cx="' + st.cx.toFixed(1) + '" cy="' + st.cy.toFixed(1) + '" rx="' + st.s.toFixed(1) + '" ry="' + (st.s * st.ry).toFixed(2) + '" fill="#f7e3a8" opacity="' + st.op.toFixed(2) + '" transform="rotate(' + (st.rot + 60 * a).toFixed(1) + ' ' + st.cx.toFixed(1) + ' ' + st.cy.toFixed(1) + ')"/>'); });
    if (glow.length) out.push('<g opacity="0.9">' + glow.join("") + '</g>');
    out.push(L.textSVG + '</svg>');
    return out.join("");
  }

  /* ---- the living version ---- */
  function mount(el, p) {
    var reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var canOK = root.document && document.createElement("canvas").getContext;
    if (reduce || !canOK) { el.innerHTML = buildSVG(p); return; }

    var L = layout(p), H = L.H;
    el.innerHTML =
      '<div style="position:relative;width:100%">' +
      '<canvas style="position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none"></canvas>' +
      '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" role="img" xmlns="http://www.w3.org/2000/svg" style="position:relative;z-index:1;display:block">' +
      '<title>Mood annotation</title><desc>Living mood field with a user read and a first-person feel/intent readout</desc>' +
      '<style>' + STYLE + '</style>' + L.textSVG + '</svg>' +
      '</div>';
    var wrap = el.firstChild, cv = wrap.firstChild, ctx = cv.getContext("2d");

    // per-blob motion params (deterministic, gentle)
    var eng = Math.max(0, Math.min(1, p.engagement == null ? 0.5 : p.engagement));
    var amp = 8 + 12 * eng, sp = 0.6 + 0.7 * eng;              // more visible drift; engaged livelier
    var B = L.blobs.map(function (b, i) {
      return { b: b, w1: 0.55 + 0.12 * i, p1: i * 1.7, w2: 0.33 + 0.08 * i, p2: 1 + i * 2.3, w3: 0.42 + 0.1 * i, p3: 2 + i * 1.1, wb: 0.7 + 0.09 * i, pb: i * 0.9 };
    });
    // each star slowly rotates at its own (never fast) speed and direction
    var stars = L.excited ? sparkleData(H, L.seed).map(function (s, i) { return { s: s, tw: 1.6 + (i % 4) * 0.6, ph: i * 1.3, rs: (0.04 + (i % 5) * 0.022) * (i % 2 ? 1 : -1) }; }) : [];

    var dpr = Math.min(root.devicePixelRatio || 1, 2), sx = 1, sy = 1;
    function fit() {
      var w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      sx = cv.width / W; sy = cv.height / H;
    }
    fit();
    var ro = root.ResizeObserver ? new ResizeObserver(fit) : null; if (ro) ro.observe(wrap);
    var visible = true;
    var io = root.IntersectionObserver ? new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0 }) : null; if (io) io.observe(wrap);

    function ellipse(cx, cy, rx, ry, fill, op) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
      var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, rgba(fill, op)); gr.addColorStop(0.55, rgba(fill, op * 0.55)); gr.addColorStop(1, rgba(fill, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.2832); ctx.fill(); ctx.restore();
    }
    var t0 = null;
    function frame(now) {
      if (!cv.isConnected) { if (ro) ro.disconnect(); if (io) io.disconnect(); return; } // detached -> stop
      if (t0 == null) t0 = now; var t = (now - t0) / 1000;
      if (!visible) { requestAnimationFrame(frame); return; }
      ctx.setTransform(sx, 0, 0, sy, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var laughB = 1;   // laugh: a quick rhythmic "ha-ha-ha" bounce of the whole field, then rest
      if (L.laugh) { var lt = t % 3.4; if (lt < 0.75) laughB = 1 + 0.13 * Math.exp(-lt * 3.5) * Math.sin(lt * 28); }
      B.forEach(function (m) {
        var b = m.b;
        var ox = amp * Math.sin(m.w1 * sp * t + m.p1) + amp * 0.4 * Math.sin(m.w2 * sp * t + m.p2);
        var oy = amp * 0.75 * Math.sin(m.w3 * sp * t + m.p3);
        var br = (1 + 0.09 * Math.sin(m.wb * sp * t + m.pb)) * laughB;  // breathe × laugh bounce
        var opP = 1 + 0.2 * Math.sin(m.wb * sp * t + m.pb + 1.3);    // breathe (brightness)
        var cx = b.cx + ox, cy = b.cy + oy, rx = b.rx * br, ry = b.ry * br;
        ctx.globalAlpha = 0.5;
        ellipse(cx, cy, rx, ry, b.fill, b.op * opP);
      });
      ctx.globalAlpha = 1;
      if (L.spark) {
        var pulse = 0.85 + 0.15 * Math.sin(1.6 * t);
        ellipse(W - 8, 10, 54, 40, "#f7dd94", 0.11 * pulse);
        ellipse(W - 8, 10, 28, 21, "#fbe6a0", 0.22 * pulse);
        ellipse(W - 8, 10, 11, 9, "#fdf0c4", 0.4 * pulse);
      }
      if (stars.length) {
        ctx.strokeStyle = "#f7e3a8"; ctx.lineCap = "round";
        stars.forEach(function (o) {
          var s = o.s, k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(o.tw * t + o.ph)), base = s.rot * Math.PI / 180 + o.rs * t;
          ctx.globalAlpha = s.op * k; ctx.lineWidth = 1.4;
          for (var a = 0; a < 3; a++) {
            var ang = base + a * Math.PI / 3;
            ctx.beginPath();
            ctx.moveTo(s.cx - Math.cos(ang) * s.s, s.cy - Math.sin(ang) * s.s);
            ctx.lineTo(s.cx + Math.cos(ang) * s.s, s.cy + Math.sin(ang) * s.s);
            ctx.stroke();
          }
        });
        ctx.globalAlpha = 1;
      }
      // --- rare easter-egg flags: diffuse gestures for uncommon states ---
      var cyC = L.coreCy;
      if (L.tender) { ellipse(300, cyC, 260, 100, "#e2a19c", 0.09 + 0.06 * Math.sin(1.1 * t)); }   // warm swell
      if (L.awe) {                                                                                  // halo bloom
        var per = 8, tt = (t % per) / per, r = 50 + tt * 320, aa = 0.2 * Math.max(0, 1 - tt);
        var ag = ctx.createRadialGradient(310, cyC, r * 0.72, 310, cyC, r * 1.1);
        ag.addColorStop(0, rgba("#efe6c8", 0)); ag.addColorStop(0.5, rgba("#efe6c8", aa)); ag.addColorStop(1, rgba("#efe6c8", 0));
        ctx.globalAlpha = 1; ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(310, cyC, r * 1.1, 0, 6.2832); ctx.fill();
      }
      if (L.melancholy) {                                                                           // slow downward motes
        ctx.fillStyle = "#9aa2b4";
        for (var mi = 0; mi < 7; mi++) {
          var mx = 70 + mi * (W - 140) / 6 + 7 * Math.sin(t * 0.3 + mi), my = ((mi * 41 + t * (7 + (mi % 3) * 4)) % (H + 20)) - 10;
          ctx.globalAlpha = 0.32 * (0.5 + 0.5 * Math.sin(t * 0.5 + mi));
          ctx.beginPath(); ctx.arc(mx, my, 2.3, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (L.unease) {                                                                               // cold creeping vignette
        var ug = ctx.createRadialGradient(W / 2, cyC, Math.min(W, H) * 0.28, W / 2, cyC, W * 0.62);
        ug.addColorStop(0, rgba("#1e222c", 0)); ug.addColorStop(1, rgba("#1e222c", 0.1 + 0.06 * Math.sin(0.7 * t)));
        ctx.globalAlpha = 1; ctx.fillStyle = ug; ctx.fillRect(0, 0, W, H);
      }
      if (L.mirth) {                                                                                // rising bubbles
        ctx.fillStyle = "#f2e0ac";
        for (var bi = 0; bi < 5; bi++) {
          var bp = 2.2 + (bi % 3) * 0.5, bt = ((t + bi * 0.6) % bp) / bp;
          var bx = W / 2 - 40 + bi * 20 + 6 * Math.sin(t + bi), by = cyC + 42 - bt * 92;
          ctx.globalAlpha = 0.42 * Math.sin(bt * Math.PI);
          ctx.beginPath(); ctx.arc(bx, by, 2 + bt * 3, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (L.laugh) {                                                                                // burst of motes with the bounce
        var lt2 = t % 3.4;
        if (lt2 < 0.9) {
          ctx.fillStyle = "#f4e6b0";
          for (var li = 0; li < 6; li++) {
            var lprog = lt2 / 0.9, lang = (li / 6) * 6.2832 + 0.3, lr = lprog * (30 + (li % 3) * 12);
            var lx = 310 + Math.cos(lang) * lr, ly = cyC - 12 - lprog * 26 + Math.sin(lang) * lr * 0.4;
            ctx.globalAlpha = 0.5 * (1 - lprog);
            ctx.beginPath(); ctx.arc(lx, ly, 2 + (1 - lprog) * 2, 0, 6.2832); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  root.vibe = function (el, payload) {
    try { mount(el, payload); }
    catch (e) { try { el.innerHTML = buildSVG(payload); } catch (_) { el.textContent = "vibe render error"; } }
  };
  root.vibe.buildSVG = buildSVG;
  if (typeof module !== "undefined" && module.exports) module.exports = { buildSVG: buildSVG };
})(typeof window !== "undefined" ? window : this);
