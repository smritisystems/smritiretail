/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Delegating LoginScreen Facade
 * File         : src/components/LoginScreen.tsx
 */

import React from "react";
import { LoginPage } from "../features/auth/components/LoginPage";

interface LoginScreenProps {
  onLoginSuccess: (user: {
    role: string;
    name: string;
    passwordResetRequired?: boolean;
    companyId?: string;
    branchId?: string;
  }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  return <LoginPage onLoginSuccess={onLoginSuccess} />;
};
