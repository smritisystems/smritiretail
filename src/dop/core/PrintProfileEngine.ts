/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintProfileEngine (Named Print Profiles)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.1.0
 */

export interface PrintProfile {
  id: string;
  name: string;
  copies: number;
  openCutter: boolean;
  openDrawer: boolean;
  densityLevel: number; // 1 - 10
  barcodeHeightMm: number;
  encoding: string;
  topMarginMm: number;
  bottomMarginMm: number;
}

class PrintProfileEngineService {
  private profiles: Map<string, PrintProfile> = new Map();

  constructor() {
    this.seedDefaultProfiles();
  }

  private seedDefaultProfiles() {
    this.register({
      id: "thermal_receipt_standard",
      name: "Standard POS Thermal Receipt",
      copies: 1,
      openCutter: true,
      openDrawer: true,
      densityLevel: 8,
      barcodeHeightMm: 12,
      encoding: "UTF-8",
      topMarginMm: 0,
      bottomMarginMm: 5,
    });

    this.register({
      id: "barcode_label_heavy",
      name: "High Density Barcode Label",
      copies: 2,
      openCutter: false,
      openDrawer: false,
      densityLevel: 10,
      barcodeHeightMm: 25,
      encoding: "ZPL-II",
      topMarginMm: 2,
      bottomMarginMm: 2,
    });

    this.register({
      id: "a4_invoice_standard",
      name: "Standard A4 GST Tax Invoice",
      copies: 2,
      openCutter: false,
      openDrawer: false,
      densityLevel: 5,
      barcodeHeightMm: 15,
      encoding: "UTF-8",
      topMarginMm: 10,
      bottomMarginMm: 10,
    });
  }

  public register(profile: PrintProfile): void {
    this.profiles.set(profile.id, profile);
  }

  public get(id: string): PrintProfile | undefined {
    return this.profiles.get(id);
  }

  public list(): PrintProfile[] {
    return Array.from(this.profiles.values());
  }
}

export const PrintProfileEngine = new PrintProfileEngineService();
