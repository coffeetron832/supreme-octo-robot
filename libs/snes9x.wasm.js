// libs/snes9x.wasm.js
// Carga el archivo libs/snes9x.wasm.base64 y expone:
//  - window.SNES9xWasmBase64 (string base64)
//  - window.SNES9xWasmReady (Promise que resuelve con el base64)
(function () {
  if (window.SNES9xWasmReady) return; // idempotente

  window.SNES9xWasmBase64 = null;

  window.SNES9xWasmReady = (async () => {
    try {
      const url = "libs/snes9x.wasm.base64";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`No se pudo cargar ${url} (status ${res.status})`);
      }
      const text = await res.text();
      // limpiar espacios/line breaks
      const base64 = text.replace(/\s+/g, "");
      window.SNES9xWasmBase64 = base64;
      console.log("✅ Base64 SNES9x cargado (libs/snes9x.wasm.base64)");
      return base64;
    } catch (err) {
      console.error("❌ Error cargando libs/snes9x.wasm.base64:", err);
      throw err;
    }
  })();
})();
