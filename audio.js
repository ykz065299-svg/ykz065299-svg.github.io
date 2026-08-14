/* v103 — HTMLAudio 流式播放；不预解码；不阻塞首屏 */
(() => {
  const bust = "?v=105";
  const SHAKE_SEC = 5.4;

  const AudioEngine = {
    enabled: false,
    ambient: null,
    _duckTimer: 0,

    async enable() {
      this.enabled = true;
      this.startAmbient();
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
      a.preload = "auto";
      a.play().catch(() => {});
      return a;
    },

    async playShake() {
      if (!this.enabled) return;
      this.duckMusic(SHAKE_SEC);
      this.playHtml("/audio/shake-lite.wav", 0.85);
    },

    async playReveal() {
      if (!this.enabled) return;
      this.playHtml("/audio/reveal-lite.wav", 0.8);
    },
  };

  window.KanshanAudio = AudioEngine;
})();
