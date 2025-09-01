import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import {
  User,
  Zap,
  MessageSquare,
  ArrowLeft,
  FileText,
  Activity,
  DollarSign,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";

// Import our new components
import EntityRelationshipPanel from "./EntityRelationshipPanel.jsx";
import CostContextPanel from "./CostContextPanel.jsx";
import SmartScoreExplanation from "./SmartScoreExplanation.jsx";

// Enhanced tab definitions with AiOps context
const TABS = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "actions", label: "Actions", icon: User },
  { key: "ai_insights", label: "AI Insights", icon: Activity },
  { key: "relationships", label: "Relationships", icon: Building2 },
  { key: "financial", label: "Financial", icon: DollarSign },
  { key: "activity_log", label: "Activity Log", icon: FileText },
];

// Enhanced metadata fields with business context
const META_FIELDS = [
  { key: "status", label: "Status", type: "status" },
  { key: "priority", label: "Priority", type: "priority" },
  { key: "type", label: "Type", type: "text" },
  { key: "slaBreached", label: "SLA", type: "sla" },
  { key: "customer_tier", label: "Customer", type: "tier" },
  { key: "asset_criticality", label: "Asset", type: "criticality" },
];

export default function EnhancedWorkItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workItems = [] } = useWorkItems();
  const { queueChange } = useSync();
  const { addToast } = useToast();

  const workItem = Array.isArray(workItems)
    ? workItems.find((w) => w?.id === id)
    : null;

  const [activeTab, setActiveTab] = useState("overview");

  // Debug logging
  console.log("Enhanced WorkItemDetail Debug:", { id, workItem, workItems });

  if (!workItem) {
    return (
      <div className="p-4">
        <button
          className="flex items-center text-blue-600 hover:underline"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <p className="mt-4 text-gray-600">Work item not found. ID: {id}</p>
        <div className="mt-2 text-xs text-gray-500">
          Available work items: {workItems.map(w => w?.id).join(', ') || 'none'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-7xl mx-auto">
      {/* Breadcrumb / Back */}
      <button
        className="flex items-center text-blue-600 hover:underline w-fit"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} /> Back to Queue
      </button>

      {/* Enhanced Header with Smart Score */}
      <div className="border rounded-lg bg-white shadow p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              {workItem?.title || "Untitled Work Item"}
            </h1>
            <div className="text-sm text-gray-600">
              ID: {workItem?.id} • Created {new Date(workItem?.createdAt || Date.now()).toLocaleDateString()}
            </div>
          </div>
          
          {/* Smart Score in header */}
          <div className="flex-shrink-0">
            <div className="text-xs text-gray-600 mb-1">AI Priority Score</div>
            <SmartScoreExplanation workItem={workItem} />
          </div>
        </div>

        {/* Enhanced Metadata with Visual Indicators */}
        <div className="flex flex-wrap gap-3 text-sm">
          {META_FIELDS.map(({ key, label, type }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-gray-600">{label}:</span>
              <MetadataValue workItem={workItem} field={key} type={type} />
            </div>
          ))}
        </div>

        {/* Quick Actions Bar */}
        <div className="flex gap-2 mt-4 pt-3 border-t">
          <ActionButton
            icon={User}
            label="Reassign"
            onClick={() => handleQuickAction("reassign")}
            variant="secondary"
          />
          <ActionButton
            icon={Zap}
            label="Automate"
            onClick={() => handleQuickAction("automate")}
            variant="primary"
            disabled={!workItem.automation_available}
          />
          <ActionButton
            icon={MessageSquare}
            label="Chat"
            onClick={() => handleQuickAction("chat")}
            variant="secondary"
          />
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left Column - Main Tabs */}
        <div className="lg:col-span-2">
          {/* Tab Navigation */}
          <div className="flex border-b overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1 px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === key
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white shadow rounded-lg p-4 mt-4">
            <TabContent workItem={workItem} activeTab={activeTab} />
          </div>
        </div>

        {/* Right Column - Context Panels */}
        <div className="space-y-4">
          <EntityRelationshipPanel workItem={workItem} />
          <CostContextPanel workItem={workItem} />
        </div>
      </div>

      {/* Enhanced Traceability Links */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Related Items</h3>
        <TracealibityLinks workItem={workItem} />
      </div>
    </div>
  );

  // Quick action handler with enhanced context
  function handleQuickAction(action) {
    queueChange?.(action, workItem);
    addToast({ 
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} action queued`, 
      type: TOAST_TYPES.INFO 
    });
  }
}

/**
 * Enhanced metadata value renderer with visual indicators
 */
function MetadataValue({ workItem, field, type }) {
  const value = workItem?.[field];

  switch (type) {
    case "status":
      return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === "open" ? "bg-blue-100 text-blue-800" :
          value === "in-progress" ? "bg-purple-100 text-purple-800" :
          value === "resolved" ? "bg-green-100 text-green-800" :
          "bg-gray-100 text-gray-800"
        }`}>
          {value || "—"}
        </span>
      );
    
    case "priority":
      return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === "P0" ? "bg-red-100 text-red-800" :
          value === "P1" ? "bg-orange-100 text-orange-800" :
          value === "P2" ? "bg-yellow-100 text-yellow-800" :
          "bg-gray-100 text-gray-800"
        }`}>
          {value || "—"}
        </span>
      );
    
    case "sla":
      return (
        <div className="flex items-center gap-1">
          {workItem?.slaBreached ? (
            <>
              <AlertTriangle size={12} className="text-red-600" />
              <span className="text-red-600 font-medium text-xs">Breached</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={12} className="text-green-600" />
              <span className="text-green-600 text-xs">On Track</span>
            </>
          )}
        </div>
      );
    
    case "tier":
      return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === "platinum" ? "bg-purple-100 text-purple-800" :
          value === "gold" ? "bg-yellow-100 text-yellow-800" :
          "bg-gray-100 text-gray-800"
        }`}>
          {value?.toUpperCase() || "STANDARD"}
        </span>
      );
    
    case "criticality":
      return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === "high" ? "bg-red-100 text-red-800" :
          value === "medium" ? "bg-yellow-100 text-yellow-800" :
          "bg-green-100 text-green-800"
        }`}>
          {value?.toUpperCase() || "LOW"}
        </span>
      );
    
    default:
      return <span className="text-gray-900">{value || "—"}</span>;
  }
}

/**
 * Action button component
 */
function ActionButton({ icon: Icon, label, onClick, variant = "secondary", disabled = false }) {
  const baseClasses = "flex items-center gap-2 px-3 py-1 rounded text-sm font-medium transition-colors";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-50"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${disabled ? 'cursor-not-allowed' : ''}`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

