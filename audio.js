/* v300 — 原版摇筒/出签；点击手势内解锁；音效 no-cache */
(() => {
  const bust = "?v=300";
  const NATIVE_SHAKE_SEC = 5.4;
  const SHAKE_URL = "audio/shake.wav";
  const REVEAL_URL = "audio/reveal.wav";
  const AMBIENT_URL = "audio/ambient-lite.wav";

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
      // 不用 force-cache：SW/旧缓存容易把大 wav 卡住导致无声
      const res = await fetch(url + bust, { cache: "no-cache" });
      if (!res.ok) throw new Error("load fail " + url);
      const arr = await res.arrayBuffer();
      if (!arr.byteLength) throw new Error("empty audio " + url);
      const buf = await this.ctx.decodeAudioData(arr.slice(0));
      this.buffers[name] = buf;
      return buf;
    },

    async enable() {
      await this.ensure();
      this.enabled = true;
      this.startAmbient();
      // 预热，失败不挡求签（播放时再拉）
      this.loadBuffer("shake", SHAKE_URL).catch(() => {});
      this.loadBuffer("reveal", REVEAL_URL).catch(() => {});
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
      const a = new Audio(AMBIENT_URL + bust);
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
        return this._waitHtml(SHAKE_URL, 0.85, rate, duckSec);
      }

      if (this.enabled) this.duckMusic(duckSec);

      try {
        const buf = await this.loadBuffer("shake", SHAKE_URL);
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
        return this._waitHtml(SHAKE_URL, 0.85, rate, duckSec);
      }
    },

    async playReveal() {
      try {
        await this.ensure();
        const buf = await this.loadBuffer("reveal", REVEAL_URL);
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
        return this._waitHtml(REVEAL_URL, 0.8, 1, 4.8);
      }
    },
  };

  window.KanshanAudio = AudioEngine;
})();
