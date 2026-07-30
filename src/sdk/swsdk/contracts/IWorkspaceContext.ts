/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Injected Workspace Context Contract (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

export interface IWorkspaceContext {
  organization: {
    companyId: string;
    companyName: string;
    branchId: string;
    branchName: string;
    financialYear: string;
  };
  currentUser: {
    id: string;
    username: string;
    role: string;
    isPlatformAdmin: boolean;
  };
  theme: {
    mode: "dark" | "light";
    primaryColor: string;
  };
  permissions: Set<string>;
  services: Record<string, unknown>;
  events: {
    emit: (eventType: string, payload: unknown) => void;
    subscribe: (eventType: string, handler: (payload: unknown) => void) => () => void;
  };
  navigation: {
    navigate: (route: string, params?: Record<string, unknown>) => void;
    openTab: (tabId: string, params?: Record<string, unknown>) => void;
    closeTab: (tabId: string) => void;
  };
}
