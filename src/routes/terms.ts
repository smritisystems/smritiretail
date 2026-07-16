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
import { resolveTermsText } from "../lib/helpers.js";

const router = express.Router();

// Helper to convert DB clause to API format
function mapClause(row: any) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    category: row.category,
    content: row.content,
    isActive: row.isActive,
    version: row.version,
    lastUpdated: row.lastUpdated ? new Date(row.lastUpdated).toISOString() : null,
    updatedBy: row.updatedBy || "System Admin",
    status: row.status,
    language: row.language,
    approvedBy: row.approvedBy || "-",
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : "-"
  };
}

// Helper to convert DB default to API format
function mapDefault(row: any) {
  let clauseIds: string[] = [];
  if (row.clauseIds) {
    try {
      clauseIds = typeof row.clauseIds === "string" ? JSON.parse(row.clauseIds) : row.clauseIds;
    } catch {
      clauseIds = [];
    }
  }
  return {
    id: row.id,
    level: row.level,
    refId: row.refId,
    clauseIds,
    isActive: row.isActive,
    lastUpdated: row.lastUpdated ? new Date(row.lastUpdated).toISOString() : null,
    updatedBy: row.updatedBy || "System Admin"
  };
}

// Helper to convert DB workflow log to API format
function mapWorkflowLog(row: any) {
  let proposedChanges: any = null;
  if (row.proposedChanges) {
    try {
      proposedChanges = typeof row.proposedChanges === "string" ? JSON.parse(row.proposedChanges) : row.proposedChanges;
    } catch {
      proposedChanges = null;
    }
  }
  return {
    id: row.id,
    clauseId: row.clauseId,
    title: row.title,
    version: row.version,
    submittedBy: row.submittedBy || "Operator Dev",
    submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
    status: row.status,
    approvedBy: row.approvedBy || "-",
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : "-",
    comments: row.comments || "",
    proposedChanges
  };
}

// Helper to convert DB snapshot to API format
function mapSnapshot(row: any) {
  let clausesSnapshot: any[] = [];
  if (row.clausesSnapshot) {
    try {
      clausesSnapshot = typeof row.clausesSnapshot === "string" ? JSON.parse(row.clausesSnapshot) : row.clausesSnapshot;
    } catch {
      clausesSnapshot = [];
    }
  }
  return {
    id: row.id,
    documentType: row.documentType,
    documentNo: row.documentNo,
    snapshotAt: row.snapshotAt ? new Date(row.snapshotAt).toISOString() : null,
    clausesSnapshot
  };
}

