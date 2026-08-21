/* v107 — 看山求签：五幕故事节奏；看山仅大小浮动，不跟签筒摇晃 */
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

  function animateShake(durationMs = SHAKE_MS, onBeat) {
    return new Promise((resolve) => {
      tube.classList.add("shaking");
      pageRitual?.classList.add("is-casting");
      setSeer("casting");
      const start = performance.now();
      const peaks = SHAKE_PEAKS;
      const fired = new Set();

      const tick = (now) => {
        const t = (now - start) / 1000;
        if (t >= durationMs / 1000) {
          stopShake();
          tube.classList.remove("shaking");
          pageRitual?.classList.remove("is-casting");
          tube.style.transform = "rotate(0deg) translate3d(0,0,0)";
          setSeer(null);
          resolve();
          return;
        }

        for (let i = 0; i < peaks.length; i++) {
          if (!fired.has(i) && t >= peaks[i] - 0.04) {
            fired.add(i);
            onBeat?.(i);
          }
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
    pageRitual?.classList.remove("is-casting", "is-drawing");
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

  async function playShakeAndDraw(onPhase, onBeat) {
    resetRitualVisual();
    pageRitual?.classList.add("is-drawing");

    // 第一幕：问事入筒
    onPhase?.("求签");
    await wait(780);

    // 第二幕：摇筒夺缘（旁白随峰值推进）
    onPhase?.("摇签");
    onBeat?.(0);
    tube.style.willChange = "transform";
    if (kanshanSeer) kanshanSeer.style.willChange = "transform";
    const shakeAudio = window.KanshanAudio?.playShake?.() || Promise.resolve();
    const shakeMotion = animateShake(SHAKE_MS, onBeat);
    await Promise.all([shakeAudio, shakeMotion]);
    tube.style.willChange = "auto";
    if (kanshanSeer) kanshanSeer.style.willChange = "auto";

    // 第三幕：落定一瞬，再出签
    onPhase?.("落定", "筒声渐歇，缘分将定…");
    await wait(420);

    onPhase?.("取签");
    setSeer("blessing");
    emerging.hidden = false;
    void emerging.offsetWidth;
    emerging.classList.add("show");
    window.KanshanAudio?.playReveal?.();
    await wait(1180);
    onPhase?.("取签", "一签认主，看山将为你展卷");
    await wait(520);
    setSeer(null);
    pageRitual?.classList.remove("is-drawing");
  }

  async function revealSlip(onPhase, opts = {}) {
    // 第四幕：开卷见题
    onPhase?.("开签");
    await wait(260);
    tubeStage.classList.add("leaving");
    await wait(300);
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
    const expandMs = Math.round(980 + Math.min(420, (h - 280) * 0.55));
    await wait(expandMs);

    fortuneCard.classList.add("revealed");
    await wait(760);
    fortuneCard.classList.add("glowing");
    await wait(480);
    fortuneCard.style.willChange = "auto";
  }

  window.KanshanScene = {
    playShakeAndDraw,
    revealSlip,
    resetRitualVisual,
    SHAKE_PEAKS,
    SHAKE_MS,
    burst() {},
    async playRitual(onPhase, onBeat) {
      await playShakeAndDraw(onPhase, onBeat);
      await revealSlip(onPhase);
    },
  };

  resetRitualVisual();
})();
