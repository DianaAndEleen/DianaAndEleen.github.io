/**
 * 琳嘉女孩 同人馆 · 站内背景音乐（浏览页）
 *
 * - 只在首页 / 书库 / 作品页加载；阅读页（read.html）不加载，避免和剧场模式配乐打架。
 * - 《江南春色》《枝江》两首轮播：一首快放完时与下一首交叉淡入淡出，中间不留空档。
 * - 浏览器会拦自动播放，被拦下时左下角的小按钮点一下就能开始（之后会记住选择）。
 * - 跨页续播：翻页后从上次的进度接着放，而不是从头重来。
 */
(function () {
  "use strict";

  var TRACKS = window.__BGM_TRACKS || [
    { src: "assets/audio/jiangnan-chunshe.mp3", title: "江南春色" },
    { src: "assets/audio/zhijiang.mp3", title: "枝江" }
  ];

  var VOLUME = 0.32;            // 平时音量
  var FADE = 1.8;               // 交叉淡入淡出时长（秒）
  var TICK = 100;               // 音量渐变步长（毫秒）
  var PREF_KEY = "linjia-bgm";     // 记住开关
  var POS_KEY = "linjia-bgm-pos";  // 记住播放进度
  var FRESH = 10 * 60 * 1000;      // 跨页续播的有效期

  var ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  var ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M3 3l18 18"/></svg>';

  var base = window.__BASE__ || "";
  var players = [];

  var index = readPos().index;
  var fading = false;
  var timer = null;
  var wantPlay = readPref();   // 用户是否希望有音乐
  var blocked = false;         // 被浏览器拦下，等待一次点击
  var btn = null;

  /* ------------------------------------------------------------ 记忆 */

  function readPref() {
    try { return localStorage.getItem(PREF_KEY) !== "off"; } catch (e) { return true; }
  }
  function writePref(on) {
    try { localStorage.setItem(PREF_KEY, on ? "on" : "off"); } catch (e) {}
  }
  function readPos() {
    try {
      var raw = JSON.parse(sessionStorage.getItem(POS_KEY) || "null");
      if (!raw || Date.now() - raw.at > FRESH) return { index: 0, time: 0 };
      return { index: raw.i === 1 ? 1 : 0, time: raw.t + (Date.now() - raw.at) / 1000 };
    } catch (e) {
      return { index: 0, time: 0 };
    }
  }
  function savePos() {
    try {
      sessionStorage.setItem(POS_KEY, JSON.stringify({
        i: index,
        t: players[index].currentTime || 0,
        at: Date.now()
      }));
    } catch (e) {}
  }

  /* ------------------------------------------------------------ 播放 */

  function resumeOffset(audio) {
    var saved = readPos();
    if (audio.dataset.resumed) return;
    audio.dataset.resumed = "1";
    if (saved.index !== index || !saved.time) return;
    var apply = function () {
      if (audio.duration && saved.time < audio.duration - 2) audio.currentTime = saved.time;
    };
    if (audio.readyState >= 1) apply();
    else audio.addEventListener("loadedmetadata", apply, { once: true });
  }

  function start(fromGesture) {
    wantPlay = true;
    writePref(true);
    if (fromGesture) blocked = false;
    var active = players[index];
    active.volume = VOLUME;
    resumeOffset(active);
    var attempt = active.play();
    if (attempt && attempt.catch) {
      attempt.catch(function () {
        // 浏览器要求先有用户手势，等第一次点击/按键
        blocked = true;
        paint();
        armGesture();
      });
    }
    loop();
    paint();
  }

  function stop() {
    wantPlay = false;
    writePref(false);
    fading = false;
    clearInterval(timer);
    timer = null;
    players.forEach(function (a) {
      a.pause();
      a.volume = 0;
    });
    paint();
  }

  function advance() {
    var previous = players[index];
    previous.volume = 0;
    previous.pause();
    index = 1 - index;
    fading = false;
    var next = players[index];
    try { next.currentTime = 0; } catch (e) {}
    next.volume = VOLUME;
    var attempt = next.play();
    if (attempt && attempt.catch) attempt.catch(function () {});
    paint();
  }

  // 一首快放完时，和下一首做交叉淡入淡出
  function loop() {
    clearInterval(timer);
    timer = setInterval(function () {
      if (!wantPlay) return;
      var current = players[index];
      var next = players[1 - index];
      var duration = current.duration;
      if (!duration || !isFinite(duration)) return;
      var remain = duration - current.currentTime;

      if (!fading && remain <= FADE && remain > 0) {
        fading = true;
        try { next.currentTime = 0; } catch (e) {}
        next.volume = 0;
        var attempt = next.play();
        if (attempt && attempt.catch) attempt.catch(function () {});
      }

      if (!fading) return;
      var step = (TICK / 1000) / FADE;
      current.volume = Math.max(0, current.volume - step * VOLUME);
      next.volume = Math.min(VOLUME, next.volume + step * VOLUME);
      if (current.volume <= 0.005 || next.volume >= VOLUME - 0.005) {
        current.volume = 0;
        current.pause();
        try { current.currentTime = 0; } catch (e) {}
        next.volume = VOLUME;
        index = 1 - index;
        fading = false;
        paint();
      }
    }, TICK);
  }

  function armGesture() {
    if (armGesture.armed) return;
    armGesture.armed = true;
    var once = function () {
      armGesture.armed = false;
      document.removeEventListener("pointerdown", once);
      document.removeEventListener("keydown", once);
      if (wantPlay) start(true);
    };
    document.addEventListener("pointerdown", once);
    document.addEventListener("keydown", once);
  }

  /* -------------------------------------------------------------- UI */

  function paint() {
    if (!btn) return;
    var label;
    if (!wantPlay) label = "背景音乐";
    else if (blocked) label = "点击播放";
    else label = TRACKS[index].title;
    btn.querySelector(".bgm-label").textContent = label;
    btn.querySelector(".bgm-icon").innerHTML = wantPlay && !blocked ? ICON_ON : ICON_OFF;
    btn.classList.toggle("is-playing", wantPlay && !blocked);
    btn.setAttribute("aria-label", wantPlay && !blocked ? "暂停背景音乐" : "播放背景音乐");
    btn.title = !wantPlay
      ? "播放背景音乐"
      : blocked
        ? "点击播放背景音乐"
        : "背景音乐：" + TRACKS[index].title + "（点击暂停）";
  }

  function makeButton() {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bgm-btn";
    btn.innerHTML = '<span class="bgm-icon"></span><span class="bgm-label"></span>';
    btn.addEventListener("click", function () {
      if (wantPlay && !blocked) stop();
      else start(true);
    });
    document.body.appendChild(btn);
    paint();
  }

  /* ------------------------------------------------------------ 启动 */

  // 两首曲子各用一个 <audio>，挂在页面上（不显示），方便互相交叉淡入淡出
  function createPlayers() {
    TRACKS.forEach(function (t) {
      var audio = document.createElement("audio");
      audio.className = "bgm-audio";
      audio.preload = "auto";
      audio.src = base + t.src;
      audio.volume = 0;
      document.body.appendChild(audio);
      players.push(audio);
    });
  }

  function init() {
    createPlayers();
    makeButton();
    players.forEach(function (a, i) {
      a.addEventListener("ended", function () {
        if (i === index && wantPlay && !fading) advance();
      });
    });
    if (!wantPlay) return;
    start(false);
  }

  // 播放进度跨页保存
  window.addEventListener("pagehide", savePos);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") savePos();
  });

  // 调试用：在控制台看当前播放状态
  window.__bgm = {
    state: function () {
      return {
        index: index,
        wantPlay: wantPlay,
        blocked: blocked,
        fading: fading,
        tracks: TRACKS.map(function (t, i) {
          return {
            title: t.title,
            paused: players[i].paused,
            volume: Number(players[i].volume.toFixed(3)),
            time: Number((players[i].currentTime || 0).toFixed(1)),
            duration: Number((players[i].duration || 0).toFixed(1))
          };
        })
      };
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
