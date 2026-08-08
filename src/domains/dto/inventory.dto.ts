/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Inventory Domain Data Transfer Objects (DTOs)
 * Standard     : SMAP Constitution v1.0 & Wave 1 Inventory Standard
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface StockAdjustmentRequestDTO {
  sku: string;
  qtyChange: number;
  reason: string;
}

export interface StockAdjustmentResponseDTO {
  sku: string;
  previousQty: number;
  newQty: number;
  success: boolean;
  message: string;
}
