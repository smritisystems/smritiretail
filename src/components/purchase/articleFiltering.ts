/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.77.0
 * Created      : 2026-10-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal / Purchase Order & Item Grid Auto-Filtering Engine
 * Capability    : @SmritiCapability("PURCHASE", "ARTICLE_FILTERING")
 */

import type { Product } from "../../types.ts";

export interface ArticleVariantItem {
  id: string;
  code: string;
  barcode: string;
  name: string;
  article: string;
  color: string;
  size: string;
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  brand?: string;
  category?: string;
  hsnCode?: string;
  gstPercentage?: number;
  unit?: string;
  imageUrl?: string;
  originalProduct: Product;
}

export interface ArticleGroupDetails {
  article: string;
  brand?: string;
  name?: string;
  category?: string;
  hsnCode?: string;
  gstPercentage?: number;
  costPrice?: number;
  mrp?: number;
  unit?: string;
  imageUrl?: string;
  availableColors: string[];
  colorVariantMap: Record<
    string,
    {
      availableSizes: string[];
      variantsBySize: Record<string, ArticleVariantItem>;
    }
  >;
}

export interface ArticleCatalogIndex {
  articles: string[];
  articleMap: Map<string, ArticleGroupDetails>;
  barcodeMap: Map<string, ArticleVariantItem>;
  skuMap: Map<string, ArticleVariantItem>;
}

/**
 * Normalizes an article string for robust case-insensitive comparisons.
 */
export function normalizeKey(val?: string | null): string {
  return (val || "").trim().toUpperCase();
}

/**
 * Extracts normalized Article, Color, and Size from a Product entity.
 */
export function extractProductDimensions(p: Product): {
  article: string;
  color: string;
  size: string;
} {
  // 1. Article / Style extraction
  let article = (
    (p as any).styleCode ||
    (p as any).style_code ||
    (p as any).style ||
    (p as any).articleNo ||
    (p as any).article ||
    ""
  ).trim();

  // 2. Color extraction
  let color = ((p as any).color || (p as any).shade || "").trim();

  // 3. Size extraction
  let size = ((p as any).size || "").trim();

  const code = (p.code || "").trim();
  const name = (p.name || "").trim();

  // If article not found in explicit attributes, attempt SKU regex parsing (e.g., CH-13-C-BLACK-38)
  if (!article && code) {
    const parts = code.split("-");
    if (parts.length >= 3) {
      const last = parts[parts.length - 1];
      const secondLast = parts[parts.length - 2];
      if (/^(\d{1,3}|[X|S|M|L]+)$/i.test(last)) {
        if (!size) size = last;
        if (!color) color = secondLast;
        article = parts.slice(0, parts.length - 2).join("-");
      }
    } else if (parts.length === 2 && !size && /^(\d{1,3}|[X|S|M|L]+)$/i.test(parts[1])) {
      size = parts[1];
      article = parts[0];
    } else {
      article = parts[0];
    }
  }

  // If color not found, inspect name (e.g., "TATLD ETHNIC CHAPPAL, BRONZE, 38")
  if (!color && name.includes(",")) {
    const segments = name.split(",").map((s) => s.trim());
    if (segments.length >= 2) {
      color = segments[1];
      if (segments.length >= 3 && !size) {
        size = segments[2];
      }
    }
  }

  // If size not found, check trailing token in name
  if (!size && name) {
    const sizeMatch = name.match(/\b(\d{1,2}|XXL|XL|L|M|S|XS)\b$/i);
    if (sizeMatch) {
      size = sizeMatch[1];
    }
  }

  if (!article) {
    article = code || (name ? name.split(",")[0].trim() : "ITEM");
  }

  return {
    article: article.trim(),
    color: color.trim().toUpperCase() || "STANDARD",
    size: size.trim().toUpperCase(),
  };
}

/**
 * Builds a high-speed indexed Catalog for article-based filtering.
 */
