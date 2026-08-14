/* v106 — 恢复原版摇签/出签音色（44100 wav + 均衡）；氛围音仍轻量流式 */
(() => {
  const bust = "?v=106";
  const SHAKE_SEC = 5.4;

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
      // 后台预热摇签音，不挡交互
      this.loadBuffer("shake", "/audio/shake.wav").catch(() => {});
      this.loadBuffer("reveal", "/audio/reveal.wav").catch(() => {});
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
      a.play().catch(() => {});
      return a;
    },

    async playShake() {
      // 求签手势：即使氛围音未开也播摇签
      try {
        await this.ensure();
      } catch (_) {
        this.playHtml("/audio/shake.wav", 0.85);
        return;
      }
      if (this.enabled) this.duckMusic(SHAKE_SEC);
      try {
        const buf = await this.loadBuffer("shake", "/audio/shake.wav");
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
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
        src.start();
      } catch (_) {
        this.playHtml("/audio/shake.wav", 0.85);
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
        src.start();
      } catch (_) {
        this.playHtml("/audio/reveal.wav", 0.8);
      }
    },
  };

  window.KanshanAudio = AudioEngine;
})();
