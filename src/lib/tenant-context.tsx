import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { AppRole, Permission } from "@/lib/permissions";
import { can } from "@/lib/permissions";

export type TenantMembership = {
  tenantId: string;
  name: string;
  slug: string;
  industry: string;
  isDemo: boolean;
  defaultCurrency: string;
  aiAutonomy: string;
  role: AppRole;
};

type TenantState = {
  memberships: TenantMembership[];
  currentTenant: TenantMembership | null;
  role: AppRole | null;
  loading: boolean;
  switchTenant: (tenantId: string) => void;
  refresh: () => void;
  allows: (permission: Permission) => boolean;
};

const STORAGE_KEY = "salesos.tenant";

const TenantContext = createContext<TenantState>({
  memberships: [],
  currentTenant: null,
  role: null,
  loading: true,
  switchTenant: () => {},
  refresh: () => {},
  allows: () => false,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(localStorage.getItem(STORAGE_KEY));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TenantMembership[]> => {
      const { data, error } = await supabase
        .from("memberships")
        .select("role, status, tenant_id, tenants(id, name, slug, industry, is_demo, default_currency, ai_autonomy)")
        .eq("status", "active");
      if (error) throw error;
      return (data ?? [])
        .filter((row) => row.tenants)
        .map((row) => ({
          tenantId: row.tenant_id,
          name: row.tenants!.name,
          slug: row.tenants!.slug,
          industry: row.tenants!.industry,
          isDemo: row.tenants!.is_demo,
          defaultCurrency: row.tenants!.default_currency,
          aiAutonomy: row.tenants!.ai_autonomy,
          role: row.role as AppRole,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const memberships = useMemo(() => data ?? [], [data]);
  const currentTenant =
    memberships.find((m) => m.tenantId === selected) ?? memberships[0] ?? null;

  const switchTenant = useCallback((tenantId: string) => {
    localStorage.setItem(STORAGE_KEY, tenantId);
    setSelected(tenantId);
  }, []);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["memberships"] });
  }, [queryClient]);

  const role = currentTenant?.role ?? null;

  return (
    <TenantContext.Provider
      value={{
        memberships,
        currentTenant,
        role,
        loading: isLoading,
        switchTenant,
        refresh,
        allows: (permission) => can(role, permission),
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
