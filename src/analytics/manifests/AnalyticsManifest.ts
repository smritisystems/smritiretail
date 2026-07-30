/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUPAE AnalyticsManifest (Versioned Manifest Schema v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

export interface AnalyticsManifestV1 {
  version: "1.0";
  entity: string;
  dataset: string;
  dimensions: string[];
  measures: string[];
  kpis: {
    id: string;
    name: string;
    target: number;
    thresholds: { warning: number; danger: number };
  }[];
  drillPaths: {
    measure: string;
    path: string[];
  }[];
  dashboards?: string[];
}
