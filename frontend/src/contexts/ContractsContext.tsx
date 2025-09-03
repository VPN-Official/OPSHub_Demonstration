// src/contexts/ContractsContext.tsx - Frontend UI State Manager
import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useCallback,
  useMemo,
  useRef
} from "react";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Frontend Type Definitions
// ---------------------------------

/**
 * Async state wrapper for UI state management
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  stale: boolean;
}

/**
 * UI-focused Contract interface (mirrors backend but for frontend display)
 */
export interface Contract {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  start_date: string;
  end_date?: string | null;
  renewal_date?: string | null;
  created_at: string;
  updated_at: string;

  // Relationships (IDs only for frontend)
  customer_id?: string | null;
  business_service_ids: string[];
  vendor_id?: string | null;
  cost_center_id?: string | null;
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Contract Terms (backend-calculated)
  auto_renewal: boolean;
  renewal_period_months?: number;
  notice_period_days?: number;
  termination_clauses?: string[];

  // SLA/OLA Terms (backend-managed)
  sla_terms?: ContractSLA;
  sla_penalties?: Array<{
    breach_type: string;
    penalty_amount: number;
    penalty_type: "fixed" | "percentage";
  }>;

  // Milestones & Deliverables (backend-managed)
  milestones: ContractMilestone[];
  key_deliverables: string[];

  // Financial Terms (backend-calculated)
  annual_value?: number;
  total_contract_value?: number;
  currency: string;
  payment_terms?: string;
  payment_schedule?: Array<{
    due_date: string;
    amount: number;
    description: string;
    paid: boolean;
  }>;

  // Performance Tracking (backend-calculated)
  performance_score?: number;
  sla_compliance_rate?: number;
  penalties_incurred?: number;
  credits_issued?: number;

  // Risk & Compliance (backend-managed)
  risk_score?: number;
  compliance_requirement_ids: string[];
  regulatory_requirements?: string[];
  data_processing_clauses?: boolean;
  liability_cap?: number;

  // Legal & Governance (backend-managed)
  governing_law?: string;
  dispute_resolution?: string;
  confidentiality_clauses?: boolean;
  ip_ownership_clauses?: string;
  
  // Approval & Workflow (backend-managed)
  approval_workflow?: Array<{
    step: number;
    approver_user_id: string;
    approved_at?: string;
    rejected_at?: string;
    comments?: string;
  }>;
  legal_review_required?: boolean;
  legal_reviewed_at?: string;
  executed_at?: string;

  // UI Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

export interface ContractSLA {
  uptime_target: number;
  response_time_target: number;
  resolution_time_target: number;
  availability_window: string;
  penalty_per_breach?: number;
  credits_eligible?: boolean;
}

export interface ContractMilestone {
  id: string;
  name: string;
  description?: string;
  target_date: string;
  completion_date?: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  deliverables: string[];
}

/**
 * UI Filters for client-side filtering
 */
export interface ContractUIFilters {
  type?: string;
  status?: string;
  vendorId?: string;
  customerId?: string;
  search?: string;
  showExpired?: boolean;
  showHighValue?: boolean;
}

/**
 * Optimistic update operation
 */
interface OptimisticOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity?: Contract;
  originalEntity?: Contract;
  timestamp: number;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------
interface ContractsContextType {
  // Core async state
  contracts: AsyncState<Contract[]>;
  
  // CRUD Operations (API orchestration only)
  createContract: (contract: Omit<Contract, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateContract: (contract: Contract, userId?: string) => Promise<void>;
  deleteContract: (id: string, userId?: string) => Promise<void>;
  
  // Data fetching
  fetchContracts: (force?: boolean) => Promise<void>;
  fetchContract: (id: string, force?: boolean) => Promise<Contract | null>;
  
  // UI-focused operations (delegate business logic to backend)
  renewContract: (contractId: string, params: { newEndDate: string }, userId?: string) => Promise<void>;
  terminateContract: (contractId: string, params: { terminationDate: string; reason: string }, userId?: string) => Promise<void>;
  updateSLA: (contractId: string, slaTerms: ContractSLA, userId?: string) => Promise<void>;
  recordSLABreach: (contractId: string, breachData: any, userId?: string) => Promise<void>;
  completeMilestone: (contractId: string, milestoneId: string, userId?: string) => Promise<void>;

  // Client-side UI helpers (for immediate responsiveness)
  getFilteredContracts: (filters: ContractUIFilters) => Contract[];
  searchContracts: (query: string) => Contract[];
  
  // Cache management
  invalidateCache: () => void;
  isStale: () => boolean;
  
  // Config (from backend)
  config: {
    types: string[];
    statuses: string[];
    currencies: string[];
    payment_terms: string[];
    cache_ttl: number;
  };

  // UI State helpers
  optimisticOperations: OptimisticOperation[];
  clearErrors: () => void;
}

const ContractsContext = createContext<ContractsContextType | undefined>(undefined);

// ---------------------------------
// 3. Frontend Provider Implementation
// ---------------------------------
export const ContractsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // Core async state
  const [contracts, setContracts] = useState<AsyncState<Contract[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true
  });
  
