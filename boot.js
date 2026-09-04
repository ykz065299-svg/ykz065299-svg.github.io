/* v300 — 原版摇筒/出签；点击手势内解锁；音效 no-cache */
(() => {
  const bust = "?v=310";
  const NATIVE_SHAKE_SEC = 5.4;
  const SHAKE_URL = "audio/shake.wav";
  const REVEAL_URL = "audio/reveal.wav";
  const AMBIENT_URL = "audio/ambient-lite.wav";

  const AudioEngine = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    enabled: false,
    ambient: null,
    buffers: {},
    _duckTimer: 0,

    async ensure() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.25;
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.92;
        this.sfxGain.connect(this.master);
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return this.ctx;
    },

    async loadBuffer(name, url) {
      if (this.buffers[name]) return this.buffers[name];
      // 不用 force-cache：SW/旧缓存容易把大 wav 卡住导致无声
      const res = await fetch(url + bust, { cache: "no-cache" });
      if (!res.ok) throw new Error("load fail " + url);
      const arr = await res.arrayBuffer();
      if (!arr.byteLength) throw new Error("empty audio " + url);
      const buf = await this.ctx.decodeAudioData(arr.slice(0));
      this.buffers[name] = buf;
      return buf;
    },

    async enable() {
      await this.ensure();
      this.enabled = true;
      this.startAmbient();
      // 预热，失败不挡求签（播放时再拉）
      this.loadBuffer("shake", SHAKE_URL).catch(() => {});
      this.loadBuffer("reveal", REVEAL_URL).catch(() => {});
    },

    async disable() {
      this.enabled = false;
      if (this.ambient) {
        this.ambient.pause();
        this.ambient.src = "";
        this.ambient = null;
      }
    },

    startAmbient() {
      if (this.ambient) return;
      const a = new Audio(AMBIENT_URL + bust);
      a.loop = true;
      a.volume = 0.22;
      a.preload = "none";
      a.play().catch(() => {});
      this.ambient = a;
    },

    duckMusic(seconds = NATIVE_SHAKE_SEC) {
      if (!this.ambient) return;
      const prev = this.ambient.volume;
      this.ambient.volume = 0.06;
      clearTimeout(this._duckTimer);
      this._duckTimer = setTimeout(() => {
        if (this.ambient) this.ambient.volume = prev || 0.22;
      }, (seconds + 0.55) * 1000);
    },

    playHtml(url, volume) {
      const a = new Audio(url + bust);
      a.volume = volume;
      a.play().catch(() => {});
      return a;
    },

    _waitHtml(url, volume, rate, seconds) {
      return new Promise((resolve) => {
        const a = this.playHtml(url, volume);
        try {
          if (a) a.playbackRate = rate;
        } catch (_) {}
        if (!a) return resolve();
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          try {
            a.pause();
          } catch (_) {}
          resolve();
        };
        a.addEventListener("ended", done, { once: true });
        setTimeout(done, (seconds + 0.15) * 1000);
      });
    },

    /** 完整一轮摇签声（0821）；rate<1 时整段放慢，播完 resolve */
    async playShake(opts = {}) {
      const rate = typeof opts.rate === "number" && opts.rate > 0 ? opts.rate : 1;
      const duckSec =
        typeof opts.seconds === "number"
          ? opts.seconds
          : NATIVE_SHAKE_SEC / Math.max(rate, 0.01);

      try {
        await this.ensure();
      } catch (_) {
        return this._waitHtml(SHAKE_URL, 0.85, rate, duckSec);
      }

      if (this.enabled) this.duckMusic(duckSec);

      try {
        const buf = await this.loadBuffer("shake", SHAKE_URL);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 80;
        const mid = this.ctx.createBiquadFilter();
        mid.type = "peaking";
        mid.frequency.value = 520;
        mid.Q.value = 0.9;
        mid.gain.value = 2.2;
        const shelf = this.ctx.createBiquadFilter();
        shelf.type = "highshelf";
        shelf.frequency.value = 3500;
        shelf.gain.value = -4;
        const lp = this.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 4200;
        lp.Q.value = 0.6;
        const g = this.ctx.createGain();
        g.gain.value = 0.86;
        src.connect(hp);
        hp.connect(mid);
        mid.connect(shelf);
        shelf.connect(lp);
        lp.connect(g);
        g.connect(this.sfxGain);

        const dur = buf.duration / Math.max(rate, 0.01);
        await new Promise((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          src.onended = done;
          src.start(); // 完整一轮，不截取
          setTimeout(done, (dur + 0.12) * 1000);
        });
      } catch (_) {
        return this._waitHtml(SHAKE_URL, 0.85, rate, duckSec);
      }
    },

    async playReveal() {
      try {
        await this.ensure();
        const buf = await this.loadBuffer("reveal", REVEAL_URL);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const lp = this.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 4800;
        const g = this.ctx.createGain();
        g.gain.value = 0.88;
        src.connect(lp);
        lp.connect(g);
        g.connect(this.sfxGain);
        const dur = buf.duration;
        await new Promise((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          src.onended = done;
          src.start();
          setTimeout(done, (dur + 0.12) * 1000);
        });
      } catch (_) {
        return this._waitHtml(REVEAL_URL, 0.8, 1, 4.8);
      }
    },
  };

  window.KanshanAudio = AudioEngine;
})();

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

/* v184 — 热榜解析 + SW 注册 */
const drawBtn = document.getElementById("drawBtn");
const againBtn = document.getElementById("againBtn");
const btnLabel = document.getElementById("btnLabel");
const hint = document.getElementById("hint");
const phaseText = document.getElementById("phaseText");
const storyLine = document.getElementById("storyLine");
const tubeLabel = document.getElementById("tubeLabel");
const seerCaption = document.getElementById("seerCaption");
const slipGrade = document.getElementById("slipGrade");
const slipNo = document.getElementById("slipNo");
const slipMotto = document.getElementById("slipMotto");
const rankEl = document.getElementById("rank");
const oracleText = document.getElementById("oracleText");
const UNLOCK_FALLBACK = "这一签只说到这里，别人的故事或许还有下文。";
const topicTitle = document.getElementById("topicTitle");
const topicSummary = document.getElementById("topicSummary");
const topicLink = document.getElementById("topicLink");
const audioToggle = document.getElementById("audioToggle");
const pageRitual = document.getElementById("pageRitual");
const scrollCue = document.getElementById("scrollCue");
const fortuneCard = document.getElementById("fortuneCard");
const slipPaper = document.getElementById("slipPaper");
const slipCardArt = document.getElementById("slipCardArt");
const tubeStage = document.getElementById("tubeStage");
const shareBtn = document.getElementById("shareBtn");
const readBtn = document.getElementById("readBtn");
const aiSearchBtn = document.getElementById("aiSearchBtn");
const slipMeaning = document.getElementById("slipMeaning");
const slipMeaningText = document.getElementById("slipMeaningText");
const shareBackup = document.getElementById("shareBackup");
const shareBackupArt = document.getElementById("shareBackupArt");
const shareBackupHint = document.getElementById("shareBackupHint");
const shareBackupText = document.getElementById("shareBackupText");
const shareCopyBtn = document.getElementById("shareCopyBtn");
const shareDownloadBtn = document.getElementById("shareDownloadBtn");
const shareGoZhihuBtn = document.getElementById("shareGoZhihuBtn");
const shareBackupClose = document.getElementById("shareBackupClose");
const SHARE_TOPIC_NAME = "看山今日一签";
const SHARE_TOPIC_ID = "unknown";

