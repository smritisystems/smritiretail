/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — File Transport Adapter
 * Standard     : SCS-PRINT-FILE-ADAPTER-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IPrinterAdapter, TransportDispatchResult } from "./PrinterAdapter.ts";
import { UniversalPrintJob, PrintTransportType } from "../UniversalPrintJob.ts";
import { PrinterProfile } from "../../models/PrinterProfile.ts";
import * as fs from "fs";
import * as path from "path";

export interface PrintFileResult {
  mode: "FILE";
  success: boolean;
  filePath: string;
  fileName: string;
  language: string;
  bytes: number;
  checksum: string;
  copies: number;
}

export interface FileMetadataResult {
  exists: boolean;
  sizeBytes: number;
  createdAt: string;
  language: string;
  checksum: string;
  absolutePath: string;
}

export class FilePrinterAdapter implements IPrinterAdapter {
  public readonly transportType: PrintTransportType = "FILE";
  public lastOutputPayload?: string;
  public lastFileResult?: PrintFileResult;

  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || path.join(process.cwd(), "print_outputs");
    this.ensureDirectoryExists(this.outputDir);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
      } catch {
        // Fall back to current working dir if directory creation fails
        this.outputDir = process.cwd();
      }
    }
  }

  /**
   * Sanitizes filenames to prevent path traversal and remove OS invalid characters.
   */
  public sanitizeFilename(input: string): string {
    if (!input) return "unnamed_label.prn";
    // Replace OS invalid chars: <>:"/\|?* with underscore
    let clean = input.replace(/[<>:"/\\|?*]/g, "_").trim();
    if (!clean.endsWith(".prn")) {
      clean += ".prn";
    }
    return clean;
  }

  /**
   * Generates and writes the printer-native script payload to a file.
   */
  public async generate(
    job: UniversalPrintJob,
    printer: PrinterProfile,
    customFilename?: string
  ): Promise<PrintFileResult> {
    const payload = job.renderedPayload;
    if (!payload || payload.length === 0) {
      throw new Error("INVALID_PAYLOAD: Rendered job payload is empty.");
    }

    const lang = (job.language || printer.language || "PRN").toUpperCase();
    const fileName = customFilename
      ? this.sanitizeFilename(customFilename)
      : this.sanitizeFilename(`${job.templateId}_${printer.name}_${job.jobId}`);

    const targetPath = path.join(this.outputDir, fileName);

    // Save stream securely
    await this.save(payload, targetPath);

    const bytes = Buffer.from(payload).length;
    this.lastOutputPayload = payload;

    const fileResult: PrintFileResult = {
      mode: "FILE",
      success: true,
      filePath: targetPath,
      fileName,
      language: lang,
      bytes,
      checksum: job.checksum,
      copies: job.copies,
    };

    this.lastFileResult = fileResult;
    return fileResult;
  }

  /**
   * Saves payload content securely to target filepath.
   */
  public async save(payload: string, targetPath: string): Promise<string> {
    const dir = path.dirname(targetPath);
    this.ensureDirectoryExists(dir);

    // Write file cleanly without executing code
    fs.writeFileSync(targetPath, payload, { encoding: "utf-8" });
    return targetPath;
  }

  /**
   * Returns a structured preview of the PRN content.
   */
  public preview(payload: string, language: string): { raw: string; lineCount: number; summary: string } {
    if (!payload) {
      return { raw: "", lineCount: 0, summary: "Empty payload" };
    }

    const lines = payload.split(/\r?\n/);
    const nonEndLines = lines.filter((l) => l.trim().length > 0);
    return {
      raw: payload,
      lineCount: lines.length,
      summary: `PRN Script (${language || "RAW"}) — ${nonEndLines.length} active command lines, ${Buffer.from(payload).length} bytes`,
    };
  }

  /**
   * Reads metadata for a generated .prn file.
   */
  public async getMetadata(filePath: string): Promise<FileMetadataResult> {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        sizeBytes: 0,
        createdAt: "",
        language: "UNKNOWN",
        checksum: "",
        absolutePath: filePath,
      };
    }

    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, "utf-8");

    // Simple hash calculation for metadata
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash |= 0;
    }

    return {
      exists: true,
      sizeBytes: stats.size,
      createdAt: stats.birthtime.toISOString(),
      language: content.includes("^XA") ? "ZPL" : content.includes("\x02L") ? "DPL" : "RAW",
      checksum: `chk-${Math.abs(hash).toString(16)}`,
      absolutePath: path.resolve(filePath),
    };
  }

  /**
   * Generates OS folder show path for file dialog / preview.
   */
  public getFolderShowPath(filePath: string): string {
    return path.dirname(path.resolve(filePath));
  }

  /**
   * Dispatches print job to File transport mode.
   */
  public async dispatch(job: UniversalPrintJob, printer: PrinterProfile): Promise<TransportDispatchResult> {
    const payload = job.renderedPayload;
    if (!payload || payload.length === 0) {
      return {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "File payload is empty.",
      };
    }

    try {
      const fileRes = await this.generate(job, printer);
      job.logTransport(`Generated PRN script file: ${fileRes.filePath} (${fileRes.bytes} bytes, checksum: ${fileRes.checksum})`);

      // Governed requirement: Set job status to FILE_GENERATED, not COMPLETED or PRINTED
      job.updateStatus("FILE_GENERATED");

      return {
        success: true,
        code: "COMPLETED",
        message: `PRINT TO FILE COMPLETE — File '${fileRes.fileName}' generated (${fileRes.bytes} bytes). Status: FILE_GENERATED.`,
        bytesTransferred: fileRes.bytes,
        durationMs: 5,
      };
    } catch (err: any) {
      return {
        success: false,
        code: "FAILED",
        message: `File Transport Failure: ${err.message || String(err)}`,
      };
    }
  }

  public async checkStatus(printer: PrinterProfile): Promise<{ online: boolean; statusMessage: string }> {
    return { online: true, statusMessage: "FILE transport mode ready." };
  }
}