  // Optimistic updates state
  const [optimisticOperations, setOptimisticOperations] = useState<OptimisticOperation[]>([]);
  
  // Cache management
  const cacheRef = useRef<Map<string, { data: Contract; timestamp: number }>>(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Extract frontend config from global config
  const config = useMemo(() => ({
    types: globalConfig?.business?.contracts?.types || 
           ['service_agreement', 'license', 'maintenance', 'support', 'consulting'],
    statuses: globalConfig?.statuses?.contracts || 
              ['draft', 'under_review', 'approved', 'active', 'expired', 'terminated'],
    currencies: globalConfig?.business?.contracts?.currencies || 
                ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
    payment_terms: globalConfig?.business?.contracts?.payment_terms || 
                   ['net_15', 'net_30', 'net_45', 'net_60', 'prepaid', 'custom'],
    cache_ttl: CACHE_TTL,
  }), [globalConfig]);

  /**
   * Basic UI validation - minimal, UX-focused only
   */
  const validateForUI = useCallback((contract: Partial<Contract>): string | null => {
    if (!contract.name || contract.name.trim().length < 2) {
      return "Contract name is required (min 2 characters)";
    }
    if (!contract.type || !config.types.includes(contract.type)) {
      return "Valid contract type is required";
    }
    if (!contract.start_date) {
      return "Start date is required";
    }
    if (contract.start_date && isNaN(Date.parse(contract.start_date))) {
      return "Valid start date is required";
    }
    return null;
  }, [config.types]);

  /**
   * Apply optimistic updates to UI data
   */
  const applyOptimisticUpdates = useCallback((baseContracts: Contract[]): Contract[] => {
    let result = [...baseContracts];
    
    optimisticOperations.forEach(op => {
      switch (op.type) {
        case 'create':
          if (op.entity && !result.find(c => c.id === op.entity!.id)) {
            result.unshift(op.entity);
          }
          break;
        case 'update':
          if (op.entity) {
            const index = result.findIndex(c => c.id === op.entity!.id);
            if (index >= 0) {
              result[index] = op.entity;
            }
          }
          break;
        case 'delete':
          result = result.filter(c => c.id !== op.id);
          break;
      }
    });
    
    return result;
  }, [optimisticOperations]);

  /**
   * Add optimistic operation
   */
  const addOptimisticOperation = useCallback((operation: Omit<OptimisticOperation, 'timestamp'>) => {
    const fullOperation: OptimisticOperation = {
      ...operation,
      timestamp: Date.now()
    };
    setOptimisticOperations(prev => [...prev, fullOperation]);
    
    // Auto-remove after timeout
    setTimeout(() => {
      setOptimisticOperations(prev => 
        prev.filter(op => op.timestamp !== fullOperation.timestamp)
      );
    }, 10000);
  }, []);

  /**
   * Remove optimistic operation
   */
  const removeOptimisticOperation = useCallback((timestamp: number) => {
    setOptimisticOperations(prev => prev.filter(op => op.timestamp !== timestamp));
  }, []);

  /**
   * Rollback optimistic operation
   */
  const rollbackOptimisticOperation = useCallback((timestamp: number) => {
    const operation = optimisticOperations.find(op => op.timestamp === timestamp);
    if (operation?.originalEntity && operation.type === 'update') {
      // Could restore original state here if needed for UX
    }
    removeOptimisticOperation(timestamp);
  }, [optimisticOperations, removeOptimisticOperation]);

  // ---------------------------------
  // API Integration Layer
  // ---------------------------------

  /**
   * Fetch contracts from backend API
   */
  const fetchContracts = useCallback(async (force: boolean = false) => {
    if (!tenantId) return;
    
    const now = Date.now();
    const isStale = !contracts.lastFetch || (now - contracts.lastFetch) > CACHE_TTL;
    
    if (!force && !isStale && contracts.data && !contracts.loading) {
      return;
    }

    setContracts(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Backend handles all business logic for fetching/filtering/sorting
      const response = await fetch(`/api/${tenantId}/contracts`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch contracts: ${response.statusText}`);
      }

      const data = await response.json();
      
      setContracts({
        data: data.contracts || [],
        loading: false,
        error: null,
        lastFetch: now,
        stale: false
      });

    } catch (error) {
      setContracts(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contracts'
      }));
    }
  }, [tenantId, contracts.lastFetch, contracts.data, contracts.loading, CACHE_TTL]);

  /**
   * Fetch single contract with caching
   */
  const fetchContract = useCallback(async (id: string, force: boolean = false): Promise<Contract | null> => {
    if (!tenantId) return null;

    // Check cache first
    const cached = cacheRef.current.get(id);
    const now = Date.now();
    
    if (!force && cached && (now - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await fetch(`/api/${tenantId}/contracts/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch contract: ${response.statusText}`);
      }

      const contract = await response.json();
      
      // Cache the result
      cacheRef.current.set(id, { data: contract, timestamp: now });
      
      return contract;

    } catch (error) {
      console.error(`Error fetching contract ${id}:`, error);
      return null;
    }
  }, [tenantId, CACHE_TTL]);

  /**
   * Create contract via API (backend handles all business logic)
   */
  const createContract = useCallback(async (
    contractData: Omit<Contract, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Basic UI validation only
    const validationError = validateForUI(contractData);
    if (validationError) {
      throw new Error(validationError);
    }

    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticContract: Contract = {
      ...contractData,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      business_service_ids: contractData.business_service_ids || [],
      compliance_requirement_ids: contractData.compliance_requirement_ids || [],
      milestones: contractData.milestones || [],
      key_deliverables: contractData.key_deliverables || [],
      tags: contractData.tags || [],
    };

    // Optimistic UI update
    const operationTimestamp = Date.now();
    addOptimisticOperation({
      id: tempId,
      type: 'create',
      entity: optimisticContract
    });

    try {
      // Backend handles ALL business logic, validation, and persistence
      const response = await fetch(`/api/${tenantId}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contractData, userId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create contract: ${response.statusText}`);
      }

      const createdContract = await response.json();

      // Remove optimistic update and refresh data
      removeOptimisticOperation(operationTimestamp);
      
      // Sync with offline queue
      await enqueueItem({
        storeName: "contracts",
        entityId: createdContract.id,
        action: "create",
        payload: createdContract,
      });

      // Refresh to get latest state from backend
      await fetchContracts(true);

    } catch (error) {
      // Rollback optimistic update on failure
      rollbackOptimisticOperation(operationTimestamp);
      throw error;
    }
  }, [tenantId, validateForUI, addOptimisticOperation, removeOptimisticOperation, rollbackOptimisticOperation, enqueueItem, fetchContracts]);

  /**
   * Update contract via API (backend handles all business logic)
   */
  const updateContract = useCallback(async (contract: Contract, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Basic UI validation only
    const validationError = validateForUI(contract);
    if (validationError) {
      throw new Error(validationError);
    }

    // Store original for potential rollback
    const originalContract = contracts.data?.find(c => c.id === contract.id);
    
    // Optimistic UI update
    const operationTimestamp = Date.now();
    addOptimisticOperation({
      id: contract.id,
      type: 'update',
      entity: { ...contract, updated_at: new Date().toISOString() },
      originalEntity: originalContract
    });

    try {
      // Backend handles ALL business logic and validation
      const response = await fetch(`/api/${tenantId}/contracts/${contract.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contract, userId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update contract: ${response.statusText}`);
      }

      const updatedContract = await response.json();

      // Remove optimistic update
      removeOptimisticOperation(operationTimestamp);
      
      // Clear cache for this contract
      cacheRef.current.delete(contract.id);

      // Sync with offline queue
      await enqueueItem({
        storeName: "contracts",
        entityId: updatedContract.id,
        action: "update",
        payload: updatedContract,
      });

      // Refresh to get latest state from backend
      await fetchContracts(true);

    } catch (error) {
      // Rollback optimistic update on failure
      rollbackOptimisticOperation(operationTimestamp);
      throw error;
    }
  }, [tenantId, validateForUI, contracts.data, addOptimisticOperation, removeOptimisticOperation, rollbackOptimisticOperation, enqueueItem, fetchContracts]);

  /**
   * Delete contract via API
   */
  const deleteContract = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const originalContract = contracts.data?.find(c => c.id === id);
    
    // Optimistic UI update
    const operationTimestamp = Date.now();
    addOptimisticOperation({
      id,
      type: 'delete',
      originalEntity: originalContract
    });

    try {
      const response = await fetch(`/api/${tenantId}/contracts/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete contract: ${response.statusText}`);
      }

      // Remove optimistic update
      removeOptimisticOperation(operationTimestamp);
      
      // Clear cache
      cacheRef.current.delete(id);

      // Sync with offline queue
      await enqueueItem({
        storeName: "contracts",
        entityId: id,
        action: "delete",
        payload: null,
      });

      // Refresh to get latest state
      await fetchContracts(true);

    } catch (error) {
      // Rollback optimistic update on failure
      rollbackOptimisticOperation(operationTimestamp);
      throw error;
    }
  }, [tenantId, contracts.data, addOptimisticOperation, removeOptimisticOperation, rollbackOptimisticOperation, enqueueItem, fetchContracts]);

  // ---------------------------------
  // Business Operation Delegates (API calls only)
  // ---------------------------------

  /**
   * Renew contract - delegates to backend API
   */
  const renewContract = useCallback(async (
    contractId: string, 
    params: { newEndDate: string }, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      const response = await fetch(`/api/${tenantId}/contracts/${contractId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, userId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to renew contract: ${response.statusText}`);
      }

      // Clear cache and refresh
      cacheRef.current.delete(contractId);
      await fetchContracts(true);

    } catch (error) {
      throw error;
    }
  }, [tenantId, fetchContracts]);

  /**
   * Terminate contract - delegates to backend API
   */
  const terminateContract = useCallback(async (
    contractId: string, 
    params: { terminationDate: string; reason: string }, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      const response = await fetch(`/api/${tenantId}/contracts/${contractId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, userId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to terminate contract: ${response.statusText}`);
      }

      // Clear cache and refresh
      cacheRef.current.delete(contractId);
      await fetchContracts(true);

    } catch (error) {
      throw error;
    }
  }, [tenantId, fetchContracts]);

  /**
   * Update SLA terms - delegates to backend API
   */
  const updateSLA = useCallback(async (
    contractId: string, 
    slaTerms: ContractSLA, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      const response = await fetch(`/api/${tenantId}/contracts/${contractId}/sla`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slaTerms, userId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update SLA: ${response.statusText}`);
      }

      // Clear cache and refresh
      cacheRef.current.delete(contractId);
      await fetchContracts(true);

    } catch (error) {
      throw error;
    }
  }, [tenantId, fetchContracts]);

  /**
   * Record SLA breach - delegates to backend API
   */
  const recordSLABreach = useCallback(async (
    contractId: string, 
    breachData: any, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      const response = await fetch(`/api/${tenantId}/contracts/${contractId}/sla-breach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...breachData, userId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to record SLA breach: ${response.statusText}`);
      }

      // Clear cache and refresh
      cacheRef.current.delete(contractId);
      await fetchContracts(true);

    } catch (error) {
      throw error;
    }
  }, [tenantId, fetchContracts]);

  /**
   * Complete milestone - delegates to backend API
   */
  const completeMilestone = useCallback(async (
    contractId: string, 
    milestoneId: string, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      const response = await fetch(`/api/${tenantId}/contracts/${contractId}/milestones/${milestoneId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to complete milestone: ${response.statusText}`);
      }

      // Clear cache and refresh
      cacheRef.current.delete(contractId);
      await fetchContracts(true);

    } catch (error) {
      throw error;
    }
  }, [tenantId, fetchContracts]);

  // ---------------------------------
  // Client-Side UI Helpers
  // ---------------------------------

  /**
   * Get filtered contracts for immediate UI responsiveness
   * (NOT business filtering - just basic UI filters)
   */
  const getFilteredContracts = useCallback((filters: ContractUIFilters): Contract[] => {
    const baseData = contracts.data || [];
    const withOptimistic = applyOptimisticUpdates(baseData);
    
    return withOptimistic.filter(contract => {
      if (filters.type && contract.type !== filters.type) return false;
      if (filters.status && contract.status !== filters.status) return false;
      if (filters.vendorId && contract.vendor_id !== filters.vendorId) return false;
      if (filters.customerId && contract.customer_id !== filters.customerId) return false;
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const searchFields = [
          contract.name,
          contract.description,
          contract.type,
          ...contract.tags
        ].filter(Boolean);
        
        if (!searchFields.some(field => field!.toLowerCase().includes(query))) {
          return false;
        }
      }
      if (filters.showExpired === false && contract.status === 'expired') return false;
      if (filters.showHighValue && !(contract.total_contract_value && contract.total_contract_value > 100000)) return false;
      
      return true;
    });
  }, [contracts.data, applyOptimisticUpdates]);

  /**
   * Simple client-side search for immediate UI feedback
   */
  const searchContracts = useCallback((query: string): Contract[] => {
    return getFilteredContracts({ search: query });
  }, [getFilteredContracts]);

  // ---------------------------------
  // Cache Management
  // ---------------------------------

  /**
   * Invalidate all caches
   */
  const invalidateCache = useCallback(() => {
    cacheRef.current.clear();
    setContracts(prev => ({ ...prev, stale: true }));
  }, []);

  /**
   * Check if data is stale
   */
  const isStale = useCallback((): boolean => {
    if (!contracts.lastFetch) return true;
    return (Date.now() - contracts.lastFetch) > CACHE_TTL;
  }, [contracts.lastFetch, CACHE_TTL]);

  /**
   * Clear error state
   */
  const clearErrors = useCallback(() => {
    setContracts(prev => ({ ...prev, error: null }));
  }, []);

  // ---------------------------------
  // Lifecycle & Cleanup
  // ---------------------------------

  // Initial load
  useEffect(() => {
    if (tenantId && globalConfig) {
      fetchContracts();
    }
  }, [tenantId, globalConfig, fetchContracts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cacheRef.current.clear();
      setOptimisticOperations([]);
    };
  }, []);

  // ---------------------------------
  // Context Value
  // ---------------------------------

  const contextValue = useMemo(() => ({
    contracts,
    createContract,
    updateContract,
    deleteContract,
    fetchContracts,
    fetchContract,
    renewContract,
    terminateContract,
    updateSLA,
    recordSLABreach,
    completeMilestone,
    getFilteredContracts,
    searchContracts,
    invalidateCache,
    isStale,
    config,
    optimisticOperations,
    clearErrors,
  }), [
    contracts,
    createContract,
    updateContract,
    deleteContract,
    fetchContracts,
    fetchContract,
    renewContract,
    terminateContract,
    updateSLA,
    recordSLABreach,
    completeMilestone,
    getFilteredContracts,
    searchContracts,
    invalidateCache,
    isStale,
    config,
    optimisticOperations,
    clearErrors,
  ]);

  return (
    <ContractsContext.Provider value={contextValue}>
      {children}
    </ContractsContext.Provider>
  );
};