let busy = false;
let audioOn = false;
let ritualAssetsReady = false;
let lastDraw = null;
let interpretBusy = false;
let SLIP_CARDS = { cards: [] };
const LOCAL_CARD_PREVIEW = new URLSearchParams(window.location.search).get("localCards") === "1";

function isZhihuCdn(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)zhimg\.com$/i.test(u.hostname);
  } catch (_) {
    return false;
  }
}

function cardById(id) {
  return (SLIP_CARDS.cards || []).find((c) => Number(c.id) === Number(id)) || null;
}

function hostedCardUrl(slip) {
  const url = slip?.image_url || cardById(slip?.no)?.url || "";
  return isZhihuCdn(url) ? url : "";
}

function displayCardSrc(slip) {
  const card = cardById(slip?.no);
  if (LOCAL_CARD_PREVIEW && card?.file) return "art/slip-cards/" + encodeURIComponent(card.file);
  const hosted = hostedCardUrl(slip);
  if (hosted) return hosted;
  if (card?.file) return "art/slip-cards/" + encodeURIComponent(card.file);
  return "";
}

function clearHostedCard() {
  slipPaper?.classList.remove("is-hosted");
  slipPaper?.classList.remove("local-card-preview");
  fortuneCard?.classList.remove("has-art");
  if (!slipCardArt) return;
  slipCardArt.onload = null;
  slipCardArt.onerror = null;
  slipCardArt.removeAttribute("src");
  slipCardArt.hidden = true;
  slipCardArt.alt = "";
}

function showHostedCard(url, name) {
  if (!slipCardArt || !url) {
    clearHostedCard();
    return;
  }
  slipCardArt.onload = () => {
    slipPaper?.classList.add("is-hosted");
    slipPaper?.classList.toggle("local-card-preview", LOCAL_CARD_PREVIEW);
    fortuneCard?.classList.add("has-art");
    slipCardArt.hidden = false;
  };
  slipCardArt.onerror = () => {
    clearHostedCard();
  };
  slipCardArt.alt = name || "今日一签";
  slipCardArt.src = url;
}

async function loadSlipCards() {
  try {
    const r = await fetch("data/slip-cards.json", { cache: "no-store" });
    if (r.ok) SLIP_CARDS = await r.json();
  } catch (_) {}
}
loadSlipCards();

const ACT_NAMES = new Set(["叩问", "尘定", "认主", "显机"]);

/** polish-20 定稿文案 */
const ACT_META = {
  idle: {
    phase: "静候开筒",
    line: "心念一事，再请看山开筒",
    btn: "求签",
    hint: "点击签筒 · 心诚则灵",
  },
  摇签: { phase: "摇签", line: "", btn: "求签", hint: "" },
  叩问: { phase: "叩问", line: "", btn: "求签", hint: "" },
  尘定: { phase: "尘定", line: "", btn: "求签", hint: "" },
  认主: { phase: "认主", line: "", btn: "求签", hint: "" },
  显机: { phase: "显机", line: "", btn: "求签", hint: "" },
  待命: { phase: "显机", line: "墨迹将现…", btn: "求签", hint: "" },
};

function setAudioUi() {
  audioToggle.textContent = audioOn ? "氛围音 · 开" : "氛围音 · 关";
}

function ensureAudio() {
  if (audioOn || !window.KanshanAudio) return Promise.resolve();
  return window.KanshanAudio.enable()
    .then(() => {
      audioOn = true;
      setAudioUi();
    })
    .catch(() => {});
}

/** 必须在用户点击的同步阶段调用，避免 iOS 手势过期后无声 */
function unlockAudioSync() {
  try {
    window.KanshanAudio?.ensure?.();
  } catch (_) {}
  return ensureAudio();
}

function ensureRitualAssets() {
  document.body.classList.add("ritual-assets-ready");
  document.querySelectorAll("img[data-src]").forEach(function (img) {
    const want = img.getAttribute("data-src");
    if (!want) return;
    if (img.getAttribute("src") !== want) img.setAttribute("src", want);
    // 破图后重试：清掉失败态再赋一次
    if (img.complete && img.naturalWidth === 0) {
      img.removeAttribute("src");
      img.setAttribute("src", want);
    }
  });
  ritualAssetsReady = true;
}

audioToggle.addEventListener("click", async () => {
  if (!audioOn) {
    await window.KanshanAudio.enable();
    audioOn = true;
    setHint("氛围音已开");
  } else {
    await window.KanshanAudio.disable();
    audioOn = false;
  }
  setAudioUi();
});

scrollCue?.addEventListener("click", () => {
  ensureRitualAssets();
  unlockAudioSync();
  pageRitual?.scrollIntoView({ behavior: "smooth", block: "start" });
});

// 进二页（或已在二页）就挂背景；签筒/看山 HTML 已带 src，不依赖懒加载
function ritualNearViewport() {
  if (!pageRitual) return true;
  const r = pageRitual.getBoundingClientRect();
  const vh = window.innerHeight || 800;
  return r.top < vh + 160 && r.bottom > -40;
}
if (ritualNearViewport()) ensureRitualAssets();

