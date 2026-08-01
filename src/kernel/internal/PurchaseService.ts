/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : PurchaseService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 — Internal Domain Engine
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { IPurchaseService, PurchaseOrderRecord } from "../public/IPurchaseService.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { SPK } from "../SPK.js";

export class PurchaseService implements IPurchaseService {
  private localCache: PurchaseOrderRecord[] = [
    {
      id: "po-101",
      poNumber: "PO-2025-001",
      supplierId: "sup-101",
      supplierName: "Apex Footwear Corp",
      orderDate: "2025-05-10",
      expectedDeliveryDate: "2025-05-20",
      warehouseId: "wh-main",
      paymentTerms: "Net 30 Days",
      status: "Approved",
      totalAmount: 150000,
      totalTaxAmount: 27000,
      netPayable: 177000,
      lines: [
        {
          id: "pol-1",
          itemId: "prod-1",
          itemCode: "SHOE-001",
          itemName: "Nike Sports Shoes",
          hsnCode: "6404",
          orderedQty: 50,
          receivedQty: 50,
          unitPrice: 2000,
          taxRate: 18,
          taxAmount: 18000,
          totalAmount: 118000
        }
      ]
    }
  ];

  public async getAllPOs(): Promise<PurchaseOrderRecord[]> {
    try {
      const data = await apiFetchV1("/purchase/orders/");
      if (Array.isArray(data) && data.length > 0) {
        this.localCache = data.map((po: any) => this.normalizeBackendPO(po));
        return this.localCache;
      }
    } catch (e) {
      logger.warn("[PurchaseService] API unreachable. Serving cached purchase orders.", e as unknown);
    }
    return this.localCache;
  }

  public async getPOById(id: string): Promise<PurchaseOrderRecord | null> {
    const list = await this.getAllPOs();
    return list.find((po) => po.id === id || po.poNumber === id) || null;
  }

  public async getByPONumber(poNumber: string): Promise<PurchaseOrderRecord | null> {
    const list = await this.getAllPOs();
    const clean = poNumber.trim().toLowerCase();
    return list.find((po) => po.poNumber.toLowerCase() === clean) || null;
  }

  public async searchPOs(query: string, limit = 50): Promise<PurchaseOrderRecord[]> {
    const list = await this.getAllPOs();
    const q = query.trim().toLowerCase();

    return list
      .filter((po) => {
        if (!q) return true;
        const matchNumber = po.poNumber.toLowerCase().includes(q);
        const matchSupplier = po.supplierName.toLowerCase().includes(q);
        const matchStatus = po.status.toLowerCase().includes(q);

        return matchNumber || matchSupplier || matchStatus;
      })
      .slice(0, limit);
  }

  public async savePO(poData: Partial<PurchaseOrderRecord>): Promise<PurchaseOrderRecord> {
    const isNew = !poData.id || poData.id.startsWith("po_temp_");
    const id = poData.id || `po_${Date.now()}`;

    const record: PurchaseOrderRecord = {
      id,
      poNumber: poData.poNumber || `PO-2025-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierId: poData.supplierId || "sup-101",
      supplierName: poData.supplierName || "Apex Footwear Corp",
      orderDate: poData.orderDate || new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: poData.expectedDeliveryDate,
      warehouseId: poData.warehouseId || "wh-main",
      paymentTerms: poData.paymentTerms || "Net 30 Days",
      status: poData.status || "Approved",
      totalAmount: poData.totalAmount || 0,
      totalTaxAmount: poData.totalTaxAmount || 0,
      netPayable: poData.netPayable || 0,
      lines: poData.lines || [],
      notes: poData.notes
    };

    try {
      const endpoint = isNew ? "/purchase/orders/" : `/purchase/orders/${id}`;
      const method = isNew ? "POST" : "PUT";
      const savedResponse = await apiFetchV1(endpoint, {
        method,
        body: JSON.stringify(record)
      });

      const normalized = this.normalizeBackendPO(savedResponse || record);
      this.upsertLocalCache(normalized);
      SPK.events.emit(isNew ? "PurchaseOrderCreated" : "PurchaseOrderUpdated", normalized.id, normalized);
      return normalized;
    } catch (err) {
      logger.warn("[PurchaseService] Backend save warning, caching locally.", err as unknown);
      this.upsertLocalCache(record);
      SPK.events.emit(isNew ? "PurchaseOrderCreated" : "PurchaseOrderUpdated", record.id, record);
      return record;
    }
  }

  public async postGRN(poId: string, receivedLines: { itemId: string; receivedQty: number }[]): Promise<PurchaseOrderRecord> {
    const po = await this.getPOById(poId);
    if (!po) {
      throw new Error(`[PurchaseService Error] Purchase Order ${poId} not found.`);
    }

    po.lines = po.lines.map((l) => {
      const match = receivedLines.find((r) => r.itemId === l.itemId || r.itemId === l.itemCode);
      if (match) {
        l.receivedQty += match.receivedQty;
      }
      return l;
    });

    const allReceived = po.lines.every((l) => l.receivedQty >= l.orderedQty);
    po.status = allReceived ? "Received" : "Partial";

    const updated = await this.savePO(po);
    SPK.events.emit("GRNPosted", poId, { poId, receivedLines, status: updated.status });
    return updated;
  }

  private upsertLocalCache(po: PurchaseOrderRecord): void {
    const idx = this.localCache.findIndex((p) => p.id === po.id);
    if (idx >= 0) {
      this.localCache[idx] = po;
    } else {
      this.localCache.unshift(po);
    }
  }

  private normalizeBackendPO(po: any): PurchaseOrderRecord {
    return {
      id: po.id,
      poNumber: po.po_number || po.poNumber || `PO-${po.id}`,
      supplierId: po.supplier_id || po.supplierId || "",
      supplierName: po.supplier_name || po.supplierName || "Supplier",
      orderDate: po.order_date || po.orderDate || new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: po.expected_delivery_date || po.expectedDeliveryDate,
      warehouseId: po.warehouse_id || po.warehouseId || "wh-main",
      paymentTerms: po.payment_terms || po.paymentTerms || "Net 30 Days",
      status: po.status || "Approved",
      totalAmount: po.total_amount !== undefined ? parseFloat(po.total_amount) : (po.totalAmount || 0),
      totalTaxAmount: po.total_tax_amount !== undefined ? parseFloat(po.total_tax_amount) : (po.totalTaxAmount || 0),
      netPayable: po.net_payable !== undefined ? parseFloat(po.net_payable) : (po.netPayable || 0),
      lines: Array.isArray(po.lines) ? po.lines : [],
      notes: po.notes || ""
    };
  }
}
