(function () {
  "use strict";

  function cardHTML(book) {
    var statusCls = book.status === "已完结" ? "done" : "series";
    return (
      '<a class="book-card reveal" href="' + window.QJ.base + 'book.html?id=' + encodeURIComponent(book.id) + '">' +
        '<div class="cover">' +
          '<img src="' + window.QJ.esc(book.cover) + '" alt="' + window.QJ.esc(book.title) + ' 封面" loading="lazy">' +
          '<span class="cover-tag ' + statusCls + '">' + window.QJ.esc(book.status) + '</span>' +
          '<span class="cover-rating">' + window.QJ.ratingText(book) + '</span>' +
        '</div>' +
        '<div class="book-meta">' +
          '<h3 class="book-title">' + window.QJ.esc(book.title) + '</h3>' +
          '<div class="book-author">' + window.QJ.esc(book.author) + ' · ' + window.QJ.esc(book.category) + '</div>' +
          '<div class="book-tags">' + book.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + window.QJ.esc(t) + '</span>'; }).join("") + '</div>' +
        '</div>' +
      '</a>'
    );
  }

  function rankHTML(book, i) {
    return (
      '<a class="rank-item reveal" href="' + window.QJ.base + 'book.html?id=' + encodeURIComponent(book.id) + '">' +
        '<span class="rank-num">' + (i + 1) + '</span>' +
        '<img class="rank-thumb" src="' + window.QJ.esc(book.cover) + '" alt="">' +
        '<span class="rank-info">' +
          '<h4>' + window.QJ.esc(book.title) + '</h4>' +
          '<p>' + window.QJ.esc(book.author) + ' · ' + window.QJ.esc(book.category) + '</p>' +
        '</span>' +
        '<span class="rank-heat">' + window.QJ.fmtNum(book.views) + '</span>' +
      '</a>'
    );
  }

  function init() {
    window.QJB.load().then(function (data) {
      // Hero stats
      var info = window.QJB.novelInfo(data);
      var follows = data.books.reduce(function (s, b) { return s + (Number(b.likes) || 0); }, 0);
      var stats = document.querySelector("[data-stats]");
      if (stats) {
        stats.innerHTML =
          '<div class="stat"><b>' + info.books + '</b><span>篇琳嘉文</span></div>' +
          '<div class="stat"><b>' + window.QJ.fmtNum(info.words) + '</b><span>累积字数</span></div>' +
          '<div class="stat"><b>' + window.QJ.fmtNum(info.chapters) + '</b><span>章节</span></div>' +
          '<div class="stat"><b>' + window.QJ.fmtNum(follows) + '</b><span>篇追更</span></div>';
      }

      // 剧场入口：永远指向一本仍然存在的书（优先选已在 scenes.json 里配好场景的）
      var theaterIds = ["morning-colors", "sunset-west", "talk-about-love"];
      var theaterBook = data.books.filter(function (b) { return theaterIds.indexOf(b.id) > -1; })[0] || data.books[0];
      if (theaterBook) {
        Array.prototype.forEach.call(document.querySelectorAll("[data-theater-link]"), function (a) {
          a.href = window.QJ.base + "read.html?id=" + encodeURIComponent(theaterBook.id) + "&c=1&mode=theater";
        });
        Array.prototype.forEach.call(document.querySelectorAll("[data-theater-title]"), function (el) {
          el.textContent = theaterBook.title;
        });
      }

      // Featured book banner (highest rated)
      var best = data.books.slice().sort(function (a, b) { return b.rating - a.rating; })[0];
      var banner = document.querySelector("[data-feature-banner]");
      if (banner && best) {
        banner.innerHTML =
          '<img src="' + window.QJ.esc(best.cover) + '" alt="">' +
          '<div class="veil"></div>' +
          '<div class="meta">' +
            '<span class="cover-tag series">编辑推荐</span>' +
            '<h3>' + window.QJ.esc(best.title) + '</h3>' +
            '<p>' + window.QJ.esc(best.intro.slice(0, 60)) + '…</p>' +
            '<a class="btn btn-primary" href="' + window.QJ.base + 'book.html?id=' + encodeURIComponent(best.id) + '">立即阅读</a>' +
          '</div>';
      }

      // Category tabs
      var tabs = document.querySelector("[data-cat-tabs]");
      var grid = document.querySelector("[data-book-grid]");
      if (tabs && grid) {
        var cats = ["全部"].concat(window.QJB.categories(data));
        tabs.innerHTML = cats.map(function (c) {
          return '<button class="tab' + (c === "全部" ? " active" : "") + '" data-cat="' + window.QJ.esc(c) + '">' + window.QJ.esc(c) + '</button>';
        }).join("");
        tabs.addEventListener("click", function (e) {
          var b = e.target.closest(".tab");
          if (!b) return;
          tabs.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
          b.classList.add("active");
          grid.innerHTML = window.QJB.filter(data, b.getAttribute("data-cat")).map(cardHTML).join("");
          window.QJ.initReveal();
        });
        grid.innerHTML = window.QJB.filter(data, "全部").map(cardHTML).join("");
      }

      // Ranked list
      var rank = document.querySelector("[data-rank-grid]");
      if (rank) rank.innerHTML = window.QJB.ranked(data, 6).map(rankHTML).join("");

      window.QJ.initReveal();
    }).catch(function (err) {
      document.querySelector("[data-book-grid]").innerHTML =
        '<div class="empty" style="grid-column:1/-1">数据加载失败，请确认 data/books.json 存在。</div>';
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
