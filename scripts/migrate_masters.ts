/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import fs from "fs";
import path from "path";
import { pool } from "../src/db/pool.js";
import { MasterRepository } from "../src/repositories/masterRepository.js";

async function run() {
  console.log("Starting master migration...");
  
  const repo = new MasterRepository();
  
  const targetSchema = {
    type: "object",
    properties: {
      legacy_id: { type: "string" },
      legacy_status: { type: "string" },
      legacy_created_at: { type: "string" }
    },
    additionalProperties: false
  };

  // 1. Create or update master types
  const existingDeptType = await repo.getMasterType("department");
  if (!existingDeptType) {
    console.log("Creating 'department' master type...");
    await repo.createMasterType({
      code: "department",
      label: "Department",
      field_schema: targetSchema
    });
  } else {
    console.log("Updating 'department' master type field_schema...");
    await pool.query("UPDATE master_types SET field_schema = $1 WHERE code = $2", [JSON.stringify(targetSchema), "department"]);
  }
  
  const existingDesigType = await repo.getMasterType("designation");
  if (!existingDesigType) {
    console.log("Creating 'designation' master type...");
    await repo.createMasterType({
      code: "designation",
      label: "Designation",
      field_schema: targetSchema
    });
  } else {
    console.log("Updating 'designation' master type field_schema...");
    await pool.query("UPDATE master_types SET field_schema = $1 WHERE code = $2", [JSON.stringify(targetSchema), "designation"]);
  }

  // 2. Read db_store.json
  const storePath = path.resolve("db_store.json");
  const storeData = JSON.parse(fs.readFileSync(storePath, "utf-8"));
  
  const departments = storeData.departments || [];
  const designations = storeData.designations || [];
  
  console.log(`Loaded ${departments.length} departments and ${designations.length} designations from db_store.json.`);

  // 3. Migrate departments
  for (const dept of departments) {
    const derivedCode = dept.code || dept.name.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 4);
    const legacyData = {
      legacy_id: dept.id || "",
      legacy_status: dept.status || "",
      legacy_created_at: dept.created_at || ""
    };
    const isActive = dept.status === "Active";
    
    // Check if value already exists
    const query = `
      SELECT mv.id FROM master_values mv
      JOIN master_types mt ON mv.master_type_id = mt.id
      WHERE mt.code = 'department' AND mv.code = $1
    `;
    const checkRes = await pool.query(query, [derivedCode]);
    if (checkRes.rows.length === 0) {
      console.log(`Inserting department: ${dept.name} (${derivedCode})`);
      await repo.create("department", {
        code: derivedCode,
        name: dept.name,
        active: isActive,
        data: legacyData
      });
    } else {
      const existingId = checkRes.rows[0].id;
      console.log(`Updating department: ${dept.name} (${derivedCode}) with legacy data`);
      await repo.update("department", existingId, {
        code: derivedCode,
        name: dept.name,
        active: isActive,
        data: legacyData
      });
    }
  }

  // 4. Migrate designations
  for (const desig of designations) {
    const derivedCode = desig.code || desig.name.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 4);
    const legacyData = {
      legacy_id: desig.id || "",
      legacy_status: desig.status || "",
      legacy_created_at: desig.created_at || ""
    };
    const isActive = desig.status === "Active";
    
    const query = `
      SELECT mv.id FROM master_values mv
      JOIN master_types mt ON mv.master_type_id = mt.id
      WHERE mt.code = 'designation' AND mv.code = $1
    `;
    const checkRes = await pool.query(query, [derivedCode]);
    if (checkRes.rows.length === 0) {
      console.log(`Inserting designation: ${desig.name} (${derivedCode})`);
      await repo.create("designation", {
        code: derivedCode,
        name: desig.name,
        active: isActive,
        data: legacyData
      });
    } else {
      const existingId = checkRes.rows[0].id;
      console.log(`Updating designation: ${desig.name} (${derivedCode}) with legacy data`);
      await repo.update("designation", existingId, {
        code: derivedCode,
        name: desig.name,
        active: isActive,
        data: legacyData
      });
    }
  }

  console.log("Master migration completed successfully.");
  await pool.end();
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
