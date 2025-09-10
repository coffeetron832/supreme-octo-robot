// emulators/snes.js
class SnesEmulator {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.width = 256;
    this.height = 224;
    this.imageData = this.ctx.createImageData(this.width, this.height);

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    this._running = false;
    this.snes = null;      // instancia del core (wrapper JS)
    this.Module = null;    // exports del WASM

    // Promesa que inicializa el core desde base64 (libs/snes9x.wasm.js -> libs/snes9x.wasm.base64)
    this.ready = this.initCore();

    // mapeo lógico de botones (para press/release)
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

    // teclado
    document.addEventListener("keydown", (e) => {
      const key = normalizeKey(e);
      if (!this.snes) return;
      const btn = this.keyMap[key];
      if (!btn) return;

      if (typeof this.snes.press === "function") {
        this.snes.press(btn);
        e.preventDefault();
        return;
      }
      if (typeof this.snes.buttonDown === "function") {
        const idx = this._buttonIndex(btn);
        if (idx !== null) this.snes.buttonDown(1, idx);
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
        return;
      }
      if (typeof this.snes.buttonUp === "function") {
        const idx = this._buttonIndex(btn);
        if (idx !== null) this.snes.buttonUp(1, idx);
        e.preventDefault();
      }
    });
  }

  _buttonIndex(name) {
    const order = ["a","b","x","y","l","r","select","start"];
    const idx = order.indexOf(name);
    return idx === -1 ? null : idx;
  }

  // Inicializa WASM a partir del base64 cargado por libs/snes9x.wasm.js
  async initCore() {
    try {
      if (!window.SNES9xWasmReady) {
        throw new Error("SNES9xWasmReady no está definido. Incluye libs/snes9x.wasm.js antes de emulators/snes.js");
      }

      // Esperar al base64
      const base64 = await window.SNES9xWasmReady;

      if (!base64) throw new Error("Base64 vacío o no disponible.");

      // Decodificar base64 a Uint8Array
      const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      // Opciones de imports: ampliables si el core lo necesita
      const imports = {
        env: {
          abort: () => console.error("abort called in snes wasm"),
          // si el core necesita memory/table/otras imports, añadir aquí
          memory: new WebAssembly.Memory({ initial: 256 }),
          table: new WebAssembly.Table({ initial: 0, element: "anyfunc" })
        }
      };

      // Instanciar WASM
      const { instance, module } = await WebAssembly.instantiate(binary.buffer, imports);
      this.Module = instance.exports;

      console.log("✅ SNES9x wasm instanciado, exports:", Object.keys(this.Module));

      // Crear wrapper mínimo. Aquí intentamos detectar funciones exportadas útiles.
      // Ajusta según las funciones reales del core WASM que tengas.
      const exports = this.Module;

      // Si el core exporta una función para 'loadROM' y 'runFrame', enlazarlas.
      const wrapper = {};

      if (typeof exports.loadROM === "function") {
        wrapper.loadROM = async (uint8Rom) => {
          // Caso ideal: si loadROM espera un puntero, sería necesario copiar bytes al heap.
          // Como cada build es distinto, aquí solo llamamos y esperamos que funcione si el wrapper JS lo maneja.
          // Si tu WASM exporta funciones de bajo nivel, necesitarás un pequeño "glue" JS para copiar la ROM a la memoria del módulo.
          try {
            // intentar llamar directo si acepta un array (algunos wrappers proporcionan esa abstracción)
            return exports.loadROM(uint8Rom);
          } catch (err) {
            console.warn("loadROM directo falló; es posible que necesites un glue específico para este build.", err);
            throw err;
          }
        };
      }

      if (typeof exports.runFrame === "function") {
        wrapper.runFrame = () => exports.runFrame();
      } else if (typeof exports.frame === "function") {
        wrapper.runFrame = () => exports.frame();
      } else {
        // Si no hay runFrame, creamos un stub que renderiza ruido (temporal)
        wrapper.runFrame = () => {
          for (let i = 0; i < this.imageData.data.length; i += 4) {
            this.imageData.data[i] = Math.random() * 255;
            this.imageData.data[i + 1] = Math.random() * 255;
            this.imageData.data[i + 2] = Math.random() * 255;
            this.imageData.data[i + 3] = 255;
          }
          this.ctx.putImageData(this.imageData, 0, 0);
        };
      }

      // Input handling: detectamos press/release si están implementadas
      if (typeof exports.press === "function" && typeof exports.release === "function") {
        wrapper.press = (name) => exports.press(name);
        wrapper.release = (name) => exports.release(name);
      } else if (typeof exports.buttonDown === "function" && typeof exports.buttonUp === "function") {
        wrapper.buttonDown = (p, idx) => exports.buttonDown(p, idx);
        wrapper.buttonUp = (p, idx) => exports.buttonUp(p, idx);
      } else {
        // stubs
        wrapper.press = (n) => console.warn("press no implementado en wasm, received:", n);
        wrapper.release = (n) => console.warn("release no implementado en wasm, received:", n);
      }

      // Asignar wrapper
      this.snes = wrapper;

      return this.Module;
    } catch (err) {
      console.error("❌ Error cargando SNES9x wasm:", err);
      throw err;
    }
  }

  // romData: ArrayBuffer or Uint8Array
  async loadROM(romData) {
    try {
      await this.ready;
      if (!this.Module) throw new Error("Core WASM no inicializado.");

      let romUint8;
      if (romData instanceof ArrayBuffer) romUint8 = new Uint8Array(romData);
      else if (romData instanceof Uint8Array) romUint8 = romData;
      else throw new Error("Formato de ROM no soportado; envía ArrayBuffer o Uint8Array.");

      // Si wrapper tiene loadROM, usarlo
      if (this.snes && typeof this.snes.loadROM === "function") {
        await this.snes.loadROM(romUint8);
      } else {
        // Si el WASM exporta funciones de bajo nivel, aquí es donde hay que copiar al heap.
        // Como cada build es distinto, notificamos al usuario.
        throw new Error("El wrapper del core no disponde de loadROM directo. Requiere un glue específico para este build WASM.");
      }

      if (!this._running) {
        this._running = true;
        this.run();
      }
    } catch (err) {
      console.error("❌ Error cargando ROM SNES:", err);
      alert("No se pudo cargar el ROM de SNES. Mira la consola para detalles.");
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
    try {
      if (!this.snes) return false;
      if (typeof this.snes.saveState === "function") {
        const state = this.snes.saveState();
        const blob = new Blob([state], { type: "application/octet-stream" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "snes_save.sav";
        a.click();
        return true;
      }
      console.warn("saveState no implementado por el core.");
      return false;
    } catch (err) {
      console.error("❌ Error saveState SNES:", err);
      return false;
    }
  }

  loadState(stateBuffer) {
    try {
      if (!this.snes) throw new Error("Emulador no inicializado para cargar estado.");
      if (stateBuffer instanceof ArrayBuffer) stateBuffer = new Uint8Array(stateBuffer);

      if (typeof this.snes.loadState === "function") {
        this.snes.loadState(stateBuffer);
        console.log("✅ Partida SNES cargada.");
        return true;
      }
      console.warn("loadState no implementado por el core.");
      return false;
    } catch (err) {
      console.error("❌ Error al cargar partida SNES:", err);
      return false;
    }
  }
}
