class SnesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.snes = null; // Aquí inicializarías snes9x wasm
  }

  loadROM(romData) {
    console.log("SNES ROM cargada (falta inicializar snes9x). Tamaño:", romData.byteLength);
    // Aquí deberías pasar romData al emulador snes9x-js
  }
}
