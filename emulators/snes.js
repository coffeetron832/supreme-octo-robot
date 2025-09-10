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
    this.snes = null;      // instancia del emulador
    this.Module = null;    // módulo WebAssembly (HiganModule result)

    // promesa que resuelve cuando HiganModule está listo
    this.ready = this.initHigan();

    // mapeo lógico de botones (nombres, para API press/release)
    this.keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      z: "a",   // A / Botón (SNES: typically B/A mapping differences)
      x: "b",
      a: "x",
      s: "y",
      q: "l",
      w: "r",
      Enter: "start",
      Shift: "select",
    };

    // Normalizar key
    const normalizeKey = (e) => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);

    // Eventos de teclado (manejan press/release si la instancia los soporta)
    document.addEventListener("keydown", (e) => {
      const key = normalizeKey(e);
      if (!this.snes) return;
      const btn = this.keyMap[key];
      if (!btn) return;

      // Preferir press / release API (higan-js style)
      if (typeof this.snes.press === "function") {
        this.snes.press(btn);
        e.preventDefault();
        return;
      }

      // Fallback: si existe buttonDown (API diferente), intentar usarlo con índices
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

  // helper: mapear nombres a índices si el core espera índices
  _buttonIndex(name) {
    // convención: 0..7 (esto puede variar entre cores; es solo fallback)
    const order = ["a","b","x","y","l","r","select","start"];
    const idx = order.indexOf(name);
    return idx === -1 ? null : idx;
  }

  // Espera a que window.HiganModule exista y lo inicializa
  async initHigan() {
    // esperar a que window.HiganModule esté definido (script init en index.html debe establecerlo)
    const waitForHiganModule = async () => {
      if (window.HiganModule) return window.HiganModule;
      // poll breve
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const iv = setInterval(() => {
          attempts++;
          if (window.HiganModule) {
            clearInterval(iv);
            resolve(window.HiganModule);
          } else if (attempts > 200) { // ~10s
            clearInterval(iv);
            reject(new Error("Timeout esperando HiganModule en window."));
          }
        }, 50);
      });
    };

    try {
      const HModFactory = await waitForHiganModule(); // suele ser una función que devuelve una promesa Module()
      // HModFactory puede ser la función que al invocarla retorna la promesa del Module
      // Soportamos dos formas: que window.HiganModule ya sea el Module (sin invocar) o sea una factory
      let Module;
      if (typeof HModFactory === "function") {
        Module = await HModFactory();
      } else {
        // si ya es Module directamente (caso raro)
        Module = HModFactory;
      }

      this.Module = Module;
      console.log("✅ HiganModule listo. Propiedades exportadas:", Object.keys(Module));

      return Module;
    } catch (err) {
      console.error("❌ Error inicializando HiganModule:", err);
      throw err;
    }
  }

  // romData debe ser ArrayBuffer (main.js usa readAsArrayBuffer)
  async loadROM(romData) {
    try {
      const Module = await this.ready; // esperar inicialización
      if (!Module) throw new Error("Module Higan no disponible.");

      // detectar constructor disponible (Emulator / SNES / System / Core)
      const ctorNames = ["Emulator", "SNES", "System", "Core", "bsnes", "Higan"];
      let Ctor = null;
      for (const n of ctorNames) {
        if (Module[n] && typeof Module[n] === "function") {
          Ctor = Module[n];
          console.log(`🔎 Usando constructor exportado: ${n}`);
          break;
        }
      }
      // Si no se encuentra un constructor, buscar cualquier función de tipo function en Module
      if (!Ctor) {
        const keys = Object.keys(Module);
        for (const k of keys) {
          if (typeof Module[k] === "function") {
            // tomar la primera función "elevada" que parezca constructor (último recurso)
            Ctor = Module[k];
            console.log("🔎 Usando constructor alternativo:", k);
            break;
          }
        }
      }
      if (!Ctor) throw new Error("No se encontró un constructor de emulador en el Module.");

      // Instanciar emulador con el canvas (muchos cores aceptan canvas en constructor)
      this.snes = new Ctor(this.canvas);

      // Convertir ROM a Uint8Array si llega ArrayBuffer
      let romUint8;
      if (romData instanceof ArrayBuffer) romUint8 = new Uint8Array(romData);
      else if (romData instanceof Uint8Array) romUint8 = romData;
      else throw new Error("Formato de ROM no soportado; envía ArrayBuffer o Uint8Array.");

      // Llamada estándar: await this.snes.loadROM(romUint8)
      if (typeof this.snes.loadROM === "function") {
        await this.snes.loadROM(romUint8);
      } else if (typeof this.snes.loadROMFromBinary === "function") {
        await this.snes.loadROMFromBinary(romUint8);
      } else {
        throw new Error("La API del emulador no implementa loadROM / loadROMFromBinary.");
      }

      // arrancar loop
      if (!this._running) {
        this._running = true;
        this.run();
      }
    } catch (err) {
      console.error("❌ Error cargando ROM SNES:", err);
      alert("No se pudo cargar el ROM de SNES. Revisa la consola para más detalles.");
      throw err;
    }
  }

  run() {
    const loop = () => {
      if (this.snes) {
        // distintos nombres de frame loop
        if (typeof this.snes.runFrame === "function") this.snes.runFrame();
        else if (typeof this.snes.frame === "function") this.snes.frame();
        else if (typeof this.snes.step === "function") this.snes.step();
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  // guardar estado: soporte para Uint8Array/ArrayBuffer/string
  saveState() {
    try {
      if (!this.snes) return null;
      let state = null;
      if (typeof this.snes.saveState === "function") state = this.snes.saveState();
      else if (typeof this.snes.serializeState === "function") state = this.snes.serializeState();
      else throw new Error("API de saveState no disponible en el emulador.");

      // state puede ser Uint8Array, ArrayBuffer o string
      let blob;
      if (state instanceof Uint8Array || state instanceof ArrayBuffer) {
        blob = new Blob([state], { type: "application/octet-stream" });
      } else if (typeof state === "string") {
        blob = new Blob([state], { type: "application/json" });
      } else {
        // intentar convertir
        blob = new Blob([state]);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "snes_save.sav";
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.error("❌ Error guardando partida SNES:", err);
      return false;
    }
  }

  // cargar estado: acepta ArrayBuffer o Uint8Array (o string si el core lo pide)
  loadState(stateBuffer) {
    try {
      if (!this.snes) throw new Error("Emulador no inicializado para cargar estado.");
      if (stateBuffer instanceof ArrayBuffer) stateBuffer = new Uint8Array(stateBuffer);

      if (typeof this.snes.loadState === "function") {
        this.snes.loadState(stateBuffer);
      } else if (typeof this.snes.deserializeState === "function") {
        this.snes.deserializeState(stateBuffer);
      } else {
        throw new Error("API de loadState no disponible en el emulador.");
      }
      console.log("✅ Partida SNES cargada.");
      return true;
    } catch (err) {
      console.error("❌ Error al cargar partida SNES:", err);
      return false;
    }
  }
}
