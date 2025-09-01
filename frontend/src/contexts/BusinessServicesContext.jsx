import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const BusinessServicesContext = createContext();

export function BusinessServicesProvider({ children }) {
  const [businessServices, setBusinessServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState({});
  const [stats, setStats] = useState({
    total: 0,
    healthy: 0,
    warning: 0,
    critical: 0
  });
  const { user } = useAuth();

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("businessServices");
      
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 BusinessServices store empty, but global seeding will handle this");
        }
      }
      
      setBusinessServices(items);
      calculateStats(items);
      updateHealthStatus(items);
    } catch (error) {
      console.error("Failed to load business services:", error);
      setBusinessServices([]);
      setStats({ total: 0, healthy: 0, warning: 0, critical: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(items) {
    const total = items.length;
    let healthy = 0, warning = 0, critical = 0;

    items.forEach(service => {
      switch (service.health_status) {
        case "healthy":
          healthy++;
          break;
        case "warning":
          warning++;
          break;
        case "critical":
          critical++;
          break;
        default:
          healthy++; // Default to healthy if status not set
      }
    });

    setStats({ total, healthy, warning, critical });
  }

  function updateHealthStatus(items) {
    const status = {};
    items.forEach(service => {
      status[service.id] = {
        status: service.health_status || "healthy",
        last_updated: service.last_health_check || Date.now(),
        uptime: service.uptime_percentage || 100,
        response_time: service.avg_response_time || 0
      };
    });
    setHealthStatus(status);
  }

  async function addService(service) {
    try {
      const newService = {
        ...service,
        id: service.id || `bs_${Date.now()}`,
        created_by: user?.id || "system",
        created_at: Date.now(),
        health_status: service.health_status || "healthy",
        uptime_percentage: service.uptime_percentage || 100,
        tier: service.tier || "standard",
        criticality: service.criticality || "medium",
        last_health_check: Date.now(),
        incident_count: 0,
        last_modified: Date.now()
      };
      
      await setItem("businessServices", newService);
      await load();
    } catch (error) {
      console.error("Failed to add business service:", error);
      throw error;
    }
  }

  async function updateService(id, updates) {
    try {
      const existing = businessServices.find(item => item.id === id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          last_modified: Date.now(),
          modified_by: user?.id || "system"
        };
        
        // Track health status changes
        if (updates.health_status && updates.health_status !== existing.health_status) {
          updated.health_status_history = [
            ...(existing.health_status_history || []),
            {
              from: existing.health_status,
              to: updates.health_status,
              changed_at: Date.now(),
              changed_by: user?.id || "system"
            }
          ];
          updated.last_health_check = Date.now();
        }
        
        await setItem("businessServices", updated);
        
        // Optimistic update
        setBusinessServices(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
        
        // Recalculate stats and health
        const newServices = businessServices.map(item => 
          item.id === id ? updated : item
        );
        calculateStats(newServices);
        updateHealthStatus(newServices);
      }
    } catch (error) {
      console.error("Failed to update business service:", error);
      await load();
      throw error;
    }
  }

  async function removeService(id) {
    try {
      await delItem("businessServices", id);
      await load();
    } catch (error) {
      console.error("Failed to remove business service:", error);
      throw error;
    }
  }

  async function updateHealthCheck(id, healthData) {
    try {
      const service = businessServices.find(item => item.id === id);
      if (service) {
        const updates = {
          health_status: healthData.status || "healthy",
          uptime_percentage: healthData.uptime || service.uptime_percentage || 100,
          avg_response_time: healthData.response_time || service.avg_response_time || 0,
          last_health_check: Date.now(),
          health_check_count: (service.health_check_count || 0) + 1
        };
        
        // Add health metrics
        if (healthData.metrics) {
          updates.metrics = {
            ...service.metrics,
            ...healthData.metrics,
            timestamp: Date.now()
          };
        }
        
        await updateService(id, updates);
      }
    } catch (error) {
      console.error("Failed to update health check:", error);
      throw error;
    }
  }

  async function recordIncident(serviceId, incidentData) {
    try {
      const service = businessServices.find(item => item.id === serviceId);
      if (service) {
        const updates = {
          incident_count: (service.incident_count || 0) + 1,
          last_incident_at: Date.now(),
          health_status: incidentData.impact === "high" ? "critical" : "warning"
        };
        
        // Add to incident history
        const incidentRecord = {
          id: incidentData.id || `incident_${Date.now()}`,
          timestamp: Date.now(),
          impact: incidentData.impact || "medium",
          description: incidentData.description || "",
          resolved_at: null
        };
        
        updates.incident_history = [
          ...(service.incident_history || []),
          incidentRecord
        ];
        
        await updateService(serviceId, updates);
        
        return incidentRecord;
      }
    } catch (error) {
      console.error("Failed to record incident:", error);
      throw error;
    }
  }

  async function clearAll() {
    try {
      await clearStore("businessServices");
      await load();
    } catch (error) {
      console.error("Failed to clear business services:", error);
      throw error;
    }
  }

  // Role-based view filtering
  const roleView = useMemo(() => {
    if (!user || !businessServices.length) return businessServices;
    
    switch (user.role) {
      case "Manager":
        return businessServices; // Managers see all services
        
      case "SRE":
      case "Senior SRE":
      case "Automation Engineer":
        // Technical roles see services they're responsible for
        return businessServices.filter(service => 
          service.responsible_team === user.teamId ||
          service.technical_owner === user.id ||
          !service.access_restricted
        );
        
      case "Support Engineer":
      case "Dispatcher":
        // Support roles see services they support
        return businessServices.filter(service => 
          service.support_teams?.includes(user.teamId) ||
          !service.access_restricted
        );
        
      default:
        return businessServices.filter(service => !service.access_restricted);
    }
  }, [businessServices, user]);

  // Get services by tier
  const getByTier = useMemo(() => {
    const tiers = {};
    roleView.forEach(service => {
      const tier = service.tier || "standard";
      if (!tiers[tier]) {
        tiers[tier] = [];
      }
      tiers[tier].push(service);
    });
    return tiers;
  }, [roleView]);

  // Get services by health status
  const getByHealthStatus = useMemo(() => {
    const statusGroups = {};
    roleView.forEach(service => {
      const status = service.health_status || "healthy";
      if (!statusGroups[status]) {
        statusGroups[status] = [];
      }
      statusGroups[status].push(service);
    });
    return statusGroups;
  }, [roleView]);

  // Get critical services
  const criticalServices = useMemo(() => {
    return roleView.filter(service => 
      service.criticality === "high" || 
      service.tier === "platinum" ||
      service.health_status === "critical"
    );
  }, [roleView]);

  // Get services with recent incidents
  const servicesWithRecentIncidents = useMemo(() => {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return roleView.filter(service => 
      service.last_incident_at && 
      service.last_incident_at > oneDayAgo
    );
  }, [roleView]);

  // Get services needing attention
  const servicesNeedingAttention = useMemo(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return roleView.filter(service => 
      service.health_status === "critical" ||
      service.health_status === "warning" ||
      (service.last_health_check && service.last_health_check < oneHourAgo) ||
      (service.uptime_percentage && service.uptime_percentage < 95)
    );
  }, [roleView]);

  // Enhanced loading with retry logic
  useEffect(() => {
    let isMounted = true;
    
    const loadWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          if (isMounted) {
            await load();
            break;
          }
        } catch (error) {
          console.error(`BusinessServices load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All BusinessServices load attempts failed");
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    };

    loadWithRetry();

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto health check simulation (in real implementation, this would be external)
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate random health changes for demo purposes
      businessServices.forEach(service => {
        if (Math.random() < 0.1) { // 10% chance of status change
          const statuses = ["healthy", "warning", "critical"];
          const currentIndex = statuses.indexOf(service.health_status || "healthy");
          const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
          
          if (newStatus !== (service.health_status || "healthy")) {
            updateHealthCheck(service.id, {
              status: newStatus,
              uptime: Math.random() * 100,
              response_time: Math.random() * 1000
            });
          }
        }
      });
    }, 30000); // Every 30 seconds for demo

    return () => clearInterval(interval);
  }, [businessServices]);

  const contextValue = {
    businessServices,
    roleView,
    isLoading,
    stats,
    healthStatus,
    getByTier,
    getByHealthStatus,
    criticalServices,
    servicesWithRecentIncidents,
    servicesNeedingAttention,
    addService,
    updateService,
    removeService,
    updateHealthCheck,
    recordIncident,
    clearAll,
    reload: load
  };

  return (
    <BusinessServicesContext.Provider value={contextValue}>
      {children}
    </BusinessServicesContext.Provider>
  );
}

export function useBusinessServices() {
  const context = useContext(BusinessServicesContext);
  if (!context) {
    throw new Error('useBusinessServices must be used within a BusinessServicesProvider');
  }
  return context;
}