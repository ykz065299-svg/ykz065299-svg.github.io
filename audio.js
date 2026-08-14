/* v20 — 道士看山重绘 + PC/PE 同框 */
(() => {
  const bust = "?v=20";
  const SHAKE_SEC = 5.4;

  const AudioEngine = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    enabled: false,
    ambient: null,
    ambientSrc: null,
    buffers: {},

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
      const res = await fetch(url + bust, { cache: "reload" });
      if (!res.ok) throw new Error("load fail " + url);
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr.slice(0));
      this.buffers[name] = buf;
      return buf;
    },

    async preload() {
      await this.ensure();
      await Promise.all([
        this.loadBuffer("ambient", "/audio/ambient.wav"),
        this.loadBuffer("shake", "/audio/shake.wav"),
        this.loadBuffer("reveal", "/audio/reveal.wav"),
      ]);
    },

    async enable() {
      await this.ensure();
      try {
        await this.preload();
      } catch (e) {
        console.warn("audio preload", e);
      }
      this.enabled = true;
      this.startAmbient();
    },

    async disable() {
      this.enabled = false;
      this.stopAmbient();
    },

    stopAmbient() {
      if (this.ambientSrc) {
        try {
          this.ambientSrc.stop();
        } catch (_) {}
        this.ambientSrc.disconnect();
        this.ambientSrc = null;
      }
      if (this.ambient) {
        this.ambient.pause();
        this.ambient = null;
      }
    },

    startAmbient() {
      this.stopAmbient();
      if (!this.enabled) return;
      const buf = this.buffers.ambient;
      if (buf && this.ctx) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const lp = this.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2400;
        src.connect(lp);
        lp.connect(this.musicGain);
        src.start();
        this.ambientSrc = src;
        return;
      }
      const a = new Audio("/audio/ambient.wav" + bust);
      a.loop = true;
      a.volume = 0.25;
      a.play().catch(() => {});
      this.ambient = a;
    },

    duckMusic(seconds = SHAKE_SEC) {
      if (!this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(0.08, now + 0.1);
      this.musicGain.gain.setValueAtTime(0.08, now + seconds);
      this.musicGain.gain.linearRampToValueAtTime(0.25, now + seconds + 0.55);
    },

    async playShake() {
      await this.ensure();
      if (!this.enabled) return;
      this.duckMusic(SHAKE_SEC);
      const buf = this.buffers.shake;
      if (!buf) {
        const a = new Audio("/audio/shake.wav" + bust);
        a.volume = 0.85;
        a.play().catch(() => {});
        return;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      // 竹签短促碰撞：保留中频清晰，去掉空灵糊感与刺耳高
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
    },

    async playReveal() {
      await this.ensure();
      if (!this.enabled) return;
      const buf = this.buffers.reveal;
      if (!buf) {
        const a = new Audio("/audio/reveal.wav" + bust);
        a.volume = 0.8;
        a.play().catch(() => {});
        return;
      }
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
    },
  };

  window.KanshanAudio = AudioEngine;
})();
