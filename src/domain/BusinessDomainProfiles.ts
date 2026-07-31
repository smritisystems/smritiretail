export type BusinessDomain = "Apparel" | "Footwear" | "Jewellery" | "Electronics" | "Grocery" | "Pharmacy";

export interface BusinessDomainProfile {
  domain: BusinessDomain;
  dimensions: string[];
  sizeMode: "apparel" | "footwear" | "hybrid";
  sizeScaleType: string;
}

export const BUSINESS_DOMAIN_PROFILES: Record<BusinessDomain, BusinessDomainProfile> = {
  Apparel: {
    domain: "Apparel",
    dimensions: ["Color", "Apparel Size", "Style", "Fabric"],
    sizeMode: "apparel",
    sizeScaleType: "Apparel",
  },
  Footwear: {
    domain: "Footwear",
    dimensions: ["Color", "Footwear Size", "Gender", "Width"],
    sizeMode: "footwear",
    sizeScaleType: "Footwear",
  },
  Jewellery: {
    domain: "Jewellery",
    dimensions: ["Metal", "Purity", "Stone", "Weight"],
    sizeMode: "hybrid",
    sizeScaleType: "Jewellery",
  },
  Electronics: {
    domain: "Electronics",
    dimensions: ["Brand", "Model", "Storage", "Color"],
    sizeMode: "hybrid",
    sizeScaleType: "Electronics",
  },
  Grocery: {
    domain: "Grocery",
    dimensions: ["Pack Size", "Weight", "Flavor", "Expiry"],
    sizeMode: "hybrid",
    sizeScaleType: "Grocery",
  },
  Pharmacy: {
    domain: "Pharmacy",
    dimensions: ["Strength", "Dosage", "Batch", "Expiry"],
    sizeMode: "hybrid",
    sizeScaleType: "Pharmacy",
  },
};
