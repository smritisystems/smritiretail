/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.2.0
 * Created      : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SAP Fiori Horizon Admin Control Panel
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Sliders,
  RotateCw,
  Sun,
  Eye,
  Layers,
  Sparkles,
  Shield,
  Palette,
  Check,
  RefreshCw,
} from "lucide-react";
import { useLoginBackground } from "../services/login_background/LoginBackgroundEngine";
import { BackgroundType, RotationMode, LoginCardStyle } from "../services/login_background/LoginBackgroundTypes";

interface LoginBackgroundAdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const BACKGROUND_TYPES: BackgroundType[] = [
  "None",
  "Solid Color",
  "Gradient",
  "Historical Collection",
  "Cultural Collection",
  "Company Branding",
  "Custom SVG",
];

const ROTATION_MODES: RotationMode[] = [
  "Static",
  "Random",
  "Daily",
  "Weekly",
  "Monthly",
];

const CARD_STYLES: LoginCardStyle[] = [
  "Glass",
  "Solid",
  "Floating",
  "Elevated",
  "Minimal",
];

export const LoginBackgroundAdminDrawer: React.FC<LoginBackgroundAdminDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { config, updateConfig, resetConfig, collections } = useLoginBackground();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in">
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          style={{ fontFamily: "'72', 'Inter', Arial, sans-serif" }}
          className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col text-[#32363a] border-l border-[#e5e5e5]"
        >
          {/* Header Bar */}
          <div style={{ backgroundColor: "#354a5e" }} className="px-5 py-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <Sliders size={18} className="text-blue-300" />
              <div>
                <h3 className="font-bold text-sm leading-none">Login Background Engine</h3>
                <p className="text-[10px] text-blue-200/70 mt-1 font-mono">Metadata Configurator v5.2.0</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-[#e5e5e5] bg-[#f9f9f9]">
              <div>
                <span className="font-bold block text-sm">Background Engine</span>
                <span className="text-[11px] text-[#6a6d70]">Master enable/disable switch</span>
              </div>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={e => updateConfig(c => ({ ...c, enabled: e.target.checked }))}
                className="w-5 h-5 accent-[#0854a0] cursor-pointer"
              />
            </div>

            {/* Background Category Selector */}
            <div className="space-y-2">
              <label className="font-bold block text-xs flex items-center gap-1.5 text-[#32363a]">
                <Palette size={14} className="text-[#0854a0]" />
                Visual Theme Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BACKGROUND_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateConfig(c => ({ ...c, activeType: type }))}
                    className={`px-3 py-2 rounded text-left font-semibold text-[11px] transition-all border ${
                      config.activeType === type
                        ? "bg-[#0854a0] text-white border-[#0854a0] shadow-sm"
                        : "bg-white text-[#32363a] border-[#d9d9d9] hover:border-[#0854a0]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Motif Collection Selector */}
            {(config.activeType === "Historical Collection" || config.activeType === "Cultural Collection") && (
              <div className="space-y-2">
                <label className="font-bold block text-xs flex items-center gap-1.5 text-[#32363a]">
                  <Sparkles size={14} className="text-[#f29900]" />
                  Active Collection Motif
                </label>
                <div className="space-y-1.5">
                  {collections
                    .filter(item =>
                      config.activeType === "Historical Collection"
                        ? item.category === "Historical"
                        : item.category === "Cultural"
                    )
                    .map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => updateConfig(c => ({ ...c, selectedCollectionId: item.id }))}
                        className={`w-full flex items-center justify-between p-3 rounded border text-left transition-all ${
                          config.selectedCollectionId === item.id
                            ? "border-[#0854a0] bg-blue-50/50"
                            : "border-[#e5e5e5] bg-white hover:border-[#89919a]"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-[#32363a]">{item.title}</div>
                          <div className="text-[10px] text-[#6a6d70] mt-0.5">{item.description}</div>
                        </div>
                        {config.selectedCollectionId === item.id && (
                          <Check size={16} className="text-[#0854a0] shrink-0" />
                        )}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Display Controls Slider Panel */}
            <div className="space-y-4 pt-3 border-t border-[#e5e5e5]">
              <label className="font-bold block text-xs flex items-center gap-1.5 text-[#32363a]">
                <Sun size={14} className="text-[#0854a0]" />
                Display & Canvas Filters
              </label>

              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#6a6d70]">SVG Overlay Opacity</span>
                  <span className="font-bold font-mono">{config.displayControls.opacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.displayControls.opacity}
                  onChange={e =>
                    updateConfig(c => ({
                      ...c,
                      displayControls: { ...c.displayControls, opacity: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-[#0854a0] cursor-pointer"
                />
              </div>

              {/* Blur Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#6a6d70]">Canvas Blur</span>
                  <span className="font-bold font-mono">{config.displayControls.blur} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={config.displayControls.blur}
                  onChange={e =>
                    updateConfig(c => ({
                      ...c,
                      displayControls: { ...c.displayControls, blur: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-[#0854a0] cursor-pointer"
                />
              </div>

              {/* Brightness Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#6a6d70]">Canvas Brightness</span>
                  <span className="font-bold font-mono">{config.displayControls.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={config.displayControls.brightness}
                  onChange={e =>
                    updateConfig(c => ({
                      ...c,
                      displayControls: { ...c.displayControls, brightness: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-[#0854a0] cursor-pointer"
                />
              </div>
            </div>

            {/* Login Card Glassmorphism Style */}
            <div className="space-y-2 pt-3 border-t border-[#e5e5e5]">
              <label className="font-bold block text-xs flex items-center gap-1.5 text-[#32363a]">
                <Layers size={14} className="text-[#0854a0]" />
                Login Card Container Style
              </label>
              <div className="flex flex-wrap gap-2">
                {CARD_STYLES.map(style => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => updateConfig(c => ({ ...c, cardConfig: { ...c.cardConfig, style } }))}
                    className={`px-3 py-1.5 rounded font-semibold text-[11px] border transition-all ${
                      config.cardConfig.style === style
                        ? "bg-[#354a5e] text-white border-[#354a5e]"
                        : "bg-white text-[#32363a] border-[#d9d9d9] hover:border-[#354a5e]"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Rotation Mode */}
            <div className="space-y-2 pt-3 border-t border-[#e5e5e5]">
              <label className="font-bold block text-xs flex items-center gap-1.5 text-[#32363a]">
                <RotateCw size={14} className="text-[#0854a0]" />
                Rotation Policy
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ROTATION_MODES.map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateConfig(c => ({ ...c, rotationMode: mode }))}
                    className={`px-2.5 py-1.5 rounded text-center font-semibold text-[10px] border transition-all ${
                      config.rotationMode === mode
                        ? "bg-[#0854a0] text-white border-[#0854a0]"
                        : "bg-white text-[#32363a] border-[#d9d9d9] hover:border-[#0854a0]"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Accessibility Auto-Bypass Options */}
            <div className="space-y-2 pt-3 border-t border-[#e5e5e5]">
              <label className="font-bold block text-xs flex items-center gap-1.5 text-[#32363a]">
                <Shield size={14} className="text-[#188038]" />
                Accessibility Auto-Bypass
              </label>
              <div className="space-y-2 bg-[#f4f4f4] p-3 rounded border border-[#e5e5e5]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.accessibility.autoDisableOnReducedMotion}
                    onChange={e =>
                      updateConfig(c => ({
                        ...c,
                        accessibility: { ...c.accessibility, autoDisableOnReducedMotion: e.target.checked },
                      }))
                    }
                    className="accent-[#0854a0]"
                  />
                  <span>Disable on Reduced Motion preference</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.accessibility.autoDisableOnHighContrast}
                    onChange={e =>
                      updateConfig(c => ({
                        ...c,
                        accessibility: { ...c.accessibility, autoDisableOnHighContrast: e.target.checked },
                      }))
                    }
                    className="accent-[#0854a0]"
                  />
                  <span>Disable on High Contrast Mode</span>
                </label>
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[#e5e5e5] bg-[#f9f9f9] flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={resetConfig}
              className="px-3 py-1.5 text-xs text-[#d93025] hover:bg-rose-50 font-semibold rounded border border-rose-200 flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 bg-[#0854a0] hover:bg-[#064280] text-white text-xs font-bold rounded shadow-sm"
            >
              Apply &amp; Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
