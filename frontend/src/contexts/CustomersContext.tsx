// src/contexts/CustomersContext.tsx (STANDARDIZED)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface CustomerContact {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
  is_technical: boolean;
  is_billing: boolean;
  notification_preferences?: {
    incidents: boolean;
    maintenance: boolean;
    billing: boolean;
    marketing: boolean;
  };
}

export interface CustomerSLA {
  uptime_target: number;
  response_time_target_minutes: number;
  resolution_time_target_hours: number;
  availability_window: string; // "24x7", "business_hours", etc.
  penalty_rate?: number;
  credits_eligible?: boolean;
  escalation_matrix?: Array<{
    level: number;
    timeframe_minutes: number;
    contact_roles: string[];
  }>;
}

export interface Customer {
  id: string;
  name: string;
  description?: string;
  industry?: string; // config-driven
  region?: string;   // config-driven
  tier: string;      // config-driven
  created_at: string;
  updated_at: string;

  // Relationships
  end_user_ids: string[];
  business_service_ids: string[];
  contract_ids: string[];
  account_manager_user_id?: string;
  customer_success_manager_id?: string;
  technical_account_manager_id?: string;

  // Contact Management
  contacts: CustomerContact[];
  primary_contact_id?: string;
  billing_contact_id?: string;
  technical_contact_id?: string;

  // Business & Financial
  sla_level?: string; // config-driven
  annual_contract_value?: number;
  monthly_recurring_revenue?: number;
  penalty_costs_incurred?: number;
  currency?: string;
  payment_terms?: string;
  billing_frequency?: "monthly" | "quarterly" | "annually";

  // Customer Success & Health
  health_score?: number; // 0-100
  satisfaction_score?: number; // 1-10
  net_promoter_score?: number; // -100 to 100
  last_survey_date?: string;
  renewal_date?: string;
  renewal_probability?: number; // 0-100
  churn_risk?: "low" | "medium" | "high" | "critical";

  // Service Level Agreements
  sla_details?: CustomerSLA;
  current_sla_compliance?: number; // percentage
  sla_breach_count_30d?: number;
  last_sla_breach?: string;

  // Support Metrics
  ticket_count_30d?: number;
  average_resolution_time_hours?: number;
  escalation_count_30d?: number;
  satisfaction_rating_avg?: number; // 1-5

  // Engagement & Usage
  last_login_date?: string;
  active_users_count?: number;
  feature_adoption_score?: number; // 0-100
  product_usage_trend?: "increasing" | "stable" | "decreasing";

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];
  data_residency_requirements?: string[];
  security_classification?: "standard" | "enhanced" | "premium";

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface CustomersContextType {
  customers: Customer[];
  addCustomer: (cust: Customer, userId?: string) => Promise<void>;
  updateCustomer: (cust: Customer, userId?: string) => Promise<void>;
  deleteCustomer: (id: string, userId?: string) => Promise<void>;
  refreshCustomers: () => Promise<void>;
  getCustomer: (id: string) => Promise<Customer | undefined>;

  // Customer-specific operations
  updateCustomerHealth: (customerId: string, healthData: Partial<Customer>, userId?: string) => Promise<void>;
  addCustomerContact: (customerId: string, contact: CustomerContact, userId?: string) => Promise<void>;
  updateCustomerContact: (customerId: string, contactId: string, updates: Partial<CustomerContact>, userId?: string) => Promise<void>;
  removeCustomerContact: (customerId: string, contactId: string, userId?: string) => Promise<void>;
  updateCustomerSLA: (customerId: string, slaData: CustomerSLA, userId?: string) => Promise<void>;
  calculateCustomerHealth: (customerId: string) => Promise<{ status: string; score: number; factors: string[] }>;
  recordCustomerInteraction: (customerId: string, interaction: { type: string; notes: string }, userId?: string) => Promise<void>;

  // Filtering and querying
  getCustomersByTier: (tier: string) => Customer[];
  getCustomersByRegion: (region: string) => Customer[];
  getCustomersByIndustry: (industry: string) => Customer[];
  getHighValueCustomers: (akvThreshold?: number) => Customer[];
  getAtRiskCustomers: (riskLevel?: Customer['churn_risk']) => Customer[];
  getCustomersWithSLABreaches: () => Customer[];
  getCustomersDueForRenewal: (daysAhead?: number) => Customer[];
  getInactiveCustomers: (daysThreshold?: number) => Customer[];
  searchCustomers: (query: string) => Customer[];

  // Analytics
  getCustomerRevenueStats: () => {
    totalACV: number;
    totalMRR: number;
    averageACV: number;
    averageMRR: number;
    revenueByTier: Record<string, number>;
    revenueByRegion: Record<string, number>;
    revenueGrowthRate: number;
  };

  getCustomerHealthStats: () => {
    averageHealthScore: number;
    averageSatisfactionScore: number;
    averageNPS: number;
    healthyCustomers: number;
    atRiskCustomers: number;
    churnPrediction: number;
    renewalRate: number;
  };

  getCustomerSupportStats: () => {
    averageResolutionTime: number;
    totalTickets30d: number;
    averageSatisfactionRating: number;
    slaComplianceRate: number;
    escalationRate: number;
  };

  // Config integration
  config: {
    tiers: string[];
    industries: string[];
    regions: string[];
    sla_levels: string[];
    currencies: string[];
    payment_terms: string[];
  };
}