// Clauses
router.get("/api/terms/clauses", async (req, res) => {
  try {
    const dbRes = await pool.query(
      `SELECT id, code, title, category, content, status, language,
              approved_by AS "approvedBy", approved_at AS "approvedAt",
              is_active AS "isActive", version, modified_at AS "lastUpdated",
              updated_by AS "updatedBy"
       FROM terms_clauses
       WHERE is_deleted = false`
    );
    res.json(dbRes.rows.map(mapClause));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/terms/clauses", async (req, res) => {
  const data = req.body;
  if (!data.category || !data.title || !data.content) {
    return res.status(400).json({ error: "Missing required clause fields" });
  }

  const categoryAbbr = data.category.substring(0, 3).toUpperCase();
  const id = "CL-" + categoryAbbr + "-" + Date.now();
  const code = data.code || `CODE-${Date.now()}`;
  const isActive = data.isActive !== false;
  const status = data.status || "Approved";
  const language = data.language || "English";
  const operator = (req.headers["x-user-name"] as string) || "System Admin";

  try {
    await pool.query(
      `INSERT INTO terms_clauses (
        id, uuid, code, title, category, content, status, language, 
        is_active, is_deleted, created_at, modified_at, created_by, updated_by, version
      ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, $7, $8, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $9, $9, 1)`,
      [id, code, data.title, data.category, data.content, status, language, isActive, operator]
    );

    if (status === "Pending Approval") {
      const logId = "AP-" + Date.now();
      await pool.query(
        `INSERT INTO approval_workflow_logs (
          id, uuid, clause_id, title, version, submitted_by, submitted_at, 
          status, approved_by, approved_at, comments, proposed_changes, 
          is_active, is_deleted, created_at, modified_at
        ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, 1, $4, CURRENT_TIMESTAMP, 'Pending', '-', null, $5, null, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [logId, id, data.title, operator, "Submitted clause draft into security validation matrix."]
      );
    }

    res.status(201).json({
      id,
      code,
      title: data.title,
      category: data.category,
      content: data.content,
      isActive,
      version: 1,
      lastUpdated: new Date().toISOString(),
      updatedBy: operator,
      status,
      language,
      approvedBy: "-",
      approvedAt: "-"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/terms/clauses/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const operator = (req.headers["x-user-name"] as string) || "Admin Dev";

  try {
    const checkRes = await pool.query(
      `SELECT id, title, category, content, status, language, is_active AS "isActive", version 
       FROM terms_clauses WHERE id = $1 AND is_deleted = false`,
      [id]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: "Clause not found" });
    const oldClause = checkRes.rows[0];

    const requireApproval = data.submitForApproval === true;
    const updatedVersion = oldClause.version + 1;

    if (requireApproval) {
      const logId = "AP-" + Date.now();
      const proposedChanges = JSON.stringify({
        title: data.title || oldClause.title,
        content: data.content || oldClause.content,
        category: data.category || oldClause.category
      });

      await pool.query(
        `INSERT INTO approval_workflow_logs (
          id, uuid, clause_id, title, version, submitted_by, submitted_at, 
          status, approved_by, approved_at, comments, proposed_changes, 
          is_active, is_deleted, created_at, modified_at
        ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'Pending', '-', null, $6, $7, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [logId, id, data.title || oldClause.title, updatedVersion, operator, data.comments || "Revision request for compliance standard verification.", proposedChanges]
      );

      await pool.query(
        `UPDATE terms_clauses SET status = 'Pending Approval', modified_at = CURRENT_TIMESTAMP, updated_by = $1 WHERE id = $2`,
        [operator, id]
      );

      return res.json({ success: true, message: "Revision submitted to approval pipeline", logId });
    }

    const title = data.title !== undefined ? data.title : oldClause.title;
    const content = data.content !== undefined ? data.content : oldClause.content;
    const category = data.category !== undefined ? data.category : oldClause.category;
    const isActive = data.isActive !== undefined ? data.isActive : oldClause.isActive;
    const language = data.language !== undefined ? data.language : oldClause.language;

    await pool.query(
      `UPDATE terms_clauses 
       SET title = $1, content = $2, category = $3, is_active = $4, language = $5, 
           version = $6, status = 'Approved', modified_at = CURRENT_TIMESTAMP, updated_by = $7 
       WHERE id = $8`,
      [title, content, category, isActive, language, updatedVersion, operator, id]
    );

    res.json({
      id,
      title,
      content,
      category,
      isActive,
      language,
      version: updatedVersion,
      lastUpdated: new Date().toISOString(),
      updatedBy: operator,
      status: "Approved"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/terms/clauses/:id/approve", async (req, res) => {
  const { id } = req.params;
  const operator = (req.headers["x-user-name"] as string) || "Finance Auditor Dev";
  const comments = req.body.comments || "Corporate audit validation verified.";

  try {
    const checkRes = await pool.query(
      `SELECT id, version FROM terms_clauses WHERE id = $1 AND is_deleted = false`,
      [id]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: "Clause not found" });
    const currentVersion = checkRes.rows[0].version;
    const nextVersion = currentVersion + 1;

    // Find pending workflow logs
    const logRes = await pool.query(
      `SELECT id, proposed_changes AS "proposedChanges" FROM approval_workflow_logs 
       WHERE clause_id = $1 AND status = 'Pending' LIMIT 1`,
      [id]
    );

    let proposed: any = null;
    if (logRes.rows.length > 0) {
      const log = logRes.rows[0];
      await pool.query(
        `UPDATE approval_workflow_logs 
         SET status = 'Approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, comments = $2, modified_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [operator, comments, log.id]
      );
      if (log.proposedChanges) {
        try {
          proposed = typeof log.proposedChanges === "string" ? JSON.parse(log.proposedChanges) : log.proposedChanges;
        } catch {
          proposed = null;
        }
      }
    }

    if (proposed) {
      await pool.query(
        `UPDATE terms_clauses 
         SET title = $1, content = $2, category = $3, status = 'Approved', 
             version = $4, modified_at = CURRENT_TIMESTAMP, updated_by = $5, approved_by = $5, approved_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [proposed.title, proposed.content, proposed.category || "General", nextVersion, operator, id]
      );
    } else {
      await pool.query(
        `UPDATE terms_clauses 
         SET status = 'Approved', version = $1, modified_at = CURRENT_TIMESTAMP, updated_by = $2, approved_by = $2, approved_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [nextVersion, operator, id]
      );
    }

    const updatedRes = await pool.query(
      `SELECT id, code, title, category, content, status, language,
              approved_by AS "approvedBy", approved_at AS "approvedAt",
              is_active AS "isActive", version, modified_at AS "lastUpdated",
              updated_by AS "updatedBy"
       FROM terms_clauses WHERE id = $1`,
      [id]
    );

    res.json({ success: true, clause: mapClause(updatedRes.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/terms/clauses/:id/reject", async (req, res) => {
  const { id } = req.params;
  const operator = (req.headers["x-user-name"] as string) || "Finance Auditor Dev";
  const comments = req.body.comments || "Rejected. Content breaches standard legal terminology requirements.";

  try {
    const checkRes = await pool.query(
      `SELECT id FROM terms_clauses WHERE id = $1 AND is_deleted = false`,
      [id]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: "Clause not found" });

    // Reject pending workflow logs
    await pool.query(
      `UPDATE approval_workflow_logs 
       SET status = 'Rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, comments = $2, modified_at = CURRENT_TIMESTAMP 
       WHERE clause_id = $3 AND status = 'Pending'`,
      [operator, comments, id]
    );

    await pool.query(
      `UPDATE terms_clauses SET status = 'Draft', modified_at = CURRENT_TIMESTAMP, updated_by = $1 WHERE id = $2`,
      [operator, id]
    );

    const updatedRes = await pool.query(
      `SELECT id, code, title, category, content, status, language,
              approved_by AS "approvedBy", approved_at AS "approvedAt",
              is_active AS "isActive", version, modified_at AS "lastUpdated",
              updated_by AS "updatedBy"
       FROM terms_clauses WHERE id = $1`,
      [id]
    );

    res.json({ success: true, clause: mapClause(updatedRes.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Defaults
router.get("/api/terms/defaults", async (req, res) => {
  try {
    const dbRes = await pool.query(
      `SELECT id, level, ref_id AS "refId", clause_ids AS "clauseIds", is_active AS "isActive",
              modified_at AS "lastUpdated", updated_by AS "updatedBy"
       FROM terms_defaults
       WHERE is_deleted = false`
    );
    res.json(dbRes.rows.map(mapDefault));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/terms/defaults", async (req, res) => {
  const data = req.body;
  if (!data.level || !data.refId || !data.clauseIds) {
    return res.status(400).json({ error: "Missing required default mapping fields" });
  }

  const operator = (req.headers["x-user-name"] as string) || "System Admin";
  const clauseIdsStr = JSON.stringify(data.clauseIds);

  try {
    const checkRes = await pool.query(
      `SELECT id FROM terms_defaults WHERE level = $1 AND ref_id = $2 AND is_deleted = false`,
      [data.level, data.refId]
    );

    if (checkRes.rows.length > 0) {
      const existingId = checkRes.rows[0].id;
      const isActive = data.isActive !== false;

      await pool.query(
        `UPDATE terms_defaults 
         SET clause_ids = $1, is_active = $2, modified_at = CURRENT_TIMESTAMP, updated_by = $3 
         WHERE id = $4`,
        [clauseIdsStr, isActive, operator, existingId]
      );

      const updatedRes = await pool.query(
        `SELECT id, level, ref_id AS "refId", clause_ids AS "clauseIds", is_active AS "isActive",
                modified_at AS "lastUpdated", updated_by AS "updatedBy"
         FROM terms_defaults WHERE id = $1`,
        [existingId]
      );
      return res.json(mapDefault(updatedRes.rows[0]));
    }

    const id = "DF-" + Date.now();
    await pool.query(
      `INSERT INTO terms_defaults (
        id, uuid, level, ref_id, clause_ids, is_active, is_deleted, created_at, modified_at, created_by, updated_by, version
      ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5, $5, 1)`,
      [id, data.level, data.refId, clauseIdsStr, operator]
    );

    res.status(201).json({
      id,
      level: data.level,
      refId: data.refId,
      clauseIds: data.clauseIds,
      isActive: true,
      lastUpdated: new Date().toISOString(),
      updatedBy: operator
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logs
router.get("/api/terms/logs", async (req, res) => {
  try {
    const dbRes = await pool.query(
      `SELECT id, clause_id AS "clauseId", title, version, submitted_by AS "submittedBy",
              submitted_at AS "submittedAt", status, approved_by AS "approvedBy",
              approved_at AS "approvedAt", comments, proposed_changes AS "proposedChanges"
       FROM approval_workflow_logs 
       WHERE is_deleted = false
       ORDER BY created_at DESC`
    );
    res.json(dbRes.rows.map(mapWorkflowLog));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Snapshots
router.get("/api/terms/snapshots", async (req, res) => {
  try {
    const dbRes = await pool.query(
      `SELECT id, document_type AS "documentType", document_no AS "documentNo",
              snapshot_at AS "snapshotAt", clauses_snapshot AS "clausesSnapshot"
       FROM terms_snapshots
       WHERE is_deleted = false`
    );
    res.json(dbRes.rows.map(mapSnapshot));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/terms/snapshots/:docType/:docNo", async (req, res) => {
  const { docType, docNo } = req.params;
  try {
    const dbRes = await pool.query(
      `SELECT id, document_type AS "documentType", document_no AS "documentNo",
              snapshot_at AS "snapshotAt", clauses_snapshot AS "clausesSnapshot"
       FROM terms_snapshots
       WHERE document_type = $1 AND document_no = $2 AND is_deleted = false
       LIMIT 1`,
      [docType, docNo]
    );

    if (dbRes.rows.length === 0) {
      return res.status(404).json({ error: "Terms snapshot not found for this document" });
    }
    res.json(mapSnapshot(dbRes.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/terms/snapshots", async (req, res) => {
  const { documentType, documentNo, clauses } = req.body;
  if (!documentType || !documentNo || !clauses) {
    return res.status(400).json({ error: "Missing required snapshot fields" });
  }

  const clausesStr = JSON.stringify(clauses);

  try {
    const checkRes = await pool.query(
      `SELECT id FROM terms_snapshots WHERE document_type = $1 AND document_no = $2 AND is_deleted = false`,
      [documentType, documentNo]
    );

    if (checkRes.rows.length > 0) {
      const existingId = checkRes.rows[0].id;
      await pool.query(
        `UPDATE terms_snapshots 
         SET clauses_snapshot = $1, snapshot_at = CURRENT_TIMESTAMP, modified_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [clausesStr, existingId]
      );

      res.json({
        id: existingId,
        documentType,
        documentNo,
        snapshotAt: new Date().toISOString(),
        clausesSnapshot: clauses
      });
    } else {
      const id = "SNAP-" + Date.now();
      await pool.query(
        `INSERT INTO terms_snapshots (
          id, uuid, document_type, document_no, snapshot_at, clauses_snapshot, is_active, is_deleted, created_at, modified_at, version
        ) VALUES ($1, uuid_generate_v4()::varchar, $2, $3, CURRENT_TIMESTAMP, $4, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`,
        [id, documentType, documentNo, clausesStr]
      );

      res.status(201).json({
        id,
        documentType,
        documentNo,
        snapshotAt: new Date().toISOString(),
        clausesSnapshot: clauses
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve
router.post("/api/terms/resolve", async (req, res) => {
  const { companyCode, branchCode, documentType, partyId, variables } = req.body;

  try {
    const defaultsRes = await pool.query(
      `SELECT id, level, ref_id AS "refId", clause_ids AS "clauseIds", is_active AS "isActive" 
       FROM terms_defaults WHERE is_deleted = false AND is_active = true`
    );
    const defaults = defaultsRes.rows.map(mapDefault);

    const clausesRes = await pool.query(
      `SELECT id, title, category, content, status, is_active AS "isActive" 
       FROM terms_clauses WHERE is_deleted = false AND is_active = true AND status = 'Approved'`
    );
    const clauses = clausesRes.rows;

    const companyMap = defaults.find(d => d.level === "Company" && d.refId === (companyCode || "SMRITI_IND") && d.isActive);
    const branchMap = defaults.find(d => d.level === "Branch" && d.refId === branchCode && d.isActive);
    const docMap = defaults.find(d => d.level === "Document" && d.refId === documentType && d.isActive);
    const partyMap = defaults.find(d => d.level === (partyId?.startsWith("SUP") ? "Supplier" : "Customer") && d.refId === partyId && d.isActive);

    const resolvedClausesMap = new Map<string, any>();

    const applyDefaults = (mapping: any) => {
      if (!mapping || !mapping.clauseIds) return;
      mapping.clauseIds.forEach((cId: string) => {
        const clauseObj = clauses.find(c => c.id === cId);
        if (clauseObj) {
          resolvedClausesMap.set(clauseObj.category, { ...clauseObj });
        }
      });
    };

    applyDefaults(companyMap);
    applyDefaults(branchMap);
    applyDefaults(docMap);
    applyDefaults(partyMap);

    const resolvedList = Array.from(resolvedClausesMap.values()).map((clause, idx) => {
      const rawContent = clause.content;
      const resolvedContent = resolveTermsText(rawContent, variables || {});
      return {
        ...clause,
        rawContent,
        resolvedContent,
        order: idx + 1
      };
    });

    res.json({
      inheritanceTrace: {
        companyApplied: !!companyMap,
        branchApplied: !!branchMap,
        documentApplied: !!docMap,
        partyApplied: !!partyMap,
        levels: [
          { level: "Company", refId: companyCode || "SMRITI_IND", active: !!companyMap, count: companyMap?.clauseIds?.length || 0 },
          { level: "Branch", refId: branchCode, active: !!branchMap, count: branchMap?.clauseIds?.length || 0 },
          { level: "Document", refId: documentType, active: !!docMap, count: docMap?.clauseIds?.length || 0 },
          { level: "Party", refId: partyId, active: !!partyMap, count: partyMap?.clauseIds?.length || 0 }
        ]
      },
      resolvedList
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
