(function () {
  "use strict";

  var cache = null;

  window.QJB = {
    load: function () {
      if (cache) return Promise.resolve(cache);
      return fetch(window.QJ.base + "data/books.json")
        .then(function (r) {
          if (!r.ok) throw new Error("加载数据失败");
          return r.json();
        })
        .then(function (data) {
          cache = data;
          return data;
        });
    },

    categories: function (data) {
      var cats = [];
      data.books.forEach(function (b) {
        if (cats.indexOf(b.category) === -1) cats.push(b.category);
      });
      return cats;
    },

    getBook: function (data, id) {
      return data.books.find(function (b) { return b.id === id; });
    },

    featured: function (data, n) {
      return data.books.slice().sort(function (a, b) { return b.rating - a.rating; }).slice(0, n || 6);
    },

    ranked: function (data, n) {
      return data.books.slice().sort(function (a, b) { return b.views - a.views; }).slice(0, n || 8);
    },

    related: function (data, book, n) {
      var rel = data.books.filter(function (b) {
        return b.id !== book.id && (b.category === book.category || b.tags.some(function (t) { return book.tags.indexOf(t) > -1; }));
      });
      if (rel.length < (n || 4)) {
        data.books.forEach(function (b) {
          if (b.id !== book.id && rel.indexOf(b) === -1) rel.push(b);
        });
      }
      return rel.slice(0, n || 4);
    },

    search: function (data, q) {
      q = (q || "").trim().toLowerCase();
      if (!q) return data.books;
      return data.books.filter(function (b) {
        return (
          (b.title && b.title.toLowerCase().indexOf(q) > -1) ||
          (b.author && b.author.toLowerCase().indexOf(q) > -1) ||
          (b.category && b.category.toLowerCase().indexOf(q) > -1) ||
          (b.intro && b.intro.toLowerCase().indexOf(q) > -1) ||
          (b.tags && b.tags.join(" ").toLowerCase().indexOf(q) > -1)
        );
      });
    },

    filter: function (data, cat) {
      if (!cat || cat === "全部") return data.books;
      return data.books.filter(function (b) { return b.category === cat; });
    },

    novelInfo: function (data) {
      var words = data.books.reduce(function (s, b) { return s + (b.wordCount || 0); }, 0);
      var chapters = data.books.reduce(function (s, b) { return s + (b.chapters || []).length; }, 0);
      return { books: data.books.length, words: words, chapters: chapters };
    },

    chapterLength: function (chapter) {
      return (chapter.paragraphs || []).join("").length;
    }
  };
})();
