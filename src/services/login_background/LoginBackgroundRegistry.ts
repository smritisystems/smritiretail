/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.2.0
 * Created      : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Procedural Vector Art Motif Registry
 */

import { CollectionItem } from "./LoginBackgroundTypes";

export const HISTORICAL_COLLECTION: CollectionItem[] = [
  {
    id: "konark-sun-temple",
    title: "Konark Sun Temple Wheel",
    category: "Historical",
    region: "East",
    description: "Intricate 13th-century stone chariot wheel motif symbolizing time, motion, and precision.",
    enabled: true,
    order: 1,
    svgContent: `<svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="400" cy="400" r="360" stroke="currentColor" stroke-width="3" stroke-dasharray="10 6" opacity="0.6"/>
      <circle cx="400" cy="400" r="320" stroke="currentColor" stroke-width="2"/>
      <circle cx="400" cy="400" r="260" stroke="currentColor" stroke-width="1.5" opacity="0.8"/>
      <circle cx="400" cy="400" r="100" stroke="currentColor" stroke-width="3"/>
      <circle cx="400" cy="400" r="40" stroke="currentColor" stroke-width="2"/>
      <!-- 8 Major Spokes -->
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(deg => `
        <g transform="rotate(${deg} 400 400)">
          <line x1="400" y1="100" x2="400" y2="360" stroke="currentColor" stroke-width="3"/>
          <circle cx="400" cy="200" r="16" stroke="currentColor" stroke-width="1.5"/>
          <polygon points="395,240 405,240 400,280" fill="currentColor" opacity="0.4"/>
        </g>
      `).join("")}
      <!-- 8 Minor Spokes -->
      ${[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(deg => `
        <g transform="rotate(${deg} 400 400)">
          <line x1="400" y1="100" x2="400" y2="360" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 4"/>
          <circle cx="400" cy="230" r="8" fill="currentColor" opacity="0.5"/>
        </g>
      `).join("")}
    </svg>`,
  },
  {
    id: "indus-valley-seal",
    title: "Indus Valley Geometry",
    category: "Historical",
    region: "Pan India",
    description: "Harappan civilization geometric grid and sacred fig leaf lattice pattern.",
    enabled: true,
    order: 2,
    svgContent: `<svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
      <pattern id="indus-grid" width="100" height="100" patternUnits="userSpaceOnUse">
        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"/>
        <circle cx="50" cy="50" r="35" stroke="currentColor" stroke-width="1" fill="none"/>
        <path d="M 50 15 Q 85 50 50 85 Q 15 50 50 15 Z" fill="none" stroke="currentColor" stroke-width="1.2"/>
        <circle cx="50" cy="50" r="8" fill="currentColor" opacity="0.2"/>
      </pattern>
      <rect width="800" height="800" fill="url(#indus-grid)"/>
      <rect x="40" y="40" width="720" height="720" stroke="currentColor" stroke-width="3" fill="none"/>
      <rect x="60" y="60" width="680" height="680" stroke="currentColor" stroke-width="1" stroke-dasharray="12 6" fill="none"/>
    </svg>`,
  },
  {
    id: "nalanda-arch",
    title: "Nalanda University Arches",
    category: "Historical",
    region: "East",
    description: "Classic 5th-century Gupta-era terracotta monastic stupa arches & knowledge motifs.",
    enabled: true,
    order: 3,
    svgContent: `<svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 100 700 L 100 350 Q 400 50 700 350 L 700 700" stroke="currentColor" stroke-width="3" fill="none"/>
      <path d="M 160 700 L 160 380 Q 400 130 640 380 L 640 700" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M 220 700 L 220 410 Q 400 210 580 410 L 580 700" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 4" fill="none"/>
      <circle cx="400" cy="280" r="60" stroke="currentColor" stroke-width="2" fill="none"/>
      <polygon points="400,240 430,300 370,300" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <line x1="100" y1="700" x2="700" y2="700" stroke="currentColor" stroke-width="4"/>
    </svg>`,
  },
  {
    id: "hampi-chariot",
    title: "Hampi Vittala Chariot",
    category: "Historical",
    region: "South",
    description: "Vijayanagara empire monolith stone chariot architecture outline.",
    enabled: true,
    order: 4,
    svgContent: `<svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 150 650 L 650 650 L 600 300 L 400 100 L 200 300 Z" stroke="currentColor" stroke-width="3" fill="none"/>
      <circle cx="280" cy="650" r="70" stroke="currentColor" stroke-width="3" fill="none"/>
      <circle cx="280" cy="650" r="20" stroke="currentColor" stroke-width="2"/>
      <circle cx="520" cy="650" r="70" stroke="currentColor" stroke-width="3" fill="none"/>
      <circle cx="520" cy="650" r="20" stroke="currentColor" stroke-width="2"/>
      <line x1="200" y1="300" x2="600" y2="300" stroke="currentColor" stroke-width="2"/>
      <line x1="230" y1="420" x2="570" y2="420" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 4"/>
      <path d="M 400 100 L 400 250" stroke="currentColor" stroke-width="2"/>
    </svg>`,
  },
];

