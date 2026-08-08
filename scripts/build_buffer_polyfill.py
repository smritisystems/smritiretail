"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

import subprocess
import os

def build_buffer():
    os.makedirs("public", exist_ok=True)
    subprocess.run([
        "npx", "esbuild", "node_modules/buffer/index.js",
        "--bundle", "--format=iife", "--global-name=BufferModule",
        "--outfile=public/buffer.min.js"
    ], check=True, shell=True)

    
    footer = """
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || (typeof BufferModule !== "undefined" ? BufferModule.Buffer : undefined);
  window.global = window.global || window;
}
if (typeof globalThis !== "undefined") {
  globalThis.Buffer = globalThis.Buffer || (typeof BufferModule !== "undefined" ? BufferModule.Buffer : undefined);
  globalThis.global = globalThis.global || globalThis;
}
"""
    with open("public/buffer.min.js", "a", encoding="utf-8") as f:
        f.write(footer)
    print("Buffer polyfill built successfully at public/buffer.min.js")

if __name__ == "__main__":
    build_buffer()
