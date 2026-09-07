(function () {
  "use strict";

  var FONT_KEY = "qingjian-font-scale";
  var DEF = 1.1;   // base px

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function fetchScale() {
    try {
      var v = Number(localStorage.getItem(FONT_KEY));
      if (v && v >= 0.8 && v <= 1.4) return v;
    } catch (e) {}
    return 1;
  }
  function storeScale(v) {
    try { localStorage.setItem(FONT_KEY, String(v)); } catch (e) {}
  }

  function applyFont(size) {
    var el = document.querySelector("[data-content]");
    if (el) el.style.fontSize = (DEF * size).toFixed(2) + "rem";
    var btn = document.querySelector("[data-font-label]");
    if (btn) btn.textContent = Math.round(size * 100) + "%";
  }

  function setFont(size) {
    window.QJ._fontSize = size;
    storeScale(size);
    applyFont(size);
  }

  function init() {
    var id = getParam("id");
    var c = Math.max(1, parseInt(getParam("c") || "1", 10) || 1);

    window.QJB.load().then(function (data) {
      var book = window.QJB.getBook(data, id);
      var root = document.querySelector("[data-reader]");
      if (!book) {
        root.innerHTML = '<div class="empty"><p>未找到这本书，请返回书库重试。</p><a class="btn btn-primary" href="library.html">返回书库</a></div>';
        return;
      }

      var total = book.chapters.length;
      c = Math.min(Math.max(c, 1), total);
      var ch = book.chapters[c - 1];

      document.title = ch.title + " · " + book.title;

      // Reader top
      document.querySelector("[data-back]").href = window.QJ.base + "book.html?id=" + encodeURIComponent(book.id);

      // Render content
      var panel = document.querySelector("[data-content]");
      var meta = document.querySelector("[data-chapter-meta]");
      var titleEl = document.querySelector("[data-chapter-title]");
      titleEl.textContent = ch.title;
      meta.innerHTML =
        '<span>' + window.QJ.esc(book.title) + '</span>' +
        '<span>作者 ' + window.QJ.esc(book.author) + '</span>' +
        '<span>' + window.QJ.fmtNum(window.QJB.chapterLength(ch)) + ' 字</span>';

      panel.innerHTML = (ch.paragraphs || []).map(function (p) {
        return "<p>" + window.QJ.esc(p) + "</p>";
      }).join("");

      applyFont(fetchScale());

      // Prev / next
      var prev = document.querySelector("[data-prev]");
      var next = document.querySelector("[data-next]");
      if (c <= 1) {
        prev.classList.add("disabled");
        prev.setAttribute("aria-disabled", "true");
        prev.href = "javascript:void(0)";
      } else {
        prev.href = window.QJ.base + "read.html?id=" + encodeURIComponent(book.id) + "&c=" + (c - 1);
      }
      if (c >= total) {
        next.innerHTML = "已读完 · 返回简介";
        next.href = window.QJ.base + "book.html?id=" + encodeURIComponent(book.id);
      } else {
        next.href = window.QJ.base + "read.html?id=" + encodeURIComponent(book.id) + "&c=" + (c + 1);
      }

      // TOC
      var tocList = document.querySelector("[data-toc-list]");
      tocList.innerHTML = book.chapters.map(function (x, i) {
        var active = (i + 1) === c ? " active" : "";
        return '<a class="toc-item' + active + '" href="' + window.QJ.base + 'read.html?id=' + encodeURIComponent(book.id) + '&c=' + (i + 1) + '">' +
          '<span>' + window.QJ.esc(x.title) + '</span></a>';
      }).join("");
      document.querySelector("[data-toc-title]").textContent = book.title + " · 目录";

      // controls
      document.querySelectorAll("[data-font-inc]").forEach(function (b) {
        b.addEventListener("click", function () { setFont(Math.min(1.4, (window.QJ._fontSize || 1) + 0.1)); });
      });
      document.querySelectorAll("[data-font-dec]").forEach(function (b) {
        b.addEventListener("click", function () { setFont(Math.max(0.8, (window.QJ._fontSize || 1) - 0.1)); });
      });

      var drawer = document.querySelector("[data-toc]");
      var overlay = document.querySelector("[data-overlay]");
      var openToc = function (on) {
        drawer.classList.toggle("open", on);
        overlay.classList.toggle("show", on);
        document.body.classList.toggle("no-scroll", on);
      };
      document.querySelectorAll("[data-toc-open]").forEach(function (b) {
        b.addEventListener("click", function () { openToc(true); });
      });
      overlay.addEventListener("click", function () { openToc(false); });
      document.querySelector("[data-toc-close]").addEventListener("click", function () { openToc(false); });

      // Progress marker
      window.scrollTo(0, 0);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
