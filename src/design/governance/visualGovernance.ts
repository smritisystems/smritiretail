export const SMRITI_VISUAL_GOVERNANCE_RULES = {
  allow: ['surface', 'text', 'border', 'radius', 'shadow', 'spacing', 'typography', 'motion'],
  forbid: ['bg-white', 'text-black', 'border-gray', 'shadow-sm', 'rounded-lg', 'inline style', 'raw css vars'],
} as const;

export const validateVisualUsage = (value: string) => {
  const violations = SMRITI_VISUAL_GOVERNANCE_RULES.forbid.filter((token) => value.includes(token));
  return { valid: violations.length === 0, violations };
};
