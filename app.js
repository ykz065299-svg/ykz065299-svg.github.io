/* v23 — 签面居中；按内容预计算高度后 scale 展开 */
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
  pageRitual?.scrollIntoView({ behavior: "smooth", block: "start" });
});

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
  const r = await fetch("data/hot-seed.json", { cache: "no-store" });
  if (!r.ok) throw new Error("本地签库不可用");
  const payload = await r.json();
  const items = payload.Items || payload.items || [];
  if (!items.length) throw new Error("签库为空");
  const pick = items[Math.floor(Math.random() * items.length)];
  const title = pick.Title || pick.title || "";
  const url = pick.Url || pick.url || "https://www.zhihu.com/hot";
  const summary = cleanMediaPlaceholder(pick.Summary || pick.summary || "");
  const rank = items.indexOf(pick) + 1;
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
    source: "static-seed",
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
    /* GitHub Pages 无 Python 后端，走静态签库 */
  }
  return localDrawFallback();
}

async function draw() {
  if (busy) return;
  setBusy(true);
  clearSlip();
  window.KanshanScene?.resetRitualVisual?.();
  pageRitual?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (!audioOn) {
    try {
      await window.KanshanAudio.enable();
      audioOn = true;
      setAudioUi();
    } catch (_) {}
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
