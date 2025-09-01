import React, { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Building, 
  FileText, 
  Wrench, 
  User, 
  DollarSign, 
  Shield, 
  Truck, 
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink 
} from "lucide-react";

/**
 * EntityRelationshipPanel
 * - Shows all related entities for a work item
 * - Provides navigation to detailed views
 * - Collapsible sections for information density
 * - Handles AiOps entity complexity
 */
export default function EntityRelationshipPanel({ workItem, className = "" }) {
  const [expandedSections, setExpandedSections] = useState({
    customer: true,
    assets: true,
    financial: false,
    compliance: false,
    team: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!workItem) {
    return (
      <div className={`p-4 border rounded-lg bg-gray-50 ${className}`}>
        <p className="text-sm text-gray-500">No work item data available</p>
      </div>
    );
  }

  // Extract relationship data from work item
  const relationships = {
    customer: {
      customer_id: workItem.customer_id,
      customer_name: workItem.customer_name || "Metro Office Building Corp",
      customer_tier: workItem.customer_tier || "platinum",
      contract_id: workItem.contract_id,
      contract_name: workItem.contract_name || "Full Service Agreement"
    },
    assets: {
      affected_asset_ids: workItem.affected_asset_ids || [],
      primary_asset: workItem.primary_asset || "Service Truck Unit 12",
      asset_criticality: workItem.asset_criticality || "high",
      location: workItem.location || "Downtown Metro Tower"
    },
    financial: {
      cost_center_id: workItem.cost_center_id,
      estimated_cost: workItem.estimated_cost,
      billable_hours: workItem.billable_hours,
      parts_cost: workItem.parts_cost,
      budget_remaining: workItem.budget_remaining
    },
    compliance: {
      required_certifications: workItem.required_certifications || ["EPA_608", "OSHA_10"],
      compliance_status: workItem.compliance_status || "compliant",
      audit_trail: workItem.audit_trail || false
    },
    team: {
      assigned_to: workItem.assignedTo || workItem.assigned_to_user_id,
      assigned_team: workItem.assigned_to_team_id || "HVAC Service Team",
      required_skills: workItem.required_skills || [],
      available_techs: workItem.available_skilled_techs || 3
    }
  };

  return (
    <div className={`border rounded-lg bg-white shadow-sm ${className}`}>
      <div className="p-3 border-b bg-gray-50">
        <h3 className="font-semibold text-sm">Related Entities</h3>
        <p className="text-xs text-gray-600 mt-1">
          Connected systems, assets, and stakeholders
        </p>
      </div>

      <div className="divide-y">
        {/* Customer & Contract Section */}
        <RelationshipSection
          title="Customer & Contract"
          icon={Building}
          expanded={expandedSections.customer}
          onToggle={() => toggleSection('customer')}
        >
          <div className="space-y-2">
            {relationships.customer.customer_id && (
              <RelationshipItem
                label="Customer"
                value={relationships.customer.customer_name}
                badge={relationships.customer.customer_tier?.toUpperCase()}
                badgeColor={
                  relationships.customer.customer_tier === "platinum" ? "purple" :
                  relationships.customer.customer_tier === "gold" ? "yellow" : "gray"
                }
                linkTo={`/customer/${relationships.customer.customer_id}`}
              />
            )}
            
            {relationships.customer.contract_id && (
              <RelationshipItem
                label="Contract"
                value={relationships.customer.contract_name}
                badge="ACTIVE"
                badgeColor="green"
                linkTo={`/contract/${relationships.customer.contract_id}`}
              />
            )}
          </div>
        </RelationshipSection>

        {/* Assets & Location Section */}
        <RelationshipSection
          title="Assets & Location"
          icon={Truck}
          expanded={expandedSections.assets}
          onToggle={() => toggleSection('assets')}
        >
          <div className="space-y-2">
            <RelationshipItem
              label="Primary Asset"
              value={relationships.assets.primary_asset}
              badge={relationships.assets.asset_criticality?.toUpperCase()}
              badgeColor={
                relationships.assets.asset_criticality === "high" ? "red" :
                relationships.assets.asset_criticality === "medium" ? "yellow" : "gray"
              }
              linkTo={`/asset/${workItem.primary_asset_id || 'fs-asset-001'}`}
            />
            
            <RelationshipItem
              label="Location"
              value={relationships.assets.location}
              linkTo={`/location/${workItem.location_id || 'fs-loc-001'}`}
            />
            
            {relationships.assets.affected_asset_ids?.length > 1 && (
              <RelationshipItem
                label="Additional Assets"
                value={`${relationships.assets.affected_asset_ids.length - 1} more affected`}
                linkTo="/assets?filter=affected"
              />
            )}
          </div>
        </RelationshipSection>

        {/* Financial Information */}
        <RelationshipSection
          title="Financial"
          icon={DollarSign}
          expanded={expandedSections.financial}
          onToggle={() => toggleSection('financial')}
        >
          <div className="space-y-2">
            {relationships.financial.estimated_cost && (
              <RelationshipItem
                label="Estimated Cost"
                value={`$${relationships.financial.estimated_cost?.toLocaleString()}`}
                badge={relationships.financial.billable_hours ? `${relationships.financial.billable_hours}h` : null}
              />
            )}
            
            {relationships.financial.cost_center_id && (
              <RelationshipItem
                label="Cost Center"
                value="HVAC Operations"
                linkTo={`/cost-center/${relationships.financial.cost_center_id}`}
              />
            )}
            
            {relationships.financial.parts_cost && (
              <RelationshipItem
                label="Parts Cost"
                value={`$${relationships.financial.parts_cost?.toLocaleString()}`}
              />
            )}
          </div>
        </RelationshipSection>

        {/* Compliance & Skills */}
        <RelationshipSection
          title="Compliance & Skills"
          icon={Shield}
          expanded={expandedSections.compliance}
          onToggle={() => toggleSection('compliance')}
        >
          <div className="space-y-2">
            <RelationshipItem
              label="Required Certifications"
              value={relationships.compliance.required_certifications?.join(", ")}
              badge={relationships.compliance.compliance_status?.toUpperCase()}
              badgeColor={relationships.compliance.compliance_status === "compliant" ? "green" : "red"}
            />
            
            {relationships.team.required_skills?.length > 0 && (
              <RelationshipItem
                label="Required Skills"
                value={relationships.team.required_skills.map(s => s.skill || s).join(", ")}
              />
            )}
          </div>
        </RelationshipSection>

        {/* Team & Assignment */}
        <RelationshipSection
          title="Team & Assignment"
          icon={User}
          expanded={expandedSections.team}
          onToggle={() => toggleSection('team')}
        >
          <div className="space-y-2">
            {relationships.team.assigned_to && (
              <RelationshipItem
                label="Assigned To"
                value="Mike Rodriguez"
                badge="AVAILABLE"
                badgeColor="green"
                linkTo={`/user/${relationships.team.assigned_to}`}
              />
            )}
            
            <RelationshipItem
              label="Team"
              value={relationships.team.assigned_team}
              badge={`${relationships.team.available_techs} available`}
              linkTo={`/team/${workItem.assigned_to_team_id || 'fs-team-001'}`}
            />
          </div>
        </RelationshipSection>
      </div>
    </div>
  );
}

/**
 * Collapsible section wrapper
 */
function RelationshipSection({ title, icon: Icon, expanded, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors"
      >
        <Icon size={14} className="text-gray-600" />
        <span className="text-sm font-medium flex-1 text-left">{title}</span>
        {expanded ? (
          <ChevronDown size={14} className="text-gray-400" />
        ) : (
          <ChevronRight size={14} className="text-gray-400" />
        )}
      </button>
      
      {expanded && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Individual relationship item
 */
function RelationshipItem({ label, value, badge, badgeColor = "gray", linkTo }) {
  const badgeColors = {
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800", 
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
    purple: "bg-purple-100 text-purple-800",
    gray: "bg-gray-100 text-gray-800"
  };

  const content = (
    <div className="flex items-center justify-between py-1">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-gray-600">{label}</div>
        <div className="text-sm font-medium text-gray-900 truncate">{value || "—"}</div>
      </div>
      
      <div className="flex items-center gap-2 ml-2">
        {badge && (
          <span className={`text-xs px-2 py-1 rounded font-medium ${badgeColors[badgeColor]}`}>
            {badge}
          </span>
        )}
        {linkTo && <ExternalLink size={12} className="text-gray-400" />}
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="block hover:bg-gray-50 rounded px-2 -mx-2 transition-colors">
        {content}
      </Link>
    );
  }

  return <div className="px-2 -mx-2">{content}</div>;
}