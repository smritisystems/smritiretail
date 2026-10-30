/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-22
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: UX Switcher Component (Regular UX <-> Classic UX)
 */

import React, { useEffect, useRef } from 'react';
import { useLayoutEngine, UXMode } from '../../layout_engine/layout_store.tsx';

interface UxSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UxSwitcherModal: React.FC<UxSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { uxMode, setUxMode } = useLayoutEngine();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectMode = (mode: UXMode) => {
    setUxMode(mode);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div 
        ref={dialogRef}
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ux-mode-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#24389c] to-[#3f51b5] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-[22px]">tune</span>
            </div>
            <div>
              <h3 id="ux-mode-title" className="text-base font-bold tracking-tight">
                Workspace style
              </h3>
              <p className="text-xs text-indigo-100">
                Choose a layout style. Your current module stays open when you switch.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body Cards */}
        <div className="p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
          {/* Regular UX Card */}
          <button
            type="button"
            onClick={() => handleSelectMode('regular')}
            aria-pressed={uxMode === 'regular'}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24389c] ${
              uxMode === 'regular'
                ? 'border-[#24389c] dark:border-indigo-500 bg-white dark:bg-slate-900 shadow-md ring-2 ring-[#24389c]/20'
                : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  uxMode === 'regular'
                    ? 'bg-[#24389c] text-white shadow-xs'
                    : 'bg-indigo-50 dark:bg-slate-800 text-[#24389c] dark:text-indigo-400'
                }`}>
                  <span className="material-symbols-outlined text-[24px]">laptop_mac</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Regular UX
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Guided & Clean
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Simple, clean and guided • Everyday Retail
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  uxMode === 'regular'
                    ? 'border-[#24389c] bg-[#24389c] text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                }`}>
                  {uxMode === 'regular' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-500 text-[14px]">check_circle</span>
                <span>Spacious layouts & cards</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-500 text-[14px]">check_circle</span>
                <span>Guided workflows</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-500 text-[14px]">check_circle</span>
                <span>Essential summary first</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-500 text-[14px]">check_circle</span>
                <span>Zero visual clutter</span>
              </div>
            </div>
          </button>

          {/* Classic UX Card */}
          <button
            type="button"
            onClick={() => handleSelectMode('classic')}
            aria-pressed={uxMode === 'classic'}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24389c] ${
              uxMode === 'classic'
                ? 'border-[#24389c] dark:border-indigo-500 bg-white dark:bg-slate-900 shadow-md ring-2 ring-[#24389c]/20'
                : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  uxMode === 'classic'
                    ? 'bg-[#24389c] text-white shadow-xs'
                    : 'bg-indigo-50 dark:bg-slate-800 text-[#24389c] dark:text-indigo-400'
                }`}>
                  <span className="material-symbols-outlined text-[24px]">desktop_windows</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Classic UX
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Traditional ERP
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Traditional, detailed and powerful • For Advanced Users
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  uxMode === 'classic'
                    ? 'border-[#24389c] bg-[#24389c] text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                }`}>
                  {uxMode === 'classic' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-500 text-[14px]">check_circle</span>
                <span>Top ERP menu bar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-500 text-[14px]">check_circle</span>
                <span>Multi-tab workspaces</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-500 text-[14px]">check_circle</span>
                <span>Dense grids with F-keys</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-500 text-[14px]">check_circle</span>
                <span>High information density</span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="material-symbols-outlined text-emerald-500 text-[16px]">verified</span>
            <span>Your current workspace stays open while the layout changes.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
