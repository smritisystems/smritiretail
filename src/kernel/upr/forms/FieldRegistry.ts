/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Field Registry (UFR-003)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UFR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { FormFieldDefinition } from "./FormRegistry.js";
import {
  DefaultTextInputControl,
  DefaultNumberInputControl,
  DefaultSelectControl,
  DefaultCheckboxControl,
  DefaultTextareaControl,
  FieldControlProps
} from "../../../components/fields/DefaultFieldControls.tsx";

export type { FieldControlProps };
export type FieldControlComponent = React.ComponentType<FieldControlProps>;

export interface FieldManifest {
  id: string;
  label: string;
  component: FieldControlComponent;
  searchable?: boolean;
  supportedValidators?: string[];
}

export class FieldRegistryService {
  private fieldControls: Map<string, FieldControlComponent> = new Map();
  private manifests: Map<string, Readonly<FieldManifest>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultFieldControls();
  }

  private seedDefaultFieldControls() {
    this.registerFieldControl("text", DefaultTextInputControl);
    this.registerFieldControl("number", DefaultNumberInputControl);
    this.registerFieldControl("currency", DefaultNumberInputControl);
    this.registerFieldControl("percentage", DefaultNumberInputControl);
    this.registerFieldControl("select", DefaultSelectControl);
    this.registerFieldControl("enum", DefaultSelectControl);
    this.registerFieldControl("checkbox", DefaultCheckboxControl);
    this.registerFieldControl("switch", DefaultCheckboxControl);
    this.registerFieldControl("barcode", DefaultTextInputControl);
    this.registerFieldControl("textarea", DefaultTextareaControl);
  }

  public registerFieldControl(type: string, component: FieldControlComponent): void {
    const id = type.toLowerCase();
    this.fieldControls.set(id, component);
    this.manifests.set(id, Object.freeze({ id, label: type, component }));
    this.emitChange();
  }

  public registerFieldType(manifest: FieldManifest): void {
    const id = manifest.id.toLowerCase();
    const payload = Object.freeze({ ...manifest, id });
    this.fieldControls.set(id, manifest.component);
    this.manifests.set(id, payload);
    this.emitChange();
  }

  public getFieldControl(type: string): FieldControlComponent {
    const found = this.fieldControls.get(type.toLowerCase());
    return found || DefaultTextInputControl;
  }

  public getManifest(type: string): Readonly<FieldManifest> | undefined {
    return this.manifests.get(type.toLowerCase());
  }

  public getRegisteredTypes(): string[] {
    return Array.from(this.fieldControls.keys());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.fieldControls.clear();
    this.manifests.clear();
    this.seedDefaultFieldControls();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const FieldRegistry = new FieldRegistryService();
