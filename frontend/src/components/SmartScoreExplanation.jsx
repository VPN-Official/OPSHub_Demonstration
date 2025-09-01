import React, { useState } from "react";
import { Info, X, AlertTriangle, Clock, User, Building } from "lucide-react";

/**
 * SmartScoreExplanation
 * - Shows WHY the AI prioritized this work item
 * - Context-aware explanations based on AiOps data relationships
 * - Modal with detailed scoring breakdown
 * - Preserves existing score display while adding transparency
 */
export default function SmartScoreExplanation({ 
  workItem, 
  config, 
  className = "",
  compactMode = false 
}) {
  const [showExplanation, setShowExplanation] = useState(false);

  if (!workItem || workItem.smartScore === undefined || workItem.smartScore === null) {
    return <span className="text-gray-400">—</span>;
  }

  // Calculate comprehensive scoring explanation
  const getScoreExplanation = () => {
    const explanations = [];
    const score = workItem.smartScore;
    let calculatedScore = 0;

    // Priority-based scoring with business context
    if (workItem.priority === "P0") {
      explanations.push({
        category: "Priority",
        reason: "Critical Priority (P0) - Production Down",
        points: 50,
        color: "text-red-600",
        icon: AlertTriangle
      });
      calculatedScore += 50;
    } else if (workItem.priority === "P1") {
      explanations.push({
        category: "Priority", 
        reason: "High Priority (P1) - Major Business Impact",
        points: 40,
        color: "text-orange-600",
        icon: AlertTriangle
      });
      calculatedScore += 40;
    } else if (workItem.priority === "P2") {
      explanations.push({
        category: "Priority",
        reason: "Medium Priority (P2)",
        points: 20,
        color: "text-yellow-600", 
        icon: AlertTriangle
      });
      calculatedScore += 20;
    }

    // SLA impact scoring
    if (workItem.slaBreached) {
      explanations.push({
        category: "SLA",
        reason: "SLA Breach - Contract Penalties at Risk", 
        points: 30,
        color: "text-red-600",
        icon: Clock
      });
      calculatedScore += 30;
    }

    // Customer tier impact
    if (workItem.customer_tier === "platinum") {
      explanations.push({
        category: "Customer",
        reason: "Platinum Customer - Premium SLA",
        points: 25,
        color: "text-purple-600",
        icon: Building
      });
      calculatedScore += 25;
    } else if (workItem.customer_tier === "gold") {
      explanations.push({
        category: "Customer",
        reason: "Gold Customer - Enhanced SLA", 
        points: 15,
        color: "text-yellow-600",
        icon: Building
      });
      calculatedScore += 15;
    }

    // Age-based urgency
    if (workItem.createdAt) {
      const ageHours = (Date.now() - workItem.createdAt) / (1000 * 60 * 60);
      if (ageHours > 48) {
        explanations.push({
          category: "Age",
          reason: "Open for 48+ hours - Extended Duration",
          points: 20,
          color: "text-orange-600", 
          icon: Clock
        });
        calculatedScore += 20;
      } else if (ageHours > 24) {
        explanations.push({
          category: "Age", 
          reason: "Open for 24+ hours - Aging",
          points: 15,
          color: "text-yellow-600",
          icon: Clock
        });
        calculatedScore += 15;
      }
    }

    // Asset criticality
    if (workItem.asset_criticality === "high") {
      explanations.push({
        category: "Asset",
        reason: "High-Criticality Asset Affected",
        points: 20,
        color: "text-red-600",
        icon: AlertTriangle
      });
      calculatedScore += 20;
    }

    // Work type impact
    if (workItem.type === "incident") {
      explanations.push({
        category: "Type",
        reason: "Incident - Immediate Response Required",
        points: 15,
        color: "text-blue-600",
        icon: AlertTriangle
      });
      calculatedScore += 15;
    }

    // Skills availability factor
    if (workItem.required_skills && workItem.available_skilled_techs) {
      if (workItem.available_skilled_techs < 2) {
        explanations.push({
          category: "Skills",
          reason: "Limited Skilled Technicians Available",
          points: 10,
          color: "text-orange-600",
          icon: User
        });
        calculatedScore += 10;
      }
    }

    // Assignment status
    if (workItem.assignedTo && workItem.assignedTo !== "unassigned") {
      explanations.push({
        category: "Assignment",
        reason: "Already Assigned - Work in Progress", 
        points: 5,
        color: "text-green-600",
        icon: User
      });
      calculatedScore += 5;
    }

    // Determine urgency level with business context
    const getUrgencyLevel = (score) => {
      if (score >= 90) return { 
        level: "Critical", 
        color: "text-red-600", 
        bgColor: "bg-red-50",
        description: "Immediate escalation required"
      };
      if (score >= 70) return { 
        level: "High", 
        color: "text-orange-600", 
        bgColor: "bg-orange-50",
        description: "Priority assignment needed" 
      };
      if (score >= 50) return { 
        level: "Medium", 
        color: "text-yellow-600", 
        bgColor: "bg-yellow-50",
        description: "Normal queue processing"
      };
      return { 
        level: "Low", 
        color: "text-gray-600", 
        bgColor: "bg-gray-50",
        description: "Standard workflow"
      };
    };

    const urgency = getUrgencyLevel(score);

    return {
      score,
      calculatedScore,
      urgency,
      explanations,
      summary: `${urgency.level} priority based on ${explanations.length} factors`
    };
  };

  const explanation = getScoreExplanation();

  // Compact mode for mobile/tight spaces
  if (compactMode) {
    return (
      <div className={`relative inline-block ${className}`}>
        <button
          onClick={() => setShowExplanation(true)}
          className={`text-xs font-medium px-2 py-1 rounded ${explanation.urgency.bgColor} ${explanation.urgency.color}`}
        >
          {workItem.smartScore}
        </button>
        {showExplanation && <ExplanationModal explanation={explanation} onClose={() => setShowExplanation(false)} />}
      </div>
    );
  }

  // Full mode for desktop
  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => setShowExplanation(true)}
        className="flex items-center gap-2 text-sm hover:bg-gray-100 px-3 py-1 rounded transition-colors"
      >
        <span className={`font-semibold ${explanation.urgency.color}`}>
          {workItem.smartScore}
        </span>
        <span className="text-xs text-gray-500">{explanation.urgency.level}</span>
        <Info size={14} className="text-gray-400" />
      </button>

      {showExplanation && (
        <ExplanationModal 
          explanation={explanation} 
          onClose={() => setShowExplanation(false)} 
        />
      )}
    </div>
  );
}

