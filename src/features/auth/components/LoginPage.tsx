/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Top Level Login Page Container
 * Feature      : src/features/auth/components/LoginPage.tsx
 */

import React from "react";
import { AuthLayout } from "./AuthLayout";
import { LoginCard } from "./LoginCard";
import { User } from "../types/auth.types";

interface LoginPageProps {
  onLoginSuccess: (user: {
    role: string;
    name: string;
    passwordResetRequired?: boolean;
    companyId?: string;
    branchId?: string;
  }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const handleSuccess = (u: User) => {
    onLoginSuccess({
      name: u.name,
      role: u.role,
      companyId: u.companyId,
    });
  };

  return (
    <AuthLayout version="v5.2.0" environment="Production">
      <LoginCard onLoginSuccess={handleSuccess} />
    </AuthLayout>
  );
};
