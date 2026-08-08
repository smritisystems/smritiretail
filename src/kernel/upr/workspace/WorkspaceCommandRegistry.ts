/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Standard     : SCS-WCM-001 (Workspace Command Model Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 */

export type WorkspaceCommandScope = "none" | "single" | "multi" | "any";

export interface WorkspaceCommand {
  id: string;
  workspaceId: string;
  title: string;
  iconName?: string;
  scope?: WorkspaceCommandScope; // When to display command in context-aware ribbon
  order?: number;
  shortcut?: string;
  category?: string;
  action: (context?: any) => void | Promise<void>;
}

class WorkspaceCommandRegistryImpl {
  private commands: Map<string, WorkspaceCommand> = new Map();

  register(command: WorkspaceCommand): void {
    this.commands.set(command.id, command);
  }

  execute(commandId: string, context?: any): void {
    const cmd = this.commands.get(commandId);
    if (cmd) {
      cmd.action(context);
    } else {
      console.warn(`[WorkspaceCommand] Command not registered: ${commandId}`);
    }
  }

  getForWorkspace(workspaceId: string, selectedCount: number = 0): WorkspaceCommand[] {
    const all = Array.from(this.commands.values()).filter((cmd) => cmd.workspaceId === workspaceId);
    
    return all.filter((cmd) => {
      const scope = cmd.scope || "any";
      if (scope === "any") return true;
      if (scope === "none" && selectedCount === 0) return true;
      if (scope === "single" && selectedCount === 1) return true;
      if (scope === "multi" && selectedCount > 1) return true;
      return false;
    }).sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  }
}

export const WorkspaceCommandRegistry = new WorkspaceCommandRegistryImpl();
export const WorkspaceCommand = {
  execute: (id: string, context?: any) => WorkspaceCommandRegistry.execute(id, context),
};
