class NesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Crear ImageData explícitamente para evitar dependencias del estado del canvas
    this.imageData = this.ctx.createImageData(256, 240);

    // 🎵 Configuración de Audio
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.audioBufferL = [];
    this.audioBufferR = [];

    this.nes = new jsnes.NES({
      onFrame: this.onFrame.bind(this),
      onAudioSample: this.onAudioSample.bind(this), // <-- importante
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

    this._running = false; // evita arrancar múltiples loops
  }

  onFrame(frameBuffer) {
    // frameBuffer viene en formato BGR (0xBBGGRR)
    const data = this.imageData.data;
    let j = 0;
    for (let i = 0; i < frameBuffer.length; i++) {
      const color = frameBuffer[i];
      data[j++] = color & 0xFF;         // R
      data[j++] = (color >> 8) & 0xFF;  // G
      data[j++] = (color >> 16) & 0xFF; // B
      data[j++] = 0xFF;                 // A
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  // 🎵 Captura de muestras de audio
  onAudioSample(left, right) {
    this.audioBufferL.push(left);
    this.audioBufferR.push(right);
  }

  // 🎵 Enviar audio acumulado al altavoz
  flushAudio() {
    if (this.audioBufferL.length === 0) return;

    const bufferSize = this.audioBufferL.length;
    const buffer = this.audioCtx.createBuffer(2, bufferSize, 44100);
    const channelL = buffer.getChannelData(0);
    const channelR = buffer.getChannelData(1);

    for (let i = 0; i < bufferSize; i++) {
      channelL[i] = this.audioBufferL[i];
      channelR[i] = this.audioBufferR[i];
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    source.start();

    this.audioBufferL = [];
    this.audioBufferR = [];
  }

  loadROM(romData) {
    // Convierte ArrayBuffer a string binario (chunked para no saturar call stack)
    let binary = "";
    const bytes = new Uint8Array(romData);
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }

    this.nes.loadROM(binary);

    // Arrancamos el bucle solo una vez después de cargar la ROM
    if (!this._running) {
      this._running = true;
      this.run();
    }
  }

  run() {
    const frame = () => {
      this.nes.frame();
      this.flushAudio(); // 🎵 Enviar audio por frame
      requestAnimationFrame(frame);
    };
    frame();
  }
}
