/* v103 — HTMLAudio 流式播放；不预解码；不阻塞首屏 */
(() => {
  const bust = "?v=104";
  const SHAKE_SEC = 5.4;

  const AudioEngine = {
    enabled: false,
    ambient: null,
    _duckTimer: 0,

    async enable() {
      this.enabled = true;
      this.startAmbient();
    },

    async disable() {
      this.enabled = false;
      this.stopAmbient();
    },

    stopAmbient() {
      if (this.ambient) {
        this.ambient.pause();
        this.ambient.src = "";
        this.ambient = null;
      }
    },

    startAmbient() {
      this.stopAmbient();
      if (!this.enabled) return;
      const a = new Audio("/audio/ambient-lite.wav" + bust);
      a.loop = true;
      a.volume = 0.22;
      a.preload = "none";
      a.play().catch(() => {});
      this.ambient = a;
    },

    duckMusic(seconds = SHAKE_SEC) {
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
      a.preload = "auto";
      a.play().catch(() => {});
      return a;
    },

    async playShake() {
      if (!this.enabled) return;
      this.duckMusic(SHAKE_SEC);
      this.playHtml("/audio/shake-lite.wav", 0.85);
    },

    async playReveal() {
      if (!this.enabled) return;
      this.playHtml("/audio/reveal-lite.wav", 0.8);
    },
  };

  window.KanshanAudio = AudioEngine;
})();

