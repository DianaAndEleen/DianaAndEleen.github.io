(function () {
  "use strict";

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function relatedHTML(book) {
    return (
      '<a class="book-card reveal" href="' + window.QJ.base + 'book.html?id=' + encodeURIComponent(book.id) + '">' +
        '<div class="cover"><img src="' + window.QJ.esc(book.cover) + '" alt="" loading="lazy"><span class="cover-tag">' + window.QJ.esc(book.status) + '</span><span class="cover-rating">' + window.QJ.ratingText(book) + '</span></div>' +
        '<div class="book-meta"><h3 class="book-title">' + window.QJ.esc(book.title) + '</h3><div class="book-author">' + window.QJ.esc(book.author) + '</div></div>' +
      '</a>'
    );
  }

  function init() {
    var id = getParam("id");
    window.QJB.load().then(function (data) {
      var book = window.QJB.getBook(data, id);
      var wrap = document.querySelector("[data-book]");
      if (!book) {
        wrap.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><p>未找到这本书，请检查链接。</p></div>';
        return;
      }

      document.title = book.title + " · 青简";
      var tags = book.tags.map(function (t) { return '<span class="tag">' + window.QJ.esc(t) + '</span>'; }).join("");
      var statusCls = book.status === "已完结" ? "done" : "series";
      wrap.innerHTML =
        '<div class="book-hero">' +
          '<div class="book-cover-lg"><img src="' + window.QJ.esc(book.cover) + '" alt="' + window.QJ.esc(book.title) + ' 封面"></div>' +
          '<div class="book-info">' +
            '<div class="crumbs" style="margin-bottom:14px"><a href="index.html">首页</a> / <a href="library.html">书库</a> / ' + window.QJ.esc(book.category) + '</div>' +
            '<h1>' + window.QJ.esc(book.title) + '</h1>' +
            '<div class="author">作者 <b>' + window.QJ.esc(book.author) + '</b></div>' +
            '<div class="book-tags" style="margin-bottom:8px">' + tags + '</div>' +
            '<div class="book-stats">' +
              '<div class="stat-cell"><b>' + window.QJ.fmtWords(book.wordCount) + '</b><span>字数</span></div>' +
              '<div class="stat-cell"><b>' + book.chapters.length + '</b><span>章节</span></div>' +
              '<div class="stat-cell"><b>' + window.QJ.ratingText(book) + '</b><span>评分</span></div>' +
              '<div class="stat-cell"><b>' + window.QJ.fmtNum(book.views) + '</b><span>阅读</span></div>' +
              '<div class="stat-cell"><b>' + window.QJ.fmtNum(book.likes) + '</b><span>收藏</span></div>' +
            '</div>' +
            '<p class="book-intro">' + window.QJ.esc(book.intro) + '</p>' +
            '<div class="book-actions">' +
              '<a class="btn btn-primary" href="' + window.QJ.base + 'read.html?id=' + encodeURIComponent(book.id) + '&c=1">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19l7-7 7 7M5 5l7 7 7-7"/></svg> 开始阅读' +
              '</a>' +
              '<a class="btn btn-theater" href="' + window.QJ.base + 'read.html?id=' + encodeURIComponent(book.id) + '&c=1&mode=theater">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M10 8.5v7l6-3.5-6-3.5z"/></svg> 沉浸剧场' +
              '</a>' +
              '<button class="btn btn-ghost" data-like>' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></svg> 收藏' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      // Chapters
      var chapters = document.querySelector("[data-chapters]");
      chapters.innerHTML =
        '<div class="chapter-group">' +
          '<h3>目录 · 共 ' + book.chapters.length + ' 章</h3>' +
          '<div class="chapter-list-grid">' +
            book.chapters.map(function (ch, i) {
              var len = window.QJ.fmtNum(window.QJB.chapterLength(ch));
              return '<a class="chapter-row" href="' + window.QJ.base + 'read.html?id=' + encodeURIComponent(book.id) + '&c=' + (i + 1) + '">' +
                '<span>' + window.QJ.esc(ch.title) + '</span><span class="len">' + len + '</span></a>';
            }).join("") +
          '</div>' +
        '</div>';

      // Related
      var rel = document.querySelector("[data-related]");
      rel.innerHTML = window.QJB.related(data, book, 5).map(relatedHTML).join("");

      // Like button
      var like = wrap.querySelector("[data-like]");
      like.addEventListener("click", function () {
        window.QJ.toast("收藏成功！这本书已被加入你的书架（演示）");
        like.querySelector("svg").style.fill = "currentColor";
      });

      window.QJ.initReveal();
    }).catch(function () {
      document.querySelector("[data-book]").innerHTML = '<div class="empty">书籍信息加载失败。</div>';
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
