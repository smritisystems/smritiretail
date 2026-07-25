/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Label Template Library Registry Service)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

export interface LabelTemplateEntry {
  id: string;
  name: string;
  category: "Apparel" | "Footwear" | "Jewellery" | "Pharma" | "Retail" | "Logistics" | "Assets";
  format: "ZPL" | "TSPL" | "EPL" | "CPCL" | "PRN" | "PDF";
  dimensionsMm: { width: number; height: number };
  dpiSupported: number[];
  version: string;
  description: string;
  templateScript: string;
  isDefault?: boolean;
}

export const MASTER_LABEL_TEMPLATES: LabelTemplateEntry[] = [
  {
    id: "tmpl-tattly-threads",
    name: "Tattly Threads Multi-Track Garment & Footwear Tag (50.7mm Pitch)",
    category: "Apparel",
    format: "ZPL",
    dimensionsMm: { width: 50.7, height: 50 },
    dpiSupported: [203, 300, 600],
    version: "v3.37.0",
    description: "Multi-track garment and footwear tag featuring dual barcode, size matrix, and company branding",
    templateScript: `<xpml><page quantity='0' pitch='50.7 mm'></xpml>^XA
^SZ2^JMA
^MCY^PMN
^PW804
^JZY
^LH0,0^LRN
^XZ
<xpml></page></xpml><xpml><page quantity='1' pitch='50.7 mm'></xpml>^XA
^FO346,305
^BY2^BCN,66,N,N^FD{barcode}^FS
^FT390,385
^CI0
^AAN,27,15^FD{barcode}^FS
^FT772,357
^A0B,34,46^FDTATTLY THREADS^FS
^FT355,271
^ADN,18,10^FD81,Umerkhadi,Mumbai,400003^FS
^FT355,289
^ADN,18,10^FDcare@tattlythreads.com^FS
^FO627,62
^GB70,67,67^FS
^FT627,116
^A0N,65,72^FR^FD{size}^FS
^FT405,111
^A0N,37,49^FD{color}^FS
^FO416,15
^GB284,47,47^FS
^FT416,54
^A0N,45,44^FR^FD{style}     ^FS
^FO332,13
^GB367,117,3^FS
^FO334,57
^GB337,0,3^FS
^FT490,199
^A0N,17,23^FD |(Incl of all taxes)^FS
^FT488,175
^A0N,42,56^FD{mrp}/-^FS
^FT408,170
^A0N,28,38^FDMRP:^FS
^FT355,199
^A0N,17,23^FDMFG.Dt.:{pkd_date}^FS
^FT355,215
^ABN,11,7^FDNET CONTENTS:1 Pair Footwear^FS
^FT340,41
^A0N,17,23^FDArt.No.^FS
^FT340,103
^A0N,17,23^FDColor:^FS
^FO34,112
^BY1^BCN,30,N,N^FD{barcode}^FS
^FT26,165
^A0N,25,34^FD{barcode}^FS
^FO37,47
^GB70,67,67^FS
^FT37,101
^A0N,65,72^FR^FD{size}^FS
^FT116,63
^A0N,28,38^FD{color}^FS
^FT37,34
^A0N,28,27^FD{style}^FS
^FT17,146
^ABB,11,7^FDTATTLY THREADS^FS
^FT116,84
^A0N,20,27^FDMRP:{mrp}/-^FS
^FT116,101
^A0N,17,23^FD(Incl of all taxes)^FS
^FO33,338
^BY1^BCN,30,N,N^FD{barcode}^FS
^FT26,394
^A0N,25,34^FD{barcode}^FS
^FO33,274
^GB70,67,67^FS
^FT33,328
^A0N,65,72^FR^FD{size}^FS
^FT116,289
^A0N,28,38^FD{color}^FS
^FT33,260
^A0N,28,27^FD{style}^FS
^FT16,372
^ABB,11,7^FDTATTLY THREADS^FS
^FT116,310
^A0N,20,27^FDMRP:{mrp}/-^FS
^FT116,327
^A0N,17,23^FD(Incl of all taxes)^FS
^FO731,0
^GB0,405,3^FS
^FO324,236
^GB407,0,3^FS
^FT355,261
^A0N,20,27^FDMKTD.By:Tattly Threads^FS
^PQ{COPIES},0,1,Y
^XZ
<xpml></page></xpml><xpml><end/></xpml>`,
    isDefault: true
  },
  {
    id: "tmpl-garment-lg",
    name: "Garment Premium Tag Large (50x70mm)",
    category: "Apparel",
    format: "ZPL",
    dimensionsMm: { width: 50, height: 70 },
    dpiSupported: [203, 300, 600],
    version: "v2.4",
    description: "Large 2-fold garment tag with fabric composition and care instructions",
    templateScript: "^XA^PR4,4^MD18^FO50,30^A0N,28,28^FD{BRAND} LUXURY^FS^FO50,70^A0N,24,24^FD{ITEM_NAME}^FS^FO50,100^A0N,20,20^FDSTYLE: {STYLE} | SHADE: {SHADE}^FS^FO50,130^BCN,70,Y,N,N^FD{BARCODE}^FS^FO50,230^A0N,24,24^FDMRP: RS.{MRP}^FS^FO220,225^A0N,36,36^FDSALE: RS.{PRICE}^FS^PQ{COPIES}^XZ"
  },
  {
    id: "tmpl-shoe-box",
    name: "Footwear Shoe Box Label (100x50mm)",
    category: "Footwear",
    format: "TSPL",
    dimensionsMm: { width: 100, height: 50 },
    dpiSupported: [203, 300],
    version: "v1.8",
    description: "Wide shoe box end label with EURO/UK size matrix",
    templateScript: "SIZE 100 mm, 50 mm\nGAP 3 mm, 0 mm\nCLS\nTEXT 40,30,\"3.fmt\",0,1,1,\"{BRAND} FOOTWEAR\"\nBARCODE 40,80,\"128\",70,1,0,2,2,\"{BARCODE}\"\nTEXT 40,170,\"3.fmt\",0,1,1,\"SIZE: {SIZE} | COLOR: {COLOR}\"\nPRINT {COPIES}"
  },
  {
    id: "tmpl-jewellery",
    name: "Jewellery Dumbbell Tail Tag (30x10mm)",
    category: "Jewellery",
    format: "ZPL",
    dimensionsMm: { width: 30, height: 10 },
    dpiSupported: [300, 600],
    version: "v3.0",
    description: "Ultra-compact micro tail tag for gold & diamond jewellery rings",
    templateScript: "^XA^MD25^FO10,10^A0N,14,14^FDGW:{NET_WT}g^FS^FO10,30^BY1^BCN,25,N,N,N^FD{BARCODE}^FS^PQ{COPIES}^XZ"
  },
  {
    id: "tmpl-shelf-talker",
    name: "Retail Shelf Edge Talker (70x35mm)",
    category: "Retail",
    format: "TSPL",
    dimensionsMm: { width: 70, height: 35 },
    dpiSupported: [203, 300],
    version: "v2.0",
    description: "High visibility shelf edge price sticker with savings callout",
    templateScript: "SIZE 70 mm, 35 mm\nGAP 3 mm, 0 mm\nCLS\nTEXT 30,20,\"3.fmt\",0,1,1,\"{ITEM_NAME}\"\nTEXT 30,60,\"4.fmt\",0,1,1,\"RS. {PRICE}\"\nBARCODE 30,110,\"128\",50,1,0,2,2,\"{BARCODE}\"\nPRINT {COPIES}"
  },
  {
    id: "tmpl-asset-qr",
    name: "Enterprise Asset QR Tag (50x25mm)",
    category: "Assets",
    format: "ZPL",
    dimensionsMm: { width: 50, height: 25 },
    dpiSupported: [203, 300, 600],
    version: "v1.5",
    description: "Square 2D QR Code asset tag for IT equipment and fixed assets",
    templateScript: "^XA^FO30,20^BQN,2,4^FDMM,A{BARCODE}^FS^FO160,30^A0N,22,22^FDASSET ID: {STOCK_NO}^FS^FO160,60^A0N,18,18^FD{ITEM_NAME}^FS^PQ{COPIES}^XZ"
  }
];

export const getTemplateRegistry = (): LabelTemplateEntry[] => {
  return MASTER_LABEL_TEMPLATES;
};
