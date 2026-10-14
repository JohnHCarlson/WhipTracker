// Applies the saved light or dark setting before the first paint, so dark mode doesn't flash
// white. A file rather than inline, because the site's security policy only runs its own
// files. Keep in step with useTheme in src/lib/storage.js.
try {
  var theme = localStorage.getItem("whip-tracker:theme");
  if (!theme) {
    var saved = JSON.parse(localStorage.getItem("whip-tracker:v2") || "{}");
    theme = saved.settings && saved.settings.theme;
  }
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
} catch (e) {}
