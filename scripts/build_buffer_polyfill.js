/**
 * Project      : SMRITI Retail OS
 * Module       : Standalone Buffer Polyfill Builder for Browser & Docker
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritisys.com
 * Version      : 3.39.0
 * License      : Proprietary Commercial Software
 */

import { execSync } from "child_process";
import fs from "fs";

export function buildBufferPolyfill() {
  fs.mkdirSync("public", { recursive: true });

  execSync("npx esbuild node_modules/buffer/index.js --bundle --format=iife --global-name=BufferModule --outfile=public/buffer.min.js", {
    stdio: "inherit"
  });

  const footer = `
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || (typeof BufferModule !== "undefined" ? BufferModule.Buffer : undefined);
  window.global = window.global || window;
}
if (typeof globalThis !== "undefined") {
  globalThis.Buffer = globalThis.Buffer || (typeof BufferModule !== "undefined" ? BufferModule.Buffer : undefined);
  globalThis.global = globalThis.global || globalThis;
}
`;

  fs.appendFileSync("public/buffer.min.js", footer, "utf-8");
  console.log("Buffer polyfill built successfully at public/buffer.min.js");
}

if (process.argv[1] && process.argv[1].endsWith("build_buffer_polyfill.js")) {
  buildBufferPolyfill();
}
