class NesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Crear ImageData explícitamente
    this.imageData = this.ctx.createImageData(256, 240);

    // 🎵 Configuración de Audio
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.bufferSize = 2048;
    this.audioBufferL = new Float32Array(this.bufferSize);
    this.audioBufferR = new Float32Array(this.bufferSize);
    this.bufferPos = 0;

    this.scriptNode = this.audioCtx.createScriptProcessor(this.bufferSize, 0, 2);
    this.scriptNode.onaudioprocess = (e) => {
      const outL = e.outputBuffer.getChannelData(0);
      const outR = e.outputBuffer.getChannelData(1);

      if (this.bufferPos === 0) {
        outL.fill(0);
        outR.fill(0);
        return;
      }

      for (let i = 0; i < outL.length; i++) {
        outL[i] = this.audioBufferL[i] || 0;
        outR[i] = this.audioBufferR[i] || 0;
      }

      this.bufferPos = 0;
    };
    this.scriptNode.connect(this.audioCtx.destination);

    this.nes = new jsnes.NES({
      onFrame: this.onFrame.bind(this),
      onAudioSample: this.onAudioSample.bind(this),
    });

    // 🎮 Mapeo de teclas
    this.keyMap = {
      ArrowUp: jsnes.Controller.BUTTON_UP,
      ArrowDown: jsnes.Controller.BUTTON_DOWN,
      ArrowLeft: jsnes.Controller.BUTTON_LEFT,
      ArrowRight: jsnes.Controller.BUTTON_RIGHT,
      space: jsnes.Controller.BUTTON_A,
      z: jsnes.Controller.BUTTON_A,
      x: jsnes.Controller.BUTTON_B,
      Enter: jsnes.Controller.BUTTON_START,
      Shift: jsnes.Controller.BUTTON_SELECT,
    };

    const normalizeKey = (e) => {
      if (e.code === "Space") return "space";
      if (e.key && e.key.length === 1) return e.key.toLowerCase();
      return e.key;
    };

    document.addEventListener("keydown", e => {
      const key = normalizeKey(e);
      const btn = this.keyMap[key];
      if (btn !== undefined) {
        this.nes.buttonDown(1, btn);
        e.preventDefault?.();
      }
    });

    document.addEventListener("keyup", e => {
      const key = normalizeKey(e);
      const btn = this.keyMap[key];
      if (btn !== undefined) {
        this.nes.buttonUp(1, btn);
        e.preventDefault?.();
      }
    });

    this._running = false;

    // 📌 Botones de Guardar / Cargar
    const saveBtn = document.getElementById("saveStateBtn");
    const loadBtn = document.getElementById("loadStateBtn");
    const loadInput = document.getElementById("loadStateInput");

    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.saveState());
    }

    if (loadBtn && loadInput) {
      loadBtn.addEventListener("click", () => loadInput.click());
      loadInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const state = JSON.parse(ev.target.result);
              this.loadState(state);
            } catch (err) {
              alert("❌ Archivo de partida inválido.");
              console.error(err);
            }
          };
          reader.readAsText(file);
        }
      });
    }
  }

  onFrame(frameBuffer) {
    const data = this.imageData.data;
    let j = 0;
    for (let i = 0; i < frameBuffer.length; i++) {
      const color = frameBuffer[i];
      data[j++] = color & 0xFF;
      data[j++] = (color >> 8) & 0xFF;
      data[j++] = (color >> 16) & 0xFF;
      data[j++] = 0xFF;
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  onAudioSample(left, right) {
    if (this.bufferPos < this.bufferSize) {
      this.audioBufferL[this.bufferPos] = left;
      this.audioBufferR[this.bufferPos] = right;
      this.bufferPos++;
    }
  }

  loadROM(romData) {
    let binary = "";
    const bytes = new Uint8Array(romData);
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }

    this.nes.loadROM(binary);

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

  // 📌 Guardar partida a archivo
  saveState() {
    try {
      const state = this.nes.toJSON();
      const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nes_save.sav";
      a.click();
      URL.revokeObjectURL(url);
      alert("💾 Partida guardada con éxito.");
    } catch (err) {
      alert("❌ Error al guardar partida.");
      console.error(err);
    }
  }

  // 📌 Cargar partida desde objeto
  loadState(state) {
    try {
      if (!this.nes.rom) {
        alert("⚠️ Primero carga un ROM antes de cargar la partida.");
        return;
      }

      this.nes.fromJSON(state);

      // 🔄 Forzar un frame inmediato para actualizar pantalla
      this.nes.frame();

      // 🔄 Reactivar el bucle si estaba detenido
      if (!this._running) {
        this._running = true;
        this.run();
      }

      alert("✅ Partida cargada correctamente.");
    } catch (err) {
      alert("❌ Error: la partida no coincide con este ROM o está dañada.");
      console.error("❌ Error al cargar partida:", err);
    }
  }
}
