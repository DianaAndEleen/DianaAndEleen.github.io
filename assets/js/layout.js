(function () {
  "use strict";

  var base = window.__BASE__ || "";

  var bookIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  var topbar =
    '<div class="topbar">' +
      '<div class="container topbar-inner">' +
        '<a class="brand" href="' + base + 'index.html">' +
          '<span class="brand-mark">' + bookIcon + '</span>' +
          '<span class="brand-name">青简<small>同人书苑</small></span>' +
        '</a>' +
        '<nav class="nav" data-nav>' +
          '<a href="' + base + 'index.html">首页</a>' +
          '<a href="' + base + 'library.html">书库</a>' +
          '<a href="' + base + 'library.html?sort=rank">排行榜</a>' +
          '<a href="' + base + 'library.html?sort=new">最近更新</a>' +
          '<a href="#about">关于</a>' +
        '</nav>' +
        '<div class="topbar-actions">' +
          '<form class="search-box" data-search role="search">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
            '<input type="search" placeholder="搜索书名 / 作者 / 标签…">' +
          '</form>' +
          '<button class="icon-btn" data-theme-toggle aria-label="切换主题"></button>' +
          '<button class="icon-btn menu-toggle" data-menu-toggle aria-label="菜单">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  var footer =
    '<footer class="footer" id="about">' +
      '<div class="container">' +
        '<div class="footer-grid">' +
          '<div class="footer-col">' +
            '<span class="brand-mark">' + bookIcon + '</span>' +
            '<div class="brand-name" style="margin-top:10px">青简<small>同人书苑</small></div>' +
            '<p>一个收录同人创作与原创故事的在线阅读平台。愿每一段文字，都被温柔以待。</p>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5>快速导航</h5>' +
            '<a href="' + base + 'index.html">首页</a>' +
            '<a href="' + base + 'library.html">全部书库</a>' +
            '<a href="' + base + 'library.html?sort=rank">排行榜</a>' +
            '<a href="' + base + 'library.html?sort=new">最近更新</a>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5>热门分类</h5>' +
            '<a href="' + base + 'library.html?cat=奇幻">奇幻</a>' +
            '<a href="' + base + 'library.html?cat=科幻">科幻</a>' +
            '<a href="' + base + 'library.html?cat=悬疑">悬疑</a>' +
            '<a href="' + base + 'library.html?cat=都市">都市</a>' +
            '<a href="' + base + 'library.html?cat=古风">古风</a>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5>关于本站</h5>' +
            '<a href="' + base + 'README.md">如何投稿</a>' +
            '<a href="' + base + 'data/books.json">数据结构</a>' +
            '<a href="https://pages.github.com/" target="_blank" rel="noopener">GitHub Pages</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>© 2026 青简 · 同人书苑 · 本站为演示项目，内容为虚构原创</span>' +
          '<span>由 GitHub Pages 免费驱动</span>' +
        '</div>' +
      '</div>' +
    '</footer>';

  function inject() {
    var top = document.querySelector("[data-layout-topbar]");
    var foot = document.querySelector("[data-layout-footer]");
    if (top) top.innerHTML = topbar;
    if (foot) foot.innerHTML = footer;
  }

  document.addEventListener("DOMContentLoaded", inject);
})();
