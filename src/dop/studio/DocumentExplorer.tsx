/**
 * Project      : SMRITI Retail OS
 * Component    : DocumentExplorer (DXP-DOC-001 Standard)
 * Description  : Decoupled document explorer supporting search, categories, favorites,
 *                recents, and industry templates.
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState } from "react";
import { SmritiScrollArea } from "../../components/SmritiScrollArea.tsx";
import { Printer, Search, FileText, Tag, FileSpreadsheet, Layers, ShoppingBag, Truck, CreditCard, RotateCcw, Award, Mail, Star, Clock, Sparkles } from "lucide-react";
import { DocumentRegistry, RegisteredDocumentDescriptor } from "../core/DocumentRegistry.ts";
import { DxpDocumentType } from "../models/DxpTypes.ts";

interface DocumentExplorerProps {
  selectedType: DxpDocumentType;
  onSelectType: (docType: DxpDocumentType) => void;
  onLaunchLabelDesigner: () => void;
  isLabelDesignerActive: boolean;
}

const CATEGORIES = [
  { id: "ALL", label: "All Documents" },
  { id: "FINANCIAL", label: "Financial & Billing" },
  { id: "PROCUREMENT", label: "Procurement" },
  { id: "INVENTORY", label: "Barcode & Labels" },
  { id: "LOGISTICS", label: "Logistics" },
  { id: "COMPLIANCE", label: "Compliance" },
] as const;

export const DocumentExplorer: React.FC<DocumentExplorerProps> = ({
  selectedType,
  onSelectType,
  onLaunchLabelDesigner,
  isLabelDesignerActive,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [favorites, setFavorites] = useState<Set<DxpDocumentType>>(new Set(["INVOICE", "RECEIPT", "BARCODE_LABEL"]));

  const toggleFavorite = (e: React.MouseEvent, docType: DxpDocumentType) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(docType)) next.delete(docType);
      else next.add(docType);
      return next;
    });
  };

  const allDescriptors = DocumentRegistry.search(searchQuery).filter(
    (d) => selectedCategory === "ALL" || d.category === selectedCategory
  );

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case "FileText": return <FileText size={16} />;
      case "FileSpreadsheet": return <FileSpreadsheet size={16} />;
      case "Tag": return <Tag size={16} />;
      case "Layers": return <Layers size={16} />;
      case "ShoppingBag": return <ShoppingBag size={16} />;
      case "Truck": return <Truck size={16} />;
      case "CreditCard": return <CreditCard size={16} />;
      case "RotateCcw": return <RotateCcw size={16} />;
      case "Award": return <Award size={16} />;
      case "Mail": return <Mail size={16} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <div className="w-72 border-r border-theme-divider bg-theme-surface-1 flex flex-col z-10 font-sans">
      <div className="p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
            <Printer size={18} />
          </div>
          <div>
            <h2 className="font-bold font-display text-theme-primary text-sm">Document Explorer</h2>
            <p className="text-[10px] text-theme-muted uppercase tracking-wider font-mono">DXP-DOC-001 Registry</p>
          </div>
        </div>
        <Sparkles size={16} className="text-amber-400" />
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-theme-divider space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-theme-muted" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates & categories..."
            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === c.id
                  ? "bg-blue-500 text-white"
                  : "bg-theme-surface-3 text-theme-muted hover:text-theme-primary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <SmritiScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {allDescriptors.map((desc) => {
            const isSelected = selectedType === desc.documentType && !isLabelDesignerActive;
            const isFav = favorites.has(desc.documentType);
            return (
              <button
                key={desc.documentType}
                onClick={() => onSelectType(desc.documentType)}
                className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer group ${
                  isSelected
                    ? "bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20"
                    : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary"
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <div className={isSelected ? "text-blue-400" : "text-theme-muted"}>{getIcon(desc.iconName)}</div>
                  <div className="truncate">
                    <div className="text-xs font-medium truncate">{desc.title}</div>
                    <div className="text-[10px] text-theme-muted font-mono uppercase">{desc.category}</div>
                  </div>
                </div>
                <div
                  onClick={(e) => toggleFavorite(e, desc.documentType)}
                  className="p-1 rounded hover:bg-theme-surface-3 transition-colors text-theme-muted hover:text-amber-400"
                >
                  <Star size={13} className={isFav ? "fill-amber-400 text-amber-400" : ""} />
                </div>
              </button>
            );
          })}

          <div className="pt-2 border-t border-theme-divider mt-2">
            <button
              onClick={onLaunchLabelDesigner}
              className={`w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-colors cursor-pointer ${
                isLabelDesignerActive
                  ? "bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20"
                  : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary"
              }`}
            >
              <Tag size={16} className="text-blue-400" />
              <div className="truncate">
                <div className="text-xs font-semibold text-blue-400 truncate">Universal Label Designer</div>
                <div className="text-[10px] text-theme-muted font-mono">Barcode, Sticker & Tag Studio</div>
              </div>
            </button>
          </div>
        </div>
      </SmritiScrollArea>
    </div>
  );
};