// ---------------------------------
// 4. Frontend Hooks
// ---------------------------------

/**
 * Main contracts hook
 */
export const useContracts = () => {
  const ctx = useContext(ContractsContext);
  if (!ctx) throw new Error("useContracts must be used within ContractsProvider");
  return ctx;
};

/**
 * Hook for single contract details with caching
 */
export const useContractDetails = (id: string) => {
  const { contracts, fetchContract } = useContracts();
  const [contract, setContract] = useState<AsyncState<Contract>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true
  });

  const loadContract = useCallback(async (force?: boolean) => {
    if (!id) return;

    // Check if already in main contracts list first
    const existing = contracts.data?.find(c => c.id === id);
    if (existing && !force) {
      setContract({
        data: existing,
        loading: false,
        error: null,
        lastFetch: Date.now(),
        stale: false
      });
      return;
    }

    setContract(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await fetchContract(id, force);
      setContract({
        data,
        loading: false,
        error: null,
        lastFetch: Date.now(),
        stale: false
      });
    } catch (error) {
      setContract(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contract'
      }));
    }
  }, [id, contracts.data, fetchContract]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  return { ...contract, refetch: loadContract };
};

/**
 * Selective subscription hook for filtered contracts
 */
export const useFilteredContracts = (filters: ContractUIFilters) => {
  const { getFilteredContracts, contracts } = useContracts();
  
  return useMemo(() => ({
    data: getFilteredContracts(filters),
    loading: contracts.loading,
    error: contracts.error,
    stale: contracts.stale
  }), [getFilteredContracts, filters, contracts.loading, contracts.error, contracts.stale]);
};

/**
 * Hook for contracts by status
 */
export const useContractsByStatus = (status: string) => {
  return useFilteredContracts({ status });
};

/**
 * Hook for contract search
 */
export const useContractSearch = (query: string) => {
  const { searchContracts, contracts } = useContracts();
  
  return useMemo(() => ({
    data: query ? searchContracts(query) : [],
    loading: contracts.loading,
    error: contracts.error,
    stale: contracts.stale
  }), [searchContracts, query, contracts.loading, contracts.error, contracts.stale]);
};