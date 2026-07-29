/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Spreadsheet Platform (SSP)
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : © SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * Enterprise History Engine providing multi-step Undo (Ctrl+Z) and Redo (Ctrl+Y) stacks for SSP grid state.
 */
export class HistoryEngine<T = Record<string, any>[]> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];
  private maxDepth: number;

  constructor(maxDepth: number = 50) {
    this.maxDepth = maxDepth;
  }

  public pushState(state: T): void {
    this.undoStack.push(JSON.parse(JSON.stringify(state)));
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(currentState: T): T | null {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push(JSON.parse(JSON.stringify(currentState)));
    const previousState = this.undoStack.pop()!;
    return previousState;
  }

  public redo(currentState: T): T | null {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push(JSON.parse(JSON.stringify(currentState)));
    const nextState = this.redoStack.pop()!;
    return nextState;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
