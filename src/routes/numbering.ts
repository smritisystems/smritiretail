// DEPRECATED v3.20.0: Superseded by FastAPI /api/v1/* — not mounted in server.ts. Safe to delete after v3.21.0.

/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

router.get("/api/numbering/series", async (req, res) => {
  try {
    const dbRes = await pool.query(
      `SELECT id, name, document_type AS "documentType", module, prefix, suffix, 
              running_length AS "runningLength", reset_rule AS "resetRule", 
              current_number AS "currentNumber", last_reset_key AS "lastResetKey", 
              financial_year AS "financialYear", company_code AS "companyCode", 
              mode, description, is_active AS "isActive" 
       FROM document_series 
       WHERE is_deleted = false`
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/numbering/series", async (req, res) => {
  const data = req.body;
  const id = "SER-" + Date.now();
  const currentNumber = parseInt(data.currentNumber) || 0;
  const runningLength = parseInt(data.runningLength) || 6;
  const isActive = data.isActive !== false;
  const companyCode = data.companyCode || "SMRITI_IND";
  const financialYear = data.financialYear || "2026-2027";
  const mode = data.mode || "Auto";
  const resetRule = data.resetRule || "Financial Year";

  try {
    await pool.query(
      `INSERT INTO document_series (
        id, uuid, name, document_type, module, prefix, suffix, 
        running_length, reset_rule, current_number, last_reset_key, 
        financial_year, company_code, mode, description, is_active, is_deleted, created_at, modified_at
      ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, $7, $8, $9, null, $10, $11, $12, $13, $14, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        data.name,
        data.documentType,
        data.module || null,
        data.prefix || "",
        data.suffix || "",
        runningLength,
        resetRule,
        currentNumber,
        financialYear,
        companyCode,
        mode,
        data.description || null,
        isActive
      ]
    );

    const logId = "NAL-" + Date.now().toString() + Math.floor(Math.random() * 1000);
    const operator = (req.headers["x-user-name"] as string) || "Admin";
    await pool.query(
      `INSERT INTO numbering_audit_logs (
        id, uuid, series_id, series_name, action, document_no, old_value, new_value, details, operator, is_active, is_deleted, created_at, modified_at
      ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, 'CREATE', '-', '-', $4, $5, $6, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        logId,
        id,
        data.name,
        String(currentNumber),
        `Created new Document Series '${data.name}' for ${data.documentType}`,
        operator
      ]
    );

    res.json({
      id,
      name: data.name,
      documentType: data.documentType,
      module: data.module || null,
      prefix: data.prefix || "",
      suffix: data.suffix || "",
      runningLength,
      resetRule,
      currentNumber,
      lastResetKey: null,
      financialYear,
      companyCode,
      mode,
      description: data.description || null,
      isActive
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/numbering/series/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const checkRes = await pool.query(
      `SELECT id, name, document_type AS "documentType", module, prefix, suffix, 
              running_length AS "runningLength", reset_rule AS "resetRule", 
              current_number AS "currentNumber", last_reset_key AS "lastResetKey", 
              financial_year AS "financialYear", company_code AS "companyCode", 
              mode, description, is_active AS "isActive" 
       FROM document_series WHERE id = $1 AND is_deleted = false`,
      [id]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: "Series not found" });
    const old = checkRes.rows[0];

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const fieldsMapping: Record<string, string> = {
      name: "name",
      prefix: "prefix",
      suffix: "suffix",
      description: "description",
      mode: "mode"
    };

    for (const [key, col] of Object.entries(fieldsMapping)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = $${paramIdx++}`);
        values.push(data[key]);
      }
    }

    if (data.currentNumber !== undefined) {
      fields.push(`current_number = $${paramIdx++}`);
      values.push(parseInt(data.currentNumber) || 0);
    }
    if (data.runningLength !== undefined) {
      fields.push(`running_length = $${paramIdx++}`);
      values.push(parseInt(data.runningLength) || 6);
    }
    if (data.resetRule !== undefined) {
      fields.push(`reset_rule = $${paramIdx++}`);
      values.push(data.resetRule);
    }
    if (data.financialYear !== undefined) {
      fields.push(`financial_year = $${paramIdx++}`);
      values.push(data.financialYear);
    }
    if (data.companyCode !== undefined) {
      fields.push(`company_code = $${paramIdx++}`);
      values.push(data.companyCode);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIdx++}`);
      values.push(data.isActive !== false);
    }

    let updated = { ...old, ...data };

    if (fields.length > 0) {
      values.push(id);
      await pool.query(
        `UPDATE document_series SET ${fields.join(", ")}, modified_at = CURRENT_TIMESTAMP WHERE id = $${paramIdx}`,
        values
      );
    }

    const logId = "NAL-" + Date.now().toString() + Math.floor(Math.random() * 1000);
    const operator = (req.headers["x-user-name"] as string) || "Admin";
    await pool.query(
      `INSERT INTO numbering_audit_logs (
        id, uuid, series_id, series_name, action, document_no, old_value, new_value, details, operator, is_active, is_deleted, created_at, modified_at
      ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, 'UPDATE', '-', $4, $5, $6, $7, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        logId,
        id,
        updated.name,
        JSON.stringify(old),
        JSON.stringify(updated),
        `Updated configuration parameters for series '${updated.name}'`,
        operator
      ]
    );

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/numbering/series/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const checkRes = await pool.query(
      `SELECT name FROM document_series WHERE id = $1 AND is_deleted = false`,
      [id]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: "Series not found" });
    const name = checkRes.rows[0].name;

    await pool.query(
      `UPDATE document_series SET is_active = false, is_deleted = true, modified_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    const logId = "NAL-" + Date.now().toString() + Math.floor(Math.random() * 1000);
    const operator = (req.headers["x-user-name"] as string) || "Admin";
    await pool.query(
      `INSERT INTO numbering_audit_logs (
        id, uuid, series_id, series_name, action, document_no, old_value, new_value, details, operator, is_active, is_deleted, created_at, modified_at
      ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, 'RESET', '-', 'Active', 'Retired', $4, $5, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        logId,
        id,
        name,
        `Retired/deactivated series '${name}'`,
        operator
      ]
    );

    res.json({ success: true, message: `Series ${name} deactivated.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/numbering/logs", async (req, res) => {
  try {
    const dbRes = await pool.query(
      `SELECT id, created_at AS "timestamp", series_id AS "seriesId", 
              series_name AS "seriesName", action, operator AS "user", 
              document_no AS "documentNo", old_value AS "oldValue", 
              new_value AS "newValue", details 
       FROM numbering_audit_logs 
       ORDER BY created_at DESC`
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/numbering/series/:id/allocate", async (req, res) => {
  const { id } = req.params;
  const pythonCoreHost = process.env.DATABASE_URL?.includes("@db:") ? "http://python-core:8000" : "http://localhost:8000";
  const authHeader = req.headers["authorization"];

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Service-Key": process.env.INTERNAL_SERVICE_KEY || "smriti_secret_fallback_key"
    };
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const payload = {
      branch: req.body.branch || "HQ",
      fy: req.body.fy || "26-27"
    };

    const upstreamRes = await fetch(`${pythonCoreHost}/api/v1/numbering/series/${id}/allocate`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      try {
        const errJson = JSON.parse(errText);
        return res.status(upstreamRes.status).json({ error: errJson.detail || errJson.message || "Allocation failed" });
      } catch {
        return res.status(upstreamRes.status).json({ error: errText || "Allocation failed" });
      }
    }

    const data = await upstreamRes.json();
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
