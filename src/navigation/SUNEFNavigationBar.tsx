/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUNEFNavigationBar Component (SUNE In-App Control Bar)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.3.0
 */

import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Home } from "lucide-react";
import { SUNEFKernel } from "./SUNEFKernel.ts";

export const SUNEFNavigationBar: React.FC = () => {
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const syncState = () => {
      setCanGoBack(SUNEFKernel.canGoBack());
      setCanGoForward(SUNEFKernel.canGoForward());
    };
    syncState();

    const handleEntityOpened = () => syncState();
    window.addEventListener("sunef_entity_opened", handleEntityOpened);
    return () => {
      window.removeEventListener("sunef_entity_opened", handleEntityOpened);
    };
  }, []);

  const handleBack = async () => {
    await SUNEFKernel.goBack();
    setCanGoBack(SUNEFKernel.canGoBack());
    setCanGoForward(SUNEFKernel.canGoForward());
  };

  const handleForward = async () => {
    await SUNEFKernel.goForward();
    setCanGoBack(SUNEFKernel.canGoBack());
    setCanGoForward(SUNEFKernel.canGoForward());
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await SUNEFKernel.smartRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleHome = async () => {
    await SUNEFKernel.goHome();
    setCanGoBack(SUNEFKernel.canGoBack());
    setCanGoForward(SUNEFKernel.canGoForward());
  };

  return (
    <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg p-0.5">
      {/* ◀ Back */}
      <button
        onClick={handleBack}
        disabled={!canGoBack}
        className={`p-1.5 rounded transition-all flex items-center justify-center ${
          canGoBack
            ? "text-white hover:bg-white/15 cursor-pointer"
            : "text-white/30 cursor-not-allowed opacity-40"
        }`}
        title="Back (Alt + ←)"
      >
        <ArrowLeft size={13} />
      </button>

      {/* ▶ Forward */}
      <button
        onClick={handleForward}
        disabled={!canGoForward}
        className={`p-1.5 rounded transition-all flex items-center justify-center ${
          canGoForward
            ? "text-white hover:bg-white/15 cursor-pointer"
            : "text-white/30 cursor-not-allowed opacity-40"
        }`}
        title="Forward (Alt + →)"
      >
        <ArrowRight size={13} />
      </button>

      {/* ⟳ Smart Refresh */}
      <button
        onClick={handleRefresh}
        className="p-1.5 rounded text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center"
        title="Smart Refresh — Preserve Drafts (Ctrl + R)"
      >
        <RotateCw size={13} className={isRefreshing ? "animate-spin text-blue-300" : ""} />
      </button>

      {/* 🏠 Home */}
      <button
        onClick={handleHome}
        className="p-1.5 rounded text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center"
        title="Home Dashboard (Ctrl + H)"
      >
        <Home size={13} />
      </button>
    </div>
  );
};
