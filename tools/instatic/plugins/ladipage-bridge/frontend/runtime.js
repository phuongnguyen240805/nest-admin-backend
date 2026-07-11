/**
 * Public runtime snippet injected by Instatic publisher.
 * Posts forms to Ladipage public API when data-lp-page is present.
 */
(function () {
  function pageId() {
    var el = document.querySelector("[data-lp-page]");
    return el ? el.getAttribute("data-lp-page") : null;
  }

  document.addEventListener(
    "submit",
    function (event) {
      var form = event.target;
      if (!form || form.tagName !== "FORM") return;
      if (form.getAttribute("data-lp-native") === "false") return;

      var id = form.getAttribute("data-lp-page") || pageId();
      if (!id) return;

      event.preventDefault();
      var data = new FormData(form);
      var payload = { pageId: id, fields: {} };
      data.forEach(function (value, key) {
        payload.fields[key] = value;
      });

      fetch("/api/public/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit",
      }).then(function () {
        form.dispatchEvent(new CustomEvent("lp:form-submitted", { bubbles: true }));
      });
    },
    true,
  );
})();
