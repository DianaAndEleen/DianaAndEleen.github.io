(function () {
  "use strict";

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function setParam(name, value) {
    var p = getParams();
    if (value) p.set(name, value); else p.delete(name);
    var q = p.toString();
    window.history.replaceState(null, "", "library.html" + (q ? "?" + q : ""));
  }

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

  function sorted(list, key) {
    list = list.slice();
    if (key === "rank") list.sort(function (a, b) { return b.views - a.views; });
    else if (key === "rating") list.sort(function (a, b) { return b.rating - a.rating; });
    else if (key === "likes" || key === "new") list.sort(function (a, b) { return b.likes - a.likes; });
    return list;
  }

  function updateURL(cat, sort, q) {
    var p = getParams();
    if (cat) p.set("cat", cat); else p.delete("cat");
    if (sort) p.set("sort", sort); else p.delete("sort");
    if (q) p.set("q", q); else p.delete("q");
    var s = p.toString();
    window.history.replaceState(null, "", "library.html" + (s ? "?" + s : ""));
  }

  function init() {
    window.QJB.load().then(function (data) {
      var p = getParams();
      var cat = p.get("cat") || "全部";
      var sort = p.get("sort") || "";
      var q = p.get("q") || "";

      var tabs = document.querySelector("[data-cat-tabs]");
      var grid = document.querySelector("[data-grid]");
      var count = document.querySelector("[data-count]");

      // Category tabs
      var cats = ["全部"].concat(window.QJB.categories(data));
      tabs.innerHTML = cats.map(function (c) {
        return '<button class="tab' + (c === cat ? " active" : "") + '" data-cat="' + window.QJ.esc(c) + '">' + window.QJ.esc(c) + '</button>';
      }).join("");

      // Sort buttons
      var sorts = [["", "综合推荐"], ["rank", "最多阅读"], ["rating", "评分最高"], ["likes", "最多收藏"]];
      var sortBar = document.querySelector("[data-sort]");
      sortBar.innerHTML = sorts.map(function (s) {
        return '<button class="tab' + (s[0] === sort ? " active" : "") + '" data-sort="' + s[0] + '">' + s[1] + '</button>';
      }).join("");

      function render() {
        var list = window.QJB.filter(data, cat);
        if (q) list = window.QJB.search({ books: list }, q);
        list = sorted(list, sort);
        count.textContent = "共 " + list.length + " 部作品";
        if (list.length === 0) {
          grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>没有找到相关作品</p></div>';
          return;
        }
        grid.innerHTML = list.map(cardHTML).join("");
        window.QJ.initReveal();
      }

      tabs.addEventListener("click", function (e) {
        var b = e.target.closest(".tab");
        if (!b) return;
        tabs.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
        b.classList.add("active");
        cat = b.getAttribute("data-cat");
        updateURL(cat, sort, q);
        render();
      });

      sortBar.addEventListener("click", function (e) {
        var b = e.target.closest(".tab");
        if (!b) return;
        sortBar.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
        b.classList.add("active");
        sort = b.getAttribute("data-sort");
        updateURL(cat, sort, q);
        render();
      });

      var title = document.querySelector("[data-page-title]");
      if (title && q) title.textContent = "搜索：「" + q + "」";
      else if (title) title.textContent = "全部书库";

      render();
    }).catch(function () {
      document.querySelector("[data-grid]").innerHTML = '<div class="empty" style="grid-column:1/-1">数据加载失败。</div>';
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
