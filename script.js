(() => {
  const SONG_URL = "Guaraldi Time of Yearv3.json";
  const STREET_SRC = "MoonglowStreet.png";
  const LOGO_SRC = "cool-cats-logo.png";
  const LOGO_W = 280;
  const LOGO_H = 145;
  const LOGO_CROP = { x: 15, y: 168, w: 1420, h: 733 };
  const LOGO_WAVE_BARS = 2;
  const LOGO_AMP = 5.6;
  const BAND_FADE_IN = 3.6;
  const BAND_FADE_OUT_BARS = 4;
  const COLS = 4;
  const MOON = { cx: 1246, cy: 158, r: 38 };
  const MOON_STEP_DEG = 18;
  const CLOUD_SRCS = [
    "cloud_0.png",
    "cloud_1.png",
    "cloud_2.png",
    "cloud_3.png",
    "cloud_4.png",
    "cloud_5.png",
    "cloud_6.png",
    "cloud_7.png",
  ];
  const CLOUDS = [
    { sprite: 0, y: 20, speed: 5.6, phase: 0.1, alpha: 0.62 },
    { sprite: 1, y: 38, speed: 6.4, phase: 0.48, alpha: 0.56 },
    { sprite: 2, y: 14, speed: 7.0, phase: 0.78, alpha: 0.52 },
    { sprite: 3, y: 62, speed: 3.5, phase: 0.16, alpha: 0.76 },
    { sprite: 4, y: 82, speed: 3.9, phase: 0.55, alpha: 0.72 },
    { sprite: 5, y: 70, speed: 2.7, phase: 0.88, alpha: 0.74 },
    { sprite: 3, y: 100, speed: 3.2, phase: 0.34, alpha: 0.7 },
    { sprite: 6, y: 112, speed: 1.7, phase: 0.12, alpha: 0.86 },
    { sprite: 7, y: 132, speed: 1.45, phase: 0.5, alpha: 0.84 },
    { sprite: 6, y: 92, speed: 1.9, phase: 0.72, alpha: 0.8 },
    { sprite: 7, y: 150, speed: 1.6, phase: 0.28, alpha: 0.82 },
  ];
  const PIANO = { left: 0, right: 1, leftSing: 2, rightSing: 3 };
  const PRESS = { down: 0, up: 1, altA: 2, altB: 3 };
  const SLAPN = { mid: 0, low: 1, high: 2, wink: 3 };
  const SLAP = { on: 0, pluck: 1, on2: 2, away: 3 };
  const CAPN = {
    idle: { col: 1, row: 3 },
    hatUp: { col: 1, row: 0 },
    hatDown: { col: 0, row: 0 },
    hatAndSnare: { col: 0, row: 1 },
    restA: { col: 1, row: 3 },
    restB: { col: 0, row: 3 },
    snare: { col: 1, row: 1 },
    snare2: { col: 0, row: 1 },
    snare3: { col: 2, row: 1 },
    kick: { col: 1, row: 3 },
    kick2: { col: 0, row: 3 },
    tom: [
      { col: 0, row: 3 },
      { col: 1, row: 3 },
      { col: 2, row: 3 },
      { col: 1, row: 3 },
    ],
  };

  const actors = {
    tapn: document.getElementById("actor-tapn"),
    slapn: document.getElementById("actor-slapn"),
    capn: document.getElementById("actor-capn"),
  };
  const audio = document.getElementById("song");
  const playBtn = document.getElementById("play-btn");
  const seek = document.getElementById("seek");
  const vol = document.getElementById("vol");
  const clockEl = document.getElementById("clock");
  const statusEl = document.getElementById("hud-status");
  const titleEl = document.getElementById("song-title");
  const backdrop = document.getElementById("backdrop");
  const moonEl = document.getElementById("moon");
  const cloudEl = document.getElementById("clouds");
  const logoEl = document.getElementById("band-logo");
  const glowWhite = document.getElementById("glow-white");
  const glowBlack = document.getElementById("glow-black");
  const bandEl = document.getElementById("band");
  let logoSrc = null;
  let logoCtx = null;
  let cloudCtx = null;
  let cloudSprites = [];

  let songData = null;
  let pianoHits = [];
  let bassHits = [];
  let drums = { kick: [], snare: [], hat: [], tom: [] };
  let kitEndBeat = 0;
  let seeking = false;
  const DEFAULT_VOLUME = 0.3;
  audio.volume = DEFAULT_VOLUME;
  if (vol) vol.value = String(DEFAULT_VOLUME);

  function ticksPerBar(song) {
    return song.beatsPerBar * song.ticksPerBeat;
  }

  function noteBeat(song, bar, tick) {
    return bar * song.beatsPerBar + tick / song.ticksPerBeat;
  }

  function collectPitch(channel, song, fromBar) {
    const hits = [];
    if (!channel) return hits;
    channel.sequence.forEach((patternNumber, bar) => {
      if (bar < fromBar || !patternNumber) return;
      const pattern = channel.patterns[patternNumber - 1];
      if (!pattern || !pattern.notes) return;
      for (const note of pattern.notes) {
        if (note.continuesLastPattern) continue;
        const start = note.points && note.points[0];
        if (!start || start.volume === 0) continue;
        const pitches = note.pitches || [];
        hits.push({
          beat: noteBeat(song, bar, start.tick || 0),
          endBeat: noteBeat(
            song,
            bar,
            (note.points[note.points.length - 1] &&
              note.points[note.points.length - 1].tick) ||
              start.tick ||
              0
          ),
          pitch:
            pitches.reduce((sum, value) => sum + value, 0) /
            Math.max(1, pitches.length),
          volume: start.volume,
          voices: pitches.length,
        });
      }
    });
    hits.sort((a, b) => a.beat - b.beat);
    return hits;
  }

  function collectDrum(channel, song) {
    const hits = [];
    if (!channel) return hits;
    channel.sequence.forEach((patternNumber, bar) => {
      if (!patternNumber) return;
      const pattern = channel.patterns[patternNumber - 1];
      if (!pattern || !pattern.notes) return;
      for (const note of pattern.notes) {
        if (note.continuesLastPattern) continue;
        const start = note.points && note.points[0];
        if (!start || start.volume === 0) continue;
        const pitches = note.pitches || [];
        hits.push({
          beat: noteBeat(song, bar, start.tick || 0),
          pitch:
            pitches.reduce((sum, value) => sum + value, 0) /
            Math.max(1, pitches.length),
        });
      }
    });
    hits.sort((a, b) => a.beat - b.beat);
    return hits;
  }

  function mergeClose(hits, windowBeats) {
    const out = [];
    for (const hit of hits) {
      const prev = out[out.length - 1];
      if (prev && Math.abs(hit.beat - prev.beat) < windowBeats) {
        if (hit.pitch < prev.pitch) out[out.length - 1] = hit;
        continue;
      }
      out.push(hit);
    }
    return out;
  }

  function countAtOrBefore(hits, time, key) {
    let lo = 0;
    let hi = hits.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const value = key ? hits[mid][key] : hits[mid];
      if (value <= time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function lastAtOrBefore(hits, time, key) {
    const i = countAtOrBefore(hits, time, key);
    return i === 0 ? null : hits[i - 1];
  }

  function hitsInWindow(hits, time, window, key) {
    const end = countAtOrBefore(hits, time, key);
    const start = countAtOrBefore(hits, time - window, key);
    return hits.slice(start, end);
  }

  function recent(hits, time, window, key) {
    const last = lastAtOrBefore(hits, time, key);
    if (!last) return false;
    const value = key ? last[key] : last;
    return time - value < window;
  }

  function setFrame(el, col, row) {
    el.style.setProperty("--col", String(col));
    el.style.setProperty("--row", String(row));
  }

  function pianoFrame(beats, playing, beatsPerBar, hits) {
    if (!playing) return { col: PRESS.up, row: PIANO.left };

    const last = lastAtOrBefore(hits, beats, "beat");
    if (!last) return { col: PRESS.up, row: PIANO.left };

    const since = beats - last.beat;
    const noteDur = last.endBeat ? Math.max(0, last.endBeat - last.beat) : 0.18;
    const hold = Math.min(0.24, Math.max(0.16, noteDur * 0.9));
    const pressed = since < hold;
    const cluster = hitsInWindow(hits, beats, 0.16, "beat");
    const busy = cluster.length >= 2;
    const left = last.pitch < 51;
    const row = busy
      ? left
        ? PIANO.leftSing
        : PIANO.rightSing
      : left
        ? PIANO.left
        : PIANO.right;

    if (!pressed) return { col: PRESS.up, row };

    const onsets = countAtOrBefore(hits, beats, "beat");
    let col = PRESS.down;
    if (last.voices < 3) {
      col = onsets % 2 === 0 ? PRESS.altA : PRESS.altB;
    } else if (last.pitch < 47) {
      col = PRESS.altA;
    } else if (last.pitch > 54) {
      col = PRESS.altB;
    }
    return { row, col };
  }

  function slapnRow(pitch, prevPitch) {
    let row = 1;
    if (pitch <= 10) row = 0;
    else if (pitch >= 14) row = 2;
    if (prevPitch != null) {
      if (pitch > prevPitch + 2) row = Math.min(2, Math.max(row, 1));
      if (pitch < prevPitch - 2) row = Math.max(0, Math.min(row, 1));
    }
    return row;
  }

  function slapnSway(beats, beatsPerBar) {
    const barBeats = Math.max(3, beatsPerBar);
    const pos = ((beats % barBeats) + barBeats) % barBeats;
    const bar = Math.floor(Math.max(0, beats) / barBeats);
    if (bar % 8 === 7 && pos >= barBeats * 0.5) {
      return { row: SLAPN.wink, col: SLAP.away };
    }
    return {
      row: pos >= barBeats * 0.5 ? SLAPN.high : SLAPN.mid,
      col: SLAP.away,
    };
  }

  function slapnStrokeCol(since, noteIndex) {
    if (since < 0.07) return SLAP.pluck;
    return noteIndex % 2 === 0 ? SLAP.on : SLAP.on2;
  }

  function slapnFrame(beats, playing, beatsPerBar, bass) {
    if (!playing) return { row: SLAPN.mid, col: SLAP.pluck };

    const nextIndex = countAtOrBefore(bass, beats, "beat");
    const last = nextIndex > 0 ? bass[nextIndex - 1] : null;
    const prev = nextIndex > 1 ? bass[nextIndex - 2] : null;
    const next = nextIndex < bass.length ? bass[nextIndex] : null;
    const since = last ? beats - last.beat : 99;
    const until = next ? next.beat - beats : 99;
    const contact = 0.18;
    const windup = 0.26;

    if ((!last || since > 1.05) && until > windup) {
      return slapnSway(beats, beatsPerBar);
    }

    if (last && since < contact) {
      return {
        row: slapnRow(last.pitch, prev ? prev.pitch : null),
        col: slapnStrokeCol(since, nextIndex),
      };
    }

    if (next && until < windup) {
      return {
        row: slapnRow(next.pitch, last ? last.pitch : null),
        col: SLAP.away,
      };
    }

    if (last) {
      return {
        row: slapnRow(last.pitch, prev ? prev.pitch : null),
        col: SLAP.away,
      };
    }

    return slapnSway(beats, beatsPerBar);
  }

  function capnFrame(beats, playing, kit, beatsPerBar) {
    if (!playing) return CAPN.idle;

    const barBeats = Math.max(3, beatsPerBar);
    const onTom = recent(kit.tom, beats, 0.32, "beat");
    const kitOver = kitEndBeat && beats >= kitEndBeat - 0.12;
    if (kitOver || kitQuiet(beats, kit)) {
      if (onTom) return CAPN.tom[Math.floor(beats) % CAPN.tom.length];
      return capnRestGroove(beats, barBeats);
    }

    const pos = ((beats % barBeats) + barBeats) % barBeats;
    const beatInBar = Math.floor(pos) + 1;
    const phase = pos - Math.floor(pos);
    const onHat = recent(kit.hat, beats, 0.18, "beat");
    const onKick = recent(kit.kick, beats, 0.16, "beat");
    const onSnare = recent(kit.snare, beats, 0.28, "beat");
    const snareNow = capnSnareOnBeat3(beats, kit, barBeats) || onSnare;

    if (snareNow) {
      if (phase < 0.22) return CAPN.snare;
      return onHat ? CAPN.hatAndSnare : CAPN.snare2;
    }

    if (onHat) return CAPN.hatDown;
    if (beatInBar !== 3 && phase < 0.18) return CAPN.hatDown;
    if (onKick) return phase < 0.12 ? CAPN.kick : CAPN.kick2;
    return CAPN.hatUp;
  }

  function capnSnareOnBeat3(beats, kit, barBeats) {
    const pos = ((beats % barBeats) + barBeats) % barBeats;
    if (pos >= 2 && pos < 2.4) return true;
    const last = lastAtOrBefore(kit.snare, beats, "beat");
    if (!last) return false;
    const p = ((last.beat % barBeats) + barBeats) % barBeats;
    return p >= 1.85 && beats - last.beat < 0.28;
  }

  function kitQuiet(beats, kit) {
    const parts = [kit.kick, kit.snare, kit.hat];
    for (let i = 0; i < parts.length; i += 1) {
      const hits = parts[i];
      const last = lastAtOrBefore(hits, beats, "beat");
      const nextIndex = countAtOrBefore(hits, beats, "beat");
      const next = nextIndex < hits.length ? hits[nextIndex] : null;
      if (last && beats - last.beat < 1.1) return false;
      if (next && next.beat - beats < 0.45) return false;
    }
    return true;
  }

  function capnRestGroove(beats, barBeats) {
    const pos = ((beats % barBeats) + barBeats) % barBeats;
    const beatInBar = Math.floor(pos);
    const phase = pos - beatInBar;
    const dip = beatInBar === 0 ? 0.3 : 0.22;
    return phase < dip ? CAPN.restB : CAPN.restA;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function displayTitle(name) {
    return String(name || "Guaraldi Time of Year")
      .replace(/v\d+$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hideOriginalMoon(ctx) {
    const { cx, cy } = MOON;
    const cover = 90;
    const pad = 14;
    const ox = -276;
    const oy = 10;
    const x0 = cx - cover - pad;
    const y0 = cy - cover - pad;
    const size = (cover + pad) * 2;
    const dest = ctx.getImageData(x0, y0, size, size);
    const donor = ctx.getImageData(x0 + ox, y0 + oy, size, size);
    const dd = dest.data;
    const ds = donor.data;

    function hash(x, y) {
      return ((x * 374761393 + y * 668265263) >>> 0) % 1000 / 1000;
    }

    function limitAt(x, y) {
      return cover + hash(x, y) * 16;
    }

    let ringN = 0;
    const ring = [0, 0, 0];
    let donN = 0;
    const don = [0, 0, 0];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dist = Math.hypot(x0 + x - cx, y0 + y - cy);
        const i = (y * size + x) * 4;
        if (dist >= 96 && dist <= 118) {
          ring[0] += dd[i];
          ring[1] += dd[i + 1];
          ring[2] += dd[i + 2];
          ringN += 1;
        }
        if (dist <= limitAt(x, y)) {
          don[0] += ds[i];
          don[1] += ds[i + 1];
          don[2] += ds[i + 2];
          donN += 1;
        }
      }
    }
    const shift = [
      ring[0] / ringN - don[0] / donN,
      ring[1] / ringN - don[1] / donN,
      ring[2] / ringN - don[2] / donN,
    ];

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dist = Math.hypot(x0 + x - cx, y0 + y - cy);
        if (dist > limitAt(x, y)) continue;
        const i = (y * size + x) * 4;
        if (dd[i] + dd[i + 1] < 22 && dd[i + 2] < 28) continue;
        dd[i] = Math.max(0, Math.min(255, Math.round(ds[i] + shift[0])));
        dd[i + 1] = Math.max(0, Math.min(255, Math.round(ds[i + 1] + shift[1])));
        dd[i + 2] = Math.max(0, Math.min(255, Math.round(ds[i + 2] + shift[2])));
        dd[i + 3] = 255;
      }
    }
    ctx.putImageData(dest, x0, y0);
  }

  function extractMoon(img) {
    const { cx, cy } = MOON;
    const size = 80;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size);
    const mid = size / 2;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = (y * size + x) * 4;
        const red = data.data[i];
        const green = data.data[i + 1];
        const blue = data.data[i + 2];
        const bri = red + green + blue;
        const d = Math.hypot(x - mid, y - mid);
        const moonFace = red > 95 && green > 75 && bri > 260 && red + green > blue + 40;
        if (d <= 26) continue;
        if (moonFace && d <= 33) continue;
        data.data[i + 3] = 0;
      }
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function prepareStreet() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ctx = backdrop.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        hideOriginalMoon(ctx);
        moonEl.src = extractMoon(img);
        resolve();
      };
      img.onerror = () => reject(new Error("Could not load street"));
      img.src = STREET_SRC;
    });
  }

  function prepareLogo() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const off = document.createElement("canvas");
        off.width = LOGO_W;
        off.height = LOGO_H;
        const octx = off.getContext("2d");
        octx.imageSmoothingEnabled = false;
        const { x, y, w, h } = LOGO_CROP;
        octx.drawImage(img, x, y, w, h, 0, 0, LOGO_W, LOGO_H);
        logoSrc = off;
        logoEl.width = LOGO_W;
        logoEl.height = LOGO_H;
        logoCtx = logoEl.getContext("2d");
        logoCtx.imageSmoothingEnabled = false;
        drawLogo(0, false, 3);
        resolve();
      };
      img.onerror = () => reject(new Error("Could not load logo"));
      img.src = LOGO_SRC;
    });
  }

  function wrapRange(n, max) {
    return ((n % max) + max) % max;
  }

  function fillEnclosedHoles(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const at = (x, y) => (y * w + x) * 4;
    const solid = (x, y) => d[at(x, y) + 3] > 200;
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = at(x, y);
        if (d[i + 3] !== 0) continue;
        if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) {
          continue;
        }
        const ns = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        let yr = 0;
        let yg = 0;
        let yb = 0;
        let yn = 0;
        ns.forEach(([nx, ny]) => {
          const j = at(nx, ny);
          const pr = d[j];
          const pg = d[j + 1];
          const pb = d[j + 2];
          r += pr;
          g += pg;
          b += pb;
          n += 1;
          if (pr > 180 && pg > 110 && pb < 90) {
            yr += pr;
            yg += pg;
            yb += pb;
            yn += 1;
          }
        });
        if (yn) {
          d[i] = Math.round(yr / yn);
          d[i + 1] = Math.round(yg / yn);
          d[i + 2] = Math.round(yb / yn);
        } else {
          d[i] = Math.round(r / n);
          d[i + 1] = Math.round(g / n);
          d[i + 2] = Math.round(b / n);
        }
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function isCapnYellow(r, g, b, a) {
    return a > 180 && r > 180 && g > 120 && b < 70 && r > g && r - b > 80;
  }

  function fixCapnEyeSpikes(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const fw = Math.floor(w / 4);
    const fh = Math.floor(h / 4);
    const at = (x, y) => (y * w + x) * 4;
    const yel = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const i = at(x, y);
      return isCapnYellow(d[i], d[i + 1], d[i + 2], d[i + 3]);
    };
    const patches = [];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const ox = col * fw;
        const oy = row * fh;
        for (let ly = 22; ly < 78; ly += 1) {
          for (let lx = 96; lx < 158; lx += 1) {
            const x = ox + lx;
            const y = oy + ly;
            if (!yel(x, y)) continue;
            if (yel(x, y - 1) || yel(x - 1, y) || yel(x + 1, y)) continue;
            if (!yel(x, y + 1)) continue;
            let n = 0;
            for (let yy = y + 1; yy <= y + 4; yy += 1) {
              for (let xx = x - 3; xx <= x + 3; xx += 1) {
                if (yel(xx, yy)) n += 1;
              }
            }
            if (n < 5) continue;
            patches.push([x, y]);
          }
        }
      }
    }
    patches.forEach(([x, y]) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      [
        [0, -1],
        [-1, 0],
        [1, 0],
        [-1, -1],
        [1, -1],
      ].forEach(([dx, dy]) => {
        const i = at(x + dx, y + dy);
        if (d[i + 3] < 180) return;
        if (isCapnYellow(d[i], d[i + 1], d[i + 2], d[i + 3])) return;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n += 1;
      });
      if (!n) return;
      const i = at(x, y);
      d[i] = Math.round(r / n);
      d[i + 1] = Math.round(g / n);
      d[i + 2] = Math.round(b / n);
      d[i + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
  }

  function prepareCapnSheet() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        fillEnclosedHoles(ctx, canvas.width, canvas.height);
        fixCapnEyeSpikes(ctx, canvas.width, canvas.height);
        actors.capn.style.backgroundImage = "url(" + canvas.toDataURL("image/png") + ")";
        resolve();
      };
      img.onerror = () => resolve();
      img.src = "capn_sheet.png";
    });
  }

  function isSlapnFringe(r, g, b, a) {
    if (a < 40) return false;
    return (r > 110 && b > 70 && g < 95) || (b > g + 22 && r > g + 12 && b > 85);
  }

  function healSlapnFringe(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const fw = Math.floor(w / 4);
    const fh = Math.floor(h / 4);
    const at = (x, y) => (y * w + x) * 4;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const ox = col * fw;
        const oy = row * fh;
        for (let ly = 0; ly < fh; ly += 1) {
          for (let lx = 0; lx < fw; lx += 1) {
            const i = at(ox + lx, oy + ly);
            if (!isSlapnFringe(d[i], d[i + 1], d[i + 2], d[i + 3])) continue;
            let sy = ly - 1;
            while (sy >= 0) {
              const j = at(ox + lx, oy + sy);
              if (d[j + 3] > 40 && !isSlapnFringe(d[j], d[j + 1], d[j + 2], d[j + 3])) {
                d[i] = d[j];
                d[i + 1] = d[j + 1];
                d[i + 2] = d[j + 2];
                break;
              }
              sy -= 1;
            }
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function prepareSlapnSheet() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        healSlapnFringe(ctx, canvas.width, canvas.height);
        actors.slapn.style.backgroundImage = "url(" + canvas.toDataURL("image/png") + ")";
        resolve();
      };
      img.onerror = () => resolve();
      img.src = "slapn_sheet.png";
    });
  }

  function loadCloudImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function prepareClouds() {
    cloudCtx = cloudEl.getContext("2d");
    cloudCtx.imageSmoothingEnabled = false;
    return Promise.all(CLOUD_SRCS.map(loadCloudImage)).then((imgs) => {
      cloudSprites = imgs;
    });
  }

  function paintClouds(beats, beatsPerBar) {
    if (!cloudCtx) return;
    const w = cloudEl.width;
    const h = cloudEl.height;
    cloudCtx.clearRect(0, 0, w, h);
    if (!cloudSprites.length) return;
    const barBeats = Math.max(3, beatsPerBar);
    const t = Math.max(0, beats);
    const breathe = 0.92 + 0.08 * Math.abs(Math.sin((t / (barBeats * 2)) * Math.PI));
    cloudCtx.imageSmoothingEnabled = false;
    CLOUDS.forEach((cloud) => {
      const img = cloudSprites[cloud.sprite];
      if (!img) return;
      const span = img.width;
      const period = w + span;
      const drift = t * cloud.speed;
      const x = Math.round(wrapRange(cloud.phase * period + drift, period) - span);
      const y = Math.round(
        cloud.y + Math.sin(t / (barBeats * 3) + cloud.phase * 4) * 3
      );
      cloudCtx.globalAlpha = cloud.alpha * breathe;
      cloudCtx.drawImage(img, x, y);
      cloudCtx.drawImage(img, x - period, y);
      cloudCtx.drawImage(img, x + period, y);
    });
    cloudCtx.globalAlpha = 1;
  }

  function drawLogo(beats, playing, beatsPerBar) {
    if (!logoSrc || !logoCtx) return;
    const cycle = Math.max(3, beatsPerBar) * LOGO_WAVE_BARS;
    const phase = (beats / cycle) * Math.PI * 2;
    logoCtx.clearRect(0, 0, LOGO_W, LOGO_H);
    if (!playing) {
      logoCtx.drawImage(logoSrc, 0, 0);
      logoEl.style.transform = "";
      return;
    }
    for (let row = 0; row < LOGO_H; row += 1) {
      const dx = Math.round(
        Math.sin(row * 0.032 + phase) * LOGO_AMP +
          Math.sin(row * 0.058 + phase * 0.5) * 1.6
      );
      logoCtx.drawImage(logoSrc, 0, row, LOGO_W, 1, dx, row, LOGO_W, 1);
    }
    const tilt = Math.sin(phase) * 2.8;
    const bob = Math.sin(phase * 0.85) * 3.2;
    logoEl.style.transform =
      "rotate(" + tilt.toFixed(2) + "deg) translateY(" + bob.toFixed(2) + "px)";
  }

  function syncUi() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const t = audio.currentTime || 0;
    if (!seeking && duration) seek.value = String(t);
    clockEl.textContent =
      formatTime(t) + (duration ? " / " + formatTime(duration) : "");
    playBtn.textContent = audio.paused ? "Play" : "Pause";
    if (songData && !audio.paused) {
      statusEl.textContent = "live on moonglow street";
    }
  }

  function setYardGlow(el, amount) {
    const a = Math.max(0, Math.min(1, amount));
    el.style.opacity = a.toFixed(3);
    el.style.transform = "scale(" + (0.9 + a * 0.18).toFixed(3) + ")";
  }

  function setBlackGlow(amount) {
    const a = Math.max(0, Math.min(1, amount));
    glowBlack.style.opacity = a.toFixed(3);
    glowBlack.style.transform = "scale(" + (0.82 + a * 0.38).toFixed(3) + ")";
  }

  function paintYardGlows(beats, playing, beatsPerBar) {
    if (!playing) {
      setYardGlow(glowWhite, 0);
      setBlackGlow(0);
      return;
    }
    const barBeats = Math.max(3, beatsPerBar);
    const breathe = 0.5 + 0.5 * Math.sin((beats / barBeats) * Math.PI * 2);
    const onHat = recent(drums.hat, beats, 0.2, "beat");
    const onKick = recent(drums.kick, beats, 0.24, "beat");
    setYardGlow(glowWhite, 0.1 + breathe * 0.08 + (onHat ? 0.2 : 0));
    setBlackGlow(0.08 + breathe * 0.06 + (onKick ? 0.12 : 0));
  }

  function smoothstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
  }

  function bandOpacity(time, duration, bpm, beatsPerBar) {
    const t = Math.max(0, time);
    const dur = duration > 1 ? duration : 78;
    const fadeIn = smoothstep(t / BAND_FADE_IN);
    const barSec = (Math.max(3, beatsPerBar) * 60) / Math.max(1, bpm || 96);
    const fadeOutSec = barSec * BAND_FADE_OUT_BARS;
    const fadeOutStart = Math.max(BAND_FADE_IN + 4, dur - fadeOutSec);
    const fadeOut =
      t < fadeOutStart ? 1 : 1 - smoothstep((t - fadeOutStart) / Math.max(0.01, dur - fadeOutStart));
    return Math.max(0, Math.min(1, fadeIn * fadeOut));
  }

  function setBandPresence(amount) {
    bandEl.style.opacity = Math.max(0, Math.min(1, amount)).toFixed(3);
  }

  function paint(time) {
    if (!songData) return;
    const bpm = songData.beatsPerMinute;
    const beats = time * (bpm / 60);
    const playing = !audio.paused;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const presence = bandOpacity(time, duration, bpm, songData.beatsPerBar);
    const tapn = pianoFrame(beats, playing, songData.beatsPerBar, pianoHits);
    const slapn = slapnFrame(beats, playing, songData.beatsPerBar, bassHits);
    const capn = capnFrame(beats, playing, drums, songData.beatsPerBar);
    setFrame(actors.tapn, tapn.col, tapn.row);
    setFrame(actors.slapn, slapn.col, slapn.row);
    setFrame(actors.capn, capn.col, capn.row);
    const steps = Math.floor(Math.max(0, beats) / 2);
    moonEl.style.transform = "rotate(" + steps * MOON_STEP_DEG + "deg)";
    paintClouds(beats, songData.beatsPerBar);
    drawLogo(beats, playing, songData.beatsPerBar);
    paintYardGlows(beats, playing, songData.beatsPerBar);
    setBandPresence(presence);
  }

  function loop() {
    paint(audio.currentTime || 0);
    syncUi();
    requestAnimationFrame(loop);
  }

  async function boot() {
    try {
      await Promise.all([
        prepareStreet(),
        prepareLogo(),
        prepareCapnSheet(),
        prepareSlapnSheet(),
        prepareClouds(),
      ]);
      const res = await fetch(encodeURI(SONG_URL));
      if (!res.ok) throw new Error("Could not load song data");
      const song = await res.json();
      const pitch = song.channels.filter((ch) => ch.type === "pitch");
      const noise = song.channels.filter((ch) => ch.type === "drum");
      songData = song;
      pianoHits = collectPitch(pitch[7], song, 0)
        .concat(collectPitch(pitch[8], song, 8))
        .concat(collectPitch(pitch[3], song, 0));
      pianoHits.sort((a, b) => a.beat - b.beat);
      const bassRaw = collectPitch(pitch[9], song, 0)
        .concat(collectPitch(pitch[10], song, 0))
        .concat(collectPitch(pitch[11], song, 0));
      bassRaw.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
      bassHits = mergeClose(bassRaw, 0.04);
      drums = {
        kick: collectDrum(noise[0], song),
        snare: collectDrum(noise[1], song),
        hat: collectDrum(noise[2], song),
        tom: collectDrum(noise[5], song),
      };
      kitEndBeat = Math.max(
        drums.kick.length ? drums.kick[drums.kick.length - 1].beat : 0,
        drums.snare.length ? drums.snare[drums.snare.length - 1].beat : 0,
        drums.hat.length ? drums.hat[drums.hat.length - 1].beat : 0
      );
      titleEl.textContent = displayTitle(song.name);
      statusEl.textContent = "press play";
      playBtn.disabled = false;
      seek.disabled = false;
      paint(0);
    } catch (err) {
      statusEl.textContent = "could not load the song";
      playBtn.disabled = true;
      console.error(err);
    }
  }

  playBtn.addEventListener("click", async () => {
    if (!songData) return;
    try {
      if (audio.paused) {
        if (audio.ended || (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration - 0.05)) {
          audio.currentTime = 0;
        }
        await audio.play();
      } else {
        audio.pause();
        statusEl.textContent = "paused";
      }
    } catch (err) {
      statusEl.textContent = "playback blocked";
      console.error(err);
    }
  });

  seek.addEventListener("pointerdown", () => {
    seeking = true;
  });
  seek.addEventListener("pointerup", () => {
    seeking = false;
  });
  seek.addEventListener("input", () => {
    audio.currentTime = Number(seek.value);
    paint(audio.currentTime);
    syncUi();
  });

  vol.addEventListener("input", () => {
    audio.volume = Number(vol.value);
  });

  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio.duration)) seek.max = String(audio.duration);
    syncUi();
  });
  audio.addEventListener("ended", () => {
    playBtn.textContent = "Play";
    statusEl.textContent = "press play";
  });

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat) return;
    if (event.target && ["INPUT", "BUTTON", "TEXTAREA"].includes(event.target.tagName)) {
      return;
    }
    event.preventDefault();
    playBtn.click();
  });

  boot();
  requestAnimationFrame(loop);
})();
