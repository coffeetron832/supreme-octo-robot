class SnesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = 256;
    this.height = 224;

    // Escalado interno
    this.imageData = this.ctx.createImageData(this.width, this.height);

    // Inicializar SNES9x core
    this.snes = new Snes9x({
      onFrame: this.onFrame.bind(this),
      onAudioSample: this.onAudioSample.bind(this),
    });

    // 🎮 Mapeo de teclas (clásico SNES)
    this.keyMap = {
      ArrowUp: "UP",
      ArrowDown: "DOWN",
      ArrowLeft: "LEFT",
      ArrowRight: "RIGHT",
      z: "B",      // botón B
      x: "A",      // botón A
      a: "Y",
      s: "X",
      q: "L",
      w: "R",
      Enter: "START",
      Shift: "SELECT",
    };

    const normalizeKey = (e) => {
      if (e.key && e.key.length === 1) return e.key.toLowerCase();
      return e.key;
    };

    document.addEventListener("keydown", e => {
      const key = normalizeKey(e);
      if (this.keyMap[key]) {
        this.snes.buttonDown(1, this.keyMap[key]);
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", e => {
      const key = normalizeKey(e);
      if (this.keyMap[key]) {
        this.snes.buttonUp(1, this.keyMap[key]);
        e.preventDefault();
      }
    });

    this._running = false;
  }

  onFrame(frameBuffer) {
    // Dibujar en canvas
    const data = this.imageData.data;
    let j = 0;
    for (let i = 0; i < frameBuffer.length; i++) {
      const color = frameBuffer[i];
      data[j++] = color & 0xFF;
      data[j++] = (color >> 8) & 0xFF;
      data[j++] = (color >> 16) & 0xFF;
      data[j++] = 0xFF;
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  onAudioSample(left, right) {
    // TODO: conectar audio con WebAudio (similar a NES)
  }

  loadROM(romData) {
    const bytes = new Uint8Array(romData);
    this.snes.loadROM(bytes);

    if (!this._running) {
      this._running = true;
      this.run();
    }
  }

  run() {
    const loop = () => {
      this.snes.frame();
      requestAnimationFrame(loop);
    };
    loop();
  }

  saveState() {
    try {
      const state = this.snes.toJSON();
      const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "snes_save.sav";
      a.click();
      URL.revokeObjectURL(url);
      alert("💾 Partida guardada.");
    } catch (err) {
      alert("❌ Error al guardar partida.");
      console.error(err);
    }
  }

  loadState(state) {
    try {
      this.snes.fromJSON(state);
      alert("✅ Partida cargada.");
    } catch (err) {
      alert("❌ Error al cargar partida.");
      console.error(err);
    }
  }
}
