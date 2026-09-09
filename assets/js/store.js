/*
 * 青简 · 本地创作与账号原型
 * ---------------------------------------------------------------
 * 这是一个纯前端演示层：账号、会话、作品与章节保存在 localStorage。
 * 它可以完整演示注册、登录、个人主页、发布、编辑和草稿流程，但不会
 * 把数据同步到其他设备，也不适合作为真实的生产级鉴权系统。
 *
 * 后续接入 Supabase / Firebase / 自建 API 时，只需要替换本文件暴露
 * 的方法，页面与现有书库合并逻辑可以保持不变。
 */
(function () {
  "use strict";

  var KEYS = {
    users: "qingjian-users-v1",
    session: "qingjian-session-v1",
    works: "qingjian-works-v1"
  };

  var DEMO_EMAIL = "demo@qingjian.local";
  var DEMO_PASSWORD = "qingjian";
  var users = [];
  var works = [];
  var sessionId = null;

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function uid(prefix) {
    var random = Math.random().toString(36).slice(2, 9);
    return prefix + Date.now().toString(36) + "-" + random;
  }

  function now() {
    return new Date().toISOString();
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail || null }));
  }

  function fallbackHash(value) {
    var h1 = 0xdeadbeef;
    var h2 = 0x41c6ce57;
    for (var i = 0; i < value.length; i++) {
      var ch = value.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ("00000000" + (h1 >>> 0).toString(16)).slice(-8) + ("00000000" + (h2 >>> 0).toString(16)).slice(-8);
  }

  function hashPassword(password) {
    var value = String(password || "");
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      var bytes = new TextEncoder().encode("qingjian:" + value);
      return window.crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
        return Array.from(new Uint8Array(buf)).map(function (b) {
          return ("0" + b.toString(16)).slice(-2);
        }).join("");
      });
    }
    return Promise.resolve(fallbackHash(value));
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      bio: user.bio || "",
      avatarColor: user.avatarColor || "#b0772a",
      createdAt: user.createdAt
    };
  }

  function findUser(id) {
    return users.find(function (u) { return u.id === id; }) || null;
  }

  function persistUsers() { write(KEYS.users, users); }
  function persistWorks() { write(KEYS.works, works); }
  function persistSession() { write(KEYS.session, sessionId); }

  function createUser(input, passwordHash) {
    var user = {
      id: uid("user-"),
      email: String(input.email || "").trim().toLowerCase(),
      name: String(input.name || "").trim(),
      bio: String(input.bio || "").trim(),
      avatarColor: input.avatarColor || "#b0772a",
      passwordHash: passwordHash,
      createdAt: now()
    };
    users.push(user);
    persistUsers();
    return user;
  }

  function ensureDemo() {
    var exists = users.some(function (u) { return u.email === DEMO_EMAIL; });
    if (exists) return Promise.resolve();
    return hashPassword(DEMO_PASSWORD).then(function (hash) {
      createUser({
        email: DEMO_EMAIL,
        name: "青简体验作者",
        bio: "喜欢把日常写成故事的人。这是本地体验账号，可直接用来试用写作台。",
        avatarColor: "#b0772a"
      }, hash);
    });
  }

  function normalizeWork(input, owner) {
    var chapters = (input.chapters || []).map(function (ch, index) {
      var paragraphs = (ch.paragraphs || []).map(function (p) {
        return String(p || "").trim();
      }).filter(Boolean);
      return {
        title: String(ch.title || ("第" + (index + 1) + "章")).trim(),
        paragraphs: paragraphs
      };
    });
    var wordCount = chapters.reduce(function (sum, ch) {
      return sum + ch.paragraphs.join("").length;
    }, 0);

    return {
      id: input.id || uid("local-"),
      ownerId: owner.id,
      source: "local",
      title: String(input.title || "未命名作品").trim(),
      author: owner.name,
      cover: String(input.cover || "assets/images/covers/cover-10.jpg"),
      category: String(input.category || "其他"),
      tags: (input.tags || []).map(function (t) { return String(t || "").trim(); }).filter(Boolean),
      status: input.status === "已完结" ? "已完结" : "连载",
      intro: String(input.intro || "").trim(),
      published: !!input.published,
      rating: Number(input.rating) || 0,
      views: Number(input.views) || 0,
      likes: Number(input.likes) || 0,
      wordCount: wordCount,
      chapters: chapters,
      createdAt: input.createdAt || now(),
      updatedAt: now()
    };
  }

  var readyPromise = (function init() {
    users = read(KEYS.users, []);
    works = read(KEYS.works, []);
    sessionId = read(KEYS.session, null);
    if (!Array.isArray(users)) users = [];
    if (!Array.isArray(works)) works = [];
    return ensureDemo().then(function () {
      emit("qj:store-ready");
      return true;
    });
  })();

  function ready() {
    return readyPromise;
  }

  function currentUser() {
    return publicUser(findUser(sessionId));
  }

  function register(input) {
    return ready().then(function () {
      var email = String(input.email || "").trim().toLowerCase();
      var name = String(input.name || "").trim();
      var password = String(input.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("请输入有效的邮箱地址");
      if (name.length < 2) throw new Error("昵称至少需要 2 个字符");
      if (password.length < 6) throw new Error("密码至少需要 6 位");
      if (users.some(function (u) { return u.email === email; })) throw new Error("这个邮箱已经注册过了");
      return hashPassword(password).then(function (hash) {
        var user = createUser({ email: email, name: name, bio: "" }, hash);
        sessionId = user.id;
        persistSession();
        emit("qj:auth", publicUser(user));
        return publicUser(user);
      });
    });
  }

  function login(email, password) {
    return ready().then(function () {
      var target = String(email || "").trim().toLowerCase();
      var user = users.find(function (u) { return u.email === target; });
      if (!user) throw new Error("账号或密码不正确");
      return hashPassword(password).then(function (hash) {
        if (hash !== user.passwordHash) throw new Error("账号或密码不正确");
        sessionId = user.id;
        persistSession();
        emit("qj:auth", publicUser(user));
        return publicUser(user);
      });
    });
  }

  function logout() {
    sessionId = null;
    persistSession();
    emit("qj:auth", null);
  }

  function updateProfile(patch) {
    return ready().then(function () {
      var user = findUser(sessionId);
      if (!user) throw new Error("请先登录");
      if (patch.name != null) {
        var name = String(patch.name).trim();
        if (name.length < 2) throw new Error("昵称至少需要 2 个字符");
        user.name = name;
      }
      if (patch.bio != null) user.bio = String(patch.bio).trim().slice(0, 160);
      if (patch.avatarColor) user.avatarColor = patch.avatarColor;
      persistUsers();
      works.forEach(function (work) {
        if (work.ownerId === user.id) work.author = user.name;
      });
      persistWorks();
      emit("qj:auth", publicUser(user));
      emit("qj:works", listWorks(user.id));
      return publicUser(user);
    });
  }

  function saveWork(input) {
    return ready().then(function () {
      var owner = findUser(sessionId);
      if (!owner) throw new Error("请先登录后再保存作品");
      if (!String(input.title || "").trim()) throw new Error("请先填写作品名");

      var index = works.findIndex(function (w) { return w.id === input.id; });
      if (index > -1 && works[index].ownerId !== owner.id) throw new Error("你没有权限编辑这部作品");
      var existing = index > -1 ? works[index] : null;
      var work = normalizeWork(Object.assign({}, existing || {}, input), owner);
      if (input.published && (!work.chapters.length || !work.wordCount)) {
        throw new Error("发布前请至少填写一章正文");
      }
      if (index > -1) works[index] = work;
      else works.unshift(work);
      persistWorks();
      emit("qj:works", listWorks(owner.id));
      return work;
    });
  }

  function getWork(id) {
    return works.find(function (w) { return w.id === id; }) || null;
  }

  function listWorks(ownerId) {
    return works.filter(function (w) { return w.ownerId === ownerId; })
      .sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  }

  function publicWorks() {
    return works.filter(function (w) { return w.published; })
      .sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  }

  function deleteWork(id) {
    return ready().then(function () {
      var owner = findUser(sessionId);
      if (!owner) throw new Error("请先登录");
      var index = works.findIndex(function (w) { return w.id === id; });
      if (index < 0) throw new Error("作品不存在");
      if (works[index].ownerId !== owner.id) throw new Error("你没有权限删除这部作品");
      works.splice(index, 1);
      persistWorks();
      emit("qj:works", listWorks(owner.id));
      return true;
    });
  }

  function stats(ownerId) {
    var list = listWorks(ownerId);
    return {
      total: list.length,
      published: list.filter(function (w) { return w.published; }).length,
      drafts: list.filter(function (w) { return !w.published; }).length,
      words: list.reduce(function (sum, w) { return sum + (w.wordCount || 0); }, 0),
      chapters: list.reduce(function (sum, w) { return sum + (w.chapters || []).length; }, 0)
    };
  }

  window.QJStore = {
    keys: KEYS,
    demo: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    ready: ready,
    currentUser: currentUser,
    register: register,
    login: login,
    logout: logout,
    updateProfile: updateProfile,
    saveWork: saveWork,
    getWork: getWork,
    listWorks: listWorks,
    publicWorks: publicWorks,
    deleteWork: deleteWork,
    stats: stats
  };
})();