if (pageRitual && "IntersectionObserver" in window) {
  const assetsIo = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      ensureRitualAssets();
      assetsIo.disconnect();
    },
    { rootMargin: "160px 0px" }
  );
  assetsIo.observe(pageRitual);

  const visIo = new IntersectionObserver(
    ([entry]) => {
      document.body.classList.toggle(
        "ritual-visible",
        entry.isIntersecting && entry.intersectionRatio > 0.15
      );
    },
    { threshold: [0, 0.15, 0.5] }
  );
  visIo.observe(pageRitual);
} else {
  ensureRitualAssets();
  document.body.classList.add("ritual-visible");
}

function setBusy(on) {
  busy = on;
  drawBtn.disabled = on;
  if (againBtn) againBtn.disabled = on;
}

function fadeText(el, text) {
  if (!el) return;
  const next = text || "";
  if (el.textContent !== next) el.textContent = next;
  el.style.opacity = "";
}

function setHint(text) {
  if (!hint) return;
  hint.textContent = text || "";
  hint.style.opacity = text ? "1" : "0";
}

function setPhase(name) {
  const meta = ACT_META[name] || ACT_META.idle;
  const seerMap = {
    idle: "看山候你",
    叩问: "看山侧耳",
    摇签: "看山摇筒",
    尘定: "看山凝神",
    认主: "看山点头",
    显机: "看山展卷",
    待命: "看山展卷",
  };

  if (phaseText) {
    phaseText.textContent = meta.phase;
    phaseText.style.opacity = "";
  }
  if (storyLine) {
    storyLine.textContent = meta.line || "";
    storyLine.style.opacity = meta.line ? "" : "0";
  }
  if (btnLabel) btnLabel.textContent = meta.btn || "求签";
  if (hint) {
    hint.textContent = meta.hint || "";
    hint.style.opacity = meta.hint ? "1" : "0";
  }
  if ((name === "idle" || name === "摇签") && tubeLabel) {
    tubeLabel.textContent = "百签同栖 · 一签认主";
  }
  if (seerCaption) seerCaption.textContent = seerMap[name] || "看山候你";
}

function settleDoneCopy(data) {
  const s = data?.slip || {};
  if (phaseText) phaseText.textContent = s.name || s.label || "一签已定";
  if (storyLine) {
    storyLine.style.opacity = "1";
    storyLine.textContent = s.label || "";
  }
  if (hint) hint.style.opacity = "0";
  if (btnLabel) btnLabel.textContent = "求签";
  if (seerCaption) seerCaption.textContent = "看山已决";
  if (tubeLabel) tubeLabel.textContent = "一签认主";
}

function resetIdleCopy() {
  setPhase("idle");
  if (storyLine) {
    storyLine.style.opacity = "1";
    storyLine.textContent = ACT_META.idle.line;
  }
  if (hint) hint.style.opacity = "1";
}

function cleanMediaPlaceholder(raw) {
  if (!raw) return "";
  let s = String(raw)
    .replace(/\[\s*(?:图片|视频|动图|gif|image|video|photo|img)\s*\]/gi, " ")
    .replace(/(?:^|\s)(?:图片|视频|动图)(?=\s|$)/g, " ")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/[ \t\u3000]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/^[·。，,;；\s]+|[·。，,;；\s]+$/g, "");
  if (!s || ["图片", "视频", "动图"].includes(s)) return "";
  return s;
}

function aiSearchUrl(title) {
  const q = String(title || "").trim();
  if (!q) return "https://www.zhihu.com/search?type=zhida";
  return (
    "https://www.zhihu.com/search?q=" +
    encodeURIComponent(q) +
    "&search_type_string=ai_zhida&category=ai_zhida&search_type_str=ai_zhida&type=zhida"
  );
}

function slipSearchQuery(data) {
  const s = data?.slip || {};
  return String(data?.oracle || s.verse || s.question || s.name || "").trim();
}

function splitVerse(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const cut = s.search(/[，,]/);
  if (cut >= 0) {
    const left = s.slice(0, cut + 1).trim();
    const right = s.slice(cut + 1).trim();
    return [left, right].filter(Boolean);
  }
  return [s];
}

function slipFromPool(pick, total) {
  const id = Number(pick.id || 1);
  const digits = "零一二三四五六七八九";
  const toCn = (n) => {
    if (n <= 0) return "零";
    if (n < 10) return digits[n];
    if (n < 20) return "十" + (n > 10 ? digits[n - 10] : "");
    if (n < 100) {
      const t = Math.floor(n / 10);
      const o = n % 10;
      return digits[t] + "十" + (o ? digits[o] : "");
    }
    return String(n);
  };
  const grade = pick.type || "从容签";
  const keys = { 从容签: "calm", 自在签: "free", 清欢签: "joy" };
  const name = pick.name || "";
  const card = cardById(id);
  const image_url = isZhihuCdn(card?.url) ? card.url : "";
  return {
    ok: true,
    oracle: pick.verse || "",
    rank: id,
    total,
    slip: {
      no: id,
      no_cn: toCn(id),
      label: `第${toCn(id)}签`,
      name,
      grade,
      grade_key: keys[grade] || "calm",
      aspect: pick.aspect || "",
      meaning: pick.meaning || "",
      question: pick.question || "",
      verse: pick.verse || "",
      search: card?.search || "",
      image_url,
      image_width: card?.width || 1085,
      image_height: card?.height || 1450,
    },
    item: { title: name },
    source: "slips",
  };
}

function clearSlip() {
  if (slipGrade) {
    slipGrade.textContent = "";
    slipGrade.className = "slip-seal";
  }
  if (slipNo) slipNo.textContent = "";
  if (oracleText) oracleText.replaceChildren();
  if (topicTitle) topicTitle.textContent = "";
  clearHostedCard();
  if (slipMeaningText) slipMeaningText.textContent = "";
  if (slipMeaning) slipMeaning.hidden = true;
  if (readBtn) readBtn.disabled = false;
  interpretBusy = false;
  lastDraw = null;
  if (fortuneCard) {
    fortuneCard.style.removeProperty("--slip-h");
    fortuneCard.classList.remove("fit", "measuring", "preglow", "is-read", "has-art");
  }
}

function fillSlip(data) {
  const s = data.slip || {};
  if (slipNo) slipNo.textContent = s.label || `第${data.rank}签`;
  if (slipGrade) {
    slipGrade.textContent = s.grade || "从容签";
    slipGrade.className = "slip-seal " + (s.grade_key || "calm");
  }
  if (topicTitle) topicTitle.textContent = s.name || data.item?.title || "";
  if (oracleText) {
    oracleText.replaceChildren();
    splitVerse(data.oracle || "").forEach((line) => {
      const span = document.createElement("span");
      span.textContent = line;
      oracleText.appendChild(span);
    });
  }
  if (slipMeaningText) slipMeaningText.textContent = s.meaning || "";
  if (slipMeaning) slipMeaning.hidden = true;
  if (readBtn) readBtn.disabled = false;
  const cardUrl = displayCardSrc(s);
  if (cardUrl) showHostedCard(cardUrl, s.name);
  else clearHostedCard();
  lastDraw = data;
}

