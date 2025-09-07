const romInput = document.getElementById("romInput");
const consoleSelect = document.getElementById("consoleSelect");
const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");

let currentConsole = "nes";
let emulator = null;

consoleSelect.addEventListener("change", e => {
  currentConsole = e.target.value;
  console.log("Consola seleccionada:", currentConsole);
});

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

  // NES necesita binaryString, otros pueden aceptar ArrayBuffer
  if (currentConsole === "nes") {
    reader.readAsBinaryString(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
});
