export type { IEnvelope } from "./api/IEnvelope.js";
export type { IReceipt } from "./api/IReceipt.js";
export type { ISerializer } from "./api/ISerializer.js";
export type { IStorage } from "./api/IStorage.js";
export type { IPolicy } from "./api/IPolicy.js";
export type { IPlatformObject } from "./api/IPlatformObject.js";

export { Envelope, createEnvelope } from "./core/Envelope.js";
export { Receipt, createReceipt } from "./core/Receipt.js";
export { Policy, createPolicy } from "./core/Policy.js";
export { PlatformObject } from "./core/PlatformObject.js";
export { createMetadata, type Metadata } from "./core/Metadata.js";
export { PLATFORM_COMMON_API_VERSION as PLATFORM_CORE_API_VERSION } from "./core/Version.js";

export { JsonSerializer } from "./adapters/JsonSerializer.js";
export { MemoryStorage } from "./adapters/MemoryStorage.js";
