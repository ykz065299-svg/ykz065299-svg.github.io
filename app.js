/* v180 — 路演 P0：分享签文 + 热榜解析 + SW 注册 */
const drawBtn = document.getElementById("drawBtn");
const againBtn = document.getElementById("againBtn");
const shareBtn = document.getElementById("shareBtn");
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
let lastDrawData = null;

const SITE_URL = "https://ykz065299-svg.github.io/";

const ACT_NAMES = new Set(["叩问", "尘定", "认主", "显机"]);

/** polish-20 定稿文案 */
const ACT_META = {
  idle: {
    phase: "静候开筒",
    line: "心念一事，再请看山开筒",
    btn: "求签",
    hint: "心诚则灵",
  },
  摇签: { phase: "摇签", line: "", btn: "求签", hint: "" },
  叩问: { phase: "叩问", line: "", btn: "求签", hint: "" },
  尘定: { phase: "尘定", line: "", btn: "求签", hint: "" },
  认主: { phase: "认主", line: "", btn: "求签", hint: "" },
  显机: { phase: "显机", line: "", btn: "求签", hint: "" },
  待命: { phase: "显机", line: "墨迹将现…", btn: "求签", hint: "" },
};

function buildShareText(data) {
  const s = data.slip || {};
  const item = data.item || {};
  return [
    "看山今日一签",
    `${s.label || ""} · ${s.grade || ""}`,
    data.oracle || "",
    "",
    `今日山门题：${item.title || ""}`,
    `热榜第 ${data.rank ?? "?"} 位`,
    item.url || SITE_URL,
    "",
    SITE_URL,
  ]
    .join("\n")
    .trim();
}

async function shareSlip() {
  if (!lastDrawData) return;
  const text = buildShareText(lastDrawData);
  const url = lastDrawData.item?.url || SITE_URL;
  if (navigator.share) {
    try {
      await navigator.share({ title: "看山今日一签", text, url });
      setHint("已唤起分享");
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    setHint("签文已复制");
  } catch (_) {
    setHint("复制失败，请手动选中文本");
  }
}

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
    setHint("氛围音已开");
  } else {
    await window.KanshanAudio.disable();
    audioOn = false;
  }
  setAudioUi();
});

scrollCue?.addEventListener("click", () => {
  ensureRitualAssets();
  ensureAudio();
  pageRitual?.scrollIntoView({ behavior: "smooth", block: "start" });
});

if (pageRitual && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    ([entry]) => {
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

function setBusy(on) {
  busy = on;
  drawBtn.disabled = on;
  if (againBtn) againBtn.disabled = on;
}

function fadeText(el, text) {
  if (!el) return;
  el.style.opacity = "0";
  requestAnimationFrame(() => {
    el.textContent = text || "";
    el.style.opacity = "1";
  });
}

function setHint(text) {
  fadeText(hint, text);
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

  if (ACT_NAMES.has(name)) {
    if (phaseText) {
      phaseText.textContent = "";
      phaseText.style.opacity = "0";
    }
    if (storyLine) storyLine.style.opacity = "0";
    if (hint) {
      hint.textContent = "";
      hint.style.opacity = "0";
    }
    if (btnLabel) btnLabel.textContent = "求签";
    if (tubeLabel) tubeLabel.textContent = "百签同栖 · 一签认主";
    if (seerCaption) seerCaption.textContent = seerMap[name] || "看山候你";
    return;
  }

  fadeText(phaseText, meta.phase);
  if (storyLine) {
    if (meta.line) fadeText(storyLine, meta.line);
    else storyLine.style.opacity = "0";
  }
  if (btnLabel) btnLabel.textContent = meta.btn;
  if (meta.hint) {
    if (hint) hint.style.opacity = "1";
    setHint(meta.hint);
  } else if (hint) {
    hint.textContent = "";
    hint.style.opacity = "0";
  }
  if ((name === "idle" || name === "摇签") && tubeLabel) {
    tubeLabel.textContent = "百签同栖 · 一签认主";
  }
  if (seerCaption) seerCaption.textContent = seerMap[name] || "看山候你";
}

function settleDoneCopy(data) {
  lastDrawData = data;
  if (shareBtn) shareBtn.hidden = false;
  fadeText(phaseText, `${data.slip?.label || ""} · ${data.slip?.grade || ""}`);
  if (storyLine) {
    storyLine.style.opacity = "1";
    fadeText(storyLine, "此签即今日山顶热议");
  }
  if (hint) {
    hint.style.opacity = "1";
    fadeText(hint, "一签已定 · 可再求");
  }
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

function clearSlip() {
  lastDrawData = null;
  if (shareBtn) shareBtn.hidden = true;
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

function prepareSlipSize() {
  if (!fortuneCard) return 420;

  const body = fortuneCard.querySelector(".scroll-body");
  const inner = fortuneCard.querySelector(".scroll-inner");
  const rollH = 24;

  fortuneCard.hidden = false;
  fortuneCard.classList.remove("visible", "glowing", "revealed", "fit");
  fortuneCard.classList.add("measuring");
  fortuneCard.style.height = "auto";
  if (body) body.style.overflow = "visible";

  void fortuneCard.offsetHeight;
  const contentH = inner ? inner.scrollHeight : 360;
  const natural = contentH + rollH + 4;

  const vh = window.innerHeight || 700;
  const minH = Math.round(Math.max(260, vh * 0.34));
  const maxH = Math.round(Math.min(620, vh * 0.74));
  let target = Math.round(natural + 6);
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
      const list =
        payload.Items ||
        payload.items ||
        payload.Data?.Items ||
        [];
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
    "筒中落下的，是此刻山顶最响的一声问——热榜即今日山门题。",
    "此签不讲命运，只讲今日：热榜之上，风正从这里过。",
    "签意已定：此题搅动山顶风云，宜深读，忌人云亦云。",
    "看山有言：热闹处未必见真章，却最见人心。",
    "山门已开：莫急着站队，先把原题读完。",
    "一签认主。点开链接上山，便是你与今日的相遇。",
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
    fortuneCard.classList.remove("visible", "glowing", "revealed");
    fortuneCard.hidden = true;
  }
}

async function draw() {
  if (busy) return;
  setBusy(true);
  clearSlip();
  ensureRitualAssets();
  await retractSlipIfNeeded();
  window.KanshanScene?.resetRitualVisual?.();
  resetIdleCopy();
  pageRitual?.scrollIntoView({ behavior: "smooth", block: "start" });
  ensureAudio();

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
shareBtn?.addEventListener("click", shareSlip);
setAudioUi();
resetIdleCopy();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js?v=180").catch(() => {});
  });
}