function prepareSlipSize() {
  if (!fortuneCard) return 380;
  fortuneCard.hidden = false;
  fortuneCard.classList.remove("visible", "glowing", "revealed", "preglow");
  fortuneCard.classList.add("measuring", "fit");
  fortuneCard.style.height = "auto";
  void fortuneCard.offsetHeight;
  const h = Math.ceil(fortuneCard.getBoundingClientRect().height);
  fortuneCard.classList.remove("measuring");
  fortuneCard.hidden = true;
  return Math.max(280, h);
}

async function localDrawFallback() {
  const r = await fetch("data/slips.json", { cache: "no-store" });
  if (!r.ok) throw new Error("签库为空");
  const list = await r.json();
  if (!Array.isArray(list) || !list.length) throw new Error("签库为空");
  const pick = list[Math.floor(Math.random() * list.length)];
  return slipFromPool(pick, list.length);
}

async function fetchDraw() {
  try {
    const r = await fetch("/api/draw", { cache: "no-store" });
    let data = null;
    try {
      data = await r.json();
    } catch (_) {
      data = null;
    }
    if (r.ok && data?.ok) return data;
  } catch (_) {}
  return localDrawFallback();
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function retractSlipIfNeeded() {
  if (!pageRitual?.classList.contains("has-slip")) return;
  pageRitual.classList.add("slip-retracting");
  await wait(420);
  pageRitual.classList.remove("slip-retracting", "has-slip");
  if (fortuneCard) {
    fortuneCard.classList.remove("visible", "glowing", "revealed", "preglow");
    fortuneCard.hidden = true;
  }
}

async function draw() {
  if (busy) return;
  setBusy(true);
  const isAgain = pageRitual?.classList.contains("has-slip");
  window.KanshanTrack?.gameStart(isAgain ? "again" : "draw");
  // 先解锁音频（仍在点击手势内），再做收签等 await
  const audioReady = unlockAudioSync();
  clearSlip();
  ensureRitualAssets();
  await retractSlipIfNeeded();
  window.KanshanScene?.resetRitualVisual?.();
  resetIdleCopy();
  pageRitual?.scrollIntoView({ behavior: "smooth", block: "start" });
  await audioReady;

  const fetchPromise = fetchDraw().catch((err) => ({ __err: err }));

  try {
    await window.KanshanScene.playShakeAndDraw((name) => setPhase(name));
    setPhase("待命");
    const data = await fetchPromise;
    if (data?.__err) throw data.__err;
    fillSlip(data);
    const slipH = prepareSlipSize();
    await window.KanshanScene.revealSlip((name) => setPhase(name), { height: slipH });
    settleDoneCopy(data);
  } catch (err) {
    window.KanshanScene?.resetRitualVisual?.();
    clearSlip();
    resetIdleCopy();
    const msg = String(err?.message || err || "");
    setHint(/rate limit/i.test(msg) ? "山门拥挤，请稍候再求" : `求签未果：${msg}`);
  } finally {
    setBusy(false);
    if (btnLabel) btnLabel.textContent = "求签";
  }
}

drawBtn.addEventListener("click", draw);
againBtn?.addEventListener("click", draw);
tubeStage?.addEventListener("click", (e) => {
  if (busy) return;
  if (pageRitual?.classList.contains("has-slip")) return;
  e.preventDefault();
  draw();
});
tubeStage?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  if (busy || pageRitual?.classList.contains("has-slip")) return;
  draw();
});

topicLink?.addEventListener("click", () => {
  window.KanshanTrack?.track?.("topic_click", {
    kind: "ai_search",
    title: (lastDraw?.item?.title || "").slice(0, 80),
  });
});

