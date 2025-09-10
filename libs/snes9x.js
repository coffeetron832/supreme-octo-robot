class Snes9x {
  constructor() {
    this.module = null;
    this.ready = this.init();
  }

  async init() {
    if (this.module) return this.module;

    this.module = await window.createSnes9x({
      locateFile: (path) => `libs/${path}` // buscará snes9x.wasm aquí
    });

    console.log("✅ Snes9x listo");
    return this.module;
  }

  async loadROM(romBuffer) {
    const mod = await this.ready;
    const rom = new Uint8Array(romBuffer);
    mod.loadROM(rom);
  }

  runFrame(canvas) {
    if (!this.module) return;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(256, 224);

    this.module.runFrame(imageData.data.buffer);

    ctx.putImageData(imageData, 0, 0);
  }

  press(key) {
    if (this.module) this.module.pressKey(key);
  }

  release(key) {
    if (this.module) this.module.releaseKey(key);
  }
}

// Exportar global
window.Snes9x = Snes9x;