export const CULTURAL_COLLECTION: CollectionItem[] = [
  {
    id: "south-kolam-mandala",
    title: "South Indian Kolam / Rangoli",
    category: "Cultural",
    region: "South",
    description: "Symmetrical rice-flour geometric Kolam pattern representing harmony and prosperity.",
    enabled: true,
    order: 1,
    svgContent: `<svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="currentColor" stroke-width="2" fill="none">
        <circle cx="400" cy="400" r="300"/>
        <circle cx="400" cy="400" r="200"/>
        <circle cx="400" cy="400" r="100"/>
        ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => `
          <g transform="rotate(${deg} 400 400)">
            <path d="M 400 100 Q 450 250 400 400 Q 350 250 400 100 Z"/>
            <circle cx="400" cy="150" r="6" fill="currentColor" opacity="0.6"/>
          </g>
        `).join("")}
      </g>
    </svg>`,
  },
  {
    id: "warli-folk-art",
    title: "Maharashtra Warli Line Art",
    category: "Cultural",
    region: "West",
    description: "Tribal Warli geometric human figures dancing in circular celebration of life.",
    enabled: true,
    order: 2,
    svgContent: `<svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="400" cy="400" r="280" stroke="currentColor" stroke-width="2" stroke-dasharray="12 6" fill="none"/>
      ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => `
        <g transform="rotate(${deg} 400 400) translate(0, -280)">
          <!-- Warli Person (Two Triangles) -->
          <polygon points="0,-15 -10,0 10,0" fill="currentColor" opacity="0.8"/>
          <polygon points="0,15 -10,0 10,0" fill="currentColor" opacity="0.8"/>
          <circle cx="0" cy="-22" r="6" fill="currentColor"/>
          <line x1="-10" y1="-5" x2="-22" y2="-20" stroke="currentColor" stroke-width="2"/>
          <line x1="10" y1="-5" x2="22" y2="-20" stroke="currentColor" stroke-width="2"/>
          <line x1="-5" y1="15" x2="-12" y2="30" stroke="currentColor" stroke-width="2"/>
          <line x1="5" y1="15" x2="12" y2="30" stroke="currentColor" stroke-width="2"/>
        </g>
      `).join("")}
    </svg>`,
  },
  {
    id: "himalayan-peacocks",
    title: "Peacock & Lotus Motif",
    category: "Cultural",
    region: "North",
    description: "National bird & lotus flower outline vector pattern symbolizing elegance.",
    enabled: true,
    order: 3,
    svgContent: `<svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 400 700 C 200 700 100 500 100 400 C 100 250 250 100 400 100 C 550 100 700 250 700 400 C 700 500 500 700 400 700 Z" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M 400 600 C 280 600 200 480 200 400 C 200 300 300 200 400 200 C 500 200 600 300 600 400 C 600 480 520 600 400 600 Z" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3" fill="none"/>
      <!-- Lotus Center -->
      <path d="M 400 350 Q 430 400 400 450 Q 370 400 400 350 Z" stroke="currentColor" stroke-width="2" fill="currentColor" opacity="0.2"/>
      <path d="M 400 350 Q 460 380 440 440 Q 390 430 400 350 Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <path d="M 400 350 Q 340 380 360 440 Q 410 430 400 350 Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
    </svg>`,
  },
];

export const ALL_COLLECTION_ITEMS: CollectionItem[] = [
  ...HISTORICAL_COLLECTION,
  ...CULTURAL_COLLECTION,
];

export const getCollectionItemById = (id: string): CollectionItem | undefined => {
  return ALL_COLLECTION_ITEMS.find(item => item.id === id) || ALL_COLLECTION_ITEMS[0];
};
