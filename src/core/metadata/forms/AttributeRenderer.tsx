/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Metadata Platform (SMP-M)
 * Component    : AttributeRenderer (Universal Form & Grid Field Renderer - UFE/UGE)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React from "react";
import { AttributeDefinition } from "../attributes/AttributeDefinition.js";

interface AttributeRendererProps {
  definition: AttributeDefinition;
  value: any;
  onChange?: (val: any) => void;
  readOnly?: boolean;
}

export const AttributeRenderer: React.FC<AttributeRendererProps> = ({
  definition,
  value,
  onChange,
  readOnly = false,
}) => {
  if (!definition.behavior.visible) return null;

  const isMandatory = definition.behavior.mandatory;
  const isEditable = definition.behavior.editable && !readOnly;

  switch (definition.controlType) {
    case "dropdown":
    case "combobox":
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase block">
            {definition.displayLabel} {isMandatory && <span className="text-rose-500">*</span>}
          </label>
          <select
            value={value || ""}
            disabled={!isEditable}
            onChange={(e) => onChange && onChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
          >
            <option value="">Select {definition.displayLabel}</option>
            {definition.options?.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "colorpicker":
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase block">
            {definition.displayLabel} {isMandatory && <span className="text-rose-500">*</span>}
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={value || "#000000"}
              disabled={!isEditable}
              onChange={(e) => onChange && onChange(e.target.value)}
              className="h-8 w-10 border border-slate-300 rounded cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={value || ""}
              disabled={!isEditable}
              onChange={(e) => onChange && onChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
              placeholder="#HEX or Color Name"
            />
          </div>
        </div>
      );

    case "datepicker":
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase block">
            {definition.displayLabel} {isMandatory && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="date"
            value={value || ""}
            disabled={!isEditable}
            onChange={(e) => onChange && onChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
      );

    case "textbox":
    default:
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase block">
            {definition.displayLabel} {isMandatory && <span className="text-rose-500">*</span>}
          </label>
          <input
            type={definition.dataType === "number" || definition.dataType === "decimal" ? "number" : "text"}
            value={value || ""}
            disabled={!isEditable}
            onChange={(e) => onChange && onChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            placeholder={`Enter ${definition.displayLabel}`}
          />
        </div>
      );
  }
};