const CustomersContext = createContext<CustomersContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const CustomersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Extract customer-specific config from global config
  const config = {
    tiers: globalConfig?.business?.customers?.tiers || 
           ['enterprise', 'premium', 'standard', 'starter'],
    industries: globalConfig?.business?.customers?.industries || 
                ['technology', 'financial_services', 'healthcare', 'manufacturing', 'retail', 'education'],
    regions: globalConfig?.business?.customers?.regions || 
             ['north_america', 'europe', 'asia_pacific', 'latin_america', 'africa', 'middle_east'],
    sla_levels: globalConfig?.business?.customers?.sla_levels || 
                ['platinum', 'gold', 'silver', 'bronze'],
    currencies: globalConfig?.business?.customers?.currencies || 
                ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
    payment_terms: ['net_15', 'net_30', 'net_45', 'net_60', 'prepaid', 'custom'],
  };

  const validateCustomer = useCallback((cust: Customer) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate tier
    if (!config.tiers.includes(cust.tier)) {
      throw new Error(`Invalid customer tier: ${cust.tier}. Valid options: ${config.tiers.join(', ')}`);
    }

    // Validate industry if provided
    if (cust.industry && !config.industries.includes(cust.industry)) {
      throw new Error(`Invalid industry: ${cust.industry}. Valid options: ${config.industries.join(', ')}`);
    }

    // Validate region if provided
    if (cust.region && !config.regions.includes(cust.region)) {
      throw new Error(`Invalid region: ${cust.region}. Valid options: ${config.regions.join(', ')}`);
    }

    // Validate SLA level if provided
    if (cust.sla_level && !config.sla_levels.includes(cust.sla_level)) {
      throw new Error(`Invalid SLA level: ${cust.sla_level}. Valid options: ${config.sla_levels.join(', ')}`);
    }

    // Validate currency if provided
    if (cust.currency && !config.currencies.includes(cust.currency)) {
      throw new Error(`Invalid currency: ${cust.currency}. Valid options: ${config.currencies.join(', ')}`);
    }

    // Validate required fields
    if (!cust.name || cust.name.trim().length < 2) {
      throw new Error("Customer name must be at least 2 characters long");
    }

    // Validate financial values
    if (cust.annual_contract_value !== undefined && cust.annual_contract_value < 0) {
      throw new Error("Annual contract value must be a positive number");
    }

    if (cust.monthly_recurring_revenue !== undefined && cust.monthly_recurring_revenue < 0) {
      throw new Error("Monthly recurring revenue must be a positive number");
    }

    // Validate score ranges
    if (cust.health_score !== undefined && (cust.health_score < 0 || cust.health_score > 100)) {
      throw new Error("Health score must be between 0 and 100");
    }

    if (cust.satisfaction_score !== undefined && (cust.satisfaction_score < 1 || cust.satisfaction_score > 10)) {
      throw new Error("Satisfaction score must be between 1 and 10");
    }

    if (cust.net_promoter_score !== undefined && (cust.net_promoter_score < -100 || cust.net_promoter_score > 100)) {
      throw new Error("Net Promoter Score must be between -100 and 100");
    }

    if (cust.renewal_probability !== undefined && (cust.renewal_probability < 0 || cust.renewal_probability > 100)) {
      throw new Error("Renewal probability must be between 0 and 100");
    }

    // Validate contacts
    if (cust.contacts) {
      cust.contacts.forEach((contact, index) => {
        if (!contact.name || contact.name.trim().length < 2) {
          throw new Error(`Contact at index ${index} must have a name of at least 2 characters`);
        }
        if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
          throw new Error(`Contact at index ${index} has invalid email format`);
        }
      });

      // Check for multiple primary contacts
      const primaryContacts = cust.contacts.filter(c => c.is_primary);
      if (primaryContacts.length > 1) {
        throw new Error("Only one contact can be marked as primary");
      }
    }

    // Validate SLA details
    if (cust.sla_details) {
      if (cust.sla_details.uptime_target < 0 || cust.sla_details.uptime_target > 100) {
        throw new Error("SLA uptime target must be between 0 and 100 percent");
      }
      if (cust.sla_details.response_time_target_minutes < 0) {
        throw new Error("SLA response time target must be a positive number");
      }
      if (cust.sla_details.resolution_time_target_hours < 0) {
        throw new Error("SLA resolution time target must be a positive number");
      }
    }
  }, [globalConfig, config]);

  const ensureMetadata = useCallback((cust: Customer): Customer => {
    const now = new Date().toISOString();
    return {
      ...cust,
      tenantId,
      tags: cust.tags || [],
      health_status: cust.health_status || "gray",
      sync_status: cust.sync_status || "dirty",
      synced_at: cust.synced_at || now,
      end_user_ids: cust.end_user_ids || [],
      business_service_ids: cust.business_service_ids || [],
      contract_ids: cust.contract_ids || [],
      compliance_requirement_ids: cust.compliance_requirement_ids || [],
      contacts: cust.contacts || [],
      data_residency_requirements: cust.data_residency_requirements || [],
      churn_risk: cust.churn_risk || "low",
      security_classification: cust.security_classification || "standard",
      billing_frequency: cust.billing_frequency || "monthly",
    };
  }, [tenantId]);

  const refreshCustomers = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<Customer>(tenantId, "customers");
      
      // Sort by tier, ACV, and health status
      all.sort((a, b) => {
        // Enterprise tier first
        const tierOrder = { enterprise: 4, premium: 3, standard: 2, starter: 1 };
        const aTier = tierOrder[a.tier as keyof typeof tierOrder] || 0;
        const bTier = tierOrder[b.tier as keyof typeof tierOrder] || 0;
        if (aTier !== bTier) return bTier - aTier;
        
        // Higher ACV first
        const aACV = a.annual_contract_value || 0;
        const bACV = b.annual_contract_value || 0;
        if (aACV !== bACV) return bACV - aACV;
        
        // Health status priority (red/at-risk first for attention)
        const healthOrder = { red: 5, orange: 4, yellow: 3, green: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      setCustomers(all);
    } catch (error) {
      console.error("Failed to refresh customers:", error);
    }
  }, [tenantId]);

  const getCustomer = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<Customer>(tenantId, "customers", id);
  }, [tenantId]);

  const addCustomer = useCallback(async (cust: Customer, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateCustomer(cust);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...cust,
      created_at: now,
      updated_at: now,
    });

    const priority = cust.tier === 'enterprise' ? 'high' : 
                    cust.tier === 'premium' ? 'normal' : 'normal';

    await putWithAudit(
      tenantId,
      "customers",
      enriched,
      userId,
      {
        action: "create",
        description: `Created customer: ${cust.name}`,
        tags: ["customer", "create", cust.tier, cust.industry || "unspecified"],
        metadata: {
          tier: cust.tier,
          industry: cust.industry,
          region: cust.region,
          annual_contract_value: cust.annual_contract_value,
          contact_count: cust.contacts.length,
        },
      }
    );

    await enqueueItem({
      storeName: "customers",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority,
    });

    await refreshCustomers();
  }, [tenantId, validateCustomer, ensureMetadata, enqueueItem, refreshCustomers]);

  const updateCustomer = useCallback(async (cust: Customer, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateCustomer(cust);

    const enriched = ensureMetadata({
      ...cust,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "customers",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated customer: ${cust.name}`,
        tags: ["customer", "update", cust.tier],
        metadata: {
          tier: cust.tier,
          health_score: cust.health_score,
          churn_risk: cust.churn_risk,
        },
      }
    );

    await enqueueItem({
      storeName: "customers",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
    });

    await refreshCustomers();
  }, [tenantId, validateCustomer, ensureMetadata, enqueueItem, refreshCustomers]);

  const deleteCustomer = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const customer = await getCustomer(id);
    if (!customer) throw new Error(`Customer ${id} not found`);

    await removeWithAudit(
      tenantId,
      "customers",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted customer: ${customer.name}`,
        tags: ["customer", "delete", customer.tier],
        metadata: {
          tier: customer.tier,
          annual_contract_value: customer.annual_contract_value,
        },
      }
    );

    await enqueueItem({
      storeName: "customers",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshCustomers();
  }, [tenantId, getCustomer, enqueueItem, refreshCustomers]);

  // Customer-specific operations
  const updateCustomerHealth = useCallback(async (customerId: string, healthData: Partial<Customer>, userId?: string) => {
    const customer = await getCustomer(customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const updated = { ...customer, ...healthData };
    await updateCustomer(updated, userId);
  }, [getCustomer, updateCustomer]);

  const addCustomerContact = useCallback(async (customerId: string, contact: CustomerContact, userId?: string) => {
    const customer = await getCustomer(customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    // Generate ID for new contact
    const newContact = { ...contact, id: contact.id || crypto.randomUUID() };
    const updatedContacts = [...customer.contacts, newContact];
    const updated = { ...customer, contacts: updatedContacts };

    await updateCustomer(updated, userId);
  }, [getCustomer, updateCustomer]);

  const updateCustomerContact = useCallback(async (customerId: string, contactId: string, updates: Partial<CustomerContact>, userId?: string) => {
    const customer = await getCustomer(customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const updatedContacts = customer.contacts.map(contact =>
      contact.id === contactId ? { ...contact, ...updates } : contact
    );
    const updated = { ...customer, contacts: updatedContacts };

    await updateCustomer(updated, userId);
  }, [getCustomer, updateCustomer]);

  const removeCustomerContact = useCallback(async (customerId: string, contactId: string, userId?: string) => {
    const customer = await getCustomer(customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const updatedContacts = customer.contacts.filter(contact => contact.id !== contactId);
    const updated = { ...customer, contacts: updatedContacts };

    await updateCustomer(updated, userId);
  }, [getCustomer, updateCustomer]);

  const updateCustomerSLA = useCallback(async (customerId: string, slaData: CustomerSLA, userId?: string) => {
    const customer = await getCustomer(customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const updated = { ...customer, sla_details: slaData };
    await updateCustomer(updated, userId);
  }, [getCustomer, updateCustomer]);

  const calculateCustomerHealth = useCallback(async (customerId: string) => {
    const customer = await getCustomer(customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    // Calculate health score based on various factors
    let score = customer.health_score || 70; // Default baseline
    const factors: string[] = [];

    // Satisfaction score factor
    if (customer.satisfaction_score !== undefined) {
      if (customer.satisfaction_score < 6) {
        score -= (6 - customer.satisfaction_score) * 8;
        factors.push(`Low satisfaction: ${customer.satisfaction_score}/10`);
      } else if (customer.satisfaction_score >= 8) {
        score += (customer.satisfaction_score - 8) * 5;
        factors.push(`High satisfaction: ${customer.satisfaction_score}/10`);
      }
    }

    // SLA compliance factor
    if (customer.current_sla_compliance !== undefined) {
      if (customer.current_sla_compliance < 95) {
        score -= (95 - customer.current_sla_compliance) * 0.5;
        factors.push(`SLA compliance below target: ${customer.current_sla_compliance}%`);
      }
    }

    // Support ticket volume factor
    if (customer.ticket_count_30d !== undefined && customer.ticket_count_30d > 10) {
      score -= Math.min(15, (customer.ticket_count_30d - 10) * 1.5);
      factors.push(`High support volume: ${customer.ticket_count_30d} tickets in 30 days`);
    }

    // Churn risk factor
    if (customer.churn_risk) {
      const churnPenalty = { low: 0, medium: -10, high: -20, critical: -30 };
      score += churnPenalty[customer.churn_risk];
      if (customer.churn_risk !== 'low') {
        factors.push(`Churn risk: ${customer.churn_risk}`);
      }
    }

    // Usage trend factor
    if (customer.product_usage_trend === 'decreasing') {
      score -= 15;
      factors.push('Decreasing product usage');
    } else if (customer.product_usage_trend === 'increasing') {
      score += 10;
      factors.push('Increasing product usage');
    }

    // Determine status based on score
    let status: string;
    if (score >= 80) status = 'green';
    else if (score >= 65) status = 'yellow';
    else if (score >= 50) status = 'orange';
    else status = 'red';

    return { status, score: Math.max(0, Math.min(100, score)), factors };
  }, [getCustomer]);

  const recordCustomerInteraction = useCallback(async (customerId: string, interaction: { type: string; notes: string }, userId?: string) => {
    const customer = await getCustomer(customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const interactionRecord = {
      type: interaction.type,
      notes: interaction.notes,
      timestamp: new Date().toISOString(),
      user_id: userId,
    };

    const updated = {
      ...customer,
      custom_fields: {
        ...customer.custom_fields,
        interactions: [
          ...(customer.custom_fields?.interactions || []),
          interactionRecord
        ].slice(-50) // Keep only last 50 interactions
      }
    };

    await updateCustomer(updated, userId);
  }, [getCustomer, updateCustomer]);

  // Filtering functions
  const getCustomersByTier = useCallback((tier: string) => {
    return customers.filter(c => c.tier === tier);
  }, [customers]);

  const getCustomersByRegion = useCallback((region: string) => {
    return customers.filter(c => c.region === region);
  }, [customers]);

  const getCustomersByIndustry = useCallback((industry: string) => {
    return customers.filter(c => c.industry === industry);
  }, [customers]);

  const getHighValueCustomers = useCallback((akvThreshold: number = 100000) => {
    return customers.filter(c => 
      (c.annual_contract_value && c.annual_contract_value >= akvThreshold) ||
      c.tier === 'enterprise'
    );
  }, [customers]);

  const getAtRiskCustomers = useCallback((riskLevel: Customer['churn_risk'] = 'medium') => {
    const riskLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const threshold = riskLevels[riskLevel];
    
    return customers.filter(c => {
      const customerRisk = riskLevels[c.churn_risk || 'low'];
      return customerRisk >= threshold ||
             c.health_status === 'red' ||
             (c.satisfaction_score && c.satisfaction_score < 6) ||
             (c.renewal_probability && c.renewal_probability < 70);
    });
  }, [customers]);

  const getCustomersWithSLABreaches = useCallback(() => {
    return customers.filter(c => 
      (c.sla_breach_count_30d && c.sla_breach_count_30d > 0) ||
      (c.current_sla_compliance && c.current_sla_compliance < 95)
    );
  }, [customers]);

  const getCustomersDueForRenewal = useCallback((daysAhead: number = 90) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
    
    return customers.filter(c => {
      if (!c.renewal_date) return false;
      const renewalDate = new Date(c.renewal_date);
      return renewalDate >= now && renewalDate <= futureDate;
    });
  }, [customers]);

  const getInactiveCustomers = useCallback((daysThreshold: number = 30) => {
    const cutoffDate = new Date(Date.now() - (daysThreshold * 24 * 60 * 60 * 1000));
    
    return customers.filter(c => {
      if (!c.last_login_date) return true;
      return new Date(c.last_login_date) < cutoffDate;
    });
  }, [customers]);

  const searchCustomers = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(lowerQuery) ||
      c.description?.toLowerCase().includes(lowerQuery) ||
      c.industry?.toLowerCase().includes(lowerQuery) ||
      c.tier.toLowerCase().includes(lowerQuery) ||
      c.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      c.contacts.some(contact => 
        contact.name.toLowerCase().includes(lowerQuery) ||
        contact.email?.toLowerCase().includes(lowerQuery)
      )
    );
  }, [customers]);

  // Analytics functions
  const getCustomerRevenueStats = useCallback(() => {
    const customersWithACV = customers.filter(c => c.annual_contract_value && c.annual_contract_value > 0);
    const customersWithMRR = customers.filter(c => c.monthly_recurring_revenue && c.monthly_recurring_revenue > 0);

    const totalACV = customersWithACV.reduce((sum, c) => sum + (c.annual_contract_value || 0), 0);
    const totalMRR = customersWithMRR.reduce((sum, c) => sum + (c.monthly_recurring_revenue || 0), 0);
    
    const averageACV = customersWithACV.length > 0 ? totalACV / customersWithACV.length : 0;
    const averageMRR = customersWithMRR.length > 0 ? totalMRR / customersWithMRR.length : 0;

    const revenueByTier = customers.reduce((acc, c) => {
      if (c.annual_contract_value) {
        acc[c.tier] = (acc[c.tier] || 0) + c.annual_contract_value;
      }
      return acc;
    }, {} as Record<string, number>);

    const revenueByRegion = customers.reduce((acc, c) => {
      if (c.annual_contract_value && c.region) {
        acc[c.region] = (acc[c.region] || 0) + c.annual_contract_value;
      }
      return acc;
    }, {} as Record<string, number>);

    // Simple growth calculation (would typically be historical)
    const revenueGrowthRate = 15; // Mock 15% growth

    return {
      totalACV,
      totalMRR,
      averageACV,
      averageMRR,
      revenueByTier,
      revenueByRegion,
      revenueGrowthRate,
    };
  }, [customers]);

  const getCustomerHealthStats = useCallback(() => {
    const customersWithHealth = customers.filter(c => c.health_score !== undefined);
    const customersWithSat = customers.filter(c => c.satisfaction_score !== undefined);
    const customersWithNPS = customers.filter(c => c.net_promoter_score !== undefined);

    const averageHealthScore = customersWithHealth.length > 0
      ? customersWithHealth.reduce((sum, c) => sum + (c.health_score || 0), 0) / customersWithHealth.length
      : 0;

    const averageSatisfactionScore = customersWithSat.length > 0
      ? customersWithSat.reduce((sum, c) => sum + (c.satisfaction_score || 0), 0) / customersWithSat.length
      : 0;

    const averageNPS = customersWithNPS.length > 0
      ? customersWithNPS.reduce((sum, c) => sum + (c.net_promoter_score || 0), 0) / customersWithNPS.length
      : 0;

    const healthyCustomers = customers.filter(c => 
      c.health_status === 'green' || 
      (c.health_score && c.health_score >= 75)
    ).length;

    const atRiskCustomers = customers.filter(c => 
      c.churn_risk === 'high' || c.churn_risk === 'critical' ||
      c.health_status === 'red' ||
      (c.health_score && c.health_score < 50)
    ).length;

    const customersWithRenewalProb = customers.filter(c => c.renewal_probability !== undefined);
    const renewalRate = customersWithRenewalProb.length > 0
      ? customersWithRenewalProb.reduce((sum, c) => sum + (c.renewal_probability || 0), 0) / customersWithRenewalProb.length
      : 0;

    const churnPrediction = 100 - renewalRate;

    return {
      averageHealthScore,
      averageSatisfactionScore,
      averageNPS,
      healthyCustomers,
      atRiskCustomers,
      churnPrediction,
      renewalRate,
    };
  }, [customers]);

  const getCustomerSupportStats = useCallback(() => {
    const customersWithResolutionTime = customers.filter(c => c.average_resolution_time_hours !== undefined);
    const customersWithTickets = customers.filter(c => c.ticket_count_30d !== undefined);
    const customersWithRating = customers.filter(c => c.satisfaction_rating_avg !== undefined);
    const customersWithSLA = customers.filter(c => c.current_sla_compliance !== undefined);
    const customersWithEscalations = customers.filter(c => c.escalation_count_30d !== undefined);

    const averageResolutionTime = customersWithResolutionTime.length > 0
      ? customersWithResolutionTime.reduce((sum, c) => sum + (c.average_resolution_time_hours || 0), 0) / customersWithResolutionTime.length
      : 0;

    const totalTickets30d = customersWithTickets.reduce((sum, c) => sum + (c.ticket_count_30d || 0), 0);

    const averageSatisfactionRating = customersWithRating.length > 0
      ? customersWithRating.reduce((sum, c) => sum + (c.satisfaction_rating_avg || 0), 0) / customersWithRating.length
      : 0;

    const slaComplianceRate = customersWithSLA.length > 0
      ? customersWithSLA.reduce((sum, c) => sum + (c.current_sla_compliance || 0), 0) / customersWithSLA.length
      : 0;

    const totalEscalations = customersWithEscalations.reduce((sum, c) => sum + (c.escalation_count_30d || 0), 0);
    const escalationRate = totalTickets30d > 0 ? (totalEscalations / totalTickets30d) * 100 : 0;

    return {
      averageResolutionTime,
      totalTickets30d,
      averageSatisfactionRating,
      slaComplianceRate,
      escalationRate,
    };
  }, [customers]);

  // Initialize when tenant and config are ready
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshCustomers();
    }
  }, [tenantId, globalConfig, refreshCustomers]);

  return (
    <CustomersContext.Provider
      value={{
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        refreshCustomers,
        getCustomer,
        updateCustomerHealth,
        addCustomerContact,
        updateCustomerContact,
        removeCustomerContact,
        updateCustomerSLA,
        calculateCustomerHealth,
        recordCustomerInteraction,
        getCustomersByTier,
        getCustomersByRegion,
        getCustomersByIndustry,
        getHighValueCustomers,
        getAtRiskCustomers,
        getCustomersWithSLABreaches,
        getCustomersDueForRenewal,
        getInactiveCustomers,
        searchCustomers,
        getCustomerRevenueStats,
        getCustomerHealthStats,
        getCustomerSupportStats,
        config,
      }}
    >
      {children}
    </CustomersContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useCustomers = () => {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used within CustomersProvider");
  return ctx;
};

export const useCustomerDetails = (id: string) => {
  const { customers } = useCustomers();
  return customers.find((c) => c.id === id) || null;
};

// Utility hooks
export const useHighValueCustomers = () => {
  const { getHighValueCustomers } = useCustomers();
  return getHighValueCustomers();
};

export const useAtRiskCustomers = () => {
  const { getAtRiskCustomers } = useCustomers();
  return getAtRiskCustomers();
};

export const useCustomerRevenueStats = () => {
  const { getCustomerRevenueStats } = useCustomers();
  return getCustomerRevenueStats();
};

export const useCustomerHealthStats = () => {
  const { getCustomerHealthStats } = useCustomers();
  return getCustomerHealthStats();
};

export const useCustomerHealth = (customerId: string) => {
  const { calculateCustomerHealth } = useCustomers();
  const [health, setHealth] = useState<{ status: string; score: number; factors: string[] } | null>(null);

  useEffect(() => {
    if (customerId) {
      calculateCustomerHealth(customerId)
        .then(setHealth)
        .catch(console.error);
    }
  }, [customerId, calculateCustomerHealth]);

  return health;
};