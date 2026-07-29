/**
 * Project      : SMRITI Business OS
 * Component    : SEDSWizard (SMRITI Enterprise Design System Multi-Step Wizard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Core Component
 */

import React from "react";
import { Check, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

export interface SEDSPageStep {
  id: number;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
}

export interface SEDSWizardProps {
  steps: SEDSPageStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  onComplete?: () => void;
  isNextDisabled?: boolean;
  isSubmitting?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  completeLabel?: string;
  children: React.ReactNode;
}

export const SEDSWizard: React.FC<SEDSWizardProps> = ({
  steps,
  currentStep,
  onStepClick,
  onNext,
  onPrev,
  onComplete,
  isNextDisabled = false,
  isSubmitting = false,
  nextLabel = "Next",
  prevLabel = "Back",
  completeLabel = "Complete Setup",
  children,
}) => {
  const isLastStep = currentStep === steps.length;

  return (
    <div className="w-full h-full flex flex-col bg-theme-base font-sans select-text">
      {/* Top Visual Stepper Header */}
      <div className="w-full bg-theme-surface-1 border-b border-theme-divider px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-950 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-theme-body tracking-tight">
                {steps[currentStep - 1]?.title || "Enterprise Setup Wizard"}
              </h2>
              {steps[currentStep - 1]?.subtitle && (
                <p className="text-xs text-theme-muted">{steps[currentStep - 1]?.subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {steps.map((step) => {
              const isPassed = step.id < currentStep;
              const isCurrent = step.id === currentStep;

              return (
                <button
                  key={step.id}
                  disabled={!isPassed && !isCurrent}
                  onClick={() => onStepClick && isPassed && onStepClick(step.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                    isCurrent
                      ? "bg-blue-950/40 border-blue-500 text-blue-400 font-bold shadow-sm"
                      : isPassed
                      ? "bg-theme-surface-2 border-theme-divider text-emerald-400 cursor-pointer hover:border-emerald-500/50"
                      : "bg-theme-surface-2/40 border-theme-divider/40 text-theme-muted/50 cursor-not-allowed"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isPassed
                        ? "bg-emerald-500 text-black"
                        : isCurrent
                        ? "bg-blue-500 text-white"
                        : "bg-theme-surface-3 text-theme-muted"
                    }`}
                  >
                    {isPassed ? <Check size={12} /> : step.id}
                  </div>
                  <span className="whitespace-nowrap">{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 flex flex-col justify-between">
        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl p-6 md:p-8 min-h-[440px]">
          {children}
        </div>

        {/* Footer Navigation Bar */}
        <div className="mt-6 flex items-center justify-between border-t border-theme-divider/60 pt-4">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentStep === 1 || isSubmitting}
            className={`px-5 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
              currentStep === 1 || isSubmitting
                ? "bg-theme-surface-2/40 border-theme-divider/40 text-theme-muted/40 cursor-not-allowed"
                : "bg-theme-surface-2 border-theme-divider text-theme-body hover:bg-theme-surface-hover hover:border-theme-muted"
            }`}
          >
            <ChevronLeft size={16} />
            <span>{prevLabel}</span>
          </button>

          <div className="flex items-center gap-3">
            {!isLastStep ? (
              <button
                type="button"
                onClick={onNext}
                disabled={isNextDisabled || isSubmitting}
                className={`px-6 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition shadow-lg ${
                  isNextDisabled || isSubmitting
                    ? "bg-blue-950/30 border-blue-900/40 text-blue-400/40 cursor-not-allowed"
                    : "bg-blue-600 border-blue-500 text-white hover:bg-blue-500"
                }`}
              >
                <span>{nextLabel}</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                disabled={isSubmitting}
                className="px-8 py-2.5 rounded-xl bg-emerald-600 border border-emerald-500 text-white font-bold text-xs hover:bg-emerald-500 transition shadow-xl flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Provisioning System...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>{completeLabel}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
