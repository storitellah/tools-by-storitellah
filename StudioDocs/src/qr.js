// ---------- QR encoder from the original Narretrieve Card Studio ----------
(function (global) {
  'use strict';

  var ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  };
  var NUM_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  };
  var FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /* ---- GF(256) arithmetic, primitive polynomial 0x11D ---- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11D;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function rsGenerator(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= gmul(poly[j], 1);
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  function rsRemainder(data, degree) {
    var gen = rsGenerator(degree);
    var rem = new Array(degree).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ rem[0];
      rem.shift(); rem.push(0);
      for (var j = 0; j < degree; j++) rem[j] ^= gmul(gen[j + 1], factor);
    }
    return rem;
  }

  /* ---- capacity ---- */
  function rawDataModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver, ecl) {
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
  }
  function alignPositions(ver) {
    if (ver === 1) return [];
    var n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
    var step = (ver === 32) ? 26 : Math.ceil((size - 13) / (2 * n - 2)) * 2;
    var pos = [6];
    for (var p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    return pos;
  }

  function utf8Bytes(str) {
    var out = [], s = encodeURIComponent(str);
    for (var i = 0; i < s.length; i++) {
      if (s[i] === '%') { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
      else out.push(s.charCodeAt(i));
    }
    return out;
  }

  /* ---- BCH helpers ---- */
  function bchFormat(data) {
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }
  function bchVersion(ver) {
    var rem = ver;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    return (ver << 12) | rem;
  }

  function encode(text, opts) {
    opts = opts || {};
    var ecl = opts.ecLevel || 'M';
    if (!ECC_PER_BLOCK[ecl]) ecl = 'M';
    var bytes = utf8Bytes(String(text));

    /* choose the smallest version that fits */
    var ver = -1;
    for (var v = (opts.minVersion || 1); v <= 40; v++) {
      var ccBits = v <= 9 ? 8 : 16;
      if (4 + ccBits + bytes.length * 8 <= dataCodewords(v, ecl) * 8) { ver = v; break; }
    }
    if (ver < 0) throw new Error('QR payload too long for a single symbol');

    /* bit stream */
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    var capacityBits = dataCodewords(ver, ecl) * 8;
    push(0, Math.min(4, capacityBits - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < capacityBits; pad ^= 0xEC ^ 0x11) push(pad, 8);

    var dataBytes = [];
    for (var b = 0; b < bits.length; b += 8) {
      var byte = 0;
      for (var k = 0; k < 8; k++) byte = (byte << 1) | bits[b + k];
      dataBytes.push(byte);
    }

    /* split into blocks, add EC, interleave */
    var numBlocks = NUM_BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver];
    var totalCw = Math.floor(rawDataModules(ver) / 8);
    var shortBlockLen = Math.floor(totalCw / numBlocks) - eccLen;
    var numShort = numBlocks - totalCw % numBlocks;
    var blocks = [], ecBlocks = [], off = 0;
    for (var bi = 0; bi < numBlocks; bi++) {
      var len = shortBlockLen + (bi < numShort ? 0 : 1);
      var chunk = dataBytes.slice(off, off + len); off += len;
      blocks.push(chunk);
      ecBlocks.push(rsRemainder(chunk, eccLen));
    }
    var codewords = [];
    for (var c = 0; c <= shortBlockLen; c++)
      for (var bj = 0; bj < numBlocks; bj++)
        if (c < blocks[bj].length) codewords.push(blocks[bj][c]);
    for (var e = 0; e < eccLen; e++)
      for (var bk = 0; bk < numBlocks; bk++) codewords.push(ecBlocks[bk][e]);

    /* ---- lay out the symbol ---- */
    var size = ver * 4 + 17;
    var mod = [], fn = [];
    for (var y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(x, y, dark) { if (x >= 0 && y >= 0 && x < size && y < size) { mod[y][x] = dark; fn[y][x] = true; } }

    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    }
    /* timing */
    for (var t = 0; t < size; t++) { set(6, t, t % 2 === 0); set(t, 6, t % 2 === 0); }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    var ap = alignPositions(ver);
    for (var ai = 0; ai < ap.length; ai++) for (var aj = 0; aj < ap.length; aj++) {
      if ((ai === 0 && aj === 0) || (ai === 0 && aj === ap.length - 1) || (ai === ap.length - 1 && aj === 0)) continue;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++)
        set(ap[aj] + dx2, ap[ai] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }
    set(8, size - 8, true); /* dark module */

    /* Reserve the format-info cells by writing a placeholder through the same
       routine that writes the real bits later — guarantees the reserved set and
       the written set are identical, and never touches a timing module. */
    drawFormat(0);
    if (ver >= 7) {
      for (var vb = 0; vb < 18; vb++) {
        var a = Math.floor(vb / 3), bpos = vb % 3;
        set(size - 11 + bpos, a, false); set(a, size - 11 + bpos, false);
      }
    }

    /* data placement, zig-zag from bottom right */
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var col = 0; col < 2; col++) {
          var xx = right - col;
          var upward = ((right + 1) & 2) === 0;
          var yy = upward ? size - 1 - vert : vert;
          if (fn[yy][xx]) continue;
          var bit = false;
          if (idx < codewords.length * 8) bit = ((codewords[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0;
          mod[yy][xx] = bit; idx++;
        }
      }
    }

    /* masking */
    function maskFn(m, x, y) {
      switch (m) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return (x * y) % 2 + (x * y) % 3 === 0;
        case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
        case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
      }
    }
    function applyMask(m) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++)
        if (!fn[y][x] && maskFn(m, x, y)) mod[y][x] = !mod[y][x];
    }
    function drawFormat(m) {
      var bitsF = bchFormat(FORMAT_BITS[ecl] << 3 | m);
      for (var i = 0; i <= 5; i++) set(8, i, ((bitsF >>> i) & 1) !== 0);
      set(8, 7, ((bitsF >>> 6) & 1) !== 0);
      set(8, 8, ((bitsF >>> 7) & 1) !== 0);
      set(7, 8, ((bitsF >>> 8) & 1) !== 0);
      for (var j = 9; j < 15; j++) set(14 - j, 8, ((bitsF >>> j) & 1) !== 0);
      for (var k = 0; k < 8; k++) set(size - 1 - k, 8, ((bitsF >>> k) & 1) !== 0);
      for (var l = 8; l < 15; l++) set(8, size - 15 + l, ((bitsF >>> l) & 1) !== 0);
      set(8, size - 8, true);
    }
    if (ver >= 7) {
      var vbits = bchVersion(ver);
      for (var vi = 0; vi < 18; vi++) {
        var on = ((vbits >>> vi) & 1) !== 0, aa = Math.floor(vi / 3), bb = vi % 3;
        set(size - 11 + bb, aa, on); set(aa, size - 11 + bb, on);
      }
    }

    function penalty() {
      var p = 0, x, y, run, colour;
      for (y = 0; y < size; y++) {
        run = 0; colour = null;
        for (x = 0; x < size; x++) {
          if (mod[y][x] === colour) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
          else { colour = mod[y][x]; run = 1; }
        }
      }
      for (x = 0; x < size; x++) {
        run = 0; colour = null;
        for (y = 0; y < size; y++) {
          if (mod[y][x] === colour) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
          else { colour = mod[y][x]; run = 1; }
        }
      }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
        var c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
      }
      var pat1 = [true, false, true, true, true, false, true, false, false, false, false];
      var pat2 = [false, false, false, false, true, false, true, true, true, false, true];
      function match(get, i) {
        var ok1 = true, ok2 = true;
        for (var k = 0; k < 11; k++) {
          var v = get(i + k);
          if (v !== pat1[k]) ok1 = false;
          if (v !== pat2[k]) ok2 = false;
        }
        return ok1 || ok2;
      }
      for (y = 0; y < size; y++) for (x = 0; x + 11 <= size; x++)
        if (match(function (i) { return mod[y][i]; }, x)) p += 40;
      for (x = 0; x < size; x++) for (y = 0; y + 11 <= size; y++)
        if (match(function (i) { return mod[i][x]; }, y)) p += 40;
      var dark = 0;
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }

    var best = opts.mask, bestScore = Infinity;
    if (typeof best !== 'number') {
      for (var m = 0; m < 8; m++) {
        applyMask(m); drawFormat(m);
        var s = penalty();
        if (s < bestScore) { bestScore = s; best = m; }
        applyMask(m);
      }
    }
    applyMask(best); drawFormat(best);

    return { size: size, version: ver, ecLevel: ecl, mask: best, modules: mod };
  }

  /* Vector path for the whole symbol — one <path>, so it stays razor sharp
     in SVG and PDF output and never blurs at export time. */
  function toPath(qr, moduleSize, quiet) {
    quiet = quiet === undefined ? 4 : quiet;
    var d = [], s = moduleSize;
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) {
      if (!qr.modules[y][x]) continue;
      var px = ((x + quiet) * s).toFixed(3), py = ((y + quiet) * s).toFixed(3);
      d.push('M' + px + ' ' + py + 'h' + s.toFixed(3) + 'v' + s.toFixed(3) + 'h-' + s.toFixed(3) + 'z');
    }
    return { d: d.join(''), extent: (qr.size + quiet * 2) * s };
  }

  global.NRTQR = { encode: encode, toPath: toPath };
})(typeof window !== 'undefined' ? window : globalThis);