/**
 * ExplanationModal - Detailed scoring breakdown
 */
function ExplanationModal({ explanation, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Smart Score Explanation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Score Summary */}
        <div className={`p-4 ${explanation.urgency.bgColor} border-b`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-2xl font-bold ${explanation.urgency.color}`}>
                {explanation.score}
              </div>
              <div className={`text-sm ${explanation.urgency.color}`}>
                {explanation.urgency.level} Priority
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <div>{explanation.urgency.description}</div>
              <div className="text-xs mt-1">{explanation.summary}</div>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="p-4 max-h-96 overflow-y-auto">
          <h4 className="font-medium mb-3">Scoring Factors:</h4>
          
          {explanation.explanations.length === 0 ? (
            <p className="text-sm text-gray-500">No specific factors identified for this score.</p>
          ) : (
            <div className="space-y-3">
              {explanation.explanations.map((factor, idx) => {
                const IconComponent = factor.icon;
                return (
                  <div key={idx} className="flex items-start gap-3 p-2 rounded bg-gray-50">
                    <IconComponent size={16} className={`mt-0.5 ${factor.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{factor.reason}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        Category: {factor.category}
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${factor.color}`}>
                      +{factor.points}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Calculation Summary */}
          <div className="mt-4 pt-3 border-t text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Calculated Score:</span>
              <span>{explanation.calculatedScore}</span>
            </div>
            <div className="flex justify-between">
              <span>AI-Adjusted Score:</span>
              <span>{explanation.score}</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              AI considers additional factors like technician workload, location proximity, and historical success rates.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}