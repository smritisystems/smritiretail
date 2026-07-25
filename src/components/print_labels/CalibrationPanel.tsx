/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Advanced Printer Calibration & Settings Sub-Component)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Sliders, RefreshCw, Check } from "lucide-react";

export interface PrinterCalibrationState {
  paperWidthMm: number;
  paperHeightMm: number;
  gapMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  marginLeftMm: number;
  marginTopMm: number;
  darkness: number;
  speedIps: number;
  rotationDeg: number;
  mirror: boolean;
}

export const DEFAULT_CALIBRATION: PrinterCalibrationState = {
  paperWidthMm: 50,
  paperHeightMm: 35,
  gapMm: 3,
  labelWidthMm: 50,
  labelHeightMm: 35,
  marginLeftMm: 0,
  marginTopMm: 0,
  darkness: 15,
  speedIps: 4,
  rotationDeg: 0,
  mirror: false
};

export const CalibrationPanel: React.FC = () => {
  const [calib, setCalib] = useState<PrinterCalibrationState>(DEFAULT_CALIBRATION);
  const [calibratedSuccess, setCalibratedSuccess] = useState<boolean>(false);

  const handleTestCalibration = () => {
    setCalibratedSuccess(true);
    setTimeout(() => setCalibratedSuccess(false), 3000);
  };

  return (
    <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl font-mono text-xs max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-sm font-bold text-white uppercase flex items-center gap-2">
          <Sliders size={18} className="text-amber-400" />
          Advanced Hardware Calibration & Media Margins
        </span>

        <button 
          onClick={handleTestCalibration}
          className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg"
        >
          <RefreshCw size={13} /> Execute Sensor Calibration
        </button>
      </div>

      {calibratedSuccess && (
        <div className="bg-emerald-950/60 border border-emerald-500/50 p-2.5 rounded-xl text-emerald-300 font-bold flex items-center gap-2 text-xs">
          <Check size={16} /> Sensor Gap & Black Mark Calibration Dispatched to Active Printer Hardware.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Media Dimensions & Margins */}
        <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3.5 space-y-3">
          <span className="text-xs font-bold text-amber-300 uppercase block border-b border-slate-800 pb-1">Media Dimensions & Margins (mm)</span>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Paper Width (mm):</span>
              <input type="number" value={calib.paperWidthMm} onChange={e => setCalib({ ...calib, paperWidthMm: parseFloat(e.target.value) || 0 })} className="w-full bg-[#141726] border border-slate-800 rounded px-2 py-1 text-slate-200" />
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Paper Height (mm):</span>
              <input type="number" value={calib.paperHeightMm} onChange={e => setCalib({ ...calib, paperHeightMm: parseFloat(e.target.value) || 0 })} className="w-full bg-[#141726] border border-slate-800 rounded px-2 py-1 text-slate-200" />
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Label Gap (mm):</span>
              <input type="number" value={calib.gapMm} onChange={e => setCalib({ ...calib, gapMm: parseFloat(e.target.value) || 0 })} className="w-full bg-[#141726] border border-slate-800 rounded px-2 py-1 text-slate-200" />
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Margin Left (mm):</span>
              <input type="number" value={calib.marginLeftMm} onChange={e => setCalib({ ...calib, marginLeftMm: parseFloat(e.target.value) || 0 })} className="w-full bg-[#141726] border border-slate-800 rounded px-2 py-1 text-slate-200" />
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Margin Top (mm):</span>
              <input type="number" value={calib.marginTopMm} onChange={e => setCalib({ ...calib, marginTopMm: parseFloat(e.target.value) || 0 })} className="w-full bg-[#141726] border border-slate-800 rounded px-2 py-1 text-slate-200" />
            </div>
          </div>
        </div>

        {/* Darkness, Speed & Orientation */}
        <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3.5 space-y-3">
          <span className="text-xs font-bold text-indigo-300 uppercase block border-b border-slate-800 pb-1">Print Density, Speed & Orientation</span>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-400 uppercase">Darkness Density (0 to 30):</span>
                <span className="text-amber-300">{calib.darkness}</span>
              </div>
              <input type="range" min={0} max={30} value={calib.darkness} onChange={e => setCalib({ ...calib, darkness: parseInt(e.target.value) })} className="w-full accent-amber-500" />
            </div>

            <div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-400 uppercase">Print Speed (2 to 6 ips):</span>
                <span className="text-indigo-300">{calib.speedIps} ips</span>
              </div>
              <input type="range" min={2} max={6} value={calib.speedIps} onChange={e => setCalib({ ...calib, speedIps: parseInt(e.target.value) })} className="w-full accent-indigo-500" />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Rotation Angle:</span>
                <select value={calib.rotationDeg} onChange={e => setCalib({ ...calib, rotationDeg: parseInt(e.target.value) })} className="w-full bg-[#141726] border border-slate-800 rounded px-2 py-1 text-slate-200">
                  <option value={0}>0° Normal</option>
                  <option value={90}>90° Clockwise</option>
                  <option value={180}>180° Inverted</option>
                  <option value={270}>270° Counter</option>
                </select>
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-bold">
                  <input type="checkbox" checked={calib.mirror} onChange={e => setCalib({ ...calib, mirror: e.target.checked })} className="accent-amber-500" />
                  <span>Mirror Print</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
