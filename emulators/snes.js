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

    // ⚡ Guardamos la promesa de inicialización
    this.ready = this.init();

    this._running = false;

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
        this.snes.buttonDown(1, this.keyMap[key]);
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      const key = normalizeKey(e);
      if (this.snes && this.keyMap[key]) {
        this.snes.buttonUp(1, this.keyMap[key]);
        e.preventDefault();
      }
    });
  }

  async init() {
    try {
      this.snes = await Snes9xModule(); // 👈 inicializar con la promesa
      console.log("✅ SNES listo");
    } catch (err) {
      console.error("❌ Error inicializando SNES:", err);
    }
  }

  onFrame(frameBuffer, width, height) {
    if (!frameBuffer) return;

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
      data[j++] = color & 0xff;
      data[j++] = (color >> 8) & 0xff;
      data[j++] = (color >> 16) & 0xff;
      data[j++] = 0xff;
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  onAudioSample(left, right) {
    // ⚠️ pendiente: cuando snes9x exponga audio real
  }

  async loadROM(romData) {
    await this.ready; // 👈 esperar que SNES esté inicializado

    if (!this.snes) {
      console.error("❌ SNES no inicializado aún");
      return;
    }

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
      if (this.snes && typeof this.snes.frame === "function") {
        this.snes.frame();
      }
      requestAnimationFrame(frame);
    };
    frame();
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
    } catch (err) {
      console.error("❌ Error guardando partida SNES:", err);
    }
  }

  loadState(state) {
    try {
      this.snes.fromJSON(state);
      console.log("✅ Partida SNES cargada.");
    } catch (err) {
      console.error("❌ Error al cargar partida SNES:", err);
    }
  }
}
