import React from "react";
import { NormalizedLookupItem } from "../../../kernel/SPK.js";

export interface LookupRendererProps {
  items: NormalizedLookupItem[];
  columns?: Array<{ key: string; label: string; type: string; width?: string }>;
  selectedIndex?: number;
  onSelect: (item: NormalizedLookupItem) => void;
}

export type LookupLayoutType = "table" | "gallery" | "card" | "tree" | "kanban";

export type ILookupRendererComponent = React.ComponentType<LookupRendererProps>;
