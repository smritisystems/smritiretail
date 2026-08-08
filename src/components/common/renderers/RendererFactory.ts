import { LookupLayoutType, LookupRendererProps, ILookupRendererComponent } from "./ILookupRenderer.js";
import { TableRenderer } from "./TableRenderer.js";
import { GalleryRenderer } from "./GalleryRenderer.js";
import { CardRenderer } from "./CardRenderer.js";
import { TreeRenderer } from "./TreeRenderer.js";

export class LookupRendererFactory {
  private static registry: Map<LookupLayoutType, ILookupRendererComponent> = new Map([
    ["table", TableRenderer],
    ["gallery", GalleryRenderer],
    ["card", CardRenderer],
    ["tree", TreeRenderer],
    ["kanban", TableRenderer],
  ]);

  public static register(layout: LookupLayoutType, component: ILookupRendererComponent): void {
    this.registry.set(layout, component);
  }

  public static getRenderer(layout: LookupLayoutType = "table"): ILookupRendererComponent {
    return this.registry.get(layout) || TableRenderer;
  }
}
