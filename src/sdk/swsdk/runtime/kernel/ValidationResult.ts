export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

export function createValidationResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    valid: true,
    warnings: [],
    errors: [],
    recommendations: [],
    ...overrides
  };
}
