import { ValidationResult } from "./ManifestValidator.js";

export interface RegistrationSignature {
  algorithm: "sha256";
  value: string;
  key: string;
}

export interface RegistrationCompatibility {
  constitution: string;
  spc: string;
  sdk: string;
  designSystem: string;
}

export interface RegistrationManifest {
  workspaceId: string;
  manifestVersion: "1.0";
  registeredAt: string;
  publisher: string;
  signature: RegistrationSignature;
  compatibility: RegistrationCompatibility;
}

export interface RegistrationRecord {
  workspaceId: string;
  status: "registered" | "pending" | "failed";
  manifest: RegistrationManifest;
  registeredAt: string;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return String(value);
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function createRegistrationSignature(registration: RegistrationManifest): string {
  const payload = stableStringify({
    workspaceId: registration.workspaceId,
    manifestVersion: registration.manifestVersion,
    registeredAt: registration.registeredAt,
    publisher: registration.publisher,
    compatibility: registration.compatibility
  });
  return hashString(`${payload}:${registration.signature.key}`);
}

export function verifyRegistrationSignature(registration: RegistrationManifest): boolean {
  return Boolean(registration.signature?.value) && registration.signature.value === createRegistrationSignature(registration);
}

function isSupportedCompatibilityVersion(version: string): boolean {
  return /^1(\.x|\.0|\.\d+)?$/.test(version);
}

export function validateRegistrationManifest(
  workspaceId: string,
  registration?: RegistrationManifest
): ValidationResult {
  if (!registration) {
    return { valid: true, stage: "Registration", errors: [] };
  }

  const errors: string[] = [];

  if (!registration.workspaceId || registration.workspaceId !== workspaceId) {
    errors.push("Registration Validation Failed: registration workspaceId must match the workspace manifest.");
  }
  if (!registration.manifestVersion || registration.manifestVersion !== "1.0") {
    errors.push("Registration Validation Failed: manifestVersion must be '1.0'.");
  }
  if (!registration.registeredAt) {
    errors.push("Registration Validation Failed: registeredAt is required.");
  }
  if (!registration.publisher) {
    errors.push("Registration Validation Failed: publisher is required.");
  }
  if (!registration.signature?.algorithm || registration.signature.algorithm !== "sha256") {
    errors.push("Registration Validation Failed: signature.algorithm must be 'sha256'.");
  }
  if (!registration.signature?.key) {
    errors.push("Registration Validation Failed: signature.key is required.");
  }
  if (!registration.signature?.value) {
    errors.push("Registration Validation Failed: signature.value is required.");
  }
  if (!registration.compatibility) {
    errors.push("Registration Validation Failed: compatibility metadata is required.");
  } else {
    if (!isSupportedCompatibilityVersion(registration.compatibility.constitution)) {
      errors.push("Compatibility Validation Failed: constitution version must align with the 1.x baseline.");
    }
    if (!isSupportedCompatibilityVersion(registration.compatibility.spc)) {
      errors.push("Compatibility Validation Failed: spc version must align with the 1.x baseline.");
    }
    if (!isSupportedCompatibilityVersion(registration.compatibility.sdk)) {
      errors.push("Compatibility Validation Failed: sdk version must align with the 1.x baseline.");
    }
    if (!isSupportedCompatibilityVersion(registration.compatibility.designSystem)) {
      errors.push("Compatibility Validation Failed: designSystem version must align with the 1.x baseline.");
    }
  }

  if (!errors.some((error) => error.includes("signature.value")) && !verifyRegistrationSignature(registration)) {
    errors.push("Signature Validation Failed: the registration signature does not match the canonical payload.");
  }

  return {
    valid: errors.length === 0,
    stage: "Registration",
    errors
  };
}
