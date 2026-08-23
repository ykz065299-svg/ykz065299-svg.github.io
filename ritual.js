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
  const PEAK_AMP_Y = MOBILE ? 3.4 : 4.8;
  const PEAK_AMP_S = MOBILE ? 0.034 : 0.048;
  const SEER_PEAK_WIDTH = 0.26;
  const SEER_REACT_S = 0.06;
  const LERP_TUBE = 0.42;
  const LERP_SEER = 0.38;

  let shakeRaf = 0;
  let settleRaf = 0;
  let smoothTube = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
  let smoothSeer = { y: 0, scale: 1 };

  function resetSmoothMotion() {
    smoothTube = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
    smoothSeer = { y: 0, scale: 1 };
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
    const snap = amp < 0.08 ? 0.5 : LERP_SEER;
    smoothSeer.y = lerp(smoothSeer.y, targetTy, snap);
    smoothSeer.scale = lerp(smoothSeer.scale, targetScale, snap);
    if (amp < 0.04) {
      kanshanSeer.style.transform = "translate3d(0,0,0) scale(1)";
      smoothSeer = { y: 0, scale: 1 };
    } else {
      kanshanSeer.style.transform =
        `translate3d(0,${smoothSeer.y.toFixed(2)}px,0) scale(${smoothSeer.scale.toFixed(4)})`;
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

  function flashActNow(word) {
    if (!actFlash || !word) return;
    clearTimeout(flashActNow._delay);
    clearTimeout(flashActNow._t);
    flashActNow._delay = setTimeout(() => {
      actFlash.textContent = word;
      actFlash.classList.remove("show");
      void actFlash.offsetWidth;
      actFlash.classList.add("show");
      flashActNow._t = setTimeout(() => {
        actFlash.classList.remove("show");
      }, 1350);
    }, 200);
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
          Math.sin(t * f1) * amp * 11.5 +
          Math.sin(t * f2) * amp * 2.6 +
          Math.sin(t * f3 * 0.55) * amp * 1.4;
        const tx = Math.sin(t * f3) * amp * 8 + Math.sin(t * f4 * 1.3) * amp * 2.2;
        const ty = Math.abs(Math.cos(t * f4)) * amp * 5.5;
        const squish = 1 - amp * 0.03;
        const scaleY = 1 + amp * 0.018;

        // 幕间仍较快归零；仅整轮收势时用慢插值
        let snap = LERP_TUBE;
        if (hushAfterReveal) snap = 0.16;
        else if (amp < 0.12) snap = 0.58;

        smoothTube.tx = lerp(smoothTube.tx, tx, snap);
        smoothTube.ty = lerp(smoothTube.ty, ty, snap);
        smoothTube.rot = lerp(smoothTube.rot, rot, snap);
        smoothTube.sx = lerp(smoothTube.sx, squish, snap);
        smoothTube.sy = lerp(smoothTube.sy, scaleY, snap);

        if (!hushAfterReveal && amp < 0.035) {
          tube.style.transform = "translate3d(0,0,0) rotate(0deg) scale(1,1)";
          smoothTube = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 };
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
    clearTimeout(flashActNow._delay);
    tubeStage.classList.remove("leaving");
    tubeStage.style.removeProperty("transform");
    tubeStage.style.removeProperty("transition");
    emerging.hidden = true;
    emerging.classList.remove("show", "fade-out");
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
    await wait(720);

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
      fortuneCard.style.height = `${opts.height}px`;
    }
    fortuneCard.hidden = false;
    fortuneCard.style.willChange = "transform, opacity";
    pageRitual?.classList.add("has-slip");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    tubeStage.classList.add("leaving");
    fortuneCard.classList.add("visible");
    await wait(160);
    emerging.classList.add("fade-out");

    await wait(520);
    emerging.classList.remove("show", "fade-out");
    emerging.hidden = true;
    setSeer(null);
    if (kanshanSeer) {
      kanshanSeer.style.willChange = "auto";
      kanshanSeer.style.transition = "";
    }

    // 4) 展卷中段就开始落字，不必等缩放完全停住
    const h = opts.height || 420;
    const expandMs = Math.round(780 + Math.min(320, (h - 280) * 0.48));
    await wait(Math.max(280, expandMs - 360));
    fortuneCard.classList.add("revealed");
    await wait(Math.max(420, expandMs * 0.42));
    fortuneCard.classList.add("glowing");
    await wait(360);
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