/* v103 — 看山求签：仅大小浮动，不跟签筒摇晃 */
(() => {
  const tube = document.getElementById("tube");
  const tubeArt = document.getElementById("tubeArt");
  const tubeStage = document.getElementById("tubeStage");
  const emerging = document.getElementById("emerging");
  const fortuneCard = document.getElementById("fortuneCard");
  const pageRitual = document.getElementById("pageRitual");
  const kanshanSeer = document.getElementById("kanshanSeer");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const SHAKE_PEAKS = [0.55, 1.75, 2.95, 4.15];
  const SHAKE_MS = 5400;
  const IDLE_SRC = "/tube-clean.webp?v=104";

  let shakeRaf = 0;

  if (tubeArt) {
    // src 由下滑到二页时 data-src 注入
  }

  function setSeer(mode) {
    if (!kanshanSeer) return;
    kanshanSeer.classList.remove("casting", "blessing");
    if (mode) kanshanSeer.classList.add(mode);
  }

  function clearSeerMotion() {
    if (!kanshanSeer) return;
    kanshanSeer.style.transform = "";
    kanshanSeer.style.filter = "";
  }

  function stopShake() {
    cancelAnimationFrame(shakeRaf);
    shakeRaf = 0;
    if (tube) {
      tube.style.transform = "";
      tube.style.filter = "";
    }
    clearSeerMotion();
  }

  function peakAmp(t, peaks) {
    let amp = 0;
    for (const p of peaks) {
      const d = Math.abs(t - p);
      if (d < 0.4) {
        amp = Math.max(amp, Math.cos((d / 0.4) * (Math.PI / 2)));
      }
    }
    // 低底噪，保持呼吸感但不抢峰值
    amp = Math.max(amp, 0.06 * Math.abs(Math.sin(t * 7.5)));
    return Math.min(1, amp);
  }

  function animateShake(durationMs = SHAKE_MS) {
    return new Promise((resolve) => {
      tube.classList.add("shaking");
      setSeer("casting");
      const start = performance.now();
      const peaks = SHAKE_PEAKS;

      const tick = (now) => {
        const t = (now - start) / 1000;
        if (t >= durationMs / 1000) {
          stopShake();
          tube.classList.remove("shaking");
          tube.style.transform = "rotate(0deg) translate3d(0,0,0)";
          setSeer(null);
          resolve();
          return;
        }

        const amp = peakAmp(t, peaks);

        // 签筒主律动
        const rot = Math.sin(t * 16) * amp * 11.5 + Math.sin(t * 6.2) * amp * 2.6;
        const tx = Math.sin(t * 12.5) * amp * 8;
        const ty = Math.abs(Math.cos(t * 10)) * amp * 5.5;
        const squish = 1 - amp * 0.03;

        tube.style.transform =
          `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) ` +
          `rotate(${rot.toFixed(2)}deg) scale(${squish.toFixed(3)}, ${(1 + amp * 0.018).toFixed(3)})`;

        // 看山：不跟摇晃，仅靠 CSS casting 做大小浮动
        shakeRaf = requestAnimationFrame(tick);
      };

      shakeRaf = requestAnimationFrame(tick);
    });
  }

  function resetRitualVisual() {
    stopShake();
    setSeer(null);
    tubeStage.classList.remove("leaving");
    emerging.hidden = true;
    emerging.classList.remove("show");
    fortuneCard.hidden = true;
    fortuneCard.classList.remove("visible", "glowing", "revealed", "measuring", "fit");
    fortuneCard.style.removeProperty("--slip-h");
    fortuneCard.style.height = "";
    fortuneCard.style.willChange = "auto";
    tube.style.willChange = "auto";
    pageRitual?.classList.remove("has-slip");
  }

  async function playShakeAndDraw(onPhase) {
    resetRitualVisual();
    onPhase?.("求签");
    await wait(280);

    onPhase?.("摇签");
    tube.style.willChange = "transform";
    if (kanshanSeer) kanshanSeer.style.willChange = "transform";
    const shakeAudio = window.KanshanAudio?.playShake?.() || Promise.resolve();
    const shakeMotion = animateShake(SHAKE_MS);
    await Promise.all([shakeAudio, shakeMotion]);
    tube.style.willChange = "auto";
    if (kanshanSeer) kanshanSeer.style.willChange = "auto";

    onPhase?.("取签");
    setSeer("blessing");
    emerging.hidden = false;
    void emerging.offsetWidth;
    emerging.classList.add("show");
    window.KanshanAudio?.playReveal?.();
    await wait(1050);
    setSeer(null);
  }

  async function revealSlip(onPhase, opts = {}) {
    onPhase?.("开签");
    tubeStage.classList.add("leaving");
    await wait(280);
    emerging.classList.remove("show");
    emerging.hidden = true;

    if (opts.height) {
      fortuneCard.style.setProperty("--slip-h", `${opts.height}px`);
      fortuneCard.style.height = `${opts.height}px`;
    }

    fortuneCard.hidden = false;
    fortuneCard.style.willChange = "transform, opacity";
    pageRitual?.classList.add("has-slip");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    fortuneCard.classList.add("visible");

    const h = opts.height || 420;
    const expandMs = Math.round(920 + Math.min(380, (h - 280) * 0.55));
    await wait(expandMs);

    fortuneCard.classList.add("revealed");
    await wait(700);
    fortuneCard.classList.add("glowing");
    await wait(420);
    fortuneCard.style.willChange = "auto";
  }

  window.KanshanScene = {
    playShakeAndDraw,
    revealSlip,
    resetRitualVisual,
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

/* v103 — 二页资源懒加载；求签不阻塞等音频 */
const drawBtn = document.getElementById("drawBtn");
const againBtn = document.getElementById("againBtn");
const btnLabel = document.getElementById("btnLabel");
const hint = document.getElementById("hint");
const phaseText = document.getElementById("phaseText");
const slipGrade = document.getElementById("slipGrade");
const slipNo = document.getElementById("slipNo");
const slipMotto = document.getElementById("slipMotto");
const rankEl = document.getElementById("rank");
const oracleText = document.getElementById("oracleText");
const topicTitle = document.getElementById("topicTitle");
const topicSummary = document.getElementById("topicSummary");
const topicLink = document.getElementById("topicLink");
const audioToggle = document.getElementById("audioToggle");
const pageRitual = document.getElementById("pageRitual");
const scrollCue = document.getElementById("scrollCue");
const fortuneCard = document.getElementById("fortuneCard");

let busy = false;
let audioOn = false;
let ritualAssetsReady = false;

const PHASE_HINT = {
  求签: "心诚则灵…",
  摇签: "百签同栖，筒中有数",
  取签: "一签脱出",
  开签: "一签已定，可再求",
  待命: "静候山门回音…",
};

function setAudioUi() {
  audioToggle.textContent = audioOn ? "氛围音 · 开" : "氛围音 · 关";
}

function ensureRitualAssets() {
  if (ritualAssetsReady) return;
  ritualAssetsReady = true;
  document.body.classList.add("ritual-assets-ready");
  document.querySelectorAll("img[data-src]").forEach(function (img) {
    if (!img.getAttribute("src")) img.setAttribute("src", img.getAttribute("data-src"));
  });
}

audioToggle.addEventListener("click", async () => {
  if (!audioOn) {
    await window.KanshanAudio.enable();
    audioOn = true;
    hint.textContent = "氛围音已开。请听清每一次摇筒。";
  } else {
    await window.KanshanAudio.disable();
    audioOn = false;
  }
  setAudioUi();
});

scrollCue?.addEventListener("click", () => {
  ensureRitualAssets();
  pageRitual?.scrollIntoView({ behavior: "smooth", block: "start" });
});

// 接近第二页再加载背景；第一页时关掉二页可见性
if (pageRitual && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    ([entry]) => {
      const near = entry.isIntersecting || entry.intersectionRatio > 0;
      if (entry.boundingClientRect.top < window.innerHeight * 1.35) ensureRitualAssets();
      document.body.classList.toggle("ritual-visible", entry.isIntersecting && entry.intersectionRatio > 0.15);
    },
    { threshold: [0, 0.15, 0.5], rootMargin: "40% 0px 0px 0px" }
  );
  io.observe(pageRitual);
} else {
  ensureRitualAssets();
  document.body.classList.add("ritual-visible");
}

// 首屏不预热二页，避免和封面抢带宽

function setBusy(on) {
  busy = on;
  drawBtn.disabled = on;
  if (againBtn) againBtn.disabled = on;
}

function setPhase(name) {
  phaseText.style.opacity = "0";
  requestAnimationFrame(() => {
    phaseText.textContent = name;
    btnLabel.textContent = name === "开签" ? "求签" : name;
    hint.textContent = PHASE_HINT[name] || "";
    phaseText.style.opacity = "1";
  });
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

function clearSlip() {
  slipGrade.textContent = "";
  slipGrade.className = "slip-grade";
  slipNo.textContent = "";
  slipMotto.textContent = "";
  rankEl.textContent = "?";
  oracleText.textContent = "";
  topicTitle.textContent = "";
  topicSummary.textContent = "";
  topicSummary.hidden = true;
  topicLink.href = "#";
  if (fortuneCard) {
    fortuneCard.style.removeProperty("--slip-h");
    fortuneCard.classList.remove("fit", "measuring");
  }
}

function fillSlip(data) {
  const item = data.item || {};
  const s = data.slip || {};
  slipNo.textContent = s.label || `第${data.rank}签`;
  slipGrade.textContent = s.grade || "中平签";
  slipGrade.className = "slip-grade " + (s.grade_key || "plain");
  slipMotto.textContent = s.motto || "";
  rankEl.textContent = String(data.rank ?? "?");
  oracleText.textContent = data.oracle || "";
  topicTitle.textContent = item.title || "（无名之签）";
  const sum = cleanMediaPlaceholder(item.summary || "");
  if (sum) {
    topicSummary.hidden = false;
    topicSummary.textContent = sum.length > 200 ? sum.slice(0, 200) + "…" : sum;
  } else {
    topicSummary.textContent = "";
    topicSummary.hidden = true;
  }
  topicLink.href = item.url || "#";
}

/**
 * 迭代核心：按正文自然高度预计算签长，再交给 scale 展开。
 * 短签短展、长签封顶可滚，避免一律拉满造成空洞或拥挤。
 */
function prepareSlipSize() {
  if (!fortuneCard) return 420;

  const body = fortuneCard.querySelector(".scroll-body");
  const inner = fortuneCard.querySelector(".scroll-inner");
  const rollH = 24; // 上下轴合计

  // 测量态：居中、真实宽度、内容全显、高度自适应
  fortuneCard.hidden = false;
  fortuneCard.classList.remove("visible", "glowing", "revealed", "fit");
  fortuneCard.classList.add("measuring");
  fortuneCard.style.height = "auto";
  if (body) body.style.overflow = "visible";

  // 强制回流拿真实高度
  void fortuneCard.offsetHeight;
  const contentH = inner ? inner.scrollHeight : 360;
  const natural = contentH + rollH + 4;

  // v2 幅度带：短 / 中 / 长
  const vh = window.innerHeight || 700;
  const minH = Math.round(Math.max(260, vh * 0.34));
  const maxH = Math.round(Math.min(620, vh * 0.74));
  let target = natural;

  // v2：给一点呼吸边，但不故意撑满
  target = Math.round(target + 6);

  // v4：内容能放下则贴合；超出则封顶并允许滚动
  const fits = target <= maxH;
  target = Math.max(minH, Math.min(maxH, target));

  fortuneCard.style.setProperty("--slip-h", `${target}px`);
  fortuneCard.style.height = `${target}px`;
  fortuneCard.classList.toggle("fit", fits);
  if (body) body.style.overflow = "";

  fortuneCard.classList.remove("measuring");
  fortuneCard.hidden = true;

  return target;
}

async function localDrawFallback() {
  // Pages 无后端：优先最近热榜缓存，再退回 seed
  let items = [];
  let source = "static-seed";
  for (const [path, tag] of [
    ["data/hot-cache.json", "hot-cache"],
    ["data/hot-seed.json", "static-seed"],
  ]) {
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (!r.ok) continue;
      const payload = await r.json();
      const list = payload.Items || payload.items || [];
      if (list.length) {
        items = list;
        source = tag;
        break;
      }
    } catch (_) {}
  }
  if (!items.length) throw new Error("签库为空");
  const pick = items[Math.floor(Math.random() * items.length)];
  const title = pick.Title || pick.title || "";
  const url = pick.Url || pick.url || "https://www.zhihu.com/hot";
  const summary = cleanMediaPlaceholder(pick.Summary || pick.summary || "");
  const rank = Math.max(1, items.indexOf(pick) + 1);
  const slipNo = 1 + Math.floor(Math.random() * 100);
  const grades = [
    { label: "上上签", key: "supreme", motto: "天时正盛，宜顺势探问" },
    { label: "上签", key: "great", motto: "机缘已现，宜深入一读" },
    { label: "中平签", key: "plain", motto: "不疾不徐，宜辨其真伪" },
    { label: "玄机签", key: "odd", motto: "看似冷门，或藏异答" },
  ];
  const g = grades[Math.floor(Math.random() * grades.length)];
  const oracles = [
    "签意已定：此题正搅动山顶风云，宜深读，忌人云亦云。",
    "山风起处，热议已成。今日宜观其势，再判其理。",
    "一签既出，机缘自来。点开细看，或许正是你要的答案。",
    "看山有言：热闹处未必见真章，却最见人心。",
    "山门已开：莫急着站队，先把原题读完。",
  ];
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
  return {
    ok: true,
    oracle: oracles[Math.floor(Math.random() * oracles.length)],
    rank,
    total: items.length,
    slip: {
      no: slipNo,
      no_cn: toCn(slipNo),
      label: `第${toCn(slipNo)}签`,
      grade: g.label,
      grade_key: g.key,
      motto: g.motto,
    },
    item: { title, url, summary },
    source,
  };
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
  } catch (_) {
    /* GitHub Pages 无 Python 后端 */
  }
  return localDrawFallback();
}

async function draw() {
  if (busy) return;
  setBusy(true);
  clearSlip();
  ensureRitualAssets();
  window.KanshanScene?.resetRitualVisual?.();
  pageRitual?.scrollIntoView({ behavior: "smooth", block: "start" });

  // 不阻塞摇签：音频后台开，避免等 音频解码卡死
  if (!audioOn && window.KanshanAudio) {
    window.KanshanAudio.enable()
      .then(() => {
        audioOn = true;
        setAudioUi();
      })
      .catch(() => {});
  }

  const fetchPromise = fetchDraw().catch((err) => ({ __err: err }));

  try {
    await window.KanshanScene.playShakeAndDraw((name) => setPhase(name));

    setPhase("待命");
    const data = await fetchPromise;
    if (data?.__err) throw data.__err;

    fillSlip(data);
    // 展开前按内容定长
    const slipH = prepareSlipSize();
    await window.KanshanScene.revealSlip((name) => setPhase(name), { height: slipH });
    phaseText.textContent = `${data.slip?.label || ""} · ${data.slip?.grade || ""}`;
    hint.textContent = PHASE_HINT["开签"];
  } catch (err) {
    window.KanshanScene?.resetRitualVisual?.();
    clearSlip();
    phaseText.textContent = "静候开筒";
    btnLabel.textContent = "求签";
    const msg = String(err?.message || err || "");
    hint.textContent = /rate limit/i.test(msg)
      ? "山门拥挤，请稍候再求"
      : `求签未果：${msg}`;
  } finally {
    setBusy(false);
    btnLabel.textContent = "求签";
  }
}

drawBtn.addEventListener("click", draw);
againBtn?.addEventListener("click", draw);
setAudioUi();


if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js?v=104").catch(function () {});
  });
}
