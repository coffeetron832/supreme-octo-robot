class SnesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = 256;
    this.height = 224;
    this.imageData = this.ctx.createImageData(this.width, this.height);

    this._running = false;
    this.snes = null;

    // 🎮 Mapeo de teclas (ajustado a snes9x-js)
    this.keyMap = {
      ArrowUp: 12,    // Up
      ArrowDown: 13,  // Down
      ArrowLeft: 14,  // Left
      ArrowRight: 15, // Right
      z: 0,           // B
      x: 1,           // A
      a: 2,           // Y
      s: 3,           // X
      q: 4,           // L
      w: 5,           // R
      Enter: 7,       // Start
      Shift: 6        // Select
    };

    this.init();
  }

  async init() {
    this.snes = await Snes9xModule();

    // Wrap de funciones nativas expuestas por el core
    this._loadROM = this.snes.cwrap("loadROM", "number", ["array", "number"]);
    this._emulateFrame = this.snes.cwrap("emulateFrame", null, []);
    this._getFrameBuffer = this.snes.cwrap("getFrameBuffer", "number", []);
    this._buttonDown = this.snes.cwrap("buttonDown", null, ["number", "number"]);
    this._buttonUp = this.snes.cwrap("buttonUp", null, ["number", "number"]);
    this._saveState = this.snes.cwrap("saveState", "string", []);
    this._loadState = this.snes.cwrap("loadState", null, ["string"]);

    // Eventos de teclado
    const normalizeKey = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

    document.addEventListener("keydown", (e) => {
      const key = normalizeKey(e);
      if (this.keyMap[key] !== undefined) {
        this._buttonDown(1, this.keyMap[key]);
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      const key = normalizeKey(e);
      if (this.keyMap[key] !== undefined) {
        this._buttonUp(1, this.keyMap[key]);
        e.preventDefault();
      }
    });
  }

  // 📥 Cargar ROM
  loadROM(romData) {
    if (!this.snes) {
      console.error("❌ SNES no inicializado aún");
      return;
    }

    const data = new Uint8Array(romData);
    const buf = this.snes._malloc(data.length);
    this.snes.HEAPU8.set(data, buf);
    this._loadROM(buf, data.length);
    this.snes._free(buf);

    if (!this._running) {
      this._running = true;
      this.run();
    }
  }

  // 📺 Dibujar frame
  drawFrame() {
    this._emulateFrame();
    const ptr = this._getFrameBuffer();
    const frameBuffer = new Uint8Array(this.snes.HEAPU8.buffer, ptr, this.width * this.height * 4);

    this.imageData.data.set(frameBuffer);
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  run() {
    const loop = () => {
      if (this._running) {
        this.drawFrame();
        requestAnimationFrame(loop);
      }
    };
    loop();
  }

  // 💾 Guardar estado
  saveState() {
    try {
      const state = this._saveState();
      const blob = new Blob([state], { type: "application/json" });
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
      const stateStr = JSON.stringify(state);
      this._loadState(stateStr);
      console.log("✅ Partida SNES cargada.");
    } catch (err) {
      console.error("❌ Error al cargar partida SNES:", err);
    }
  }
}
