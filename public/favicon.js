(async function () {
  try {
    const res = await fetch("/api/bot/info");
    if (!res.ok) throw new Error("Bot info not available");

    const data = await res.json();

    if (data.avatar) {
      let icon = document.querySelector('link[rel="icon"]');

      if (!icon) {
        icon = document.createElement("link");
        icon.rel = "icon";
        document.head.appendChild(icon);
      }

      icon.href = data.avatar + "?v=" + Date.now();
    }
  } catch (err) {
    console.error("Failed to load favicon:", err);
  }
})();