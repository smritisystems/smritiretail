/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-09-27
 * Modified     : 2026-09-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Shared Billing Product Catalog Hook
 */

import { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export interface BillingProduct {
  id: string;
  code: string;
  name: string;
  category?: string;
  brand?: string;
  mrp?: number;
  price?: number;
  stock?: number;
  unit?: string;
  barcode?: string;
  gst_rate?: number;
  hsn_code?: string;
  is_active?: boolean;
  image_url?: string;
}

export interface CategoryFacet {
  name: string;
  count: number;
}

export interface UseBillingCatalogOptions {
  initialCategory?: string;
  pageSize?: number;
}

export const FALLBACK_BILLING_PRODUCTS: BillingProduct[] = [
  {
    id: "prod-shoe-001",
    code: "SHOE-001",
    name: "Sports Shoes - Black",
    category: "Footwear",
    brand: "Nike",
    mrp: 1899.0,
    price: 1500.0,
    stock: 32,
    unit: "Pair",
    barcode: "890123456001",
    gst_rate: 18.0,
    hsn_code: "640411",
    is_active: true,
  },
  {
    id: "prod-shoe-002",
    code: "SHOE-002",
    name: "Running Shoes - Blue",
    category: "Footwear",
    brand: "Adidas",
    mrp: 2199.0,
    price: 1800.0,
    stock: 18,
    unit: "Pair",
    barcode: "890123456002",
    gst_rate: 18.0,
    hsn_code: "640411",
    is_active: true,
  },
  {
    id: "prod-shoe-003",
    code: "SHOE-003",
    name: "Casual Shoes - White",
    category: "Footwear",
    brand: "Puma",
    mrp: 1499.0,
    price: 1200.0,
    stock: 24,
    unit: "Pair",
    barcode: "890123456003",
    gst_rate: 18.0,
    hsn_code: "640411",
    is_active: true,
  },
  {
    id: "prod-acc-001",
    code: "ACC-001",
    name: "Shoe Care Kit",
    category: "Accessories",
    brand: "Kiwi",
    mrp: 299.0,
    price: 250.0,
    stock: 120,
    unit: "Nos",
    barcode: "890123456004",
    gst_rate: 18.0,
    hsn_code: "340510",
    is_active: true,
  },
  {
    id: "prod-bag-001",
    code: "BAG-001",
    name: "Sports Bag",
    category: "Bags",
    brand: "Wildcraft",
    mrp: 1299.0,
    price: 950.0,
    stock: 25,
    unit: "Nos",
    barcode: "890123456005",
    gst_rate: 18.0,
    hsn_code: "420212",
    is_active: true,
  },
  {
    id: "prod-sock-001",
    code: "SOCK-001",
    name: "Sports Socks - 3 Pack",
    category: "Socks",
    brand: "Nike",
    mrp: 199.0,
    price: 150.0,
    stock: 100,
    unit: "Pack",
    barcode: "890123456006",
    gst_rate: 12.0,
    hsn_code: "611595",
    is_active: true,
  },
];

export function useBillingCatalog(options: UseBillingCatalogOptions = {}) {
  const { initialCategory = "All Categories", pageSize = 50 } = options;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [stockAvailability, setStockAvailability] = useState("ALL");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const [categories, setCategories] = useState<CategoryFacet[]>([
    { name: "All Categories", count: 245 },
    { name: "Footwear", count: 86 },
    { name: "Accessories", count: 32 },
    { name: "Care Products", count: 18 },
    { name: "Bags", count: 26 },
    { name: "Socks", count: 12 },
    { name: "Apparel", count: 28 },
    { name: "Others", count: 43 },
  ]);

  const [brands, setBrands] = useState<string[]>([
    "Nike",
    "Adidas",
    "Puma",
    "Bata",
    "Kiwi",
    "Wildcraft",
  ]);

  const [products, setProducts] = useState<BillingProduct[]>(FALLBACK_BILLING_PRODUCTS);
  const [totalCount, setTotalCount] = useState(245);
  const [loading, setLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : "";
      const cat = selectedCategory !== "All Categories" ? `&category=${encodeURIComponent(selectedCategory)}` : "";
      const br = brandFilter !== "ALL" ? `&brand=${encodeURIComponent(brandFilter)}` : "";
      const minP = minPrice ? `&min_price=${minPrice}` : "";
      const maxP = maxPrice ? `&max_price=${maxPrice}` : "";
      const st = stockAvailability !== "ALL" ? `&stock_status=${stockAvailability}` : "";
      const act = showOnlyActive ? "&is_active=true" : "";

      const res = await apiFetchV1<any>(
        `/billing/products?page=1&page_size=${pageSize}${q}${cat}${br}${minP}${maxP}${st}${act}`
      );
      if (res && res.items) {
        setProducts(res.items);
        if (res.total_count !== undefined) setTotalCount(res.total_count);
        if (res.categories && res.categories.length > 0) setCategories(res.categories);
        if (res.brands && res.brands.length > 0) setBrands(res.brands);
      }
    } catch {
      // Retain fallback items
      setProducts((prev) => (prev.length > 0 ? prev : FALLBACK_BILLING_PRODUCTS));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, brandFilter, stockAvailability, minPrice, maxPrice, showOnlyActive, pageSize]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    brandFilter,
    setBrandFilter,
    stockAvailability,
    setStockAvailability,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    showOnlyActive,
    setShowOnlyActive,
    categories,
    brands,
    products,
    totalCount,
    loading,
    refresh: fetchProducts,
  };
}
