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
