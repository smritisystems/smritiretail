/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : UndoRedoEngine (SPF v1.0 Universal Undo/Redo Stack)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 1.0.0
 */

export interface UndoRedoCommand<T = any> {
  id: string;
  description: string;
  execute: () => void | Promise<void>;
  undo: () => void | Promise<void>;
}

export class UndoRedoEngine {
  private static undoStack: UndoRedoCommand[] = [];
  private static redoStack: UndoRedoCommand[] = [];
  private static maxStackSize = 50;

  public static pushCommand(cmd: UndoRedoCommand): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public static canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public static canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public static async undo(): Promise<void> {
    if (!this.canUndo()) return;
    const cmd = this.undoStack.pop()!;
    await cmd.undo();
    this.redoStack.push(cmd);
  }

  public static async redo(): Promise<void> {
    if (!this.canRedo()) return;
    const cmd = this.redoStack.pop()!;
    await cmd.execute();
    this.undoStack.push(cmd);
  }

  public static clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
