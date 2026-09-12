/*
 * 琳嘉女孩 同人馆 · 剧场模式内置配乐
 * ---------------------------------------------------------------
 * 这里不加载任何外部音频文件，而是用 Web Audio 实时合成一层
 * 环境音乐（长音铺底 + 钟琴点缀 + 空气噪声），因此：
 *   - 没有任何版权/授权问题，可以随站点一起发布；
 *   - 循环天然无缝，也不会因为网络加载失败而静音；
 *   - 每部小说可以按 mood 使用不同的和声与音色。
 *
 * 如果你之后想换成真实 mp3，只要在 data/scenes.json 里给某本书加
 * "bgm": "assets/audio/xxx.mp3"，theater.js 会优先使用该文件。
 */
(function () {
  "use strict";

  var MOODS = {
    sea: {
      label: "雾海",
      chords: [[50, 57, 62, 66], [48, 55, 60, 64], [46, 53, 58, 62], [48, 55, 62, 67]],
      scale: [50, 53, 55, 57, 60, 62, 65, 69],
      padGain: 0.15,
      bellGain: 0.09,
      air: 0.05,
      airFreq: 420,
      chordDur: 9.5,
      bellRate: 0.55
    },
    rain: {
      label: "雨夜",
      chords: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [45, 52, 59, 64]],
      scale: [57, 60, 62, 64, 67, 69, 72],
      padGain: 0.13,
      bellGain: 0.11,
      air: 0.085,
      airFreq: 700,
      chordDur: 8.5,
      bellRate: 0.7
    },
    space: {
      label: "星海",
      chords: [[48, 55, 59, 62], [43, 50, 54, 59], [45, 52, 57, 60], [41, 48, 55, 60]],
      scale: [60, 62, 64, 67, 69, 72, 74, 76],
      padGain: 0.16,
      bellGain: 0.08,
      air: 0.03,
      airFreq: 320,
      chordDur: 12,
      bellRate: 0.4
    },
    folk: {
      label: "春山",
      chords: [[55, 62, 67, 71], [48, 55, 60, 64], [50, 57, 62, 66], [52, 59, 64, 67]],
      scale: [55, 57, 59, 62, 64, 67, 69, 71],
      padGain: 0.11,
      bellGain: 0.15,
      air: 0.035,
      airFreq: 900,
      chordDur: 7,
      bellRate: 0.95
    },
    city: {
      label: "巷口",
      chords: [[53, 60, 64, 67], [57, 64, 69, 72], [55, 62, 65, 69], [48, 55, 60, 64]],
      scale: [60, 62, 65, 67, 69, 72, 74, 77],
      padGain: 0.12,
      bellGain: 0.13,
      air: 0.055,
      airFreq: 620,
      chordDur: 7.5,
      bellRate: 0.8
    },
    morning: {
      label: "清晨",
      chords: [[55, 62, 66, 69], [50, 57, 62, 66], [57, 64, 67, 71], [52, 59, 64, 69]],
      scale: [62, 64, 66, 69, 71, 74, 76, 78],
      padGain: 0.12,
      bellGain: 0.14,
      air: 0.035,
      airFreq: 950,
      chordDur: 7.2,
      bellRate: 0.95
    },
    mirror: {
      label: "镜城",
      chords: [[52, 59, 64, 67], [48, 55, 59, 64], [45, 52, 57, 60], [47, 54, 59, 62]],
      scale: [64, 67, 69, 71, 74, 76, 79, 81],
      padGain: 0.12,
      bellGain: 0.16,
      air: 0.028,
      airFreq: 1100,
      chordDur: 8,
      bellRate: 1.05
    },
    urban: {
      label: "市井",
      chords: [[45, 52, 57, 61], [50, 57, 62, 66], [43, 50, 55, 59], [48, 55, 60, 64]],
      scale: [57, 59, 61, 64, 66, 69, 71, 73],
      padGain: 0.12,
      bellGain: 0.12,
      air: 0.06,
      airFreq: 560,
      chordDur: 8,
      bellRate: 0.75
    },
    tide: {
      label: "潮汐",
      chords: [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]],
      scale: [60, 64, 65, 67, 69, 72, 76, 77],
      padGain: 0.14,
      bellGain: 0.13,
      air: 0.07,
      airFreq: 500,
      chordDur: 9,
      bellRate: 0.6
    },

    /* 《清晨的色彩》逐场景配乐：每个 mood 对应一类情绪，剧场模式会随场景切换 */
    lazy: {
      label: "低电量",
      chords: [[45, 52, 57, 60], [43, 50, 55, 59], [41, 48, 53, 57], [45, 52, 57, 62]],
      scale: [57, 60, 62, 64, 67, 69, 72],
      padGain: 0.13,
      bellGain: 0.07,
      air: 0.05,
      airFreq: 480,
      chordDur: 10,
      bellRate: 0.35
    },
    memory: {
      label: "回忆",
      chords: [[55, 62, 66, 69], [53, 60, 64, 67], [50, 57, 62, 65], [48, 55, 60, 64]],
      scale: [62, 64, 66, 69, 71, 74, 76, 78],
      padGain: 0.13,
      bellGain: 0.12,
      air: 0.04,
      airFreq: 820,
      chordDur: 9,
      bellRate: 0.6
    },
    playful: {
      label: "俏皮",
      chords: [[57, 64, 69, 71], [60, 67, 72, 74], [55, 62, 67, 69], [53, 60, 65, 69]],
      scale: [64, 67, 69, 71, 74, 76, 79, 81],
      padGain: 0.11,
      bellGain: 0.17,
      air: 0.04,
      airFreq: 980,
      chordDur: 5.6,
      bellRate: 1.25
    },
    bloom: {
      label: "心动",
      chords: [[53, 60, 65, 69], [55, 62, 67, 71], [57, 64, 69, 72], [52, 59, 64, 67]],
      scale: [65, 67, 69, 72, 74, 76, 79, 81],
      padGain: 0.13,
      bellGain: 0.16,
      air: 0.032,
      airFreq: 1000,
      chordDur: 8.6,
      bellRate: 0.9
    },
    cafe: {
      label: "午后咖啡",
      chords: [[55, 59, 64, 67], [53, 57, 62, 65], [51, 55, 60, 64], [57, 60, 65, 69]],
      scale: [60, 62, 64, 67, 69, 71, 72, 74],
      padGain: 0.11,
      bellGain: 0.15,
      air: 0.05,
      airFreq: 700,
      chordDur: 6.4,
      bellRate: 1.1
    },
    warm: {
      label: "烟火",
      chords: [[53, 60, 64, 67], [50, 57, 62, 65], [48, 55, 60, 64], [55, 62, 65, 69]],
      scale: [60, 62, 65, 67, 69, 72, 74, 77],
      padGain: 0.14,
      bellGain: 0.12,
      air: 0.055,
      airFreq: 600,
      chordDur: 7.4,
      bellRate: 0.7
    },
    dusk: {
      label: "黄昏",
      chords: [[45, 52, 57, 60], [43, 50, 55, 58], [41, 48, 53, 56], [44, 51, 56, 60]],
      scale: [57, 60, 62, 64, 67, 69, 72],
      padGain: 0.14,
      bellGain: 0.09,
      air: 0.06,
      airFreq: 520,
      chordDur: 10,
      bellRate: 0.45
    },
    night: {
      label: "夜色",
      chords: [[41, 48, 53, 56], [43, 50, 55, 58], [38, 45, 50, 53], [40, 47, 52, 55]],
      scale: [53, 56, 58, 60, 63, 65, 68, 70],
      padGain: 0.13,
      bellGain: 0.08,
      air: 0.03,
      airFreq: 380,
      chordDur: 11,
      bellRate: 0.3
    },
    dream: {
      label: "梦境",
      chords: [[50, 57, 61, 64], [52, 59, 63, 66], [48, 55, 59, 62], [55, 62, 66, 69]],
      scale: [62, 64, 66, 68, 70, 73, 75, 78],
      padGain: 0.15,
      bellGain: 0.13,
      air: 0.028,
      airFreq: 1050,
      chordDur: 12.5,
      bellRate: 0.5
    },
    tension: {
      label: "屏息",
      chords: [[38, 45, 50, 53], [38, 44, 50, 53], [37, 44, 49, 52], [38, 45, 49, 52]],
      scale: [50, 53, 56, 57, 60, 62, 65, 68],
      padGain: 0.12,
      bellGain: 0.06,
      air: 0.045,
      airFreq: 300,
      chordDur: 9,
      bellRate: 0.22
    },
    glow: {
      label: "暖光",
      chords: [[55, 62, 67, 71], [57, 64, 69, 72], [52, 59, 64, 69], [53, 60, 65, 69]],
      scale: [64, 67, 69, 71, 74, 76, 79, 83],
      padGain: 0.15,
      bellGain: 0.17,
      air: 0.035,
      airFreq: 1080,
      chordDur: 8.4,
      bellRate: 1
    }
  };

  var ctx = null;
  var master = null;
  var dryBus = null;
  var wetBus = null;
  var reverbInput = null;
  var airNode = null;
  var scheduler = null;
  var nextChordAt = 0;
  var chordStep = 0;
  var moodKey = null;
  var mood = null;
  var playing = false;
  var muted = false;
  var volume = 0.55;
  var unlockBound = false;

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function ensureContext() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      return null;
    }

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    dryBus = ctx.createGain();
    dryBus.gain.value = 0.78;
    dryBus.connect(master);

    var convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(3.6, 2.6);
    reverbInput = convolver;
    wetBus = ctx.createGain();
    wetBus.gain.value = 0.5;
    convolver.connect(wetBus);
    wetBus.connect(master);

    return ctx;
  }

  function makeImpulse(seconds, decay) {
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function makeNoiseBuffer(seconds) {
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      var last = 0;
      for (var i = 0; i < len; i++) {
        var white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
    }
    return buf;
  }

  function schedulePad(notes, at, dur) {
    if (!mood) return;
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(760, at);
    filter.frequency.linearRampToValueAtTime(1500, at + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(900, at + dur);
    filter.Q.value = 0.6;

    var out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.linearRampToValueAtTime(mood.padGain, at + dur * 0.38);
    out.gain.setValueAtTime(mood.padGain, at + dur * 0.62);
    out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    filter.connect(out);
    out.connect(dryBus);
    if (reverbInput) out.connect(reverbInput);

    notes.forEach(function (m) {
      [-4, 4].forEach(function (cents, i) {
        var osc = ctx.createOscillator();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.value = midiToFreq(m);
        osc.detune.value = cents;
        osc.connect(filter);
        osc.start(at);
        osc.stop(at + dur + 0.4);
      });
    });
  }

  function scheduleBell(m, at, vel) {
    if (!mood) return;
    var osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = midiToFreq(m);

    var partial = ctx.createOscillator();
    partial.type = "sine";
    partial.frequency.value = midiToFreq(m) * 2.01;

    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(mood.bellGain * (vel || 1), at + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 3.4);

    var partialGain = ctx.createGain();
    partialGain.gain.value = 0.32;

    osc.connect(env);
    partial.connect(partialGain);
    partialGain.connect(env);
    env.connect(dryBus);
    if (reverbInput) env.connect(reverbInput);

    osc.start(at);
    partial.start(at);
    osc.stop(at + 3.6);
    partial.stop(at + 3.6);
  }

  function startAir() {
    if (!mood || airNode) return;
    var src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(6);
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = mood.airFreq;
    var gain = ctx.createGain();
    gain.gain.value = mood.air;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    airNode = { src: src, gain: gain };
  }

  function scheduleAhead() {
    if (!playing || !ctx || !mood) return;
    var horizon = ctx.currentTime + 3;
    while (nextChordAt < horizon) {
      var chord = mood.chords[chordStep % mood.chords.length];
      schedulePad(chord, nextChordAt, mood.chordDur * 1.08);

      if (Math.random() < mood.bellRate) {
        var count = 1 + (Math.random() < 0.4 ? 1 : 0);
        for (var i = 0; i < count; i++) {
          var offset = 1.2 + Math.random() * (mood.chordDur - 1.8);
          var note = mood.scale[Math.floor(Math.random() * mood.scale.length)];
          scheduleBell(note + 12, nextChordAt + offset, 0.6 + Math.random() * 0.5);
        }
      }

      nextChordAt += mood.chordDur;
      chordStep += 1;
    }
  }

  function fade(to, seconds) {
    if (!ctx || !master) return;
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.linearRampToValueAtTime(Math.max(to, 0.0001), now + seconds);
  }

  function targetGain() {
    return muted ? 0.0001 : volume;
  }

  function unlock(fn) {
    if (!ctx || ctx.state === "running") {
      if (fn) fn();
      return;
    }
    ctx.resume().then(function () {
      if (fn) fn();
    }).catch(function () {});
  }

  function bindUnlock() {
    if (unlockBound) return;
    unlockBound = true;
    var handler = function () {
      unlock(function () {
        if (playing) fade(targetGain(), 1.2);
      });
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };
    window.addEventListener("pointerdown", handler, { passive: true });
    window.addEventListener("keydown", handler);
    window.addEventListener("touchstart", handler, { passive: true });
  }

  /**
   * 开始播放某个氛围。
   * `fadeSeconds` 不传时沿用旧的 0.6s 淡出 / 2.6s 淡入；
   * 剧场模式在场景切换时会传一个稍长的值，让换场像一次呼吸而不是一次切断。
   */
  function start(key, fadeSeconds) {
    if (!MOODS[key]) key = "sea";
    ensureContext();
    if (!ctx) return false;
    if (playing && moodKey === key) {
      unlock(function () { fade(targetGain(), 1.2); });
      return true;
    }

    var inFade = fadeSeconds ? fadeSeconds : 2.6;
    var outFade = fadeSeconds ? Math.max(0.8, fadeSeconds * 0.6) : 0.6;
    if (playing) stop(outFade);

    moodKey = key;
    mood = MOODS[key];
    chordStep = 0;
    nextChordAt = ctx.currentTime + 0.12;
    playing = true;

    startAir();
    if (airNode) {
      airNode.gain.gain.cancelScheduledValues(ctx.currentTime);
      airNode.gain.gain.linearRampToValueAtTime(mood.air, ctx.currentTime + 2.5);
    }

    scheduleAhead();
    clearInterval(scheduler);
    scheduler = setInterval(scheduleAhead, 400);

    unlock(function () { fade(targetGain(), inFade); });
    bindUnlock();
    return true;
  }

  function stop(fadeSeconds) {
    playing = false;
    clearInterval(scheduler);
    scheduler = null;
    fade(0.0001, fadeSeconds == null ? 1.6 : fadeSeconds);
    if (airNode && ctx) {
      try {
        airNode.gain.gain.cancelScheduledValues(ctx.currentTime);
        airNode.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + (fadeSeconds || 1.6));
        airNode.src.stop(ctx.currentTime + (fadeSeconds || 1.6) + 0.2);
      } catch (e) {}
      airNode = null;
    }
  }

  function toggle(key) {
    if (playing) {
      stop();
      return false;
    }
    return start(key || moodKey || "sea");
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (playing) fade(targetGain(), 0.35);
  }

  function setMuted(m) {
    muted = !!m;
    if (playing) fade(targetGain(), 0.35);
  }

  window.QJMusic = {
    moods: MOODS,
    start: start,
    stop: stop,
    toggle: toggle,
    setVolume: setVolume,
    getVolume: function () { return volume; },
    setMuted: setMuted,
    isMuted: function () { return muted; },
    isPlaying: function () { return playing; },
    isRunning: function () { return !!(ctx && ctx.state === "running"); },
    currentMood: function () { return moodKey; },
    unlock: unlock
  };
})();
