const romInput = document.getElementById("romInput");
const consoleSelect = document.getElementById("consoleSelect");
const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");

let currentConsole = "nes";
let emulator = null;

// Cambio de consola
consoleSelect.addEventListener("change", e => {
  currentConsole = e.target.value;
  console.log("Consola seleccionada:", currentConsole);
});

// Cargar ROM
romInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();

  reader.onload = () => {
    const romData = reader.result;

    switch (currentConsole) {
      case "nes":
        emulator = new NesEmulator(canvas, ctx);
        emulator.loadROM(romData);
        break;

      case "snes":
        emulator = new SnesEmulator(canvas, ctx);
        emulator.loadROM(romData);
        break;

      case "gba":
        emulator = new GbaEmulator(canvas, ctx);
        emulator.loadROM(romData);
        break;
    }
  };

  reader.readAsArrayBuffer(file);
});

// Pantalla completa
document.getElementById("fullscreenBtn").addEventListener("click", () => {
  if (canvas.requestFullscreen) {
    canvas.requestFullscreen();
  } else if (canvas.webkitRequestFullscreen) {
    canvas.webkitRequestFullscreen();
  }
});

// 🎮 Guardar partida
document.getElementById("saveStateBtn").addEventListener("click", () => {
  if (emulator && typeof emulator.saveState === "function") {
    emulator.saveState();
  } else {
    alert("⚠️ Guardar estado solo está disponible en NES por ahora.");
  }
});

// 🎮 Conectar botón "Cargar Partida" con el input oculto
document.getElementById("loadStateBtn").addEventListener("click", () => {
  document.getElementById("loadStateInput").click();
});

// 🎮 Cargar partida desde archivo
document.getElementById("loadStateInput").addEventListener("change", e => {
  if (!emulator || typeof emulator.loadState !== "function") {
    alert("⚠️ Cargar estado solo está disponible en NES por ahora.");
    return;
  }
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const state = JSON.parse(ev.target.result);
        emulator.loadState(state);
        alert("✅ Partida cargada correctamente.");
      } catch (err) {
        alert("❌ Archivo de partida inválido.");
      }
    };
    reader.readAsText(file);
  }
});
