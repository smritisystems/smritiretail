/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-004 (Printer Language Detector v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export type DetectedPrinterLanguage =
  | "ZPL"
  | "TSPL"
  | "EPL"
  | "CPCL"
  | "SBPL"
  | "DPL"
  | "ESC_POS"
  | "RAW";

export interface LanguageDetectionResult {
  language: DetectedPrinterLanguage;
  confidence: number; // 0.0 to 1.0
  evidence: string[];
  ambiguous: boolean;
  alternativeLanguages?: DetectedPrinterLanguage[];
}

export class PrinterLanguageDetectorService {
  /**
   * Signature patterns for thermal printer languages.
   */
  private rules: Array<{
    language: DetectedPrinterLanguage;
    signatures: Array<{ pattern: RegExp; score: number; description: string }>;
  }> = [
    {
      language: "ZPL",
      signatures: [
        { pattern: /\^XA/i, score: 0.5, description: "ZPL format start header tag ^XA" },
        { pattern: /\^XZ/i, score: 0.4, description: "ZPL format end tag ^XZ" },
        { pattern: /\^FO\d+,\d+/i, score: 0.2, description: "ZPL field origin ^FO" },
        { pattern: /\^FD/i, score: 0.2, description: "ZPL field data ^FD" },
        { pattern: /\^FS/i, score: 0.2, description: "ZPL field separator ^FS" },
        { pattern: /\^BY\d+/i, score: 0.15, description: "ZPL barcode orientation ^BY" },
        { pattern: /\^BC[N|R|I|B]/i, score: 0.2, description: "ZPL Code128 barcode ^BC" },
      ],
    },
    {
      language: "TSPL",
      signatures: [
        { pattern: /^SIZE\s+\d+(\.\d+)?\s*(mm|inch)?,\s*\d+/im, score: 0.4, description: "TSPL SIZE command" },
        { pattern: /^GAP\s+\d+(\.\d+)?\s*(mm|inch)?/im, score: 0.3, description: "TSPL GAP command" },
        { pattern: /^CLS/im, score: 0.3, description: "TSPL CLS clear buffer command" },
        { pattern: /^PRINT\s+\d+(,\d+)?/im, score: 0.4, description: "TSPL PRINT command" },
        { pattern: /^TEXT\s+\d+,\d+/im, score: 0.2, description: "TSPL TEXT command" },
        { pattern: /^BARCODE\s+\d+,\d+/im, score: 0.2, description: "TSPL BARCODE command" },
      ],
    },
    {
      language: "EPL",
      signatures: [
        { pattern: /^N\r?\n/m, score: 0.4, description: "EPL clear image buffer command N" },
        { pattern: /^P\d+(,\d+)?\r?\n/m, score: 0.4, description: "EPL print command P" },
        { pattern: /^A\d+,\d+,\d+,\d+,\d+,\d+,[NR],"/m, score: 0.4, description: "EPL ASCII text command A" },
        { pattern: /^B\d+,\d+,\d+,\d+,\d+,\d+,\d+,[NWB],"/m, score: 0.4, description: "EPL Barcode command B" },
      ],
    },
    {
      language: "CPCL",
      signatures: [
        { pattern: /^!\s+\d+\s+\d+\s+\d+\s+\d+/m, score: 0.6, description: "CPCL header starting with exclamation" },
        { pattern: /^FORM\r?\n/m, score: 0.3, description: "CPCL FORM tag" },
        { pattern: /^PRINT\r?\n/m, score: 0.4, description: "CPCL PRINT tag" },
        { pattern: /^BARCODE\s+(128|EAN13|39)/im, score: 0.3, description: "CPCL BARCODE command" },
      ],
    },
    {
      language: "SBPL",
      signatures: [
        { pattern: /\x1A\x02/i, score: 0.6, description: "SATO SBPL STX/ETX sequence" },
        { pattern: /\{SBPL\}/i, score: 0.8, description: "SATO SBPL explicit metadata tag" },
        { pattern: /\x1BA/i, score: 0.4, description: "SATO ESC+A command" },
        { pattern: /\x1BZ/i, score: 0.4, description: "SATO ESC+Z command" },
      ],
    },
    {
      language: "DPL",
      signatures: [
        { pattern: /\x02L\r?\n/m, score: 0.6, description: "Datamax DPL STX L enter label format" },
        { pattern: /\x02E\d+/m, score: 0.4, description: "Datamax DPL print command STX E" },
        { pattern: /^1\d{3}000\d{4}/m, score: 0.3, description: "Datamax DPL text record format" },
      ],
    },
    {
      language: "ESC_POS",
      signatures: [
        { pattern: /\x1B\x40/i, score: 0.5, description: "ESC/POS initialize printer ESC @" },
        { pattern: /\x1D\x56[\x00\x01\x41\x42]/i, score: 0.4, description: "ESC/POS paper cut command GS V" },
        { pattern: /\x1D\x28\x6b/i, score: 0.4, description: "ESC/POS QR code command GS ( k" },
      ],
    },
  ];

  public detect(rawContent: string): LanguageDetectionResult {
    if (!rawContent || rawContent.trim().length === 0) {
      return {
        language: "RAW",
        confidence: 1.0,
        evidence: ["Empty content defaults to RAW"],
        ambiguous: false,
      };
    }

    const scores: Map<DetectedPrinterLanguage, { score: number; evidence: string[] }> = new Map();

    for (const rule of this.rules) {
      let langScore = 0;
      const langEvidence: string[] = [];

      for (const sig of rule.signatures) {
        if (sig.pattern.test(rawContent)) {
          langScore += sig.score;
          langEvidence.push(sig.description);
        }
      }

      if (langScore > 0) {
        scores.set(rule.language, {
          score: Math.min(langScore, 1.0),
          evidence: langEvidence,
        });
      }
    }

    if (scores.size === 0) {
      return {
        language: "RAW",
        confidence: 0.2,
        evidence: ["No recognized printer language signatures matched; falling back to RAW"],
        ambiguous: true,
      };
    }

    // Sort by highest confidence score
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score);

    const topMatch = sorted[0];
    const topLanguage = topMatch[0];
    const topScore = topMatch[1].score;
    const topEvidence = topMatch[1].evidence;

    // Check for ambiguity (second highest score close to top score)
    let isAmbiguous = false;
    const alternatives: DetectedPrinterLanguage[] = [];

    if (sorted.length > 1) {
      const runnerUp = sorted[1];
      if (topScore < 0.7 || Math.abs(topScore - runnerUp[1].score) < 0.15) {
        isAmbiguous = true;
      }
      for (let i = 1; i < sorted.length; i++) {
        alternatives.push(sorted[i][0]);
      }
    } else if (topScore < 0.7) {
      isAmbiguous = true;
    }

    return {
      language: topLanguage,
      confidence: parseFloat(topScore.toFixed(2)),
      evidence: topEvidence,
      ambiguous: isAmbiguous,
      alternativeLanguages: alternatives.length > 0 ? alternatives : undefined,
    };
  }
}

export const PrinterLanguageDetector = new PrinterLanguageDetectorService();
