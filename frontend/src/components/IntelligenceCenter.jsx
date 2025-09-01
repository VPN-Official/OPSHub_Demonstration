import React, { useState } from "react";
import { useAutomations } from "../contexts/AutomationsContext.jsx";
import { useKnowledge } from "../contexts/KnowledgeContext.jsx";
import { useAgents } from "../contexts/AgentsContext.jsx";
import { useNudges } from "../contexts/NudgesContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import { 
  Play, 
  FileText, 
  Bot, 
  Lightbulb, 
  Edit3, 
  Trash2, 
  Plus, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Activity
} from "lucide-react";

export default function FunctionalIntelligenceCenter() {
  const { role, user } = useAuth();
  const { automations, roleView: automationView = [], addAutomation, removeAutomation } = useAutomations();
  const { articles, roleView: knowledgeView = [], addArticle, removeArticle } = useKnowledge();
  const { agents, roleView: agentView = [], addAgent, removeAgent } = useAgents();
  const { nudges, roleView: nudgeView = [], acknowledgeNudge, removeNudge, addNudge } = useNudges();
  const { queueChange } = useSync();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("automations");
  const [actionStates, setActionStates] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(null);

  // Generic action state manager
  const setActionState = (id, state) => {
    setActionStates(prev => ({ ...prev, [id]: state }));
  };

  const getActionState = (id) => actionStates[id] || {};

  // ========================
  // AUTOMATION ACTIONS
  // ========================
  
  const executeAutomation = async (automation) => {
    if (getActionState(automation.id).executing) return;
    
    setActionState(automation.id, { executing: true });

    try {
      const executionId = `exec-${Date.now()}`;
      const executionData = {
        automationId: automation.id,
        executionId,
        triggeredBy: user?.id,
        triggeredAt: Date.now(),
        status: "running",
        script: automation.script,
        expectedDuration: automation.avg_execution_time || "30 seconds"
      };

      // Queue for API execution
      await queueChange("execute_automation", {
        ...automation,
        execution: executionData,
        apiEndpoint: `/api/automations/${automation.id}/execute`,
        method: "POST"
      });

      // Simulate execution progress (remove when API ready)
      setTimeout(() => {
        setActionState(automation.id, { 
          executing: false, 
          lastExecution: {
            status: "success",
            completedAt: Date.now(),
            duration: "45 seconds",
            executionId
          }
        });
        
        addToast({ 
          message: `Automation "${automation.name}" completed successfully`, 
          type: TOAST_TYPES.SUCCESS 
        });
      }, 3000);

      addToast({ 
        message: `Executing automation "${automation.name}"...`, 
        type: TOAST_TYPES.INFO 
      });

    } catch (error) {
      setActionState(automation.id, { executing: false, error: error.message });
      addToast({ 
        message: `Failed to execute automation: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const scheduleAutomation = async (automation, schedule) => {
    try {
      const scheduleData = {
        automationId: automation.id,
        schedule,
        createdBy: user?.id,
        createdAt: Date.now()
      };

      await queueChange("schedule_automation", {
        ...scheduleData,
        apiEndpoint: `/api/automations/${automation.id}/schedule`,
        method: "POST"
      });

      addToast({ 
        message: `Automation "${automation.name}" scheduled`, 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to schedule automation: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const createAutomation = async (automationData) => {
    try {
      const newAutomation = {
        id: `AUTO-${Date.now()}`,
        ...automationData,
        createdBy: user?.id,
        createdAt: Date.now(),
        status: "draft",
        runs: 0,
        lastRun: null,
        success_rate: 0
      };

      await addAutomation(newAutomation);
      
      await queueChange("create_automation", {
        ...newAutomation,
        apiEndpoint: "/api/automations",
        method: "POST"
      });

      addToast({ 
        message: `Automation "${automationData.name}" created`, 
        type: TOAST_TYPES.SUCCESS 
      });
      
      setShowCreateForm(null);

    } catch (error) {
      addToast({ 
        message: `Failed to create automation: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  // ========================
  // KNOWLEDGE ACTIONS
  // ========================

  const updateKnowledge = async (article, updates) => {
    if (getActionState(article.id).updating) return;
    
    setActionState(article.id, { updating: true });

    try {
      const updatedArticle = {
        ...article,
        ...updates,
        lastUpdated: Date.now(),
        updatedBy: user?.id,
        version: (article.version || 1) + 1
      };

      await queueChange("update_knowledge", {
        ...updatedArticle,
        apiEndpoint: `/api/knowledge/${article.id}`,
        method: "PUT"
      });

      setActionState(article.id, { updating: false });
      
      addToast({ 
        message: `Knowledge article "${article.title}" updated`, 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      setActionState(article.id, { updating: false, error: error.message });
      addToast({ 
        message: `Failed to update article: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const validateKnowledge = async (article) => {
    setActionState(article.id, { validating: true });

    try {
      const validationData = {
        articleId: article.id,
        validatedBy: user?.id,
        validatedAt: Date.now(),
        accuracyScore: Math.random() * 0.2 + 0.8, // Simulate 80-100% accuracy
        relevanceScore: Math.random() * 0.3 + 0.7,
        completenessScore: Math.random() * 0.4 + 0.6
      };

      await queueChange("validate_knowledge", {
        ...validationData,
        article,
        apiEndpoint: `/api/knowledge/${article.id}/validate`,
        method: "POST"
      });

      // Simulate validation results
      setTimeout(() => {
        setActionState(article.id, {
          validating: false,
          validation: validationData
        });
        
        addToast({ 
          message: `Knowledge validation completed for "${article.title}"`, 
          type: TOAST_TYPES.SUCCESS 
        });
      }, 2000);

      addToast({ 
        message: `Validating knowledge article...`, 
        type: TOAST_TYPES.INFO 
      });

    } catch (error) {
      setActionState(article.id, { validating: false, error: error.message });
      addToast({ 
        message: `Knowledge validation failed: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  // ========================
  // AGENT ACTIONS
  // ========================

  const trainAgent = async (agent) => {
    if (getActionState(agent.id).training) return;
    
    setActionState(agent.id, { training: true });

    try {
      const trainingData = {
        agentId: agent.id,
        trainingStarted: Date.now(),
        trainingType: "incremental",
        datasetSize: agent.trainingData?.incidents_processed || 1000,
        estimatedDuration: "15 minutes"
      };

      await queueChange("train_agent", {
        ...trainingData,
        agent,
        apiEndpoint: `/api/agents/${agent.id}/train`,
        method: "POST"
      });

      // Simulate training progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        setActionState(agent.id, { 
          training: true, 
          progress: Math.min(progress, 100) 
        });
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          setActionState(agent.id, {
            training: false,
            lastTraining: {
              completedAt: Date.now(),
              accuracyImprovement: (Math.random() * 0.1).toFixed(2),
              newAccuracy: (agent.trainingData?.accuracy + Math.random() * 0.1).toFixed(2)
            }
          });
          
          addToast({ 
            message: `Agent "${agent.name}" training completed`, 
            type: TOAST_TYPES.SUCCESS 
          });
        }
      }, 1000);

      addToast({ 
        message: `Training agent "${agent.name}"...`, 
        type: TOAST_TYPES.INFO 
      });

    } catch (error) {
      setActionState(agent.id, { training: false, error: error.message });
      addToast({ 
        message: `Agent training failed: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const testAgent = async (agent) => {
    if (getActionState(agent.id).testing) return;
    
    setActionState(agent.id, { testing: true });

    try {
      const testData = {
        agentId: agent.id,
        testStarted: Date.now(),
        testScenarios: ["incident_triage", "knowledge_search", "priority_scoring"],
        testDataSize: 50
      };

      await queueChange("test_agent", {
        ...testData,
        agent,
        apiEndpoint: `/api/agents/${agent.id}/test`,
        method: "POST"
      });

      // Simulate test execution
      setTimeout(() => {
        const testResults = {
          completedAt: Date.now(),
          accuracy: (0.7 + Math.random() * 0.3).toFixed(2),
          precision: (0.6 + Math.random() * 0.4).toFixed(2),
          recall: (0.65 + Math.random() * 0.35).toFixed(2),
          testsPassed: Math.floor(35 + Math.random() * 15),
          totalTests: 50
        };

        setActionState(agent.id, { 
          testing: false, 
          lastTest: testResults 
        });
        
        addToast({ 
          message: `Agent testing completed: ${testResults.testsPassed}/${testResults.totalTests} passed`, 
          type: TOAST_TYPES.SUCCESS 
        });
      }, 4000);

      addToast({ 
        message: `Testing agent "${agent.name}"...`, 
        type: TOAST_TYPES.INFO 
      });

    } catch (error) {
      setActionState(agent.id, { testing: false, error: error.message });
      addToast({ 
        message: `Agent testing failed: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  // ========================
  // NUDGE ACTIONS
  // ========================

  const acknowledgeNudgeWithAction = async (nudge) => {
    try {
      await acknowledgeNudge(nudge.id);
      
      await queueChange("acknowledge_nudge", {
        nudgeId: nudge.id,
        acknowledgedBy: user?.id,
        acknowledgedAt: Date.now(),
        apiEndpoint: `/api/nudges/${nudge.id}/acknowledge`,
        method: "POST"
      });

      addToast({ 
        message: `Nudge "${nudge.title}" acknowledged`, 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to acknowledge nudge: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const implementNudgeSuggestion = async (nudge) => {
    try {
      const implementationData = {
        nudgeId: nudge.id,
        implementedBy: user?.id,
        implementedAt: Date.now(),
        implementationType: nudge.category,
        estimatedImpact: nudge.cost_impact || 0
      };

      await queueChange("implement_nudge", {
        ...implementationData,
        nudge,
        apiEndpoint: `/api/nudges/${nudge.id}/implement`,
        method: "POST"
      });

      addToast({ 
        message: `Implementation started for "${nudge.title}"`, 
        type: TOAST_TYPES.INFO 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to implement nudge: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Enhanced Header with Role Context */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Intelligence Center</h2>
          <div className="text-sm text-gray-600 mt-1">
            {role} workspace • AI-powered operations improvement
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateForm(activeTab)}
            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus size={14} />
            Create {activeTab.slice(0, -1)}
          </button>
        </div>
      </div>

      {/* Enhanced Tab Navigation */}
      <div className="border-b flex gap-6 text-sm">
        {[
          { key: "automations", label: "Automations", icon: Play },
          { key: "knowledge", label: "Knowledge", icon: FileText },
          { key: "agents", label: "Agents", icon: Bot },
          { key: "nudges", label: "Nudges", icon: Lightbulb }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-2 flex items-center gap-1 ${
              activeTab === key 
                ? "border-b-2 border-blue-600 text-blue-600" 
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === "automations" && (
          <AutomationsTab
            automations={automationView}
            onExecute={executeAutomation}
            onSchedule={scheduleAutomation}
            actionStates={actionStates}
            role={role}
          />
        )}

        {activeTab === "knowledge" && (
          <KnowledgeTab
            articles={knowledgeView}
            onUpdate={updateKnowledge}
            onValidate={validateKnowledge}
            actionStates={actionStates}
            role={role}
          />
        )}

        {activeTab === "agents" && (
          <AgentsTab
            agents={agentView}
            onTrain={trainAgent}
            onTest={testAgent}
            actionStates={actionStates}
            role={role}
          />
        )}

        {activeTab === "nudges" && (
          <NudgesTab
            nudges={nudgeView}
            onAcknowledge={acknowledgeNudgeWithAction}
            onImplement={implementNudgeSuggestion}
            actionStates={actionStates}
            role={role}
          />
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <CreateFormModal
          type={showCreateForm}
          onClose={() => setShowCreateForm(null)}
          onCreate={showCreateForm === "automations" ? createAutomation : null}
          user={user}
        />
      )}
    </div>
  );
}

// ========================
// TAB COMPONENTS
// ========================

function AutomationsTab({ automations, onExecute, onSchedule, actionStates, role }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        {automations.length} automations • {automations.filter(a => a.status === "active").length} active
      </div>
      
      {automations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No automations available. Create your first automation to get started.
        </div>
      ) : (
        automations.map((automation) => (
          <AutomationCard
            key={automation.id}
            automation={automation}
            onExecute={onExecute}
            onSchedule={onSchedule}
            actionState={actionStates[automation.id] || {}}
            canExecute={["Automation Engineer", "Senior Site Reliability Engineer"].includes(role)}
          />
        ))
      )}
    </div>
  );
}

function KnowledgeTab({ articles, onUpdate, onValidate, actionStates, role }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        {articles.length} articles • {articles.filter(a => a.gap).length} gaps identified
      </div>
      
      {articles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No knowledge articles found. Start building your knowledge base.
        </div>
      ) : (
        articles.map((article) => (
          <KnowledgeCard
            key={article.id}
            article={article}
            onUpdate={onUpdate}
            onValidate={onValidate}
            actionState={actionStates[article.id] || {}}
            canEdit={["SME", "Manager"].includes(role)}
          />
        ))
      )}
    </div>
  );
}

function AgentsTab({ agents, onTrain, onTest, actionStates, role }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        {agents.length} agents • {agents.filter(a => a.trainingNeeded).length} need training
      </div>
      
      {agents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No agents available. Deploy your first AI agent to get started.
        </div>
      ) : (
        agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onTrain={onTrain}
            onTest={onTest}
            actionState={actionStates[agent.id] || {}}
            canTrain={["Agent Designer", "Manager"].includes(role)}
          />
        ))
      )}
    </div>
  );
}

function NudgesTab({ nudges, onAcknowledge, onImplement, actionStates, role }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        {nudges.length} nudges • {nudges.filter(n => !n.acknowledged).length} pending action
      </div>
      
      {nudges.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No nudges available. AI will suggest improvements as patterns are detected.
        </div>
      ) : (
        nudges.map((nudge) => (
          <NudgeCard
            key={nudge.id}
            nudge={nudge}
            onAcknowledge={onAcknowledge}
            onImplement={onImplement}
            actionState={actionStates[nudge.id] || {}}
            canImplement={true} // All roles can act on nudges
          />
        ))
      )}
    </div>
  );
}

// ========================
// CARD COMPONENTS
// ========================

function AutomationCard({ automation, onExecute, onSchedule, actionState, canExecute }) {
  const { executing, lastExecution, error } = actionState;

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-medium">{automation.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{automation.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {automation.success_rate && (
            <span className={`text-xs px-2 py-1 rounded ${
              automation.success_rate > 90 ? "bg-green-100 text-green-700" :
              automation.success_rate > 70 ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>
              {automation.success_rate}% success
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded ${
            automation.status === "active" ? "bg-green-100 text-green-700" :
            "bg-gray-100 text-gray-700"
          }`}>
            {automation.status}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {automation.runs} runs • Last: {automation.lastRun ? 
            new Date(automation.lastRun).toLocaleDateString() : "Never"}
        </div>
        
        {canExecute && (
          <div className="flex gap-2">
            <button
              onClick={() => onExecute(automation)}
              disabled={executing || automation.status !== "active"}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              {executing ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
              {executing ? "Running..." : "Execute"}
            </button>
          </div>
        )}
      </div>

      {lastExecution && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
          Last execution: {lastExecution.status} in {lastExecution.duration}
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-red-50 text-red-700 rounded text-xs">
          Error: {error}
        </div>
      )}
    </div>
  );
}

function KnowledgeCard({ article, onUpdate, onValidate, actionState, canEdit }) {
  const { updating, validating, validation, error } = actionState;

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-medium">{article.title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Last updated: {new Date(article.last_updated || Date.now()).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {article.usage_count && (
            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
              {article.usage_count} uses
            </span>
          )}
          {article.gap && (
            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
              Gap Identified
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Success rate: {article.success_rate}% • Service: {article.relatedService}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => onValidate(article)}
            disabled={validating}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {validating ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {validating ? "Validating..." : "Validate"}
          </button>
          
          {canEdit && (
            <button
              onClick={() => onUpdate(article, { reviewed: true })}
              disabled={updating}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              <Edit3 size={12} />
              Edit
            </button>
          )}
        </div>
      </div>

      {validation && (
        <div className="mt-3 p-2 bg-green-50 rounded text-xs">
          Validation: {(validation.accuracyScore * 100).toFixed(0)}% accuracy
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, onTrain, onTest, actionState, canTrain }) {
  const { training, testing, progress, lastTraining, lastTest, error } = actionState;

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-medium">{agent.name}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Confidence: {(agent.confidence || 0)}% • Version: {agent.version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {agent.trainingNeeded && (
            <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">
              Training Needed
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded ${
            agent.confidence > 90 ? "bg-green-100 text-green-700" :
            agent.confidence > 70 ? "bg-yellow-100 text-yellow-700" :
            "bg-red-100 text-red-700"
          }`}>
            {agent.trainingData?.accuracy * 100}% accuracy
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {agent.current_task} • {agent.actions_taken} actions
        </div>
        
        {canTrain && (
          <div className="flex gap-2">
            <button
              onClick={() => onTest(agent)}
              disabled={testing || training}
              className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
            >
              {testing ? <RefreshCw size={12} className="animate-spin" /> : <Activity size={12} />}
              {testing ? "Testing..." : "Test"}
            </button>
            
            <button
              onClick={() => onTrain(agent)}
              disabled={training || testing}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {training ? <RefreshCw size={12} className="animate-spin" /> : <Database size={12} />}
              {training ? `Training... ${progress?.toFixed(0) || 0}%` : "Train"}
            </button>
          </div>
        )}
      </div>

      {(lastTraining || lastTest) && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
          {lastTraining && `Last training: +${lastTraining.accuracyImprovement} accuracy`}
          {lastTest && `Last test: ${lastTest.testsPassed}/${lastTest.totalTests} passed`}
        </div>
      )}
    </div>
  );
}

function NudgeCard({ nudge, onAcknowledge, onImplement, actionState, canImplement }) {
  return (
    <div className={`border rounded-lg p-4 ${
      nudge.acknowledged ? "bg-gray-50" : "bg-white"
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-medium">{nudge.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{nudge.message}</p>
        </div>
        <div className="flex items-center gap-2">
          {nudge.cost_impact && (
            <span className={`text-xs px-2 py-1 rounded ${
              nudge.cost_impact > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}>
              {nudge.cost_impact > 0 ? "+" : ""}${nudge.cost_impact?.toLocaleString()}
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded ${
            nudge.severity === "critical" ? "bg-red-100 text-red-700" :
            nudge.severity === "high" ? "bg-orange-100 text-orange-700" :
            "bg-yellow-100 text-yellow-700"
          }`}>
            {nudge.severity?.toUpperCase()}
          </span>
        </div>
      </div>

      {!nudge.acknowledged && canImplement && (
        <div className="flex gap-2">
          <button
            onClick={() => onAcknowledge(nudge)}
            className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
          >
            <CheckCircle2 size={12} />
            Acknowledge
          </button>
          
          <button
            onClick={() => onImplement(nudge)}
            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            <Play size={12} />
            Implement
          </button>
        </div>
      )}
    </div>
  );
}

// ========================
// CREATE FORM MODAL
// ========================

function CreateFormModal({ type, onClose, onCreate, user }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    script: type === "automations" ? "#!/bin/bash\necho 'New automation script'" : ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onCreate) {
      onCreate(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">
          Create New {type.slice(0, -1).charAt(0).toUpperCase() + type.slice(1, -1)}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm h-20"
              required
            />
          </div>
          
          {type === "automations" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Script
              </label>
              <textarea
                value={formData.script}
                onChange={(e) => setFormData(prev => ({ ...prev, script: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm font-mono h-32"
                required
              />
            </div>
          )}
          
          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}