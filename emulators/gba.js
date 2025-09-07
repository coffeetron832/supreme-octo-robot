class GbaEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.gba = new GameBoyAdvance();
    this.gba.setCanvas(canvas);
  }

  loadROM(romData) {
    this.gba.loadRomFromArrayBuffer(romData, () => {
      this.gba.runStable();
    });
  }
}
