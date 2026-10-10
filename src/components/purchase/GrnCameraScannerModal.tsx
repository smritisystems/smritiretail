/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.34.0
 * Created      : 2026-09-20
 * Modified     : 2026-09-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_CAMERA_SCANNER")
 * Target UI    : SMRITI GRN Studio — Camera-Based Barcode & QR Receiving Scanner
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, X, Flashlight, AlertCircle, Scan, Volume2, VolumeX, CheckCircle } from "lucide-react";

interface GrnCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  audioFeedback?: boolean;
}

export const GrnCameraScannerModal: React.FC<GrnCameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  audioFeedback = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const lastBarcodeRef = useRef<string>("");

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(audioFeedback);
  const [recentScans, setRecentScans] = useState<Array<{ code: string; time: string }>>([]);
  const [scanPulse, setScanPulse] = useState(false);
  const [barcodeDetectorSupported, setBarcodeDetectorSupported] = useState(true);

  // Play synthetic scanner chime using Web Audio API
  const playScanTone = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08); // E6 note

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Ignore audio failure
    }
  }, [soundEnabled]);

  // Handle successful scan detection
  const handleBarcodeDetected = useCallback((rawBarcode: string) => {
    const cleanCode = rawBarcode.trim();
    if (!cleanCode) return;

    const now = Date.now();
    // Debounce duplicate scans within 1.2s if identical, or 400ms for rapid new barcodes
    if (cleanCode === lastBarcodeRef.current && now - lastScannedTimeRef.current < 1200) {
      return;
    }
    if (now - lastScannedTimeRef.current < 400) {
      return;
    }

    lastScannedTimeRef.current = now;
    lastBarcodeRef.current = cleanCode;

    setScanPulse(true);
    setTimeout(() => setScanPulse(false), 300);

    playScanTone();
    onScan(cleanCode);

    setRecentScans((prev) => [
      { code: cleanCode, time: new Date().toLocaleTimeString("en-IN") },
      ...prev.slice(0, 4),
    ]);
  }, [playScanTone, onScan]);

  // Start Video Stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities?.() || {};
      if (capabilities.torch) {
        setTorchSupported(true);
      }
    } catch (err: any) {
      setCameraActive(false);
      setCameraError(err.message || "Failed to access dock video camera.");
    }
  }, []);

  // Stop Video Stream
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchEnabled(false);
  }, []);

  // Continuous Scanner Loop using native BarcodeDetector
  useEffect(() => {
    if (!isOpen || !cameraActive || !videoRef.current) return;

    let detector: any = null;
    if ("BarcodeDetector" in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ["code_128", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e", "code_39"],
        });
        setBarcodeDetectorSupported(true);
      } catch {
        setBarcodeDetectorSupported(false);
      }
    } else {
      setBarcodeDetectorSupported(false);
    }

    let isDetecting = false;

    const scanFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (detector && !isDetecting) {
        isDetecting = true;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            handleBarcodeDetected(barcodes[0].rawValue);
          }
        } catch {
          // Frame detection dropped
        } finally {
          isDetecting = false;
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isOpen, cameraActive, handleBarcodeDetected]);

  // Lifecycle control
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchEnabled;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchEnabled(nextTorch);
    } catch {
      // Torch constraint failed
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Camera Barcode Scanner</h3>
              <p className="text-[11px] text-slate-400">Scan product label or carton barcode to inward</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-lg border text-xs transition ${
                  torchEnabled
                    ? "bg-amber-500 border-amber-400 text-slate-950 font-bold"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
                title="Toggle Flashlight / Torch"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
              title={soundEnabled ? "Mute Scanner Sound" : "Enable Scanner Sound"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Viewport */}
        <div className="relative bg-black h-72 sm:h-80 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Viewfinder Frame Overlay */}
          <div
            className={`absolute w-64 h-44 rounded-2xl border-2 transition-all duration-150 pointer-events-none flex flex-col justify-between p-2 ${
              scanPulse
                ? "border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.8)] scale-105"
                : "border-indigo-400/80 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            }`}
          >
            {/* Corner Markers */}
            <div className="flex justify-between">
              <div className="w-4 h-4 border-t-2 border-l-2 border-white rounded-tl" />
              <div className="w-4 h-4 border-t-2 border-r-2 border-white rounded-tr" />
            </div>

            {/* Laser Scan Animation Line */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" />

            <div className="flex justify-between">
              <div className="w-4 h-4 border-b-2 border-l-2 border-white rounded-bl" />
              <div className="w-4 h-4 border-b-2 border-r-2 border-white rounded-br" />
            </div>
          </div>

          {/* Error / Fallback Message */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <div className="text-xs text-rose-200 font-medium max-w-xs">{cameraError}</div>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow"
              >
                Retry Camera
              </button>
            </div>
          )}

          {/* Compatibility Notice if BarcodeDetector is not natively supported */}
          {!barcodeDetectorSupported && !cameraError && (
            <div className="absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-700/60 text-amber-200 text-[11px] text-center">
              Web BarcodeDetector unsupported in this browser. Use Chrome/Edge or USB handheld wedge scanner.
            </div>
          )}
        </div>

        {/* Recent Scans Strip */}
        <div className="p-3.5 bg-slate-850 border-t border-slate-800 text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-2">
            <span className="flex items-center gap-1">
              <Scan className="w-3.5 h-3.5 text-indigo-400" />
              Live Inward Feed
            </span>
            <span>{recentScans.length} Scanned in Session</span>
          </div>

          {recentScans.length === 0 ? (
            <div className="py-3 text-center text-slate-500 text-[11px]">
              Align barcode inside the central frame to automatically inward (+1).
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentScans.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-[11px]"
                >
                  <span className="font-mono font-bold text-indigo-300">{s.code}</span>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span>{s.time}</span>
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Dock Mode: Continuous Multi-Scan (+1 per read)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition"
          >
            Done Scanning
          </button>
        </div>
      </div>
    </div>
  );
};
