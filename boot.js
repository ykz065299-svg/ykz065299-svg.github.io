/* v143 — 0821 摇签/出签音色；完整一轮 shake.wav，可略放慢并对齐动画 */
(() => {
  const bust = "?v=106";
  const NATIVE_SHAKE_SEC = 5.4;

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
      const res = await fetch(url + bust, { cache: "force-cache" });
      if (!res.ok) throw new Error("load fail " + url);
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr.slice(0));
      this.buffers[name] = buf;
      return buf;
    },

    async enable() {
      await this.ensure();
      this.enabled = true;
      this.startAmbient();
      this.loadBuffer("shake", "/audio/shake.wav").catch(() => {});
      this.loadBuffer("reveal", "/audio/reveal.wav").catch(() => {});
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
      const a = new Audio("/audio/ambient-lite.wav" + bust);
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
        return this._waitHtml("/audio/shake.wav", 0.85, rate, duckSec);
      }

      if (this.enabled) this.duckMusic(duckSec);

      try {
        const buf = await this.loadBuffer("shake", "/audio/shake.wav");
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
        return this._waitHtml("/audio/shake.wav", 0.85, rate, duckSec);
      }
    },

    async playReveal() {
      try {
        await this.ensure();
        const buf = await this.loadBuffer("reveal", "/audio/reveal.wav");
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
        return this._waitHtml("/audio/reveal.wav", 0.8, 1, 4.8);
      }
    },
  };

  window.KanshanAudio = AudioEngine;
})();