/**
 * Tab content router
 */
function TabContent({ workItem, activeTab }) {
  switch (activeTab) {
    case "overview":
      return <OverviewTab workItem={workItem} />;
    case "actions":
      return <ActionsTab workItem={workItem} />;
    case "ai_insights":
      return <AiInsightsTab workItem={workItem} />;
    case "relationships":
      return <RelationshipsTab workItem={workItem} />;
    case "financial":
      return <FinancialTab workItem={workItem} />;
    case "activity_log":
      return <ActivityLogTab workItem={workItem} />;
    default:
      return <div>Tab content not found</div>;
  }
}

/**
 * Enhanced tab components
 */
function OverviewTab({ workItem }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">Description</h4>
        <p className="text-sm text-gray-700">
          {workItem?.description || "No description provided"}
        </p>
      </div>
      
      <div>
        <h4 className="font-medium mb-2">Business Impact</h4>
        <div className="text-sm text-gray-700">
          <div>Impact Level: <span className="font-medium">{workItem?.business_impact || "Medium"}</span></div>
          <div>Customer Impact: <span className="font-medium">{workItem?.customer_impact || "External Visible"}</span></div>
        </div>
      </div>

      {workItem?.required_skills?.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Required Skills</h4>
          <div className="flex flex-wrap gap-2">
            {workItem.required_skills.map((skill, idx) => (
              <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                {skill.skill || skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionsTab({ workItem }) {
  return (
    <div className="space-y-3">
      <h4 className="font-medium">Available Actions</h4>
      
      <div className="space-y-2">
        <button className="flex items-center gap-2 text-blue-600 hover:underline w-full text-left">
          <User size={16} /> Reassign to Available Technician
        </button>
        
        {workItem?.automation_available && (
          <button className="flex items-center gap-2 text-green-600 hover:underline w-full text-left">
            <Zap size={16} /> Run HVAC System Reset Automation
          </button>
        )}
        
        <button className="flex items-center gap-2 text-purple-600 hover:underline w-full text-left">
          <MessageSquare size={16} /> Open Customer Communication
        </button>
      </div>
    </div>
  );
}

function AiInsightsTab({ workItem }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">AI Recommendations</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Similar HVAC issue resolved in 4 hours using System Reset automation</li>
          <li>• Recommend assigning to Mike Rodriguez (EPA certified, available)</li>
          <li>• Consider preventive maintenance schedule after resolution</li>
        </ul>
      </div>
      
      <div className="p-3 bg-amber-50 rounded border border-amber-200">
        <h4 className="font-medium text-amber-900 mb-2">Risk Factors</h4>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• Platinum customer with premium SLA requirements</li>
          <li>• Equipment warranty expires in 4 months</li>
          <li>• Similar pattern detected 3 times this quarter</li>
        </ul>
      </div>
    </div>
  );
}

function RelationshipsTab({ workItem }) {
  return (
    <EntityRelationshipPanel workItem={workItem} className="border-0 shadow-none" />
  );
}

function FinancialTab({ workItem }) {
  return (
    <CostContextPanel workItem={workItem} className="border-0 shadow-none" />
  );
}

function ActivityLogTab({ workItem }) {
  return (
    <div className="text-sm text-gray-700">
      {Array.isArray(workItem?.activity_timeline) && workItem.activity_timeline.length > 0 ? (
        <div className="space-y-3">
          {workItem.activity_timeline.map((activity, idx) => (
            <div key={activity.id || idx} className="flex gap-3 pb-3 border-b last:border-none">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Activity size={12} className="text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{activity.action}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(activity.timestamp).toLocaleString()} • {activity.user_name}
                </div>
                {activity.description && (
                  <div className="text-sm text-gray-600 mt-1">{activity.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <p className="text-gray-500 mb-3">No detailed activity timeline available.</p>
          <div className="p-3 bg-gray-50 rounded border">
            <h4 className="font-medium text-gray-900 mb-2">Basic Activity</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Created: {new Date(workItem?.createdAt || Date.now()).toLocaleString()}</li>
              <li>• Assigned to: {workItem?.assignedTo || 'Unassigned'}</li>
              <li>• Status: {workItem?.status || 'Unknown'}</li>
              <li>• Priority: {workItem?.priority || 'Not Set'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Enhanced traceability links
 */
function TracealibityLinks({ workItem }) {
  const links = [];
  
  if (workItem?.relatedAutomation) {
    links.push({
      label: "Related Automation",
      url: `/intelligence/automation/${workItem.relatedAutomation}`,
      color: "text-green-600"
    });
  }
  
  if (workItem?.relatedKnowledge) {
    links.push({
      label: "Knowledge Article",
      url: `/intelligence/knowledge/${workItem.relatedKnowledge}`,
      color: "text-purple-600"
    });
  }
  
  if (workItem?.primary_asset_id) {
    links.push({
      label: "Primary Asset",
      url: `/asset/${workItem.primary_asset_id}`,
      color: "text-blue-600"
    });
  }
  
  if (workItem?.customer_id) {
    links.push({
      label: "Customer Details",
      url: `/customer/${workItem.customer_id}`,
      color: "text-orange-600"
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {links.length > 0 ? (
        links.map((link, idx) => (
          <Link
            key={idx}
            to={link.url}
            className={`${link.color} hover:underline text-sm block`}
          >
            {link.label}
          </Link>
        ))
      ) : (
        <p className="text-sm text-gray-500 col-span-full">No related items found</p>
      )}
    </div>
  );
}