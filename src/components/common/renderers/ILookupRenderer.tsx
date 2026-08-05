import React from "react";
import { LookupLayoutType, LookupRendererProps } from "./ILookupRenderer.js";
import { LookupRendererFactory } from "./RendererFactory.js";

export * from "./ILookupRenderer.js";
export * from "./TableRenderer.js";
export * from "./GalleryRenderer.js";
export * from "./CardRenderer.js";
export * from "./TreeRenderer.js";
export * from "./RendererFactory.js";

export const UniversalLookupRenderer: React.FC<LookupRendererProps & { layout?: LookupLayoutType }> = ({
  layout = "table",
  ...props
}) => {
  const Component = LookupRendererFactory.getRenderer(layout);
  return <Component {...props} />;
};
