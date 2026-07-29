/**
 * Project      : SMRITI Business OS
 * Component    : SEDSAvatar (User Avatar & Initials Indicator)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Core Component
 */

import React from "react";

export interface SEDSAvatarProps {
  name: string;
  role?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}

export const SEDSAvatar: React.FC<SEDSAvatarProps> = ({
  name,
  src,
  size = "md",
}) => {
  const getInitials = (str: string) => {
    if (!str) return "U";
    const parts = str.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const sizeClasses = {
    sm: "w-7 h-7 text-[11px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
  };

  return (
    <div
      className={`rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-400/30 flex items-center justify-center font-bold text-white shadow-md font-mono shrink-0 overflow-hidden ${sizeClasses[size]}`}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};
