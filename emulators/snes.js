class SnesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.width = 256;
    this.height = 224;
    this.imageData = this.ctx.createImageData(this.width, this.height);

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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
      if (this.snes && this.keyMap[key] && this.snes.press) {
        this.snes.press(this.keyMap[key]); // 👈 API higan-js
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      const key = normalizeKey(e);
      if (this.snes && this.keyMap[key] && this.snes.release) {
        this.snes.release(this.keyMap[key]); // 👈 API higan-js
        e.preventDefault();
      }
    });
  }

  async loadROM(romData) {
    try {
      if (!window.HiganModule) {
        throw new Error("Higan aún no está inicializado.");
      }

      // ⚡ Lo importante: usa la clase correcta exportada por higan.js
      console.log("🔍 Claves disponibles en HiganModule:", Object.keys(window.HiganModule));

      // ⚠️ Esto puede variar: a veces es Emulator, a veces SNES, depende del build
      this.snes = new window.HiganModule.Emulator(this.canvas);

      await this.snes.loadROM(romData);

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
      if (this.snes && this.snes.runFrame) {
        this.snes.runFrame(); // 👈 API de higan-js
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  saveState() {
    try {
      if (!this.snes || !this.snes.saveState) return;
      const state = this.snes.saveState(); // 👈 API higan-js
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
      if (this.snes && this.snes.loadState) {
        this.snes.loadState(stateBuffer); // 👈 API higan-js
        console.log("✅ Partida SNES cargada.");
      }
    } catch (err) {
      console.error("❌ Error al cargar partida SNES:", err);
    }
  }
}
