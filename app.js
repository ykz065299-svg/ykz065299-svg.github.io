/* v107 — 二页懒加载；求签五幕旁白；不阻塞等音频 */
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

/** 五幕：问事 → 摇筒 → 落定 → 取签 → 开卷 */
const PHASE_HINT = {
  静候开筒: "心念一事，再请看山开筒",
  求签: "看山侧耳——今日所求，可入筒中",
  摇签: "百签同栖，筒中有数",
  落定: "筒声渐歇，缘分将定…",
  取签: "一枝脱出，认主而立",
  开签: "天机展开，便是今日山门风云",
  待命: "看山展卷，天机将现…",
};

/** 摇签峰值旁白：跟木签相碰的节奏讲故事 */
const SHAKE_LINES = [
  "百签同栖，筒中有数",
  "木签相碰，各争机缘",
  "山风入筒，天命将定",
  "一签将出，且莫分心",
];

const BTN_PHASE = {
  求签: "求签",
  摇签: "摇签",
  落定: "摇签",
  取签: "取签",
  开签: "求签",
  待命: "开签",
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
    setHint("氛围音已开。请听清每一次摇筒。");
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

function setHint(text) {
  if (!hint) return;
  hint.style.opacity = "0";
  requestAnimationFrame(() => {
    hint.textContent = text || "";
    hint.style.opacity = "1";
  });
}

function setPhase(name, hintOverride) {
  const line = hintOverride != null ? hintOverride : PHASE_HINT[name] || "";
  phaseText.style.opacity = "0";
  if (hint) hint.style.opacity = "0";
  requestAnimationFrame(() => {
    phaseText.textContent = name;
    btnLabel.textContent = BTN_PHASE[name] || (name === "开签" ? "求签" : name);
    if (hint) hint.textContent = line;
    phaseText.style.opacity = "1";
    if (hint) hint.style.opacity = "1";
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
    "看山掷筒：筒中落下的，是此刻山顶最响的那一声问。",
    "签意已定：此题正搅动山顶风云，宜深读，忌人云亦云。",
    "此签不讲命运，只讲今日——热榜之上，风正从这里过。",
    "山风起处，热议已成。今日宜观其势，再判其理。",
    "看山有言：热闹处未必见真章，却最见人心。",
    "山门已开：莫急着站队，先把原题读完。",
    "筒中百签，独此一枝认你。点开，便是今日山门题。",
    "一签既出，机缘自来。顺着链接上山，自有风景。",
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
    await window.KanshanScene.playShakeAndDraw(
      (name, line) => setPhase(name, line),
      (i) => setHint(SHAKE_LINES[i] || SHAKE_LINES[0])
    );

    setPhase("待命");
    const data = await fetchPromise;
    if (data?.__err) throw data.__err;

    fillSlip(data);
    // 展开前按内容定长
    const slipH = prepareSlipSize();
    await window.KanshanScene.revealSlip((name, line) => setPhase(name, line), { height: slipH });
    phaseText.textContent = `${data.slip?.label || ""} · ${data.slip?.grade || ""}`;
    setHint("此签即今日山顶热议——点开便是原题");
  } catch (err) {
    window.KanshanScene?.resetRitualVisual?.();
    clearSlip();
    phaseText.textContent = "静候开筒";
    btnLabel.textContent = "求签";
    const msg = String(err?.message || err || "");
    setHint(
      /rate limit/i.test(msg) ? "山门拥挤，请稍候再求" : `求签未果：${msg}`
    );
  } finally {
    setBusy(false);
    btnLabel.textContent = "求签";
  }
}

drawBtn.addEventListener("click", draw);
againBtn?.addEventListener("click", draw);
setAudioUi();
