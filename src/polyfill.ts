/**
 * Project      : SMRITI Retail OS
 * Module       : Browser Global Polyfill Entrypoint
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritisys.com
 * Version      : 3.21.0
 * License      : Proprietary Commercial Software
 */

import { Buffer } from "buffer/";


if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
  (globalThis as any).Buffer = Buffer;
  (window as any).global = window;
  (globalThis as any).global = globalThis;
}

