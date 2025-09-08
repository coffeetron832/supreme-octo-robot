class SnesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.width = 256;
    this.height = 224;
    this.imageData = this.ctx.createImageData(this.width, this.height);

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.bufferSize = 2048;
    this.scriptNode = this.audioCtx.createScriptProcessor(this.bufferSize, 0, 2);
    this.scriptNode.onaudioprocess = (e) => {
      const outL = e.outputBuffer.getChannelData(0);
      const outR = e.outputBuffer.getChannelData(1);
      for (let i = 0; i < outL.length; i++) {
        outL[i] = 0;
        outR[i] = 0;
      }
    };
    this.scriptNode.connect(this.audioCtx.destination);

    this._running = false;
    this.snes = null;

    // 🎮 Mapeo teclas SNES
    this.keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      z: "a",
      x: "b",
      a: "x",
      s: "y",
      q: "l",
      w: "r",
      Enter: "start",
      Shift: "select",
    };

    const normalizeKey = (e) => {
      if (e.key && e.key.length === 1) return e.key.toLowerCase();
      return e.key;
    };

    document.addEventListener("keydown", (e) => {
      const key = normalizeKey(e);
      if (this.snes && this.keyMap[key]) {
        this.snes.press(this.keyMap[key]);
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      const key = normalizeKey(e);
      if (this.snes && this.keyMap[key]) {
        this.snes.release(this.keyMap[key]);
        e.preventDefault();
      }
    });
  }

  async loadROM(romData) {
  try {
    // Crear instancia del emulador (Higan global de higan-js)
    this.snes = new Higan(this.canvas);

    // Asegurarnos de que el buffer sea Uint8Array
    const romBuffer = new Uint8Array(romData);

    // Cargar la ROM
    await this.snes.loadROM(romBuffer);

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
    const loop = () => {
      if (this.snes) {
        this.snes.runFrame(); // API de higan-js
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  saveState() {
    try {
      const state = this.snes.saveState();
      const blob = new Blob([state], { type: "application/octet-stream" });
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

  loadState(stateBuffer) {
    try {
      this.snes.loadState(stateBuffer);
      console.log("✅ Partida SNES cargada.");
    } catch (err) {
      console.error("❌ Error al cargar partida SNES:", err);
    }
  }
}
