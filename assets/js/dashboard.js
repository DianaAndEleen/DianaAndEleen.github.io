(function () {
  "use strict";

  var filter = "all";

  function requireUser() {
    var user = window.QJStore.currentUser();
    if (!user) {
      window.location.href = "login.html?next=dashboard.html";
      return null;
    }
    return user;
  }

  function renderProfile(user) {
    var card = document.querySelector("[data-profile-card]");
    var stats = window.QJStore.stats(user.id);
    var initial = user.name.slice(0, 1);
    card.innerHTML =
      '<div class="profile-main">' +
        '<span class="avatar-lg" style="background:' + user.avatarColor + '">' + window.QJ.esc(initial) + '</span>' +
        '<div><h2>' + window.QJ.esc(user.name) + '</h2><p>' + window.QJ.esc(user.email) + '</p></div>' +
      '</div>' +
      '<p class="profile-bio">' + (user.bio ? window.QJ.esc(user.bio) : "还没有写简介。说一句你想对读者说的话吧。") + '</p>' +
      '<div class="profile-stats">' +
        '<div class="stat-pill"><b>' + stats.published + '</b><span>已发布</span></div>' +
        '<div class="stat-pill"><b>' + stats.drafts + '</b><span>草稿</span></div>' +
        '<div class="stat-pill"><b>' + window.QJ.fmtNum(stats.words) + '</b><span>字数</span></div>' +
      '</div>' +
      '<details class="profile-edit">' +
        '<summary>编辑个人资料</summary>' +
        '<form data-profile-form>' +
          '<label class="field"><span>昵称</span><input class="input" name="name" value="' + window.QJ.esc(user.name) + '" maxlength="24"></label>' +
          '<label class="field"><span>个人简介</span><textarea class="textarea" name="bio" maxlength="160" style="min-height:90px">' + window.QJ.esc(user.bio) + '</textarea></label>' +
          '<label class="field"><span>头像颜色</span><input class="input" type="color" name="avatarColor" value="' + window.QJ.esc(user.avatarColor) + '" style="padding:5px"></label>' +
          '<button class="btn btn-primary" type="submit" style="width:100%">保存资料</button>' +
          '<p class="form-error" data-profile-error></p>' +
        '</form>' +
      '</details>';

    var form = card.querySelector("[data-profile-form]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      window.QJStore.updateProfile({
        name: fd.get("name"),
        bio: fd.get("bio"),
        avatarColor: fd.get("avatarColor")
      }).then(function () {
        window.QJ.toast("个人资料已更新");
        renderProfile(window.QJStore.currentUser());
      }).catch(function (err) {
        var box = form.querySelector("[data-profile-error]");
        box.textContent = err.message;
        box.classList.add("show");
      });
    });
  }

  function workCard(work) {
    var isPublished = !!work.published;
    var action = isPublished
      ? '<a class="btn btn-sm btn-ghost" href="book.html?id=' + encodeURIComponent(work.id) + '">查看</a>' +
        '<a class="btn btn-sm btn-primary" href="editor.html?id=' + encodeURIComponent(work.id) + '">编辑</a>'
      : '<a class="btn btn-sm btn-primary" href="editor.html?id=' + encodeURIComponent(work.id) + '">继续写</a>';
    return (
      '<article class="work-card reveal">' +
        '<div class="work-cover"><img src="' + window.QJ.esc(work.cover) + '" alt="" loading="lazy"></div>' +
        '<div class="work-info">' +
          '<h3>' + window.QJ.esc(work.title) + '</h3>' +
          '<div class="work-meta">' +
            '<span class="status-dot' + (isPublished ? '' : ' draft') + '">' + (isPublished ? "已发布" : "草稿") + '</span>' +
            '<span>' + window.QJ.esc(work.category) + '</span>' +
            '<span>' + (work.chapters || []).length + ' 章</span>' +
            '<span>' + window.QJ.fmtNum(work.wordCount || 0) + ' 字</span>' +
            '<span>更新于 ' + window.QJ.dateText(work.updatedAt) + '</span>' +
          '</div>' +
          '<p class="work-excerpt">' + window.QJ.esc(work.intro || "还没有写简介。") + '</p>' +
        '</div>' +
        '<div class="work-actions">' +
          action +
          '<button class="btn btn-sm btn-ghost" type="button" data-delete="' + window.QJ.esc(work.id) + '" style="color:var(--danger)">删除</button>' +
        '</div>' +
      '</article>'
    );
  }

  function renderWorks(user) {
    var list = window.QJStore.listWorks(user.id);
    if (filter === "published") list = list.filter(function (w) { return w.published; });
    if (filter === "draft") list = list.filter(function (w) { return !w.published; });

    var wrap = document.querySelector("[data-work-list]");
    var count = document.querySelector("[data-work-count]");
    count.textContent = list.length + " 部作品";

    if (!list.length) {
      wrap.innerHTML =
        '<div class="empty-panel">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
          '<h3>' + (filter === "draft" ? "草稿箱还是空的" : "还没有作品") + '</h3>' +
          '<p>写下一个名字，故事就开始了。</p>' +
          '<a class="btn btn-primary" href="editor.html">创建第一部作品</a>' +
        '</div>';
      return;
    }

    wrap.innerHTML = list.map(workCard).join("");
    wrap.querySelectorAll("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete");
        if (!window.confirm("确定删除这部作品吗？删除后无法恢复。")) return;
        window.QJStore.deleteWork(id).then(function () {
          window.QJ.toast("作品已删除");
          renderWorks(user);
        }).catch(function (err) { window.QJ.toast(err.message); });
      });
    });
    window.QJ.initReveal();
  }

  function init() {
    window.QJStore.ready().then(function () {
      var user = requireUser();
      if (!user) return;
      renderProfile(user);
      renderWorks(user);

      document.querySelector("[data-work-tabs]").addEventListener("click", function (e) {
        var btn = e.target.closest("[data-filter]");
        if (!btn) return;
        filter = btn.getAttribute("data-filter");
        document.querySelectorAll("[data-filter]").forEach(function (b) { b.classList.toggle("active", b === btn); });
        renderWorks(user);
      });

      window.addEventListener("qj:works", function () {
        var current = window.QJStore.currentUser();
        if (current) {
          renderProfile(current);
          renderWorks(current);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
