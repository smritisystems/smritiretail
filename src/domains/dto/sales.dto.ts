/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Sales Domain Data Transfer Objects (DTOs)
 * Standard     : SMAP Constitution v1.0 & Wave 1 Sales Standard
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface SalesOrderRequestDTO {
  orderId: string;
  customerName: string;
  totalAmount: number;
}

export interface SalesOrderResponseDTO {
  orderId: string;
  previousState: string;
  newState: string;
  success: boolean;
  message: string;
}
