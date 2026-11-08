// Must Be Viral · the waitlist form, enhanced. Without JavaScript the form
// still posts to /api/waitlist and lands on /thanks/.
(function () {
  "use strict";
  var form = document.getElementById("waitlist");
  if (!form || !window.fetch) return;

  // Keep the campaign tags a link arrived with, so a sign-up can be tied back
  // to the reel that sent it. Only safe characters survive on the server.
  try {
    var q = new URLSearchParams(window.location.search);
    ["utm_source", "utm_campaign"].forEach(function (k) {
      var v = q.get(k);
      if (v && form.elements[k]) form.elements[k].value = v.slice(0, 100);
    });
  } catch (e) {
    /* old browser: no tags */
  }

  var status = form.querySelector(".form-status");
  var button = form.querySelector("button[type=submit]");
  var fields = ["email", "business_type", "business_name", "city", "note"];

  function clearErrors() {
    fields.forEach(function (name) {
      var p = document.getElementById("e-" + name);
      if (p) {
        p.hidden = true;
        p.textContent = "";
      }
      var el = form.elements[name];
      if (el && el.setAttribute) el.removeAttribute("aria-invalid");
    });
  }

  function showErrors(errs) {
    var first = null;
    Object.keys(errs || {}).forEach(function (name) {
      var p = document.getElementById("e-" + name);
      if (p) {
        p.textContent = errs[name];
        p.hidden = false;
      }
      var el = form.elements[name];
      if (el && el.setAttribute) {
        el.setAttribute("aria-invalid", "true");
        if (!first) first = el;
      }
    });
    if (first && first.focus) first.focus();
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    clearErrors();
    status.textContent = "";

    var data = {};
    new FormData(form).forEach(function (v, k) {
      data[k] = typeof v === "string" ? v : "";
    });

    if (!data.email || data.email.indexOf("@") < 1) {
      showErrors({ email: "Enter your email address." });
      return;
    }

    button.disabled = true;
    button.textContent = "Sending…";

    fetch(form.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
      credentials: "same-origin",
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            return { res: res, body: body };
          });
      })
      .then(function (r) {
        if (r.res.ok && r.body.ok) {
          var done = document.createElement("div");
          done.className = "form-done";
          done.setAttribute("tabindex", "-1");
          done.innerHTML =
            "<h3>You’re on the list.</h3>" +
            "<p>We’ll write from hello@mustbeviral.com when there’s a spot for you. Nothing else will land in your inbox from us.</p>";
          form.replaceChildren(done);
          done.focus();
          return;
        }
        if (r.body && r.body.error === "invalid") {
          showErrors(r.body.fields);
          status.textContent = "Check the highlighted fields.";
        } else if (r.res.status === 429)
          status.textContent =
            "Too many tries in a minute. Wait a minute and send it again.";
        else
          status.textContent =
            "Something broke on our side and nothing was saved. Try again in a minute.";
      })
      .catch(function () {
        status.textContent =
          "We couldn’t reach the server. Check your connection and try again.";
      })
      .then(function () {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = "Join the waitlist";
        }
      });
  });
})();
