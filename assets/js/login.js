(function () {
  "use strict";

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function safeNext() {
    var next = params().get("next") || "dashboard.html";
    return /^[a-z0-9_-]+\.html(?:\?.*)?$/i.test(next) ? next : "dashboard.html";
  }

  function showTab(name) {
    document.querySelectorAll("[data-auth-tab]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-auth-tab") === name);
    });
    document.querySelectorAll(".auth-form").forEach(function (form) {
      form.classList.toggle("active", form.matches(name === "register" ? "[data-register-form]" : "[data-login-form]"));
    });
    var url = new URL(window.location.href);
    if (name === "register") url.searchParams.set("tab", "register");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url.pathname.split("/").pop() + url.search);
  }

  function setError(form, message) {
    var box = form.querySelector("[data-form-error]");
    if (!box) return;
    box.textContent = message || "";
    box.classList.toggle("show", !!message);
  }

  function finish() {
    window.QJ.toast("登录成功，正在进入写作台…");
    setTimeout(function () {
      window.location.href = safeNext();
    }, 450);
  }

  function init() {
    window.QJStore.ready().then(function () {
      if (window.QJStore.currentUser()) {
        window.location.href = safeNext();
        return;
      }

      showTab(params().get("tab") === "register" ? "register" : "login");

      document.querySelectorAll("[data-auth-tab]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          showTab(btn.getAttribute("data-auth-tab"));
        });
      });

      var loginForm = document.querySelector("[data-login-form]");
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        setError(loginForm, "");
        var fd = new FormData(loginForm);
        window.QJStore.login(fd.get("email"), fd.get("password")).then(finish).catch(function (err) {
          setError(loginForm, err.message);
        });
      });

      document.querySelector("[data-demo-login]").addEventListener("click", function () {
        setError(loginForm, "");
        window.QJStore.login(window.QJStore.demo.email, window.QJStore.demo.password)
          .then(finish)
          .catch(function (err) { setError(loginForm, err.message); });
      });

      var registerForm = document.querySelector("[data-register-form]");
      registerForm.addEventListener("submit", function (e) {
        e.preventDefault();
        setError(registerForm, "");
        var fd = new FormData(registerForm);
        if (fd.get("password") !== fd.get("confirm")) {
          setError(registerForm, "两次输入的密码不一致");
          return;
        }
        window.QJStore.register({
          name: fd.get("name"),
          email: fd.get("email"),
          password: fd.get("password")
        }).then(finish).catch(function (err) {
          setError(registerForm, err.message);
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
