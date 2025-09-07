class NesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Crear ImageData explícitamente para evitar dependencias del estado del canvas
    this.imageData = this.ctx.createImageData(256, 240);

    // 🎵 Configuración de Audio con ScriptProcessorNode
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.bufferSize = 2048; // tamaño de bloque (ajustable)
    this.audioBufferL = new Float32Array(this.bufferSize);
    this.audioBufferR = new Float32Array(this.bufferSize);
    this.bufferPos = 0;

    this.scriptNode = this.audioCtx.createScriptProcessor(this.bufferSize, 0, 2);
    this.scriptNode.onaudioprocess = (e) => {
      const outL = e.outputBuffer.getChannelData(0);
      const outR = e.outputBuffer.getChannelData(1);

      // Si no tenemos suficientes muestras, rellenar con silencio
      if (this.bufferPos === 0) {
        for (let i = 0; i < outL.length; i++) {
          outL[i] = 0;
          outR[i] = 0;
        }
        return;
      }

      for (let i = 0; i < outL.length; i++) {
        outL[i] = this.audioBufferL[i] || 0;
        outR[i] = this.audioBufferR[i] || 0;
      }

      this.bufferPos = 0; // reiniciar para siguiente bloque
    };
    this.scriptNode.connect(this.audioCtx.destination);

    this.nes = new jsnes.NES({
      onFrame: this.onFrame.bind(this),
      onAudioSample: this.onAudioSample.bind(this), // importante
    });

    // 🎮 Mapeo de teclas (con e.key en vez de keyCode)
    this.keyMap = {
      ArrowUp: jsnes.Controller.BUTTON_UP,
      ArrowDown: jsnes.Controller.BUTTON_DOWN,
      ArrowLeft: jsnes.Controller.BUTTON_LEFT,
      ArrowRight: jsnes.Controller.BUTTON_RIGHT,
      x: jsnes.Controller.BUTTON_A,     // X = Saltar
      z: jsnes.Controller.BUTTON_B,     // Z = Correr / disparar
      Enter: jsnes.Controller.BUTTON_START,
      Shift: jsnes.Controller.BUTTON_SELECT,
    };

    document.addEventListener("keydown", e => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (this.keyMap[key]) this.nes.buttonDown(1, this.keyMap[key]);
    });

    document.addEventListener("keyup", e => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (this.keyMap[key]) this.nes.buttonUp(1, this.keyMap[key]);
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

  // 🎵 Captura de muestras de audio en un buffer circular
  onAudioSample(left, right) {
    if (this.bufferPos < this.bufferSize) {
      this.audioBufferL[this.bufferPos] = left;
      this.audioBufferR[this.bufferPos] = right;
      this.bufferPos++;
    }
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
      requestAnimationFrame(frame);
    };
    frame();
  }
}
