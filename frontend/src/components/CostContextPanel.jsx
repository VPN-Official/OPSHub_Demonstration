import React, { useState } from "react";
import { DollarSign, TrendingUp, AlertTriangle, Clock } from "lucide-react";

/**
 * CostContextPanel
 * - Shows financial impact and cost center information
 * - Displays contract penalties and SLA financial implications
 * - Helps users understand business cost of decisions
 * - Supports manager and support engineer perspectives
 */
export default function CostContextPanel({ workItem, className = "" }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!workItem) {
    return null;
  }

  // Calculate financial context from work item
  const financialContext = {
    // Direct costs
    estimated_cost: workItem.estimated_cost || 12500,
    actual_cost: workItem.actual_cost || null,
    billable_hours: workItem.billable_hours || 16,
    parts_cost: workItem.parts_cost || 8500,
    labor_cost: (workItem.billable_hours || 16) * 45.5, // $45.5/hour from data
    
    // Budget context
    cost_center_budget: 850000, // From field services data
    budget_remaining: 623000,
    budget_utilization: ((850000 - 623000) / 850000) * 100,
    
    // Contract implications
    customer_tier: workItem.customer_tier || "platinum",
    contract_value: workItem.contract_value || 480000,
    sla_penalty_rate: workItem.sla_penalty_rate || 2.5, // 2.5% from contract
    max_monthly_penalty: workItem.max_monthly_penalty || 40000,
    
    // Time-based costs
    hourly_revenue_impact: workItem.revenue_impact_per_hour || 15000,
    downtime_hours: workItem.downtime_hours || 0,
    
    // Historical context
    similar_work_avg_cost: 11200,
    cost_variance: null
  };

  // Calculate potential SLA penalties
  const slaRisk = financialContext.sla_penalty_rate * (financialContext.contract_value / 12); // Monthly
  
  // Calculate cost variance if actual cost exists
  if (financialContext.actual_cost) {
    financialContext.cost_variance = financialContext.actual_cost - financialContext.estimated_cost;
  }

  const getUrgencyContext = () => {
    let urgencyFactors = [];
    
    if (workItem.slaBreached) {
      urgencyFactors.push({
        factor: "SLA Breach Penalty",
        impact: `Up to $${slaRisk.toLocaleString()}/month`,
        severity: "high"
      });
    }
    
    if (financialContext.estimated_cost > financialContext.similar_work_avg_cost) {
      urgencyFactors.push({
        factor: "Above Average Cost",
        impact: `+$${(financialContext.estimated_cost - financialContext.similar_work_avg_cost).toLocaleString()}`,
        severity: "medium"
      });
    }
    
    if (financialContext.customer_tier === "platinum") {
      urgencyFactors.push({
        factor: "Platinum Customer",
        impact: "Premium SLA penalties apply",
        severity: "high"
      });
    }
    
    if (financialContext.downtime_hours > 0) {
      urgencyFactors.push({
        factor: "Revenue Impact",
        impact: `$${(financialContext.hourly_revenue_impact * financialContext.downtime_hours).toLocaleString()}/hour`,
        severity: "critical"
      });
    }

    return urgencyFactors;
  };

  const urgencyFactors = getUrgencyContext();

  return (
    <div className={`border rounded-lg bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-green-600" />
            <h3 className="font-semibold text-sm">Cost Impact</h3>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
        </div>
      </div>

      {/* Quick Summary */}
      <div className="p-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-600">Estimated Cost</div>
            <div className="font-semibold text-green-600">
              ${financialContext.estimated_cost?.toLocaleString()}
            </div>
            {financialContext.cost_variance !== null && (
              <div className={`text-xs ${
                financialContext.cost_variance > 0 ? "text-red-600" : "text-green-600"
              }`}>
                {financialContext.cost_variance > 0 ? "+" : ""}
                ${financialContext.cost_variance?.toLocaleString()} vs estimate
              </div>
            )}
          </div>
          
          <div>
            <div className="text-xs text-gray-600">Labor Hours</div>
            <div className="font-semibold">
              {financialContext.billable_hours}h
            </div>
            <div className="text-xs text-gray-600">
              ${financialContext.labor_cost?.toLocaleString()} labor
            </div>
          </div>
        </div>

        {/* Urgency Factors */}
        {urgencyFactors.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs font-medium text-gray-700 mb-2">Financial Risk Factors:</div>
            <div className="space-y-1">
              {urgencyFactors.map((factor, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <AlertTriangle 
                    size={12} 
                    className={
                      factor.severity === "critical" ? "text-red-600" :
                      factor.severity === "high" ? "text-orange-600" :
                      factor.severity === "medium" ? "text-yellow-600" : "text-gray-600"
                    } 
                  />
                  <span className="text-gray-700">{factor.factor}:</span>
                  <span className={
                    factor.severity === "critical" ? "text-red-600 font-medium" :
                    factor.severity === "high" ? "text-orange-600 font-medium" :
                    "text-gray-600"
                  }>
                    {factor.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="px-3 pb-3 border-t bg-gray-50">
          <div className="py-3 space-y-3 text-sm">
            {/* Cost Breakdown */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2">Cost Breakdown:</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Labor ({financialContext.billable_hours}h @ $45.50)</span>
                  <span>${financialContext.labor_cost?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Parts & Materials</span>
                  <span>${financialContext.parts_cost?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Total Estimated</span>
                  <span>${financialContext.estimated_cost?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Budget Context */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2">Cost Center Budget:</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">HVAC Operations Budget</span>
                  <span>${financialContext.cost_center_budget?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Remaining</span>
                  <span className={
                    financialContext.budget_remaining < financialContext.estimated_cost 
                      ? "text-red-600 font-medium" 
                      : "text-green-600"
                  }>
                    ${financialContext.budget_remaining?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Utilization</span>
                  <span className="text-gray-600">
                    {financialContext.budget_utilization?.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Contract Risk */}
            {workItem.customer_tier && (
              <div>
                <div className="text-xs font-medium text-gray-700 mb-2">Contract Risk:</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer Tier</span>
                    <span className={`font-medium ${
                      financialContext.customer_tier === "platinum" ? "text-purple-600" :
                      financialContext.customer_tier === "gold" ? "text-yellow-600" : "text-gray-600"
                    }`}>
                      {financialContext.customer_tier?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">SLA Penalty Rate</span>
                    <span>{financialContext.sla_penalty_rate}%</span>
                  </div>
                  {workItem.slaBreached && (
                    <div className="flex justify-between">
                      <span className="text-red-600">Potential Monthly Penalty</span>
                      <span className="text-red-600 font-medium">
                        ${slaRisk.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Historical Context */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2">Benchmarking:</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Similar Work Average</span>
                  <span>${financialContext.similar_work_avg_cost?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Variance</span>
                  <span className={
                    financialContext.estimated_cost > financialContext.similar_work_avg_cost
                      ? "text-red-600"
                      : "text-green-600"
                  }>
                    {financialContext.estimated_cost > financialContext.similar_work_avg_cost ? "+" : ""}
                    ${(financialContext.estimated_cost - financialContext.similar_work_avg_cost).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}