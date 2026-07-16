/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Image, Maximize2 } from "lucide-react";

interface ProductImageProps {
  src?: string;
  alt?: string;
  size?: "small" | "medium" | "large" | "original";
  className?: string;
  hoverZoom?: boolean;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt = "Product Image",
  size = "medium",
  className = "",
  hoverZoom = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Set standard dimensions based on display preference size
  const sizeClasses = {
    small: "w-6 h-6 rounded-md",
    medium: "w-12 h-12 rounded-lg",
    large: "w-24 h-24 rounded-xl",
    original: "w-full h-auto rounded-xl",
  };

  // Prepend API prefix for local SPIF uploads
  const getFullImageUrl = (path?: string) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      return path;
    }
    // Prefix /api/v1 for standard Express/Vite proxied route
    return `/api/v1${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const finalSrc = getFullImageUrl(src);

  if (error || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-theme-surface-3 border border-theme-divider/50 text-theme-muted ${sizeClasses[size]} ${className}`}
        title="No image available"
      >
        <Image className={size === "small" ? "w-3.5 h-3.5" : "w-5 h-5"} />
      </div>
    );
  }

  return (
    <>
      <div className={`relative overflow-hidden group select-none ${sizeClasses[size]} ${className}`}>
        {loading && (
          <div className="absolute inset-0 bg-theme-surface-3 animate-pulse flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <img
          src={finalSrc}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          className={`object-cover w-full h-full transition-transform duration-300 ${
            hoverZoom ? "group-hover:scale-125 cursor-zoom-in" : ""
          }`}
          onClick={() => {
            if (hoverZoom) {
              setShowFullPreview(true);
            }
          }}
        />
        {hoverZoom && !loading && (
          <div className="absolute bottom-1 right-1 bg-black/60 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <Maximize2 size={10} />
          </div>
        )}
      </div>

      {/* Full Preview Modal Overlay */}
      {showFullPreview && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowFullPreview(false)}
        >
          <div className="relative max-w-xl max-h-[80vh] bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-2xl p-2">
            <button
              onClick={() => setShowFullPreview(false)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
            <img
              src={finalSrc}
              alt={alt}
              className="max-w-full max-h-[75vh] object-contain rounded-xl"
            />
            <div className="p-3 text-center text-xs font-semibold text-theme-muted font-mono tracking-wider uppercase">
              {alt}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
