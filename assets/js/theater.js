/*
 * 琳嘉女孩 同人馆 · 剧场模式（Galgame 式沉浸阅读）
 * ---------------------------------------------------------------
 * 把当前章节的每一段文字拆成若干句，每段配一张背景图，
 * 以对白框 + 打字机 + 背景交叉淡入的方式逐句播放。
 *
 * 场景配置来自 data/scenes.json：
 *   books[bookId].mood              配乐氛围
 *   books[bookId].bgm               可选真实音频（优先于 mood）
 *   books[bookId].cast              角色名（未配置 speakers 时 cast[0] 用于引号台词）
 *   books[bookId].backgrounds       通用背景池
 *   books[bookId].chapters["1"]     某一章的逐段背景（优先）
 *   books[bookId].speakers["1"]["3"] 可选的逐段说话人覆盖（null 表示旁白）
 *
 * chapters 支持两种写法：
 *   1. 数组 ["a", "b", "c"]：一段文字一张图（旧格式）；
 *   2. 对象 { "scenes": [{ img, from, to, name, mood, bgm }] }：按「场景」
 *      合并若干段文字，每个场景一张图，并可带自己的标题与配乐（新格式，
 *      《清晨的色彩》用它实现逐场景配图 / 逐场景换曲）。
 */
(function () {
  "use strict";

  var DEFAULT_POOL = ["sea-fog-coast", "bookstore-cozy", "starry-sky", "mountain-village", "coffee-table", "tower-cloudy", "city-rain-night", "ocean-sunset"];

  var state = {
    open: false,
    scenes: [],
    flat: [],
    index: 0,
    typing: false,
    typeTimer: null,
    auto: false,
    autoTimer: null,
    activeLayer: "a",
    currentImage: "",
    currentScene: -1,
    chapterTitle: "",
    musicOff: false,
    data: null,
    cfg: null,
    chapterIndex: 1,
    totalChapters: 1,
    ended: false
  };

  var el = {};
  var scenesConfig = null;
  var configPromise = null;
  var booted = false;

  /* ------------------------------ 工具 ------------------------------ */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function splitLines(text) {
    var raw = String(text || "").trim();
    if (!raw) return [];
    var parts = raw.match(/[^。！？!?…；;]+[。！？!?…；;]?/g) || [raw];
    var lines = [];
    var buf = "";
    var softMax = 44;

    parts.forEach(function (part) {
      part = part.trim();
      if (!part) return;
      if (!buf) {
        buf = part;
      } else if (buf.length + part.length <= softMax) {
        buf += part;
      } else {
        lines.push(buf);
        buf = part;
      }
    });
    if (buf) lines.push(buf);

    // 避免出现孤零零的一两个字作为最后一句
    if (lines.length > 1 && lines[lines.length - 1].length < 6) {
      lines[lines.length - 2] += lines.pop();
    }
    return lines;
  }

  function speakerOf(line, cast, override) {
    var t = String(line || "").trim();
    var lead = t.replace(/^[\s"'「」『』“”]+/, "");
    var isDialogue = /^[“「『]/.test(t) || /^[^：:]{1,8}[：:]/.test(lead);
    if (!isDialogue) return "";
    if (override !== undefined) return override || "";
    return (cast && cast[0]) || "";
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
  }

  function loadConfig() {
    if (configPromise) return configPromise;
    configPromise = fetch((window.QJ && window.QJ.base ? window.QJ.base : "") + "data/scenes.json")
      .then(function (r) {
        if (!r.ok) throw new Error("scenes.json 加载失败");
        return r.json();
      })
      .catch(function () {
        return { imageBase: "assets/images/scenes/", books: {} };
      });
    return configPromise;
  }

  /* ------------------------------ DOM ------------------------------ */

  function buildDom() {
    if (el.root) return;
    var root = document.createElement("div");
    root.className = "theater";
    root.setAttribute("data-theater", "");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML =
      '<div class="theater-stage">' +
        '<div class="theater-bg is-active" data-bg="a"></div>' +
        '<div class="theater-bg" data-bg="b"></div>' +
      '</div>' +
      '<div class="theater-grain"></div>' +
      '<header class="theater-hud">' +
        '<div class="theater-id">' +
          '<span class="theater-kicker">沉浸剧场</span>' +
          '<span class="theater-book" data-t-book></span>' +
          '<span class="theater-chapter" data-t-chapter></span>' +
          '<span class="theater-scene" data-t-scene></span>' +
        '</div>' +
        '<div class="theater-tools">' +
          '<button class="theater-btn" data-t-music type="button" title="背景音乐（M）">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
            '<span data-t-music-label>音乐</span>' +
          '</button>' +
          '<label class="theater-vol" title="音量">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>' +
            '<input type="range" min="0" max="100" value="55" data-t-volume aria-label="音量">' +
          '</label>' +
          '<button class="theater-btn" data-t-auto type="button" title="自动播放（A）">自动</button>' +
          '<button class="theater-btn theater-btn-ghost" data-t-exit type="button" title="退出（Esc）">退出</button>' +
        '</div>' +
      '</header>' +
      '<div class="theater-progress"><span data-t-bar></span></div>' +
      '<div class="theater-bottom">' +
        '<div class="theater-dialogue" data-t-dialogue>' +
          '<div class="theater-name" data-t-name></div>' +
          '<p class="theater-text" data-t-text></p>' +
          '<div class="theater-dialogue-foot">' +
            '<button class="theater-link" data-t-prev type="button">← 上一句</button>' +
            '<span class="theater-count" data-t-count></span>' +
            '<button class="theater-link" data-t-next type="button">下一句 →</button>' +
          '</div>' +
          '<span class="theater-next-dot" data-t-dot>▾</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    el.root = root;
    el.bgA = root.querySelector('[data-bg="a"]');
    el.bgB = root.querySelector('[data-bg="b"]');
    el.book = root.querySelector("[data-t-book]");
    el.chapter = root.querySelector("[data-t-chapter]");
    el.scene = root.querySelector("[data-t-scene]");
    el.bar = root.querySelector("[data-t-bar]");
    el.dialogue = root.querySelector("[data-t-dialogue]");
    el.name = root.querySelector("[data-t-name]");
    el.text = root.querySelector("[data-t-text]");
    el.count = root.querySelector("[data-t-count]");
    el.dot = root.querySelector("[data-t-dot]");
    el.music = root.querySelector("[data-t-music]");
    el.musicLabel = root.querySelector("[data-t-music-label]");
    el.volume = root.querySelector("[data-t-volume]");
    el.auto = root.querySelector("[data-t-auto]");
    el.exit = root.querySelector("[data-t-exit]");
    el.prev = root.querySelector("[data-t-prev]");
    el.next = root.querySelector("[data-t-next]");

    bindEvents();
  }

  /* ------------------------------ 场景构建 ------------------------------ */

  /**
   * 把某一章的配置摊平成「第 n 段文字属于哪个场景」。
   * 返回的数组长度等于段落数；元素是场景配置对象（含 img）。
   */
  function buildPlan(chapterBgs, pool, paragraphCount) {
    var plan = [];
    var i;

    if (Array.isArray(chapterBgs)) {
      for (i = 0; i < paragraphCount; i++) {
        var key = chapterBgs[i] || pool[i % pool.length];
        plan.push({ img: key });
      }
      return plan;
    }

    if (chapterBgs && Array.isArray(chapterBgs.scenes)) {
      var cursor = 0;
      chapterBgs.scenes.forEach(function (s) {
        var from = s.from == null ? cursor : s.from;
        var to = s.to == null ? from : s.to;
        for (i = Math.max(0, from); i <= to; i++) plan[i] = s;
        cursor = to + 1;
      });
      return plan;
    }

    return null;
  }

  function buildScenes(ready) {
    var book = ready.book;
    var ch = ready.chapter;
    var cfg = (scenesConfig.books && scenesConfig.books[book.id]) || {};
    var pool = cfg.backgrounds && cfg.backgrounds.length ? cfg.backgrounds : DEFAULT_POOL;
    var chapterBgs = (cfg.chapters && cfg.chapters[String(ready.chapterIndex)]) || null;
    var chapterSpeakers = (cfg.speakers && cfg.speakers[String(ready.chapterIndex)]) || null;
    var imageBase = scenesConfig.imageBase || "assets/images/scenes/";
    var paragraphs = ch.paragraphs || [];
    var plan = buildPlan(chapterBgs, pool, paragraphs.length);

    var scenes = [];
    var lastEntry = null;

    paragraphs.forEach(function (p, pi) {
      var entry = (plan && plan[pi]) || { img: pool[pi % pool.length] };
      var key = entry.img || entry.key || pool[pi % pool.length];
      var hasSpeaker = hasOwn(chapterSpeakers, String(pi));
      var lines = splitLines(p).map(function (line) {
        return { text: line, speaker: speakerOf(line, cfg.cast, hasSpeaker ? chapterSpeakers[String(pi)] : undefined) };
      });
      if (!lines.length) return;

      // 同一个场景配置连续覆盖若干段文字时，合并成同一个「幕」，
      // 这样背景不会来回闪，场景标题也只在进入时出现一次。
      if (lastEntry === entry && scenes.length) {
        scenes[scenes.length - 1].lines = scenes[scenes.length - 1].lines.concat(lines);
        return;
      }

      lastEntry = entry;
      scenes.push({
        image: imageBase + key + ".jpg",
        key: key,
        name: entry.name || "",
        mood: entry.mood || "",
        bgm: entry.bgm || "",
        musicStyle: entry.musicStyle || "",
        lines: lines
      });
    });

    if (!scenes.length) scenes.push({ image: imageBase + pool[0] + ".jpg", key: pool[0], lines: [{ text: "这一章还没有可展示的文字。", speaker: "" }] });

    var flat = [];
    scenes.forEach(function (scene, si) {
      scene.lines.forEach(function (line, li) {
        flat.push({ scene: si, line: li, text: line.text, speaker: line.speaker });
      });
    });

    state.scenes = scenes;
    state.flat = flat;
    state.cfg = cfg;
    state.index = 0;
    state.ended = false;
    state.currentImage = "";
    state.currentScene = -1;
    state.chapterTitle = (chapterBgs && chapterBgs.title) || "";
  }

  function preload(key) {
    var src = (scenesConfig.imageBase || "assets/images/scenes/") + key + ".jpg";
    var img = new Image();
    img.src = src;
  }

  /* ------------------------------ 渲染 ------------------------------ */

  function setBackground(src) {
    if (!src || src === state.currentImage) return;
    var incoming = state.activeLayer === "a" ? el.bgB : el.bgA;
    var outgoing = state.activeLayer === "a" ? el.bgA : el.bgB;
    incoming.style.backgroundImage = 'url("' + src.replace(/"/g, '\\"') + '")';
    incoming.classList.add("is-active");
    outgoing.classList.remove("is-active");
    state.activeLayer = state.activeLayer === "a" ? "b" : "a";
    state.currentImage = src;
  }

  function updateHud() {
    var ready = window.QJ_READY;
    if (!ready) return;
    el.book.textContent = ready.book.title;
    el.chapter.textContent = state.chapterTitle || ready.chapter.title;
    el.count.textContent = (state.index + 1) + " / " + state.flat.length;
    el.bar.style.width = ((state.index + 1) / state.flat.length * 100).toFixed(2) + "%";
  }

  function moodLabel(key) {
    var moods = (window.QJMusic && window.QJMusic.moods) || {};
    return (moods[key] && moods[key].label) || "";
  }

  /** 进入新场景时更新场景标题，并按场景切换配乐。 */
  function enterScene(si) {
    if (si === state.currentScene) return;
    state.currentScene = si;

    var scene = state.scenes[si];
    if (el.scene) {
      // 真实音频（自己挑的曲子）优先于合成氛围，标签也就跟着改口
     var title = (scene && scene.name) || "";
      var label = scene && scene.bgm
        ? "自选曲目"
        : (scene && scene.mood ? moodLabel(scene.mood) : "");
      if (title) {
        el.scene.innerHTML =
          '<span class="theater-scene-idx">场景 ' + (si + 1) + ' ·</span>' +
          '<span class="theater-scene-name">' + esc(title) + '</span>' +
          (label
            ? '<span class="theater-scene-music" title="' + esc((scene && scene.musicStyle) || "") + '">♪ ' + esc(label) + "</span>"
            : "");
      } else {
        el.scene.textContent = "";
      }
      el.scene.classList.remove("is-in");
      void el.scene.offsetWidth;
      if (title) el.scene.classList.add("is-in");
    }

    if (!state.ended) applySceneAudio();
  }

  function typeText(text) {
    clearInterval(state.typeTimer);
    state.typing = true;
    el.dot.classList.remove("show");
    el.text.textContent = "";
    var i = 0;
    var step = text.length > 60 ? 2 : 1;
    state.typeTimer = setInterval(function () {
      i += step;
      el.text.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(state.typeTimer);
        state.typing = false;
        el.dot.classList.add("show");
        scheduleAuto();
      }
    }, 52);
  }

  function renderLine(instant) {
    var item = state.flat[state.index];
    if (!item) return;
    var scene = state.scenes[item.scene];
    enterScene(item.scene);
    setBackground(scene.image);
    updateHud();

    el.dialogue.classList.remove("line-in");
    void el.dialogue.offsetWidth;
    el.dialogue.classList.add("line-in");

    el.name.textContent = item.speaker || "旁白";
    el.name.classList.toggle("is-narration", !item.speaker);
    el.prev.classList.toggle("is-disabled", state.index <= 0);

    if (instant) {
      clearInterval(state.typeTimer);
      state.typing = false;
      el.text.textContent = item.text;
      el.dot.classList.add("show");
      scheduleAuto();
    } else {
      typeText(item.text);
    }

    // 预加载下一张背景
    var next = state.flat[state.index + 1];
    if (next) preload(state.scenes[next.scene].key);
  }

  function clearAuto() {
    clearTimeout(state.autoTimer);
    state.autoTimer = null;
  }

  function scheduleAuto() {
    clearAuto();
    if (!state.auto || state.ended) return;
    var item = state.flat[state.index];
    var wait = Math.max(2600, Math.min(9200, 1300 + (item ? item.text.length : 20) * 95));
    state.autoTimer = setTimeout(function () {
      advance();
    }, wait);
  }

  function advance() {
    if (state.ended) return;
    clearAuto();
    if (state.typing) {
      clearInterval(state.typeTimer);
      state.typing = false;
      el.text.textContent = state.flat[state.index].text;
      el.dot.classList.add("show");
      scheduleAuto();
      return;
    }
    if (state.index < state.flat.length - 1) {
      state.index += 1;
      renderLine(false);
    } else {
      showEnding();
    }
  }

  function back() {
    if (state.ended) {
      state.ended = false;
      el.dialogue.classList.remove("is-ending");
      renderLine(true);
      return;
    }
    clearAuto();
    if (state.index > 0) {
      state.index -= 1;
      renderLine(true);
    }
  }

  function showEnding() {
    state.ended = true;
    clearAuto();
    var ready = window.QJ_READY;
    var hasNext = ready && ready.chapterIndex < ready.totalChapters;
    var nextHref = hasNext
      ? window.QJ.base + "read.html?id=" + encodeURIComponent(ready.book.id) + "&c=" + (ready.chapterIndex + 1) + "&mode=theater"
      : window.QJ.base + "book.html?id=" + encodeURIComponent(ready.book.id);
    var nextText = hasNext ? "下一章 →" : "返回作品页";

    el.name.textContent = ready ? ready.book.title : "";
    el.name.classList.remove("is-narration");
    el.text.innerHTML =
      '<span class="theater-fin">本章完</span>' +
      '<span class="theater-fin-sub">' + esc(ready ? ready.chapter.title : "") + '</span>';
    el.dot.classList.remove("show");
    el.dialogue.classList.add("is-ending");
    el.count.textContent = "完结";
    el.bar.style.width = "100%";
    el.dialogue.querySelector(".theater-dialogue-foot").innerHTML =
      '<button class="theater-link" data-t-replay type="button">↺ 重播本章</button>' +
      '<a class="theater-link" href="' + nextHref + '">' + nextText + '</a>';
    el.dialogue.querySelector("[data-t-replay]").addEventListener("click", replay);
  }

  function replay() {
    var foot = el.dialogue.querySelector(".theater-dialogue-foot");
    foot.innerHTML =
      '<button class="theater-link" data-t-prev type="button">← 上一句</button>' +
      '<span class="theater-count" data-t-count></span>' +
      '<button class="theater-link" data-t-next type="button">下一句 →</button>';
    el.count = foot.querySelector("[data-t-count]");
    el.prev = foot.querySelector("[data-t-prev]");
    el.next = foot.querySelector("[data-t-next]");
    bindNav();
    state.ended = false;
    state.index = 0;
    el.dialogue.classList.remove("is-ending");
    renderLine(false);
  }

  /* ------------------------------ 音乐 ------------------------------ */

  var bgmAudio = null;   // 当前正在播放的真实音频文件
  var bgmTimers = [];    // 淡入 / 淡出用的定时器

  function musicPlaying() {
    return (bgmAudio && !bgmAudio.paused) ||
      (window.QJMusic && window.QJMusic.isPlaying() && window.QJMusic.isRunning());
  }

  function updateMusicUi() {
    var on = musicPlaying();
    var pending = !on && window.QJMusic && window.QJMusic.isPlaying() && !window.QJMusic.isRunning();
    el.music.classList.toggle("is-on", !!on);
    el.musicLabel.textContent = on ? "音乐开" : (pending ? "音乐待启" : "音乐关");
    el.root.classList.toggle("has-music", !!on);
  }

  function refreshMusicSoon() {
    var n = 0;
    var timer = setInterval(function () {
      updateMusicUi();
      if (musicPlaying() || ++n > 12) clearInterval(timer);
    }, 200);
  }

  function clearBgmTimers() {
    bgmTimers.forEach(clearInterval);
    bgmTimers = [];
  }

  function fadeOutFile(audio, seconds) {
    var from = audio.volume || 0;
    var steps = Math.max(1, Math.round((seconds || 1.2) * 20));
    var i = 0;
    var timer = setInterval(function () {
      i += 1;
      audio.volume = Math.max(0, from * (1 - i / steps));
      if (i >= steps) {
        clearInterval(timer);
        audio.pause();
      }
    }, 50);
    bgmTimers.push(timer);
  }

  function stopFile(seconds) {
    if (!bgmAudio) return;
    var audio = bgmAudio;
    bgmAudio = null;
    fadeOutFile(audio, seconds);
  }

  function fallbackMood(scene) {
    return (scene && scene.mood) || (state.cfg && state.cfg.mood) || "sea";
  }

  function playFile(src, scene) {
    if (bgmAudio && bgmAudio.dataset.src === src) {
      var resume = bgmAudio.play();
      if (resume && resume.catch) resume.catch(function () { /* 等用户手势 */ });
      return;
    }

    stopFile(1.2);
    if (window.QJMusic) window.QJMusic.stop(0.9);

    var audio = new Audio(src);
    audio.dataset.src = src;
    audio.loop = true;
    var target = window.QJMusic ? window.QJMusic.getVolume() : 0.55;
    audio.volume = 0.0001;
    audio.addEventListener("error", function () {
      if (bgmAudio === audio) bgmAudio = null;
      if (!state.musicOff && window.QJMusic) window.QJMusic.start(fallbackMood(scene), 1.8);
      updateMusicUi();
    });
    bgmAudio = audio;

    var played = audio.play();
    if (played && played.catch) played.catch(function () { /* 浏览器要求先有用户手势 */ });

    var steps = 30;
    var i = 0;
    var timer = setInterval(function () {
      i += 1;
      audio.volume = Math.min(target, target * (i / steps));
      if (i >= steps) clearInterval(timer);
    }, 50);
    bgmTimers.push(timer);
  }

  /**
   * 按当前场景决定听什么：场景 / 整本书指定了真实音频就放文件，
   * 否则切成这个场景对应的实时合成氛围；用户手动关掉音乐时不打扰他。
   */
  function applySceneAudio(force) {
    if (state.musicOff && !force) return;
    var scene = state.scenes[state.currentScene] || null;
    var bgm = (scene && scene.bgm) || (state.cfg && state.cfg.bgm) || "";
    if (bgm) {
      playFile((window.QJ.base || "") + bgm, scene);
    } else {
      stopFile(1.2);
      var mood = fallbackMood(scene);
      if (window.QJMusic) window.QJMusic.start(mood, 1.8);
    }
    updateMusicUi();
  }

  function hardStopFile() {
    if (!bgmAudio) return;
    var audio = bgmAudio;
    bgmAudio = null;
    audio.pause();
  }

  function stopMusic(immediate) {
    state.musicOff = true;
    if (immediate) hardStopFile();
    else stopFile(0.9);
    if (window.QJMusic) window.QJMusic.stop(1.2);
  }

  function startMusic() {
    state.musicOff = false;
    applySceneAudio(true);
    updateMusicUi();
  }

  /* ------------------------------ 开关 ------------------------------ */

  function open() {
    var ready = window.QJ_READY;
    if (!ready) return;
    buildDom();
    state.chapterIndex = ready.chapterIndex;
    state.totalChapters = ready.totalChapters;
    state.musicOff = false;
    buildScenes(ready);

    var jump = parseInt(new URLSearchParams(window.location.search).get("line") || "", 10);
    if (jump > 0) state.index = Math.min(state.flat.length - 1, jump - 1);

    state.open = true;
    el.root.classList.add("open");
    el.root.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll", "theater-open");

    renderLine(false);
    startMusic();
    updateMusicUi();
    refreshMusicSoon();
    el.volume.value = String(Math.round((window.QJMusic ? window.QJMusic.getVolume() : 0.55) * 100));
    setTimeout(function () { el.root.classList.add("ready"); }, 30);
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    clearAuto();
    clearInterval(state.typeTimer);
    stopMusic(true);
    clearBgmTimers();
    el.root.classList.remove("open", "ready", "has-music");
    el.root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll", "theater-open");
  }

  function toggle() {
    if (state.open) close();
    else open();
  }

  /* ------------------------------ 事件 ------------------------------ */

  function bindNav() {
    if (el.next) el.next.addEventListener("click", function (e) { e.stopPropagation(); advance(); });
    if (el.prev) el.prev.addEventListener("click", function (e) { e.stopPropagation(); back(); });
  }

  function bindEvents() {
    el.root.addEventListener("click", function (e) {
      if (e.target.closest("button, a, input, label")) return;
      if (state.ended) return;
      advance();
    });

    // 浏览器要求用户手势后才能播放声音：首次交互后刷新一次音乐状态
    el.root.addEventListener("pointerdown", function () {
      setTimeout(updateMusicUi, 200);
    }, { passive: true });

    bindNav();

    el.exit.addEventListener("click", function (e) { e.stopPropagation(); close(); });
    el.music.addEventListener("click", function (e) {
      e.stopPropagation();
      if (musicPlaying()) stopMusic();
      else startMusic();
      updateMusicUi();
      refreshMusicSoon();
    });
    el.volume.addEventListener("input", function () {
      var v = Number(el.volume.value) / 100;
      if (bgmAudio) bgmAudio.volume = v;
      if (window.QJMusic) window.QJMusic.setVolume(v);
    });
    el.volume.addEventListener("click", function (e) { e.stopPropagation(); });
    el.auto.addEventListener("click", function (e) {
      e.stopPropagation();
      state.auto = !state.auto;
      el.auto.classList.toggle("is-on", state.auto);
      el.auto.textContent = state.auto ? "自动中" : "自动";
      if (state.auto) scheduleAuto();
      else clearAuto();
    });

    document.addEventListener("keydown", function (e) {
      if (!state.open) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        back();
      } else if (e.key === "m" || e.key === "M") {
        if (musicPlaying()) stopMusic();
        else startMusic();
        updateMusicUi();
        refreshMusicSoon();
      } else if (e.key === "a" || e.key === "A") {
        el.auto.click();
      }
    });

    var touchX = 0;
    el.root.addEventListener("touchstart", function (e) {
      touchX = e.changedTouches[0].clientX;
    }, { passive: true });
    el.root.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) < 60) return;
      if (dx < 0) advance();
      else back();
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      if (!state.open) return;
      var v = document.hidden ? 0.12 : Number(el.volume.value) / 100;
      if (bgmAudio) bgmAudio.volume = v;
      if (window.QJMusic) window.QJMusic.setVolume(v);
    });
  }

  function bindOpeners() {
    document.querySelectorAll("[data-theater-open]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        open();
      });
    });
  }

  function autoOpen() {
    var q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "theater" || window.location.hash === "#theater") open();
  }

  function boot(ready) {
    if (booted) {
      autoOpen();
      return;
    }
    loadConfig().then(function (cfg) {
      booted = true;
      scenesConfig = cfg;
      buildDom();
      bindOpeners();
      autoOpen();
    });
  }

  document.addEventListener("qj:ready", function (e) {
    boot(e.detail);
  });

  document.addEventListener("DOMContentLoaded", function () {
    if (window.QJ_READY) boot(window.QJ_READY);
  });

  window.QJTheater = {
    open: open,
    close: close,
    toggle: toggle,
    isOpen: function () { return state.open; },
    advance: advance,
    back: back
  };
})();
