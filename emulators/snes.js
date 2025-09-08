class SnesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Definir tamaño base de SNES (256x224, pero puede variar según ROM)
    this.width = 256;
    this.height = 224;
    this.imageData = this.ctx.createImageData(this.width, this.height);

    // 🎵 Audio
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.bufferSize = 2048;
    this.scriptNode = this.audioCtx.createScriptProcessor(this.bufferSize, 0, 2);
    this.scriptNode.onaudioprocess = (e) => {
      // ⚠️ Aquí depende de cómo exponga el audio snes9x.js
      // Placeholder de buffer vacío (silencio)
      const outL = e.outputBuffer.getChannelData(0);
      const outR = e.outputBuffer.getChannelData(1);
      for (let i = 0; i < outL.length; i++) {
        outL[i] = 0;
        outR[i] = 0;
      }
    };
    this.scriptNode.connect(this.audioCtx.destination);

    // Inicializar núcleo SNES
    this.snes = new Snes9x({
      onFrame: this.onFrame.bind(this),
      onAudioSample: this.onAudioSample.bind(this),
    });

    // 🎮 Mapeo de teclas SNES
    this.keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      z: "a",   // Botón A
      x: "b",   // Botón B
      a: "x",   // Botón X
      s: "y",   // Botón Y
      q: "l",   // L
      w: "r",   // R
      Enter: "start",
      Shift: "select",
    };

    const normalizeKey = (e) => {
      if (e.key && e.key.length === 1) return e.key.toLowerCase();
      return e.key;
    };

    document.addEventListener("keydown", (e) => {
      const key = normalizeKey(e);
      const btn = this.keyMap[key];
      if (btn) {
        this.snes.buttonDown(1, btn);
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      const key = normalizeKey(e);
      const btn = this.keyMap[key];
      if (btn) {
        this.snes.buttonUp(1, btn);
        e.preventDefault();
      }
    });

    this._running = false;
  }

  // 📺 Frame SNES → canvas
  onFrame(frameBuffer, width, height) {
    if (width && height && (width !== this.width || height !== this.height)) {
      this.width = width;
      this.height = height;
      this.imageData = this.ctx.createImageData(this.width, this.height);
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }

    const data = this.imageData.data;
    let j = 0;
    for (let i = 0; i < frameBuffer.length; i++) {
      const color = frameBuffer[i];
      data[j++] = color & 0xff;        // R
      data[j++] = (color >> 8) & 0xff; // G
      data[j++] = (color >> 16) & 0xff;// B
      data[j++] = 0xff;                // A
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  // 🔊 Audio sample SNES
  onAudioSample(left, right) {
    // ⚠️ Esto depende de cómo snes9x.js entregue audio.
    // Por ahora, placeholder.
  }

  // 📥 Cargar ROM
  loadROM(romData) {
    try {
      this.snes.loadROM(romData);

      if (!this._running) {
        this._running = true;
        this.run();
      }
    } catch (err) {
      console.error("❌ Error cargando ROM SNES:", err);
      alert("No se pudo cargar el ROM de SNES.");
    }
  }

  run() {
    const frame = () => {
      this.snes.frame();
      requestAnimationFrame(frame);
    };
    frame();
  }

  // 💾 Guardar estado
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
    } catch (err) {
      console.error("❌ Error guardando partida SNES:", err);
    }
  }

  // 📂 Cargar estado
  loadState(state) {
    try {
      this.snes.fromJSON(state);
      console.log("✅ Partida SNES cargada.");
    } catch (err) {
      console.error("❌ Error al cargar partida SNES:", err);
    }
  }
}
