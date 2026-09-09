(function () {
  "use strict";

  var COVERS = Array.from({ length: 13 }, function (_, i) {
    return "assets/images/covers/cover-" + ("0" + (i + 1)).slice(-2) + ".jpg";
  });

  var state = {
    work: null,
    isExisting: false
  };

  function requireUser() {
    var user = window.QJStore.currentUser();
    if (!user) {
      var next = "editor.html" + (window.location.search || "");
      window.location.href = "login.html?next=" + encodeURIComponent(next);
      return null;
    }
    return user;
  }

  function defaultWork() {
    return {
      title: "",
      category: "同人",
      status: "连载",
      tags: [],
      intro: "",
      cover: COVERS[9],
      chapters: [{ title: "第一章", paragraphs: [] }],
      published: false
    };
  }

  function paragraphsFromText(text) {
    return String(text || "").split(/\n\s*\n/).map(function (p) {
      return p.replace(/\r/g, "").trim();
    }).filter(Boolean);
  }

  function textFromParagraphs(paragraphs) {
    return (paragraphs || []).join("\n\n");
  }

  function syncForm() {
    state.work.title = document.querySelector("[data-work-title]").value.trim();
    state.work.category = document.querySelector("[data-work-category]").value;
    state.work.status = document.querySelector("[data-work-status]").value;
    state.work.intro = document.querySelector("[data-work-intro]").value.trim();
    state.work.cover = document.querySelector("[data-work-cover]").value;
    state.work.tags = document.querySelector("[data-work-tags]").value
      .split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
    state.work.chapters = Array.from(document.querySelectorAll("[data-chapter-card]")).map(function (card, index) {
      var title = card.querySelector("[data-ch-title]").value.trim();
      return {
        title: title || ("第" + (index + 1) + "章"),
        paragraphs: paragraphsFromText(card.querySelector("[data-ch-text]").value)
      };
    });
    updateLiveStats();
  }

  function updateLiveStats() {
    var words = (state.work.chapters || []).reduce(function (sum, ch) {
      return sum + ch.paragraphs.join("").length;
    }, 0);
    document.querySelector("[data-word-count]").textContent = window.QJ.fmtNum(words) + " 字";
    document.querySelector("[data-publish-state]").textContent = state.work.published ? "已发布" : "草稿";
  }

  function updateCover() {
    var cover = document.querySelector("[data-work-cover]").value;
    document.querySelector("[data-cover-preview]").innerHTML = '<img src="' + window.QJ.esc(cover) + '" alt="">';
  }

  function chapterHTML(ch, index) {
    return (
      '<article class="chapter-card" data-chapter-card>' +
        '<div class="chapter-head">' +
          '<span class="chapter-index">' + (index + 1) + '</span>' +
          '<input class="input" data-ch-title value="' + window.QJ.esc(ch.title || "") + '" placeholder="章节标题">' +
          '<div class="chapter-actions">' +
            '<button class="mini-btn" type="button" data-move="up" title="上移"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m18 15-6-6-6 6"/></svg></button>' +
            '<button class="mini-btn" type="button" data-move="down" title="下移"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg></button>' +
            '<button class="mini-btn danger" type="button" data-remove-chapter title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
          '</div>' +
        '</div>' +
        '<textarea class="textarea" data-ch-text placeholder="正文内容。空一行会自动分成新的自然段。">' + window.QJ.esc(textFromParagraphs(ch.paragraphs)) + '</textarea>' +
        '<p class="chapter-help">每个空行会被识别为一个自然段。</p>' +
      '</article>'
    );
  }

  function renderChapters() {
    document.querySelector("[data-chapter-list]").innerHTML = state.work.chapters.map(chapterHTML).join("");
  }

  function renderWork() {
    document.querySelector("[data-work-title]").value = state.work.title || "";
    document.querySelector("[data-work-category]").value = state.work.category || "其他";
    document.querySelector("[data-work-status]").value = state.work.status || "连载";
    document.querySelector("[data-work-tags]").value = (state.work.tags || []).join(", ");
    document.querySelector("[data-work-intro]").value = state.work.intro || "";
    document.querySelector("[data-work-cover]").value = state.work.cover || COVERS[9];
    renderChapters();
    updateCover();
    updateLiveStats();
    document.querySelector("[data-editor-title]").textContent = state.isExisting ? "编辑作品" : "新建作品";
    document.querySelector("[data-editor-subtitle]").textContent = state.isExisting
      ? "修改后记得保存；已经发布的作品会在保存后同步更新。"
      : "先写一个名字，再慢慢把它写完。";
    document.querySelector("[data-danger-zone]").hidden = !state.isExisting;
  }

  function bindChapterActions() {
    var list = document.querySelector("[data-chapter-list]");
    list.addEventListener("click", function (e) {
      var card = e.target.closest("[data-chapter-card]");
      if (!card) return;
      var index = Array.prototype.indexOf.call(list.children, card);
      if (e.target.closest("[data-move]")) {
        syncForm();
        var dir = e.target.closest("[data-move]").getAttribute("data-move");
        var target = dir === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= state.work.chapters.length) return;
        var tmp = state.work.chapters[index];
        state.work.chapters[index] = state.work.chapters[target];
        state.work.chapters[target] = tmp;
        renderChapters();
        updateLiveStats();
      } else if (e.target.closest("[data-remove-chapter]")) {
        if (state.work.chapters.length <= 1) {
          window.QJ.toast("至少保留一章");
          return;
        }
        if (!window.confirm("确定删除这一章吗？")) return;
        syncForm();
        state.work.chapters.splice(index, 1);
        renderChapters();
        updateLiveStats();
      }
    });

    list.addEventListener("input", function () {
      syncForm();
    });
  }

  function save(publish) {
    syncForm();
    var payload = Object.assign({}, state.work, {
      id: state.work.id,
      published: !!publish
    });
    window.QJStore.saveWork(payload).then(function (work) {
      state.work = work;
      state.isExisting = true;
      var url = new URL(window.location.href);
      url.searchParams.set("id", work.id);
      window.history.replaceState(null, "", url.pathname.split("/").pop() + url.search);
      renderWork();
      if (publish) {
        window.QJ.toast("作品已发布，正在打开作品页…");
        setTimeout(function () {
          window.location.href = "book.html?id=" + encodeURIComponent(work.id);
        }, 700);
      } else {
        window.QJ.toast("草稿已保存");
      }
    }).catch(function (err) {
      window.QJ.toast(err.message);
    });
  }

  function init() {
    window.QJStore.ready().then(function () {
      var user = requireUser();
      if (!user) return;

      var coverSelect = document.querySelector("[data-work-cover]");
      coverSelect.innerHTML = COVERS.map(function (src, i) {
        return '<option value="' + src + '">封面 ' + (i + 1) + '</option>';
      }).join("");

      var id = new URLSearchParams(window.location.search).get("id");
      var existing = id ? window.QJStore.getWork(id) : null;
      if (existing && existing.ownerId !== user.id) {
        window.QJ.toast("你没有权限编辑这部作品");
        window.location.href = "dashboard.html";
        return;
      }

      state.work = existing ? JSON.parse(JSON.stringify(existing)) : defaultWork();
      state.isExisting = !!existing;
      renderWork();
      bindChapterActions();

      document.querySelector("[data-add-chapter]").addEventListener("click", function () {
        syncForm();
        state.work.chapters.push({ title: "第" + (state.work.chapters.length + 1) + "章", paragraphs: [] });
        renderChapters();
        updateLiveStats();
        var cards = document.querySelectorAll("[data-chapter-card]");
        if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
      });

      document.querySelectorAll("[data-save-draft]").forEach(function (btn) {
        btn.addEventListener("click", function () { save(false); });
      });
      document.querySelectorAll("[data-publish]").forEach(function (btn) {
        btn.addEventListener("click", function () { save(true); });
      });

      coverSelect.addEventListener("change", function () {
        syncForm();
        updateCover();
      });
      ["[data-work-title]", "[data-work-category]", "[data-work-status]", "[data-work-tags]", "[data-work-intro]"].forEach(function (sel) {
        document.querySelector(sel).addEventListener("input", function () { syncForm(); });
      });

      document.querySelector("[data-delete-work]").addEventListener("click", function () {
        if (!state.work.id) return;
        if (!window.confirm("确定删除这部作品吗？删除后无法恢复。")) return;
        window.QJStore.deleteWork(state.work.id).then(function () {
          window.QJ.toast("作品已删除");
          setTimeout(function () { window.location.href = "dashboard.html"; }, 400);
        }).catch(function (err) { window.QJ.toast(err.message); });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
