/**
 * Browser stub for 'dotenv' module.
 * Node.js filesystem environment loading (dotenv.config()) is not applicable in browser DOM.
 * In browser builds, environment variables are populated at compile time via Vite (import.meta.env).
 */

export const config = () => ({ parsed: {} });
export const parse = () => ({});

export default {
  config,
  parse,
};
