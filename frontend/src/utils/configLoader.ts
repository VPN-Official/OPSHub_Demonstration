import defaultConfig from "./default.json";
import dcnMeta from "./tenant_dcn_meta.json";
import avGoogle from "./tenant_av_google.json";
import sdGates from "./tenant_sd_gates.json";

const TENANT_CONFIGS: Record<string, any> = {
  tenant_dcn_meta: dcnMeta,
  tenant_av_google: avGoogle,
  tenant_sd_gates: sdGates,
};

export const loadConfig = (tenantId: string) => {
  const tenantOverrides = TENANT_CONFIGS[tenantId] || {};
  return {
    ...defaultConfig,
    ...tenantOverrides,
    work: {
      ...defaultConfig.work,
      ...(tenantOverrides.work || {}),
    },
    business: {
      ...defaultConfig.business,
      ...(tenantOverrides.business || {}),
    },
    governance: {
      ...defaultConfig.governance,
      ...(tenantOverrides.governance || {}),
    },
    sla: {
      ...defaultConfig.sla,
      ...(tenantOverrides.sla || {}),
    },
    kpis: [
      ...(defaultConfig.kpis || []),
      ...(tenantOverrides.kpis || []),
    ],
  };
};