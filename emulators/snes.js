class SnesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.width = 256;
    this.height = 224;
    this.imageData = this.ctx.createImageData(this.width, this.height);

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    this._running = false;
    this.snes = null;      // instancia del core
    this.Module = null;    // módulo WebAssembly

    // 🔥 ya no usamos Higan, cargamos snes9x.wasm
    this.ready = this.initCore();

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

    const normalizeKey = (e) => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);

    document.addEventListener("keydown", (e) => {
      const key = normalizeKey(e);
      if (!this.snes) return;
      const btn = this.keyMap[key];
      if (!btn) return;
      if (typeof this.snes.press === "function") {
        this.snes.press(btn);
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      const key = normalizeKey(e);
      if (!this.snes) return;
      const btn = this.keyMap[key];
      if (!btn) return;
      if (typeof this.snes.release === "function") {
        this.snes.release(btn);
        e.preventDefault();
      }
    });
  }

  // 👇 inicializa el core SNES9x desde wasm
  async initCore() {
    try {
      const response = await fetch("libs/snes9x.wasm");
      const buffer = await response.arrayBuffer();
      const wasmModule = await WebAssembly.instantiate(buffer, {
        env: {
          // aquí van imports necesarios del core
          abort: () => console.error("abort called in snes9x.wasm"),
        },
      });

      this.Module = wasmModule.instance.exports;
      console.log("✅ SNES9x wasm cargado:", this.Module);

      return this.Module;
    } catch (err) {
      console.error("❌ Error cargando SNES9x wasm:", err);
      throw err;
    }
  }

  async loadROM(romData) {
    try {
      const Module = await this.ready;
      if (!Module) throw new Error("Core SNES no disponible.");

      // ⚡ Aquí deberías conectar el core real (ej: snes9x.js wrapper)
      // De momento hacemos un stub para probar
      this.snes = {
        press: (btn) => console.log("Presionado:", btn),
        release: (btn) => console.log("Soltado:", btn),
        runFrame: () => {
          // placeholder: dibuja ruido en el canvas
          for (let i = 0; i < this.imageData.data.length; i += 4) {
            this.imageData.data[i] = Math.random() * 255;
            this.imageData.data[i + 1] = Math.random() * 255;
            this.imageData.data[i + 2] = Math.random() * 255;
            this.imageData.data[i + 3] = 255;
          }
          this.ctx.putImageData(this.imageData, 0, 0);
        },
      };

      if (!this._running) {
        this._running = true;
        this.run();
      }
    } catch (err) {
      console.error("❌ Error cargando ROM SNES:", err);
      alert("No se pudo cargar el ROM de SNES.");
      throw err;
    }
  }

  run() {
    const loop = () => {
      if (this.snes && typeof this.snes.runFrame === "function") {
        this.snes.runFrame();
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  saveState() {
    console.warn("⚠️ saveState aún no implementado en este wrapper.");
  }

  loadState() {
    console.warn("⚠️ loadState aún no implementado en este wrapper.");
  }
}
