export type { IEnvelope } from "../common/api/IEnvelope.js";
export type { IReceipt } from "../common/api/IReceipt.js";
export type { ISerializer } from "../common/api/ISerializer.js";
export type { IStorage } from "../common/api/IStorage.js";
export type { IPolicy } from "../common/api/IPolicy.js";
export type { IPlatformObject } from "../common/api/IPlatformObject.js";

export { Envelope, createEnvelope } from "../common/core/Envelope.js";
export { Receipt, createReceipt } from "../common/core/Receipt.js";
export { Policy, createPolicy } from "../common/core/Policy.js";
export { PlatformObject } from "../common/core/PlatformObject.js";
export { createMetadata, type Metadata } from "../common/core/Metadata.js";
export { PLATFORM_COMMON_API_VERSION as PLATFORM_CORE_API_VERSION } from "../common/core/Version.js";

export { JsonSerializer } from "../common/adapters/JsonSerializer.js";
export { MemoryStorage } from "../common/adapters/MemoryStorage.js";