function inZhihuApp() {
  return /ZhihuHybrid|Zhihu/i.test(navigator.userAgent || "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isPcShare() {
  if (inZhihuApp()) return false;
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

function buildShareText(data) {
  const s = data?.slip || {};
  const verse = String(data?.oracle || s.verse || "").trim();
  return [
    "今日一签已落定。",
    s.name ? `「${s.name}」` : "",
    verse,
    `#${SHARE_TOPIC_NAME}#`,
    "——看山今日一签",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPinEditorUrl(options, inApp) {
  const content = {
    html:
      `<p>${escapeHtml(options.text)}</p>` +
      `<p> <a class="hash_tag" data-topic-id="${escapeHtml(options.topicId)}">` +
      `#${escapeHtml(options.topicName)}#</a> </p>`,
    meta: {
      topic: { all: 0, data: {} },
      adActivityLink: { all: 0, data: {} },
    },
    attachment: {
      images: [
        {
          url: options.imageUrl,
          original_src: options.imageUrl,
          thumbnail: options.imageUrl,
          caption: "",
          raw_width: options.imageWidth,
          raw_height: options.imageHeight,
          size: "normal",
          watermark: "none",
        },
      ],
    },
  };
  const entry = inApp
    ? "zhihu://community/short_pin_editor"
    : "https://oia.zhihu.com/community/short_pin_editor";
  return (
    entry +
    "?tab=pin&content=" +
    encodeURIComponent(JSON.stringify(content)) +
    "&pre_fill_image_url=" +
    encodeURIComponent(options.imageUrl)
  );
}

function openAiSearch() {
  if (!lastDraw) return;
  const s = lastDraw.slip || {};
  const href = s.search || aiSearchUrl(slipSearchQuery(lastDraw));
  window.KanshanTrack?.track?.("interpret_click", {
    kind: "ai_search",
    title: String(s.name || "").slice(0, 40),
  });
  if (inZhihuApp()) window.location.href = href;
  else window.open(href, "_blank", "noopener");
}

async function copyShareText() {
  const text = buildShareText(lastDraw);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

async function downloadSlipImage() {
  const src = displayCardSrc(lastDraw?.slip || {});
  if (!src) return false;
  const name = `kanshan-${lastDraw?.slip?.no || "slip"}.png`;
  try {
    const r = await fetch(src);
    if (!r.ok) throw new Error("fetch");
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch (_) {
    window.open(src, "_blank", "noopener");
    return false;
  }
}

function closeShareBackup() {
  if (!shareBackup) return;
  shareBackup.hidden = true;
}

function openShareBackup() {
  if (!shareBackup || !lastDraw) return;
  const s = lastDraw.slip || {};
  const src = displayCardSrc(s);
  const text = buildShareText(lastDraw);
  if (shareBackupText) shareBackupText.textContent = text;
  if (shareBackupArt) {
    if (src) {
      shareBackupArt.src = src;
      shareBackupArt.hidden = false;
    } else {
      shareBackupArt.removeAttribute("src");
      shareBackupArt.hidden = true;
    }
  }
  if (shareBackupHint) {
    shareBackupHint.textContent = isPcShare()
      ? "电脑上请先复制文案、下载签卡，再到知乎首页手动发想法。"
      : "先复制文案、保存签卡，再到知乎发想法。";
  }
  shareBackup.hidden = false;
}

async function shareToThoughts() {
  if (!lastDraw) return;
  const s = lastDraw.slip || {};
  const imageUrl = hostedCardUrl(s);
  window.KanshanTrack?.track?.("share_open", { kind: "thoughts" });
  if (!isPcShare() && imageUrl) {
    window.location.href = buildPinEditorUrl(
      {
        text: buildShareText(lastDraw),
        topicName: SHARE_TOPIC_NAME,
        topicId: SHARE_TOPIC_ID,
        imageUrl,
        imageWidth: Number(s.image_width || cardById(s.no)?.width || 1085),
        imageHeight: Number(s.image_height || cardById(s.no)?.height || 1450),
      },
      inZhihuApp()
    );
    return;
  }
  openShareBackup();
}

function openShareSheet() {
  shareToThoughts();
}

async function renderSharePng() {
  if (!shareCard) return null;
  const w = 720;
  const h = 1280;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // dark premium bg
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 40, w * 0.5, h * 0.5, h * 0.7);
  g.addColorStop(0, "#2a2218");
  g.addColorStop(0.45, "#14110e");
  g.addColorStop(1, "#070605");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // sparkles
  ctx.fillStyle = "rgba(231,193,106,.35)";
  for (let i = 0; i < 48; i++) {
    const x = (Math.sin(i * 12.1) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 7.7) * 0.5 + 0.5) * h;
    const r = 0.6 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // title
  ctx.fillStyle = "#f3dfaa";
  ctx.textAlign = "center";
  ctx.font = "600 42px 'Songti SC','Noto Serif SC',serif";
  ctx.fillText("一签入手，万念归心", w / 2, 110);
  ctx.font = "28px 'Songti SC','Noto Serif SC',serif";
  ctx.fillStyle = "rgba(243,223,170,.72)";
  ctx.fillText("生成你的今日问心签笺", w / 2, 160);

  // card frame
  const cx = w * 0.38;
  const cy = h * 0.52;
  const cw = 280;
  const ch = 560;
  ctx.save();
  ctx.shadowColor = "rgba(231,193,106,.45)";
  ctx.shadowBlur = 36;
  ctx.fillStyle = "#1a140f";
  roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 18);
  ctx.fill();
  ctx.restore();

  // gold border
  ctx.strokeStyle = "rgba(231,193,106,.75)";
  ctx.lineWidth = 3;
  roundRect(ctx, cx - cw / 2 + 10, cy - ch / 2 + 10, cw - 20, ch - 20, 12);
  ctx.stroke();

  // parchment
  const px = cx - 70;
  const py = cy - 200;
  const pw = 140;
  const ph = 360;
  ctx.fillStyle = "#efe2c4";
  roundRect(ctx, px, py, pw, ph, 6);
  ctx.fill();

  // vertical oracle
  const oracle = String(lastDraw?.oracle || "心诚则灵").slice(0, 16);
  ctx.fillStyle = "#1a1208";
  ctx.font = "600 28px 'Songti SC','Noto Serif SC',serif";
  ctx.textAlign = "center";
  const chars = [...oracle];
  const startY = py + 48;
  const gap = Math.min(34, (ph - 96) / Math.max(1, chars.length));
  chars.forEach((ch, i) => {
    ctx.fillText(ch, px + pw / 2, startY + i * gap);
  });

  // seal
  ctx.strokeStyle = "rgba(180,40,35,.85)";
  ctx.fillStyle = "rgba(180,40,35,.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + ch / 2 - 56, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "22px 'Songti SC',serif";
  ctx.fillText("签", cx, cy + ch / 2 - 48);

  // tube hint right
  ctx.fillStyle = "rgba(243,223,170,.55)";
  ctx.font = "22px sans-serif";
  ctx.textAlign = "left";
  const grade = lastDraw?.slip?.grade || "";
  const title = String(lastDraw?.item?.title || "").slice(0, 18);
  ctx.fillText(grade, cx + cw / 2 + 24, cy - 40);
  wrapText(ctx, title, cx + cw / 2 + 24, cy - 8, 160, 28);

  ctx.fillStyle = "rgba(243,223,170,.45)";
  ctx.textAlign = "center";
  ctx.font = "22px 'Songti SC',serif";
  ctx.fillText("看山今日一签 · 心诚则灵", w / 2, h - 64);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const chars = [...text];
  let line = "";
  let yy = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

async function saveShareCard() {
  const blob = await renderSharePng();
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kanshan-slip-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  window.KanshanTrack?.track?.("share_save", { kind: "png" });
}

async function shareToPin() {
  const blob = await renderSharePng();
  const text = [
    "一签入手，万念归心",
    lastDraw?.oracle || "",
    lastDraw?.item?.title ? `今日问心：${lastDraw.item.title}` : "",
    "——看山今日一签",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    if (blob && navigator.share && navigator.canShare) {
      const file = new File([blob], "kanshan-slip.png", { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: "看山今日一签" });
        window.KanshanTrack?.track?.("share_pin", { kind: "webshare" });
        return;
      }
    }
  } catch (_) {}

  try {
    await navigator.clipboard?.writeText?.(text);
  } catch (_) {}
  if (blob) await saveShareCard();
  window.open("https://www.zhihu.com/pin/edit", "_blank", "noopener");
  window.KanshanTrack?.track?.("share_pin", { kind: "pin_edit" });
  setHint("卡片已留存，可粘贴到想法");
}

shareBtn?.addEventListener("click", openShareSheet);
function openSlipMeaning() {
  if (interpretBusy || !lastDraw || fortuneCard?.classList.contains("is-read")) return;
  interpretBusy = true;
  const s = lastDraw.slip || {};
  window.KanshanTrack?.track?.("interpret_click", {
    kind: "解签按钮点击",
    title: String(s.name || "").slice(0, 40),
  });
  if (slipMeaningText) slipMeaningText.textContent = s.meaning || UNLOCK_FALLBACK;
  if (slipMeaning) slipMeaning.hidden = false;
  fortuneCard?.classList.add("is-read");
  if (readBtn) readBtn.disabled = true;
  window.scrollTo(0, 0);
  pageRitual?.scrollIntoView({ block: "start" });
  window.setTimeout(() => {
    interpretBusy = false;
  }, 520);
}
readBtn?.addEventListener("click", openSlipMeaning);
aiSearchBtn?.addEventListener("click", openAiSearch);
shareBackupClose?.addEventListener("click", closeShareBackup);
shareBackup?.addEventListener("click", (e) => {
  if (e.target === shareBackup) closeShareBackup();
});
shareCopyBtn?.addEventListener("click", async () => {
  const ok = await copyShareText();
  setHint(ok ? "文案已复制" : "复制失败，请手动选中文案");
});
shareDownloadBtn?.addEventListener("click", async () => {
  const ok = await downloadSlipImage();
  setHint(ok ? "签卡已下载" : "已打开签卡，请另存图片");
});
shareGoZhihuBtn?.addEventListener("click", async () => {
  await copyShareText();
  await downloadSlipImage();
  window.open("https://www.zhihu.com/", "_blank", "noopener");
  window.KanshanTrack?.track?.("share_open", { kind: "pc_home" });
  setHint("文案已复制，签卡已下载，请到知乎首页发想法");
});

setAudioUi();
resetIdleCopy();

(async function previewNamedSlip() {
  const id = Number(new URLSearchParams(location.search).get("slip") || 0);
  if (!Number.isFinite(id) || id < 1) return;
  try {
    await loadSlipCards();
    const list = await (await fetch("data/slips.json", { cache: "no-store" })).json();
    const pick = list.find((s) => Number(s.id) === id);
    if (!pick) return;
    const data = slipFromPool(pick, list.length);
    ensureRitualAssets();
    document.body.classList.add("ritual-visible");
    document.getElementById("pageCover")?.setAttribute("hidden", "");
    pageRitual?.classList.add("has-slip");
    fillSlip(data);
    if (fortuneCard) {
      fortuneCard.hidden = false;
      fortuneCard.classList.add("visible", "revealed", "fit");
    }
    settleDoneCopy(data);
    if (new URLSearchParams(location.search).get("read") === "1") {
      openSlipMeaning();
    }
    window.scrollTo(0, 0);
    pageRitual?.scrollIntoView({ block: "start" });
  } catch (_) {}
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js?v=418").catch(() => {});
  });
}

/* v295 — 整轮收势放柔；幕间仍稳 */
(() => {
  const tube = document.getElementById("tube");
  const tubeStage = document.getElementById("tubeStage");
  const emerging = document.getElementById("emerging");
  const fortuneCard = document.getElementById("fortuneCard");
  const pageRitual = document.getElementById("pageRitual");
  const ritual = document.getElementById("ritual");
  const kanshanSeer = document.getElementById("kanshanSeer");
  const actFlash = document.getElementById("actFlash");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const ACT_WORDS = ["叩问", "尘定", "认主", "显机"];
  const NATIVE_MS = 5400;
  const SHAKE_MS = 9200;
  const PLAY_RATE = NATIVE_MS / SHAKE_MS;
  const SHAKE_PEAKS = [0.55, 1.75, 2.95, 4.15].map((t) => t / PLAY_RATE);

  const MOBILE =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 720px)").matches;
  const PEAK_AMP_Y = MOBILE ? 2.4 : 3.2;
  const PEAK_AMP_S = MOBILE ? 0.018 : 0.024;
  const SEER_PEAK_WIDTH = 0.26;
  const SEER_REACT_S = 0.06;
  const LERP_TUBE = 0.42;
  const LERP_SEER = 0.38;

  let shakeRaf = 0;
  let settleRaf = 0;
  let smoothTube = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
  let smoothSeer = { y: 0, scale: 1, rot: 0 };

  function resetSmoothMotion() {
    smoothTube = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
    smoothSeer = { y: 0, scale: 1, rot: 0 };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function setSeer(mode) {
    if (!kanshanSeer) return;
    kanshanSeer.classList.remove("casting", "blessing", "beating");
    if (mode) kanshanSeer.classList.add(mode);
  }

  function clearSeerMotion() {
    if (!kanshanSeer) return;
    kanshanSeer.style.transform = "";
    kanshanSeer.style.filter = "";
    kanshanSeer.style.opacity = "";
  }

  function stopShake() {
    cancelAnimationFrame(shakeRaf);
    cancelAnimationFrame(settleRaf);
    shakeRaf = 0;
    if (tube) {
      tube.style.transform = "";
      tube.style.filter = "";
    }
    clearSeerMotion();
    resetSmoothMotion();
  }

  function tubePeakAmp(t, peaks) {
    let amp = 0;
    for (const p of peaks) {
      const d = Math.abs(t - p);
      // 窄峰：幕间归零，只在峰点明显晃一下
      if (d < 0.32) {
        const v = Math.cos((d / 0.32) * (Math.PI / 2));
        amp = Math.max(amp, v * v);
      }
    }
    return Math.min(1, amp);
  }

  function seerPeakAmp(t, peaks) {
    let amp = 0;
    for (const p of peaks) {
      const d = Math.abs(t - (p + SEER_REACT_S));
      if (d < SEER_PEAK_WIDTH) {
        const v = Math.cos((d / SEER_PEAK_WIDTH) * (Math.PI / 2));
        amp = Math.max(amp, v * v);
      }
    }
    return amp;
  }

  function applySeerFloat(t, peaks, tubeAmp) {
    if (!kanshanSeer) return;
    const peakAmp = seerPeakAmp(t, peaks);
    const amp = Math.min(1, peakAmp * 0.95 + tubeAmp * 0.12);
    const targetScale = 1 + amp * PEAK_AMP_S;
    const targetTy = -amp * PEAK_AMP_Y;
    const targetRot = smoothTube.rot * 0.16;
    const snap = amp < 0.08 ? 0.5 : LERP_SEER;
    smoothSeer.y = lerp(smoothSeer.y, targetTy, snap);
    smoothSeer.scale = lerp(smoothSeer.scale, targetScale, snap);
    smoothSeer.rot = lerp(smoothSeer.rot, targetRot, snap);
    if (amp < 0.03 && Math.abs(smoothTube.rot) < 0.25) {
      smoothSeer.y = lerp(smoothSeer.y, 0, 0.42);
      smoothSeer.scale = lerp(smoothSeer.scale, 1, 0.42);
      smoothSeer.rot = lerp(smoothSeer.rot, 0, 0.42);
      if (Math.abs(smoothSeer.y) < 0.15 && Math.abs(smoothSeer.rot) < 0.08) {
        kanshanSeer.style.transform = "";
        smoothSeer = { y: 0, scale: 1, rot: 0 };
      } else {
        kanshanSeer.style.transform =
          `translate3d(0,${smoothSeer.y.toFixed(2)}px,0) ` +
          `rotate(${smoothSeer.rot.toFixed(2)}deg) ` +
          `scale(${smoothSeer.scale.toFixed(4)})`;
      }
    } else {
      kanshanSeer.style.transform =
        `translate3d(0,${smoothSeer.y.toFixed(2)}px,0) ` +
        `rotate(${smoothSeer.rot.toFixed(2)}deg) ` +
        `scale(${smoothSeer.scale.toFixed(4)})`;
    }
  }

  function settleSeer(ms = 320) {
    if (!kanshanSeer) return Promise.resolve();
    cancelAnimationFrame(settleRaf);
    const el = kanshanSeer;
    const cs = getComputedStyle(el).transform;
    if (cs && cs !== "none") el.style.transform = cs;
    void el.offsetWidth;
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = (now) => {
        const p = Math.min(1, (now - start) / ms);
        const e = 1 - Math.pow(1 - p, 4);
        const s = 1 + (1 - e) * 0.015;
        const y = (1 - e) * -0.8;
        el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotate(0deg) scale(${s.toFixed(4)})`;
        if (p < 1) {
          settleRaf = requestAnimationFrame(tick);
        } else {
          el.style.transform = "";
          settleRaf = 0;
          resolve();
        }
      };
      settleRaf = requestAnimationFrame(tick);
    });
  }

  function flashActNow(word) {
    if (!actFlash || !word) return;
    clearTimeout(flashActNow._t);
    actFlash.textContent = word;
    actFlash.classList.remove("show");
    requestAnimationFrame(() => {
      actFlash.classList.add("show");
    });
    flashActNow._t = setTimeout(() => {
      actFlash.classList.remove("show");
    }, 900);
  }

  function settleTube(ms = 520) {
    if (!tube) return Promise.resolve();
    const from = { ...smoothTube };
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = (now) => {
        const p = Math.min(1, (now - start) / ms);
        const e = 1 - Math.pow(1 - p, 3);
        const tx = from.tx * (1 - e);
        const ty = from.ty * (1 - e);
        const rot = from.rot * (1 - e);
        const sx = from.sx + (1 - from.sx) * e;
        const sy = from.sy + (1 - from.sy) * e;
        tube.style.transform =
          `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) ` +
          `rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          tube.style.transform = "";
          smoothTube = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  function animateShake(durationMs = SHAKE_MS, onBeat) {
    return new Promise((resolve) => {
      let finished = false;
      let hushAfterReveal = false;
      let hushAt = 0;
      const finish = () => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(shakeRaf);
        shakeRaf = 0;
        tube.classList.remove("shaking");
        pageRitual?.classList.remove("is-casting");
        ritual?.classList.remove("is-shaking");
        Promise.all([settleTube(560), settleSeer(420)]).then(() => {
          if (tube) {
            tube.style.transform = "";
            tube.style.filter = "";
          }
          setSeer(null);
          resolve();
        });
      };

      tube.classList.add("shaking");
      pageRitual?.classList.add("is-casting");
      ritual?.classList.add("is-shaking");
      setSeer("casting");
      resetSmoothMotion();
      const start = performance.now();
      const peaks = SHAKE_PEAKS;
      const fired = new Set();
      const f1 = 16 * PLAY_RATE;
      const f2 = 6.2 * PLAY_RATE;
      const f3 = 12.5 * PLAY_RATE;
      const f4 = 10 * PLAY_RATE;
      const lastBeat = peaks.length - 1;

      const tick = (now) => {
        if (finished) return;
        const t = (now - start) / 1000;
        if (t >= durationMs / 1000) {
          finish();
          return;
        }

        for (let i = 0; i < peaks.length; i++) {
          if (!fired.has(i) && t >= peaks[i] - 0.05) {
            fired.add(i);
            onBeat?.(i);
            // 显机：开始整轮收势（放慢，不硬切）
            if (i === lastBeat) {
              hushAfterReveal = true;
              hushAt = t;
            }
          }
        }

        let amp = tubePeakAmp(t, peaks);
        if (hushAfterReveal) {
          // ~1s 缓出，末尾更软
          const hush = Math.min(1, (t - hushAt) / 1.05);
          const e = 1 - Math.pow(1 - hush, 2.4);
          amp *= 1 - e;
        }

        const rot =
          Math.sin(t * f1) * amp * 7.4 +
          Math.sin(t * f2) * amp * 1.8 +
          Math.sin(t * f3 * 0.55) * amp * 0.9;
        const tx = Math.sin(t * f3) * amp * 5.4 + Math.sin(t * f4 * 1.3) * amp * 1.5;
        const ty = Math.abs(Math.cos(t * f4)) * amp * 3.6;
        const squish = 1 - amp * 0.022;
        const scaleY = 1 + amp * 0.014;

        // 幕间仍较快归零；仅整轮收势时用慢插值
        let snap = LERP_TUBE;
        if (hushAfterReveal) snap = 0.16;
        else if (amp < 0.12) snap = 0.58;

        smoothTube.tx = lerp(smoothTube.tx, tx, snap);
        smoothTube.ty = lerp(smoothTube.ty, ty, snap);
        smoothTube.rot = lerp(smoothTube.rot, rot, snap);
        smoothTube.sx = lerp(smoothTube.sx, squish, snap);
        smoothTube.sy = lerp(smoothTube.sy, scaleY, snap);

        if (!hushAfterReveal && amp < 0.03) {
          smoothTube.tx = lerp(smoothTube.tx, 0, 0.48);
          smoothTube.ty = lerp(smoothTube.ty, 0, 0.48);
          smoothTube.rot = lerp(smoothTube.rot, 0, 0.48);
          smoothTube.sx = lerp(smoothTube.sx, 1, 0.48);
          smoothTube.sy = lerp(smoothTube.sy, 1, 0.48);
          if (
            Math.abs(smoothTube.tx) < 0.12 &&
            Math.abs(smoothTube.rot) < 0.08
          ) {
            tube.style.transform = "";
            smoothTube = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
          } else {
            tube.style.transform =
              `translate3d(${smoothTube.tx.toFixed(2)}px,${smoothTube.ty.toFixed(2)}px,0) ` +
              `rotate(${smoothTube.rot.toFixed(2)}deg) ` +
              `scale(${smoothTube.sx.toFixed(4)},${smoothTube.sy.toFixed(4)})`;
          }
        } else {
          tube.style.transform =
            `translate3d(${smoothTube.tx.toFixed(2)}px,${smoothTube.ty.toFixed(2)}px,0) ` +
            `rotate(${smoothTube.rot.toFixed(2)}deg) ` +
            `scale(${smoothTube.sx.toFixed(4)},${smoothTube.sy.toFixed(4)})`;
        }

        applySeerFloat(t, peaks, amp);

        shakeRaf = requestAnimationFrame(tick);
      };

      shakeRaf = requestAnimationFrame(tick);
      setTimeout(finish, durationMs + 120);
    });
  }

  function resetRitualVisual() {
    stopShake();
    setSeer(null);
    kanshanSeer?.classList.remove("exiting");
    if (kanshanSeer) {
      kanshanSeer.style.transform = "";
      kanshanSeer.style.filter = "";
      kanshanSeer.style.opacity = "";
      kanshanSeer.style.animation = "";
      kanshanSeer.style.willChange = "auto";
      kanshanSeer.style.transition = "";
    }
    pageRitual?.classList.remove("is-casting", "is-drawing", "act-flashing");
    ritual?.classList.remove("is-shaking");
    if (actFlash) {
      actFlash.classList.remove("show", "punch");
      actFlash.textContent = "";
    }
    clearTimeout(flashActNow._t);
    tubeStage.classList.remove("leaving");
    tubeStage.style.removeProperty("transform");
    tubeStage.style.removeProperty("transition");
    emerging.hidden = true;
    emerging.classList.remove("show", "fade-out");
    fortuneCard.hidden = true;
    fortuneCard.classList.remove("visible", "glowing", "revealed", "preglow", "measuring", "fit");
    fortuneCard.style.removeProperty("--slip-h");
    fortuneCard.style.height = "";
    fortuneCard.style.willChange = "auto";
    tube.style.willChange = "auto";
    pageRitual?.classList.remove("has-slip", "gold-burst");
  }

  async function playShakeAndDraw(onPhase) {
    resetRitualVisual();
    pageRitual?.classList.add("is-drawing");

    onPhase?.("摇签");
    tube.style.willChange = "transform";
    if (kanshanSeer) {
      kanshanSeer.style.willChange = "transform";
      kanshanSeer.classList.add("motion-active");
    }

    const shakeAudio =
      window.KanshanAudio?.playShake?.({
        rate: PLAY_RATE,
        seconds: SHAKE_MS / 1000,
      }) || Promise.resolve();
    const shakeMotion = animateShake(SHAKE_MS, (i) => {
      const word = ACT_WORDS[i];
      if (!word) return;
      onPhase?.(word);
      flashActNow(word);
    });

    await Promise.all([shakeAudio, shakeMotion]);
    tube.style.willChange = "auto";
    if (kanshanSeer) {
      kanshanSeer.style.willChange = "auto";
      kanshanSeer.classList.remove("motion-active");
    }
    pageRitual?.classList.remove("is-drawing");
  }

  async function revealSlip(onPhase, opts = {}) {
    /* v290 — 显机→出签：祝福 / 抽签 / 退场 / 展卷 重叠衔接，避免硬切 */
    onPhase?.("显机");
    if (kanshanSeer) {
      kanshanSeer.classList.remove("exiting");
      kanshanSeer.style.opacity = "";
      kanshanSeer.style.transition = "";
      kanshanSeer.style.transform = "";
      kanshanSeer.style.animation = "";
      kanshanSeer.style.willChange = "transform, opacity";
    }
    emerging.classList.remove("fade-out");
    setSeer("blessing");
    emerging.hidden = false;
    void emerging.offsetWidth;
    emerging.classList.add("show");
    const bellP = window.KanshanAudio?.playReveal?.() || Promise.resolve();

    // 1) 祝福起势 + 签芽抽出（重叠，不等到祝福完全结束）
    await wait(480);

    // 2) 看山顺势退场（签芽仍在）
    if (kanshanSeer) {
      kanshanSeer.style.transition =
        "opacity .9s cubic-bezier(.33,.08,.2,1), transform .9s cubic-bezier(.33,.08,.2,1)";
      kanshanSeer.classList.remove("blessing");
      void kanshanSeer.offsetWidth;
      kanshanSeer.classList.add("exiting");
      kanshanSeer.style.opacity = "0";
      kanshanSeer.style.transform = "translate3d(8px, 6px, 0) scale(.98)";
    }
    await wait(380);

    // 3) 签筒淡出，签面自签芽形态展开（交叉叠化）
    if (opts.height) {
      fortuneCard.style.setProperty("--slip-h", `${opts.height}px`);
    }
    fortuneCard.style.height = "auto";
    fortuneCard.hidden = false;
    fortuneCard.style.willChange = "transform, opacity";
    pageRitual?.classList.add("has-slip");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    tubeStage.classList.add("leaving");
    fortuneCard.classList.add("visible");
    await wait(120);
    emerging.classList.add("fade-out");

    await wait(280);
    emerging.classList.remove("show", "fade-out");
    emerging.hidden = true;
    setSeer(null);
    if (kanshanSeer) {
      kanshanSeer.style.willChange = "auto";
      kanshanSeer.style.transition = "";
    }

    fortuneCard.classList.add("revealed");
    pageRitual?.classList.remove("gold-burst");
    await wait(280);
    fortuneCard.style.willChange = "auto";
    await Promise.resolve(bellP).catch(() => {});
  }

  window.KanshanScene = {
    playShakeAndDraw,
    revealSlip,
    resetRitualVisual,
    ACT_WORDS,
    SHAKE_PEAKS,
    SHAKE_MS,
    burst() {},
    async playRitual(onPhase) {
      await playShakeAndDraw(onPhase);
      await revealSlip(onPhase);
    },
  };

  resetRitualVisual();
})();
