class SnesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.width = 256;
    this.height = 224;
    this.imageData = this.ctx.createImageData(this.width, this.height);

    this._running = false;
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

    // Aquí todavía no tenemos el core listo hasta que se cargue el módulo
    this.moduleReady = Snes9xModule().then((Module) => {
      this.Module = Module;

      // Funciones expuestas por el core
      this._loadROM = Module.cwrap("loadROM", "number", ["array", "number"]);
      this._frame   = Module.cwrap("frame", null, []);
      this._buttonDown = Module.cwrap("buttonDown", null, ["number", "string"]);
      this._buttonUp   = Module.cwrap("buttonUp", null, ["number", "string"]);
      this._saveState  = Module.cwrap("saveState", "string", []);
      this._loadState  = Module.cwrap("loadState", null, ["string"]);

      console.log("✅ SNES core listo.");
    });

    // Eventos de teclado
    const normalizeKey = (e) => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);

    document.addEventListener("keydown", (e) => {
      const key = normalizeKey(e);
      const btn = this.keyMap[key];
      if (btn && this._buttonDown) {
        this._buttonDown(1, btn);
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      const key = normalizeKey(e);
      const btn = this.keyMap[key];
      if (btn && this._buttonUp) {
        this._buttonUp(1, btn);
        e.preventDefault();
      }
    });
  }

  // 📺 Dibujar frame (aquí depende de cómo el core expone el framebuffer)
  onFrame(buffer, width, height) {
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.imageData = this.ctx.createImageData(this.width, this.height);
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }

    const data = this.imageData.data;
    let j = 0;
    for (let i = 0; i < buffer.length; i++) {
      const color = buffer[i];
      data[j++] = color & 0xff;
      data[j++] = (color >> 8) & 0xff;
      data[j++] = (color >> 16) & 0xff;
      data[j++] = 0xff;
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  async loadROM(romData) {
    await this.moduleReady;
    try {
      const bytes = new Uint8Array(romData);
      this._loadROM(bytes, bytes.length);
      console.log("✅ ROM SNES cargado");

      if (!this._running) {
        this._running = true;
        this.run();
      }
    } catch (err) {
      console.error("❌ Error cargando ROM SNES:", err);
    }
  }

  run() {
    const loop = () => {
      if (this._frame) this._frame();
      requestAnimationFrame(loop);
    };
    loop();
  }

  saveState() {
    if (this._saveState) {
      const stateStr = this._saveState();
      const blob = new Blob([stateStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "snes_save.sav";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  loadState(state) {
    if (this._loadState) {
      this._loadState(JSON.stringify(state));
      console.log("✅ Partida SNES cargada.");
    }
  }
}