export function buildArticleCatalogIndex(products: Product[]): ArticleCatalogIndex {
  const articleMap = new Map<string, ArticleGroupDetails>();
  const barcodeMap = new Map<string, ArticleVariantItem>();
  const skuMap = new Map<string, ArticleVariantItem>();
  const articleSet = new Set<string>();

  if (!products || products.length === 0) {
    return {
      articles: [],
      articleMap,
      barcodeMap,
      skuMap,
    };
  }

  for (const p of products) {
    if (!p) continue;
    const { article, color, size } = extractProductDimensions(p);
    if (!article) continue;

    const artKey = normalizeKey(article);
    const colKey = normalizeKey(color);
    const szKey = normalizeKey(size);

    articleSet.add(article);

    const costPrice =
      (p as any).costPrice !== undefined
        ? Number((p as any).costPrice)
        : (p as any).cost_price !== undefined
        ? Number((p as any).cost_price)
        : Number(p.price || 0);

    const mrp =
      (p as any).mrp !== undefined
        ? Number((p as any).mrp)
        : (p as any).price !== undefined
        ? Number((p as any).price)
        : costPrice * 1.3;

    const sellingPrice = Number(p.price || mrp);

    const variantItem: ArticleVariantItem = {
      id: p.id,
      code: p.code || "",
      barcode: p.barcode || p.code || "",
      name: p.name || `${article} - ${color} ${size}`.trim(),
      article,
      color,
      size,
      costPrice,
      mrp,
      sellingPrice,
      brand: p.brand || undefined,
      category: p.category || undefined,
      hsnCode: (p as any).hsnCode || (p as any).hsn_code || undefined,
      gstPercentage:
        (p as any).gstPercentage !== undefined
          ? Number((p as any).gstPercentage)
          : (p as any).gst_percentage !== undefined
          ? Number((p as any).gst_percentage)
          : undefined,
      unit: (p as any).unit || "Pair",
      imageUrl: (p as any).primaryImageUrl || (p as any).primary_image_url || undefined,
      originalProduct: p,
    };

    // Index by barcode and SKU
    if (variantItem.barcode) {
      barcodeMap.set(normalizeKey(variantItem.barcode), variantItem);
    }
    if (variantItem.code) {
      skuMap.set(normalizeKey(variantItem.code), variantItem);
    }

    // Index by article
    let artDetails = articleMap.get(artKey);
    if (!artDetails) {
      artDetails = {
        article,
        brand: variantItem.brand,
        name: variantItem.name.split(",")[0].trim(),
        category: variantItem.category,
        hsnCode: variantItem.hsnCode,
        gstPercentage: variantItem.gstPercentage,
        costPrice: variantItem.costPrice,
        mrp: variantItem.mrp,
        unit: variantItem.unit,
        imageUrl: variantItem.imageUrl,
        availableColors: [],
        colorVariantMap: {},
      };
      articleMap.set(artKey, artDetails);
    }

    // Register color
    if (!artDetails.availableColors.includes(color)) {
      artDetails.availableColors.push(color);
    }

    // Register size within color
    if (!artDetails.colorVariantMap[colKey]) {
      artDetails.colorVariantMap[colKey] = {
        availableSizes: [],
        variantsBySize: {},
      };
    }

    const colGroup = artDetails.colorVariantMap[colKey];
    if (size && !colGroup.availableSizes.includes(size)) {
      colGroup.availableSizes.push(size);
    }
    if (size) {
      colGroup.variantsBySize[szKey] = variantItem;
    }
  }

  // Sort available colors and sizes naturally
  for (const artDetails of articleMap.values()) {
    artDetails.availableColors.sort((a, b) => a.localeCompare(b));
    for (const colGroup of Object.values(artDetails.colorVariantMap)) {
      colGroup.availableSizes.sort((a, b) => {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });
    }
  }

  const sortedArticles = Array.from(articleSet).sort((a, b) => a.localeCompare(b));

  return {
    articles: sortedArticles,
    articleMap,
    barcodeMap,
    skuMap,
  };
}

/**
 * Returns all available Articles matching a search query.
 */
export function getAvailableArticles(
  index: ArticleCatalogIndex,
  query: string = ""
): string[] {
  if (!index || !index.articles) return [];
  if (!query || !query.trim()) return index.articles;
  const q = normalizeKey(query);
  return index.articles.filter((art) => normalizeKey(art).includes(q));
}

/**
 * Returns ONLY colors available for the selected Article.
 * If the article is not found, returns an empty array.
 */
export function getAvailableColorsForArticle(
  index: ArticleCatalogIndex,
  article: string
): string[] {
  if (!index || !article) return [];
  const artKey = normalizeKey(article);
  const details = index.articleMap.get(artKey);
  return details ? details.availableColors : [];
}

/**
 * Returns ONLY sizes available for the selected Article and Color.
 * If article or color is not found, returns an empty array.
 */
export function getAvailableSizesForArticleAndColor(
  index: ArticleCatalogIndex,
  article: string,
  color: string
): string[] {
  if (!index || !article || !color) return [];
  const artKey = normalizeKey(article);
  const colKey = normalizeKey(color);
  const details = index.articleMap.get(artKey);
  if (!details) return [];
  const colGroup = details.colorVariantMap[colKey];
  return colGroup ? colGroup.availableSizes : [];
}

/**
 * Resolves the exact variant product for an Article, Color, and Size.
 */
export function resolveVariantFromIndex(
  index: ArticleCatalogIndex,
  article: string,
  color: string,
  size: string
): ArticleVariantItem | undefined {
  if (!index || !article || !color || !size) return undefined;
  const artKey = normalizeKey(article);
  const colKey = normalizeKey(color);
  const szKey = normalizeKey(size);

  const details = index.articleMap.get(artKey);
  if (!details) return undefined;
  const colGroup = details.colorVariantMap[colKey];
  if (!colGroup) return undefined;
  return colGroup.variantsBySize[szKey];
}

/**
 * Fast reverse-resolution: Given a Barcode or SKU, resolves the exact Article, Color, Size, and Details.
 */
export function resolveByBarcodeOrSkuFromIndex(
  index: ArticleCatalogIndex,
  barcodeOrSku: string
): ArticleVariantItem | undefined {
  if (!index || !barcodeOrSku) return undefined;
  const key = normalizeKey(barcodeOrSku);
  return index.barcodeMap.get(key) || index.skuMap.get(key);
}

/**
 * Gets high-level summary metadata for an Article (brand, category, default rates, image).
 */
export function getArticleSummaryFromIndex(
  index: ArticleCatalogIndex,
  article: string
): ArticleGroupDetails | undefined {
  if (!index || !article) return undefined;
  return index.articleMap.get(normalizeKey(article));
}
