class NesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.imageData = ctx.getImageData(0, 0, 256, 240);

    this.nes = new jsnes.NES({
      onFrame: this.onFrame.bind(this),
    });

    this.keyMap = {
      38: jsnes.Controller.BUTTON_UP,
      40: jsnes.Controller.BUTTON_DOWN,
      37: jsnes.Controller.BUTTON_LEFT,
      39: jsnes.Controller.BUTTON_RIGHT,
      90: jsnes.Controller.BUTTON_A, // Z
      88: jsnes.Controller.BUTTON_B, // X
      13: jsnes.Controller.BUTTON_START,
      16: jsnes.Controller.BUTTON_SELECT,
    };

    document.addEventListener("keydown", e => {
      if (this.keyMap[e.keyCode]) this.nes.buttonDown(1, this.keyMap[e.keyCode]);
    });

    document.addEventListener("keyup", e => {
      if (this.keyMap[e.keyCode]) this.nes.buttonUp(1, this.keyMap[e.keyCode]);
    });

    this.run();
  }

  onFrame(frameBuffer) {
    for (let i = 0; i < frameBuffer.length; i++) {
      this.imageData.data[i*4+0] = (frameBuffer[i] >> 16) & 0xFF;
      this.imageData.data[i*4+1] = (frameBuffer[i] >> 8) & 0xFF;
      this.imageData.data[i*4+2] = frameBuffer[i] & 0xFF;
      this.imageData.data[i*4+3] = 0xFF;
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  loadROM(romData) {
  // Convierte ArrayBuffer a string binario
  let binary = "";
  const bytes = new Uint8Array(romData);
  const chunkSize = 0x8000; // para evitar bloqueos con archivos grandes

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }

  this.nes.loadROM(binary);
}


  run() {
    const frame = () => {
      this.nes.frame();
      requestAnimationFrame(frame);
    };
    frame();
  }
}
