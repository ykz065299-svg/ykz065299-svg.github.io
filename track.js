/* v301 — 轻量埋点：访问 / 开始求签 + 用户 token */
(() => {
  const LS_UID = "kanshan_uid";
  const LS_TOKEN = "kanshan_token";
  const SS_PV = "kanshan_pv_sent";
  const TOKEN_KEYS = ["token", "uid", "user_token", "utm_token", "zh_token"];

  function readUrlToken() {
    try {
      const q = new URLSearchParams(location.search);
      for (const k of TOKEN_KEYS) {
        const v = (q.get(k) || "").trim();
        if (v) return v.slice(0, 128);
      }
    } catch (_) {}
    return "";
  }

  function anonId() {
    let id = "";
    try {
      id = localStorage.getItem(LS_UID) || "";
      if (!id) {
        id =
          "anon_" +
          Math.random().toString(36).slice(2, 10) +
          Date.now().toString(36).slice(-4);
        localStorage.setItem(LS_UID, id);
      }
    } catch (_) {
      id = "anon_session";
    }
    return id;
  }

  function resolveToken() {
    const fromUrl = readUrlToken();
    if (fromUrl) {
      try {
        localStorage.setItem(LS_TOKEN, fromUrl);
      } catch (_) {}
      return fromUrl;
    }
    try {
      const saved = localStorage.getItem(LS_TOKEN);
      if (saved) return saved.slice(0, 128);
    } catch (_) {}
    return anonId();
  }

  function endpoint() {
    const meta = document.querySelector('meta[name="kanshan-track-endpoint"]');
    const href = (meta && meta.getAttribute("content")) || "/api/track";
    return href.trim() || "/api/track";
  }

  function sessionId() {
    try {
      let s = sessionStorage.getItem("kanshan_sid");
      if (!s) {
        s = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem("kanshan_sid", s);
      }
      return s;
    } catch (_) {
      return "s_fallback";
    }
  }

  function track(event, props) {
    const payload = {
      event: String(event || "unknown").slice(0, 64),
      token: resolveToken(),
      session: sessionId(),
      ts: Date.now(),
      path: location.pathname + location.search,
      mobile: window.matchMedia("(max-width: 720px)").matches,
      ...(props || {}),
    };
    const url = endpoint();
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        if (ok) return;
      }
    } catch (_) {}
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      cache: "no-store",
    }).catch(() => {});
  }

  function pageViewOnce() {
    try {
      if (sessionStorage.getItem(SS_PV)) return;
      sessionStorage.setItem(SS_PV, "1");
    } catch (_) {}
    track("page_view");
  }

  window.KanshanTrack = {
    getToken: resolveToken,
    track,
    pageViewOnce,
    gameStart(kind) {
      track("game_start", { kind: kind || "draw" });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pageViewOnce);
  } else {
    pageViewOnce();
  }
})();