/* v170 — 看山流畅定稿：RAF 呼吸+峰推；静态光；退场 freeze */
(() => {
  const tube = document.getElementById("tube");
  const tubeArt = document.getElementById("tubeArt");
  const tubeStage = document.getElementById("tubeStage");
  const emerging = document.getElementById("emerging");
  const fortuneCard = document.getElementById("fortuneCard");
  const pageRitual = document.getElementById("pageRitual");
  const kanshanSeer = document.getElementById("kanshanSeer");
  const actFlash = document.getElementById("actFlash");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const ACT_WORDS = ["叩问", "尘定", "认主", "显机"];
  const NATIVE_MS = 5400;
  // 再慢一档：声画同比拉长，峰点仍对齐
  const SHAKE_MS = 9200;
  const PLAY_RATE = NATIVE_MS / SHAKE_MS;
  const SHAKE_PEAKS = [0.55, 1.75, 2.95, 4.15].map((t) => t / PLAY_RATE);

  // 手机略减起伏，避免小屏晃眼
  const MOBILE =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 720px)").matches;
  const BREATH_AMP_Y = MOBILE ? 1.6 : 2.2;
  const BREATH_AMP_S = MOBILE ? 0.018 : 0.025;
  const PEAK_AMP_Y = MOBILE ? 2.6 : 3.6;
  const PEAK_AMP_S = MOBILE ? 0.032 : 0.045;
  const BREATH_HZ = 0.55; // ~1.8s 一呼一吸

  let shakeRaf = 0;
  let settleRaf = 0;

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
    settleRaf = 0;
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
      if (d < 0.45) {
        amp = Math.max(amp, Math.cos((d / 0.45) * (Math.PI / 2)));
      }
    }
    amp = Math.max(amp, 0.06 * Math.abs(Math.sin(t * 6.8)));
    return Math.min(1, amp);
  }

  function applySeerFloat(t, amp) {
    if (!kanshanSeer) return;
    const breath = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * BREATH_HZ);
    const scale = 1 + breath * BREATH_AMP_S + amp * PEAK_AMP_S;
    const ty = -(breath * BREATH_AMP_Y + amp * PEAK_AMP_Y);
    kanshanSeer.style.transform =
      `translate3d(0, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
  }

  /** 摇毕：从当前姿态缓回静止，避免瞬间跳回 */
  function settleSeer(fromTransform, ms = 180) {
    if (!kanshanSeer) return Promise.resolve();
    cancelAnimationFrame(settleRaf);
    const start = performance.now();
    // 解析粗略：若已是 matrix，直接用当前 computed
    const el = kanshanSeer;
    const cs = getComputedStyle(el).transform;
    el.style.transform = cs && cs !== "none" ? cs : fromTransform || "translate3d(0,0,0) scale(1)";
    void el.offsetWidth;
    return new Promise((resolve) => {
      const tick = (now) => {
        const p = Math.min(1, (now - start) / ms);
        const e = 1 - Math.pow(1 - p, 3);
        const s = 1 + (1 - e) * 0.02;
        const y = (1 - e) * -1.2;
        el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
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

  function freezeSeerTransform() {
    if (!kanshanSeer) return;
    const cs = getComputedStyle(kanshanSeer).transform;
    kanshanSeer.classList.remove("casting", "blessing", "beating");
    kanshanSeer.style.animation = "none";
    kanshanSeer.style.transform = cs && cs !== "none" ? cs : "translate3d(0,0,0) scale(1)";
    void kanshanSeer.offsetWidth;
  }

  function flashActNow(word) {
    if (!actFlash || !word) return;
    clearTimeout(flashActNow._delay);
    clearTimeout(flashActNow._t);
    flashActNow._delay = setTimeout(() => {
      actFlash.textContent = word;
      actFlash.classList.remove("show", "punch");
      void actFlash.offsetWidth;
      pageRitual?.classList.add("act-flashing");
      actFlash.classList.add("show");
      flashActNow._t = setTimeout(() => {
        actFlash.classList.remove("show", "punch");
        pageRitual?.classList.remove("act-flashing");
      }, 1350);
    }, 200);
  }

  function animateShake(durationMs = SHAKE_MS, onBeat) {
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(shakeRaf);
        shakeRaf = 0;
        if (tube) {
          tube.style.transform = "";
          tube.style.filter = "";
        }
        tube.classList.remove("shaking");
        pageRitual?.classList.remove("is-casting");
        if (tube) tube.style.transform = "rotate(0deg) translate3d(0,0,0)";
        // 看山先 settle，再清 casting（保留光晕到收势结束）
        const seerWas = kanshanSeer?.style.transform || "";
        settleSeer(seerWas, 220).then(() => {
          setSeer(null);
          resolve();
        });
      };

      tube.classList.add("shaking");
      pageRitual?.classList.add("is-casting");
      setSeer("casting");
      const start = performance.now();
      const peaks = SHAKE_PEAKS;
      const fired = new Set();
      const f1 = 16 * PLAY_RATE;
      const f2 = 6.2 * PLAY_RATE;
      const f3 = 12.5 * PLAY_RATE;
      const f4 = 10 * PLAY_RATE;

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
          }
        }

        const amp = peakAmp(t, peaks);
        const rot = Math.sin(t * f1) * amp * 11.5 + Math.sin(t * f2) * amp * 2.6;
        const tx = Math.sin(t * f3) * amp * 8;
        const ty = Math.abs(Math.cos(t * f4)) * amp * 5.5;
        const squish = 1 - amp * 0.03;

        tube.style.transform =
          `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) ` +
          `rotate(${rot.toFixed(2)}deg) scale(${squish.toFixed(3)}, ${(1 + amp * 0.018).toFixed(3)})`;

        applySeerFloat(t, amp);

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
    if (actFlash) {
      actFlash.classList.remove("show", "punch");
      actFlash.textContent = "";
    }
    clearTimeout(flashActNow._t);
    clearTimeout(flashActNow._delay);
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
    pageRitual?.classList.add("is-drawing");

    onPhase?.("摇签");
    tube.style.willChange = "transform";
    if (kanshanSeer) kanshanSeer.style.willChange = "transform";

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
    if (kanshanSeer) kanshanSeer.style.willChange = "auto";
    pageRitual?.classList.remove("is-drawing");
  }

  async function revealSlip(onPhase, opts = {}) {
    onPhase?.("显机");
    if (kanshanSeer) {
      kanshanSeer.classList.remove("exiting");
      kanshanSeer.style.opacity = "";
      kanshanSeer.style.transition = "";
      kanshanSeer.style.willChange = "transform, opacity";
    }
    setSeer("blessing");
    emerging.hidden = false;
    void emerging.offsetWidth;
    emerging.classList.add("show");
    const bellP = window.KanshanAudio?.playReveal?.() || Promise.resolve();

    await wait(980);
    freezeSeerTransform();
    if (kanshanSeer) {
      kanshanSeer.style.transition =
        "opacity .88s cubic-bezier(.33,.08,.25,1), transform .88s cubic-bezier(.33,.08,.25,1)";
      void kanshanSeer.offsetWidth;
      kanshanSeer.classList.add("exiting");
      kanshanSeer.style.opacity = "0";
      kanshanSeer.style.transform = "translate3d(10px, 6px, 0) scale(1)";
    }
    await wait(720);

    tubeStage.classList.add("leaving");
    await wait(320);
    emerging.classList.remove("show");
    emerging.hidden = true;
    setSeer(null);

    if (opts.height) {
      fortuneCard.style.setProperty("--slip-h", `${opts.height}px`);
      fortuneCard.style.height = `${opts.height}px`;
    }

    fortuneCard.hidden = false;
    fortuneCard.style.willChange = "transform, opacity";
    pageRitual?.classList.add("has-slip");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    fortuneCard.classList.add("visible");

    if (kanshanSeer) {
      kanshanSeer.style.willChange = "auto";
      kanshanSeer.style.transition = "";
    }

    const h = opts.height || 420;
    const expandMs = Math.round(920 + Math.min(380, (h - 280) * 0.55));
    await wait(expandMs);

    fortuneCard.classList.add("revealed");
    await wait(700);
    fortuneCard.classList.add("glowing");
    await wait(420);
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

