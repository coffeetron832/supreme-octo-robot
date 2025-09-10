const fs = require("fs");

const base64 = fs.readFileSync("libs/snes9x.wasm.base64", "utf8");
const binary = Buffer.from(base64.replace(/\s+/g, ""), "base64");

fs.writeFileSync("libs/snes9x.wasm", binary);

console.log("✅ snes9x.wasm generado correctamente.");
