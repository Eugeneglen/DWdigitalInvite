'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCMSStore } from '@/store/useCMSStore';
import { GLOBAL_FEATURE_LABELS, FEATURE_LABELS, FEATURE_KEYS } from '@/lib/constants';

// --- Types ---

interface GlobalFeature {
  id: string;
  featureKey: string;
  enabled: boolean;
  description?: string;
}

interface TenantFeature {
  id: string;
  tenantId: string;
  featureKey: string;
  enabled: boolean;
}

interface TenantOption {
  id: string;
  name: string;
}

const ALL_EVENT_FEATURES = Object.values(FEATURE_KEYS) as string[];

export default function CMSFeatures() {
  const authUser = useCMSStore((s) => s.authUser);

  // Global features state
  const [globalFeatures, setGlobalFeatures] = useState<GlobalFeature[]>([]);
  const [globalLoading, setGlobalLoading] = useState(true);

  // Tenant features state
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenantFeatures, setTenantFeatures] = useState<TenantFeature[]>([]);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const fetchGlobalFeatures = useCallback(async () => {
    setGlobalLoading(true);
    try {
      const res = await fetch('/api/cms/features/global', {
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setGlobalFeatures(data.data);
      }
    } catch {
      // silently handle
    } finally {
      setGlobalLoading(false);
    }
  }, [authUser?.token]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/cms/tenants?limit=100', {
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTenants(data.data.tenants.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      }
    } catch {
      // silently handle
    }
  }, [authUser?.token]);

  const fetchTenantFeatures = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setTenantFeatures([]);
      return;
    }
    setTenantLoading(true);
    try {
      const res = await fetch(`/api/cms/tenants/${tenantId}/features`, {
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTenantFeatures(data.data);
      }
    } catch {
      // silently handle
    } finally {
      setTenantLoading(false);
    }
  }, [authUser?.token]);

  useEffect(() => {
    fetchGlobalFeatures();
    fetchTenants();
  }, [fetchGlobalFeatures, fetchTenants]);

  useEffect(() => {
    fetchTenantFeatures(selectedTenantId);
  }, [selectedTenantId, fetchTenantFeatures]);

  const handleGlobalToggle = async (feature: GlobalFeature) => {
    setTogglingKey(feature.featureKey);
    try {
      const res = await fetch('/api/cms/features/global', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authUser?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          featureKey: feature.featureKey,
          enabled: !feature.enabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGlobalFeatures((prev) =>
          prev.map((f) =>
            f.id === feature.id ? { ...f, enabled: !f.enabled } : f
          )
        );
        toast.success(`${GLOBAL_FEATURE_LABELS[feature.featureKey] || feature.featureKey} ${!feature.enabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleTenantToggle = async (feature: TenantFeature) => {
    setTogglingKey(`tenant-${feature.featureKey}`);
    try {
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/features`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authUser?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          featureKey: feature.featureKey,
          enabled: !feature.enabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTenantFeatures((prev) =>
          prev.map((f) =>
            f.id === feature.id ? { ...f, enabled: !f.enabled } : f
          )
        );
        toast.success(`${FEATURE_LABELS[feature.featureKey] || feature.featureKey} ${!feature.enabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setTogglingKey(null);
    }
  };

  const isToggling = (key: string) => togglingKey === key;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-charcoal-ink">Feature Flags</h1>

      {/* Global Features */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal-ink">Platform Features</h2>
          <p className="text-xs text-gray-500 mt-0.5">Global toggles that affect the entire platform.</p>
        </div>

        <div className="divide-y divide-gray-100">
          {globalLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))
          ) : globalFeatures.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No global features configured.
            </div>
          ) : (
            globalFeatures.map((feature) => (
              <div
                key={feature.id}
                className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="min-w-0">
                  <Label className="text-sm font-medium text-charcoal-ink cursor-pointer" htmlFor={`global-${feature.featureKey}`}>
                    {GLOBAL_FEATURE_LABELS[feature.featureKey] || feature.featureKey}
                  </Label>
                  {feature.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{feature.description}</p>
                  )}
                </div>
                <Switch
                  id={`global-${feature.featureKey}`}
                  checked={feature.enabled}
                  disabled={isToggling(feature.featureKey)}
                  onCheckedChange={() => handleGlobalToggle(feature)}
                  className="flex-shrink-0"
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tenant Features */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-charcoal-ink">Tenant Feature Flags</h2>
              <p className="text-xs text-gray-500 mt-0.5">Manage event features per tenant.</p>
            </div>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger className="w-full sm:w-64 h-9 border-gray-300">
                <SelectValue placeholder="Select a tenant..." />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!selectedTenantId ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Select a tenant to view and manage their feature flags.
          </div>
        ) : tenantLoading ? (
          <div className="divide-y divide-gray-100">
            {ALL_EVENT_FEATURES.map((key) => (
              <div key={key} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {ALL_EVENT_FEATURES.map((key) => {
              const feature = tenantFeatures.find((f) => f.featureKey === key);
              const enabled = feature ? feature.enabled : true;
              const featureId = feature?.id || `new-${key}`;

              return (
                <div
                  key={key}
                  className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-charcoal-ink cursor-pointer" htmlFor={`tenant-${key}`}>
                      {FEATURE_LABELS[key] || key}
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{key}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 hidden sm:inline-flex ${
                        enabled
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                    >
                      {enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Switch
                      id={`tenant-${key}`}
                      checked={enabled}
                      disabled={isToggling(`tenant-${key}`)}
                      onCheckedChange={() =>
                        handleTenantToggle({
                          id: featureId,
                          tenantId: selectedTenantId,
                          featureKey: key,
                          enabled,
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}