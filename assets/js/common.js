(function () {
  "use strict";

  // ---- Global path base ----
  window.QJ = window.QJ || {};
  // Pages live at project root, so data/asset paths are relative to the doc.
  window.QJ.base = window.__BASE__ || "";

  window.QJ.settings = {
    themeKey: "qingjian-theme",
    fontScaleKey: "qingjian-font-scale",
  };

  // ---- Number formatting (Chinese style) ----
  window.QJ.fmtNum = function (n) {
    n = Number(n) || 0;
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, "") + "亿";
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "万";
    return n.toLocaleString("zh-CN");
  };

  window.QJ.fmtWords = function (n) {
    return window.QJ.fmtNum(n) + "字";
  };

  window.QJ.ratingText = function (book) {
    return book && Number(book.rating) > 0 ? "★ " + Number(book.rating).toFixed(1) : "新作";
  };

  window.QJ.dateText = function (value) {
    if (!value) return "";
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  };

  window.QJ.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  // ---- Theme ----
  window.QJ.applyTheme = function (theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(window.QJ.settings.themeKey, theme); } catch (e) {}
    var icons = document.querySelectorAll("[data-theme-toggle]");
    icons.forEach(function (b) {
      b.innerHTML = theme === "light"
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    });
  };

  window.QJ.initTheme = function () {
    var saved = null;
    try { saved = localStorage.getItem(window.QJ.settings.themeKey); } catch (e) {}
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = saved || (prefersDark ? "dark" : "light");
    window.QJ.applyTheme(theme);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cur = document.documentElement.getAttribute("data-theme");
        window.QJ.applyTheme(cur === "light" ? "dark" : "light");
      });
    });
  };

  // ---- Mobile menu ----
  window.QJ.initMenu = function () {
    var toggle = document.querySelector("[data-menu-toggle]");
    var nav = document.querySelector("[data-nav]");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
      document.body.classList.toggle("no-scroll", nav.classList.contains("open"));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a") && window.innerWidth <= 820) {
        nav.classList.remove("open");
        document.body.classList.remove("no-scroll");
      }
    });
  };

  // ---- Search ----
  window.QJ.searchRedirect = function (q) {
    if (!q) return;
    window.location.href = window.QJ.base + "library.html?q=" + encodeURIComponent(q);
  };

  window.QJ.initSearch = function () {
    var form = document.querySelector("[data-search]");
    var input = form ? form.querySelector("input") : null;
    if (!form || !input) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      window.QJ.searchRedirect(input.value.trim());
    });
  };

  // ---- Reveal on scroll ----
  window.QJ.initReveal = function () {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  };

  // ---- Toast ----
  window.QJ.toast = function (msg) {
    var t = document.querySelector("[data-toast]");
    if (!t) {
      t = document.createElement("div");
      t.setAttribute("data-toast", "");
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window.QJ._toastTimer);
    window.QJ._toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  };

  window.QJ.addNavActive = function () {
    var path = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav] a").forEach(function (a) {
      if (a.getAttribute("href") === path) a.classList.add("active");
    });
  };

  document.addEventListener("DOMContentLoaded", function () {
    window.QJ.initTheme();
    window.QJ.initMenu();
    window.QJ.initSearch();
    window.QJ.initReveal();
    window.QJ.addNavActive();
  });
})();
