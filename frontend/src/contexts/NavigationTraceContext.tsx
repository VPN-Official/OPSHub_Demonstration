// src/contexts/NavigationTraceContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { 
  getAll,
  getById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useRealtimeStream } from "./RealtimeStreamContext";

// ---------------------------------
// 1. Entity Relationship Types
// ---------------------------------

export interface EntityReference {
  entityType: string;
  entityId: string;
  displayName: string;
  entityStatus?: string;
  entityMetadata?: Record<string, any>;
}

export interface EntityRelationship {
  id: string;
  fromEntity: EntityReference;
  toEntity: EntityReference;
  relationshipType: RelationshipType;
  relationshipStrength: 'strong' | 'moderate' | 'weak';
  direction: 'unidirectional' | 'bidirectional';
  metadata?: Record<string, any>;
  createdAt: string;
  validUntil?: string;
}

export type RelationshipType = 
  | 'parent-child'
  | 'dependency'
  | 'association'
  | 'impact'
  | 'ownership'
  | 'assignment'
  | 'reference'
  | 'trigger'
  | 'upstream'
  | 'downstream'
  | 'peer'
  | 'backup'
  | 'cluster'
  | 'service-component'
  | 'business-technical';

export interface RelatedEntity extends EntityReference {
  relationship: RelationshipType;
  relationshipStrength: 'strong' | 'moderate' | 'weak';
  distance: number; // Degrees of separation
  path?: EntityReference[]; // Path to this entity
  impactScore?: number;
  relevanceScore?: number;
}

// ---------------------------------
// 2. Navigation Types
// ---------------------------------

export interface NavigationBreadcrumb {
  id: string;
  entityRef: EntityReference;
  timestamp: string;
  action?: string;
  context?: Record<string, any>;
}

export interface NavigationContext {
  currentEntity: EntityReference | null;
  previousEntity: EntityReference | null;
  navigationStack: NavigationBreadcrumb[];
  activeView: string;
  filters?: Record<string, any>;
  searchQuery?: string;
  selectedItems?: EntityReference[];
}

export interface TracePath {
  id: string;
  fromEntity: EntityReference;
  toEntity: EntityReference;
  path: EntityReference[];
  distance: number;
  pathType: 'shortest' | 'strongest' | 'impact' | 'causal';
  totalImpactScore?: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

// ---------------------------------
// 3. Contextual Actions Types
// ---------------------------------

export interface ContextualAction {
  id: string;
  actionType: string;
  label: string;
  description?: string;
  icon?: string;
  category: 'primary' | 'secondary' | 'danger' | 'info';
  enabled: boolean;
  visible: boolean;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  
  // Action execution
  handler?: (entity: EntityReference, context?: any) => Promise<void>;
  apiEndpoint?: string;
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  payload?: any;
  
  // Permissions and conditions
  requiredPermissions?: string[];
  conditions?: ActionCondition[];
  
  // UI hints
  shortcut?: string;
  tooltip?: string;
  badge?: string | number;
  groupId?: string;
  sortOrder?: number;
}

export interface ActionCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'gt' | 'lt' | 'in' | 'notIn';
  value: any;
  combineWith?: 'and' | 'or';
}

export interface ActionGroup {
  id: string;
  label: string;
  icon?: string;
  actions: ContextualAction[];
  sortOrder?: number;
}

// ---------------------------------
// 4. Deep Linking Types
// ---------------------------------

export interface DeepLinkConfig {
  baseUrl?: string;
  includeFilters?: boolean;
  includeContext?: boolean;
  shortLinks?: boolean;
  expirationTime?: number; // In seconds
}

export interface DeepLinkResult {
  url: string;
  shortUrl?: string;
  expiresAt?: string;
  qrCode?: string;
}

// ---------------------------------
// 5. Graph Visualization Types
// ---------------------------------

export interface EntityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout?: 'force' | 'hierarchical' | 'circular' | 'grid';
  metadata?: Record<string, any>;
}

export interface GraphNode {
  id: string;
  entity: EntityReference;
  x?: number;
  y?: number;
  group?: string;
  size?: number;
  color?: string;
  icon?: string;
  highlighted?: boolean;
  expanded?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: RelationshipType;
  strength: number;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  animated?: boolean;
}

// ---------------------------------
// 6. Navigation Trace Context Interface
// ---------------------------------

export interface NavigationTraceContextProps {
  // Entity relationships
  entityRelationships: Record<string, EntityRelationship[]>;
  relationshipGraph: EntityGraph | null;
  loadingRelationships: boolean;
  
  // Navigation state
  navigationHistory: NavigationBreadcrumb[];
  currentContext: NavigationContext;
  canGoBack: boolean;
  canGoForward: boolean;
  
  // Traceability navigation
  getRelatedEntities: (entityType: string, entityId: string, options?: RelationshipOptions) => Promise<RelatedEntity[]>;
  navigateToEntity: (entity: EntityReference, context?: Record<string, any>) => void;
  buildTraceabilityPath: (fromEntity: EntityReference, toEntity: EntityReference, pathType?: TracePath['pathType']) => Promise<TracePath[]>;
  findImpactedEntities: (entity: EntityReference, impactType?: string) => Promise<RelatedEntity[]>;
  findDependencies: (entity: EntityReference, recursive?: boolean) => Promise<RelatedEntity[]>;
  
  // Contextual actions
  getContextualActions: (entityType: string, entityId: string) => Promise<ContextualAction[]>;
  executeContextualAction: (action: ContextualAction, entity: EntityReference) => Promise<void>;
  registerActionHandler: (actionType: string, handler: ActionHandler) => void;
  unregisterActionHandler: (actionType: string) => void;
  
  // Navigation state management
  pushBreadcrumb: (breadcrumb: NavigationBreadcrumb) => void;
  popBreadcrumb: () => NavigationBreadcrumb | null;
  goBack: () => void;
  goForward: () => void;
  resetNavigation: () => void;
  clearHistory: () => void;
  
  // Deep linking
  generateDeepLink: (entity: EntityReference, config?: DeepLinkConfig) => Promise<DeepLinkResult>;
  navigateFromDeepLink: (deepLink: string) => Promise<void>;
  resolveDeepLink: (deepLink: string) => Promise<EntityReference | null>;
  
  // Graph operations
  buildEntityGraph: (centerEntity: EntityReference, depth?: number) => Promise<EntityGraph>;
  expandGraphNode: (nodeId: string) => Promise<void>;
  collapseGraphNode: (nodeId: string) => Promise<void>;
  highlightPath: (fromNodeId: string, toNodeId: string) => void;
  
  // Search and discovery
  searchRelatedEntities: (query: string, entityType?: string) => Promise<EntityReference[]>;
  discoverRelationships: (entity: EntityReference) => Promise<EntityRelationship[]>;
  suggestNavigation: (currentEntity: EntityReference) => Promise<EntityReference[]>;
  
  // Utilities
  isEntityRelated: (entity1: EntityReference, entity2: EntityReference) => boolean;
  getRelationshipStrength: (entity1: EntityReference, entity2: EntityReference) => number;
  getEntityDistance: (entity1: EntityReference, entity2: EntityReference) => number;
}

export interface RelationshipOptions {
  relationshipTypes?: RelationshipType[];
  maxDistance?: number;
  includeIndirect?: boolean;
  sortBy?: 'relevance' | 'impact' | 'distance' | 'strength';
  limit?: number;
}

export type ActionHandler = (
  action: ContextualAction,
  entity: EntityReference,
  context?: any
) => Promise<void>;

// ---------------------------------
// 7. Relationship Discovery Engine
// ---------------------------------

class RelationshipEngine {
  private relationships: Map<string, EntityRelationship[]> = new Map();
  private entityCache: Map<string, EntityReference> = new Map();
  private pathCache: Map<string, TracePath[]> = new Map();
  
  constructor() {
    this.initializeEngine();
  }
  
  private initializeEngine() {
    // Initialize with common relationship patterns
    this.registerRelationshipPatterns();
  }
  
  private registerRelationshipPatterns() {
    // Define common patterns for automatic relationship discovery
    // This would be enhanced by backend ML models
  }
  
  public addRelationship(relationship: EntityRelationship) {
    const key = this.getEntityKey(relationship.fromEntity);
    if (!this.relationships.has(key)) {
      this.relationships.set(key, []);
    }
    this.relationships.get(key)!.push(relationship);
    
    // Add reverse relationship if bidirectional
    if (relationship.direction === 'bidirectional') {
      const reverseKey = this.getEntityKey(relationship.toEntity);
      if (!this.relationships.has(reverseKey)) {
        this.relationships.set(reverseKey, []);
      }
      this.relationships.get(reverseKey)!.push({
        ...relationship,
        fromEntity: relationship.toEntity,
        toEntity: relationship.fromEntity,
      });
    }
  }
  
  public getRelatedEntities(
    entity: EntityReference,
    options: RelationshipOptions = {}
  ): RelatedEntity[] {
    const {
      relationshipTypes,
      maxDistance = 3,
      includeIndirect = true,
      sortBy = 'relevance',
      limit = 100,
    } = options;
    
    const visited = new Set<string>();
    const related: RelatedEntity[] = [];
    const queue: Array<{ entity: EntityReference; distance: number; path: EntityReference[] }> = [
      { entity, distance: 0, path: [] }
    ];
    
    while (queue.length > 0 && related.length < limit) {
      const current = queue.shift()!;
      const key = this.getEntityKey(current.entity);
      
      if (visited.has(key) || current.distance > maxDistance) {
        continue;
      }
      
      visited.add(key);
      
      // Get direct relationships
      const directRelations = this.relationships.get(key) || [];
      
      for (const rel of directRelations) {
        if (relationshipTypes && !relationshipTypes.includes(rel.relationshipType)) {
          continue;
        }
        
        const relatedEntity: RelatedEntity = {
          ...rel.toEntity,
          relationship: rel.relationshipType,
          relationshipStrength: rel.relationshipStrength,
          distance: current.distance + 1,
          path: [...current.path, current.entity],
          impactScore: this.calculateImpactScore(rel),
          relevanceScore: this.calculateRelevanceScore(rel, current.distance),
        };
        
        related.push(relatedEntity);
        
        // Add to queue for indirect relationships
        if (includeIndirect && current.distance + 1 < maxDistance) {
          queue.push({
            entity: rel.toEntity,
            distance: current.distance + 1,
            path: [...current.path, current.entity],
          });
        }
      }
    }
    
    // Sort results
    return this.sortRelatedEntities(related, sortBy).slice(0, limit);
  }
  
  public findPath(
    fromEntity: EntityReference,
    toEntity: EntityReference,
    pathType: TracePath['pathType'] = 'shortest'
  ): TracePath[] {
    const cacheKey = `${this.getEntityKey(fromEntity)}_${this.getEntityKey(toEntity)}_${pathType}`;
    
    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey)!;
    }
    
    const paths: TracePath[] = [];
    
    switch (pathType) {
      case 'shortest':
        paths.push(...this.findShortestPaths(fromEntity, toEntity));
        break;
      case 'strongest':
        paths.push(...this.findStrongestPaths(fromEntity, toEntity));
        break;
      case 'impact':
        paths.push(...this.findImpactPaths(fromEntity, toEntity));
        break;
      case 'causal':
        paths.push(...this.findCausalPaths(fromEntity, toEntity));
        break;
    }
    
    this.pathCache.set(cacheKey, paths);
    return paths;
  }
  
  private findShortestPaths(from: EntityReference, to: EntityReference): TracePath[] {
    // Implement BFS for shortest path
    const paths: TracePath[] = [];
    const queue: Array<{ current: EntityReference; path: EntityReference[] }> = [
      { current: from, path: [from] }
    ];
    const visited = new Set<string>();
    const toKey = this.getEntityKey(to);
    
    while (queue.length > 0) {
      const { current, path } = queue.shift()!;
      const currentKey = this.getEntityKey(current);
      
      if (currentKey === toKey) {
        paths.push({
          id: `path_${Date.now()}_${paths.length}`,
          fromEntity: from,
          toEntity: to,
          path: path,
          distance: path.length - 1,
          pathType: 'shortest',
          confidence: 1.0,
        });
        continue;
      }
      
      if (visited.has(currentKey)) {
        continue;
      }
      
      visited.add(currentKey);
      
      const relationships = this.relationships.get(currentKey) || [];
      for (const rel of relationships) {
        if (!visited.has(this.getEntityKey(rel.toEntity))) {
          queue.push({
            current: rel.toEntity,
            path: [...path, rel.toEntity],
          });
        }
      }
    }
    
    return paths;
  }
  
  private findStrongestPaths(from: EntityReference, to: EntityReference): TracePath[] {
    // Implement Dijkstra's algorithm with relationship strength as weight
    // Placeholder implementation
    return this.findShortestPaths(from, to);
  }
  
  private findImpactPaths(from: EntityReference, to: EntityReference): TracePath[] {
    // Find paths that maximize impact score
    // Placeholder implementation
    return this.findShortestPaths(from, to);
  }
  
  private findCausalPaths(from: EntityReference, to: EntityReference): TracePath[] {
    // Find paths following causal relationships
    // Placeholder implementation
    return this.findShortestPaths(from, to);
  }
  
  private getEntityKey(entity: EntityReference): string {
    return `${entity.entityType}:${entity.entityId}`;
  }
  
  private calculateImpactScore(relationship: EntityRelationship): number {
    const strengthMultiplier = {
      strong: 1.0,
      moderate: 0.6,
      weak: 0.3,
    };
    
    const typeMultiplier = {
      'parent-child': 0.9,
      'dependency': 1.0,
      'impact': 0.95,
      'ownership': 0.8,
      'association': 0.5,
    } as Record<string, number>;
    
    const strength = strengthMultiplier[relationship.relationshipStrength];
    const type = typeMultiplier[relationship.relationshipType] || 0.5;
    
    return strength * type;
  }
  
  private calculateRelevanceScore(relationship: EntityRelationship, distance: number): number {
    const impactScore = this.calculateImpactScore(relationship);
    const distancePenalty = Math.pow(0.8, distance);
    return impactScore * distancePenalty;
  }
  
  private sortRelatedEntities(entities: RelatedEntity[], sortBy: string): RelatedEntity[] {
    switch (sortBy) {
      case 'relevance':
        return entities.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      case 'impact':
        return entities.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
      case 'distance':
        return entities.sort((a, b) => a.distance - b.distance);
      case 'strength':
        const strengthOrder = { strong: 3, moderate: 2, weak: 1 };
        return entities.sort((a, b) => 
          strengthOrder[b.relationshipStrength] - strengthOrder[a.relationshipStrength]
        );
      default:
        return entities;
    }
  }
  
  public buildGraph(centerEntity: EntityReference, depth: number = 2): EntityGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();
    
    const queue: Array<{ entity: EntityReference; level: number }> = [
      { entity: centerEntity, level: 0 }
    ];
    
    // Build nodes and edges through BFS
    while (queue.length > 0) {
      const { entity, level } = queue.shift()!;
      const key = this.getEntityKey(entity);
      
      if (visited.has(key) || level > depth) {
        continue;
      }
      
      visited.add(key);
      
      // Add node
      nodes.push({
        id: key,
        entity,
        group: entity.entityType,
        size: Math.max(10, 30 - level * 5),
        highlighted: level === 0,
        expanded: level < depth,
      });
      
      // Add edges and queue connected entities
      const relationships = this.relationships.get(key) || [];
      for (const rel of relationships) {
        const targetKey = this.getEntityKey(rel.toEntity);
        
        edges.push({
          id: `${key}_${targetKey}`,
          source: key,
          target: targetKey,
          relationship: rel.relationshipType,
          strength: this.calculateImpactScore(rel),
          label: rel.relationshipType,
          style: rel.relationshipStrength === 'strong' ? 'solid' : 'dashed',
        });
        
        if (!visited.has(targetKey) && level + 1 <= depth) {
          queue.push({
            entity: rel.toEntity,
            level: level + 1,
          });
        }
      }
    }
    
    return {
      nodes,
      edges,
      layout: 'force',
      metadata: {
        centerEntity: this.getEntityKey(centerEntity),
        depth,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// ---------------------------------
// 8. Provider Component
// ---------------------------------

const NavigationTraceContext = createContext<NavigationTraceContextProps | null>(null);

export const NavigationTraceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const { triggerSync } = useSync();
  const { subscribeToEntity, onEntityUpdate } = useRealtimeStream();
  
  // State management
  const [entityRelationships, setEntityRelationships] = useState<Record<string, EntityRelationship[]>>({});
  const [relationshipGraph, setRelationshipGraph] = useState<EntityGraph | null>(null);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<NavigationBreadcrumb[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentContext, setCurrentContext] = useState<NavigationContext>({
    currentEntity: null,
    previousEntity: null,
    navigationStack: [],
    activeView: 'default',
  });
  
  // Engines and handlers
  const relationshipEngine = useRef(new RelationshipEngine());
  const actionHandlers = useRef<Map<string, ActionHandler>>(new Map());
  const deepLinkCache = useRef<Map<string, EntityReference>>(new Map());
  
  // Load relationships from database
  useEffect(() => {
    if (!tenantId) return;
    
    const loadRelationships = async () => {
      setLoadingRelationships(true);
      try {
        // Load from IndexedDB
        const relationships = await getAll('entity_relationships', tenantId);
        
        // Build relationship map
        const relMap: Record<string, EntityRelationship[]> = {};
        relationships.forEach((rel: EntityRelationship) => {
          const key = `${rel.fromEntity.entityType}:${rel.fromEntity.entityId}`;
          if (!relMap[key]) {
            relMap[key] = [];
          }
          relMap[key].push(rel);
          
          // Add to engine
          relationshipEngine.current.addRelationship(rel);
        });
        
        setEntityRelationships(relMap);
      } catch (error) {
        console.error('[NavigationTrace] Failed to load relationships:', error);
      } finally {
        setLoadingRelationships(false);
      }
    };
    
    loadRelationships();
  }, [tenantId]);
  
  // Subscribe to entity updates for current entity
  useEffect(() => {
    if (!currentContext.currentEntity) return;
    
    const { entityType, entityId } = currentContext.currentEntity;
    
    // Subscribe to realtime updates
    const subscriptionPromise = subscribeToEntity(entityType, entityId);
    
    // Register update handler
    const unsubscribe = onEntityUpdate((update) => {
      if (update.entityType === entityType && update.entityId === entityId) {
        // Update current context with latest entity data
        setCurrentContext(prev => ({
          ...prev,
          currentEntity: {
            ...prev.currentEntity!,
            entityStatus: update.currentValues?.status,
            entityMetadata: {
              ...prev.currentEntity?.entityMetadata,
              ...update.currentValues,
            },
          },
        }));
      }
    }, entityType);
    
    return () => {
      unsubscribe();
    };
  }, [currentContext.currentEntity, subscribeToEntity, onEntityUpdate]);
  
  // Traceability navigation
  const getRelatedEntities = useCallback(async (
    entityType: string,
    entityId: string,
    options?: RelationshipOptions
  ): Promise<RelatedEntity[]> => {
    const entity: EntityReference = {
      entityType,
      entityId,
      displayName: `${entityType}:${entityId}`,
    };
    
    return relationshipEngine.current.getRelatedEntities(entity, options);
  }, []);
  
  const navigateToEntity = useCallback((
    entity: EntityReference,
    context?: Record<string, any>
  ) => {
    // Create breadcrumb
    const breadcrumb: NavigationBreadcrumb = {
      id: `nav_${Date.now()}`,
      entityRef: entity,
      timestamp: new Date().toISOString(),
      action: 'navigate',
      context,
    };
    
    // Update navigation history
    setNavigationHistory(prev => {
      // If we're not at the end of history, truncate forward history
      if (historyIndex < prev.length - 1) {
        return [...prev.slice(0, historyIndex + 1), breadcrumb];
      }
      return [...prev, breadcrumb];
    });
    
    setHistoryIndex(prev => prev + 1);
    
    // Update current context
    setCurrentContext(prev => ({
      ...prev,
      previousEntity: prev.currentEntity,
      currentEntity: entity,
      navigationStack: [...prev.navigationStack, breadcrumb],
    }));
    
    // Trigger navigation event
    window.dispatchEvent(new CustomEvent('entity-navigation', {
      detail: { entity, context },
    }));
  }, [historyIndex]);
  
  const buildTraceabilityPath = useCallback(async (
    fromEntity: EntityReference,
    toEntity: EntityReference,
    pathType: TracePath['pathType'] = 'shortest'
  ): Promise<TracePath[]> => {
    return relationshipEngine.current.findPath(fromEntity, toEntity, pathType);
  }, []);
  
  const findImpactedEntities = useCallback(async (
    entity: EntityReference,
    impactType?: string
  ): Promise<RelatedEntity[]> => {
    return getRelatedEntities(entity.entityType, entity.entityId, {
      relationshipTypes: ['impact', 'dependency', 'downstream'],
      sortBy: 'impact',
    });
  }, [getRelatedEntities]);
  
  const findDependencies = useCallback(async (
    entity: EntityReference,
    recursive: boolean = false
  ): Promise<RelatedEntity[]> => {
    return getRelatedEntities(entity.entityType, entity.entityId, {
      relationshipTypes: ['dependency', 'upstream', 'parent-child'],
      includeIndirect: recursive,
      sortBy: 'strength',
    });
  }, [getRelatedEntities]);
  
  // Contextual actions
  const getContextualActions = useCallback(async (
    entityType: string,
    entityId: string
  ): Promise<ContextualAction[]> => {
    // This would typically fetch from backend based on entity type and user permissions
    const actions: ContextualAction[] = [];
    
    // Add common actions
    actions.push({
      id: 'view_details',
      actionType: 'view',
      label: 'View Details',
      icon: 'visibility',
      category: 'primary',
      enabled: true,
      visible: true,
      sortOrder: 1,
    });
    
    actions.push({
      id: 'view_relationships',
      actionType: 'navigate',
      label: 'View Relationships',
      icon: 'hub',
      category: 'info',
      enabled: true,
      visible: true,
      sortOrder: 2,
    });
    
    actions.push({
      id: 'view_impact',
      actionType: 'analyze',
      label: 'Impact Analysis',
      icon: 'analytics',
      category: 'info',
      enabled: true,
      visible: true,
      sortOrder: 3,
    });
    
    // Add entity-specific actions
    switch (entityType) {
      case 'incident':
        actions.push({
          id: 'escalate',
          actionType: 'escalate',
          label: 'Escalate',
          icon: 'arrow_upward',
          category: 'secondary',
          enabled: true,
          visible: true,
          requiresConfirmation: true,
          confirmationMessage: 'Are you sure you want to escalate this incident?',
          sortOrder: 10,
        });
        break;
      case 'change':
        actions.push({
          id: 'approve',
          actionType: 'approve',
          label: 'Approve',
          icon: 'check',
          category: 'primary',
          enabled: true,
          visible: true,
          requiresConfirmation: true,
          confirmationMessage: 'Are you sure you want to approve this change?',
          sortOrder: 10,
        });
        break;
    }
    
    return actions;
  }, []);
  
  const executeContextualAction = useCallback(async (
    action: ContextualAction,
    entity: EntityReference
  ): Promise<void> => {
    // Check for custom handler
    const handler = actionHandlers.current.get(action.actionType);
    if (handler) {
      await handler(action, entity);
      return;
    }
    
    // Use action's built-in handler
    if (action.handler) {
      await action.handler(entity);
      return;
    }
    
    // Execute API call if configured
    if (action.apiEndpoint) {
      const response = await fetch(action.apiEndpoint, {
        method: action.apiMethod || 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: entity.entityType,
          entityId: entity.entityId,
          action: action.actionType,
          payload: action.payload,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Action failed: ${response.statusText}`);
      }
    }
    
    // Trigger sync after action
    await triggerSync();
  }, [triggerSync]);
  
  const registerActionHandler = useCallback((
    actionType: string,
    handler: ActionHandler
  ) => {
    actionHandlers.current.set(actionType, handler);
  }, []);
  
  const unregisterActionHandler = useCallback((actionType: string) => {
    actionHandlers.current.delete(actionType);
  }, []);
  
  // Navigation state management
  const pushBreadcrumb = useCallback((breadcrumb: NavigationBreadcrumb) => {
    setNavigationHistory(prev => [...prev, breadcrumb]);
    setCurrentContext(prev => ({
      ...prev,
      navigationStack: [...prev.navigationStack, breadcrumb],
    }));
  }, []);
  
  const popBreadcrumb = useCallback((): NavigationBreadcrumb | null => {
    let popped: NavigationBreadcrumb | null = null;
    
    setCurrentContext(prev => {
      const stack = [...prev.navigationStack];
      popped = stack.pop() || null;
      return {
        ...prev,
        navigationStack: stack,
      };
    });
    
    return popped;
  }, []);
  
  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousBreadcrumb = navigationHistory[newIndex];
      
      setHistoryIndex(newIndex);
      setCurrentContext(prev => ({
        ...prev,
        previousEntity: prev.currentEntity,
        currentEntity: previousBreadcrumb.entityRef,
      }));
      
      // Trigger navigation event
      window.dispatchEvent(new CustomEvent('entity-navigation', {
        detail: { 
          entity: previousBreadcrumb.entityRef, 
          context: previousBreadcrumb.context,
          direction: 'back',
        },
      }));
    }
  }, [historyIndex, navigationHistory]);
  
  const goForward = useCallback(() => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      const nextBreadcrumb = navigationHistory[newIndex];
      
      setHistoryIndex(newIndex);
      setCurrentContext(prev => ({
        ...prev,
        previousEntity: prev.currentEntity,
        currentEntity: nextBreadcrumb.entityRef,
      }));
      
      // Trigger navigation event
      window.dispatchEvent(new CustomEvent('entity-navigation', {
        detail: { 
          entity: nextBreadcrumb.entityRef, 
          context: nextBreadcrumb.context,
          direction: 'forward',
        },
      }));
    }
  }, [historyIndex, navigationHistory]);
  
  const resetNavigation = useCallback(() => {
    setCurrentContext({
      currentEntity: null,
      previousEntity: null,
      navigationStack: [],
      activeView: 'default',
    });
  }, []);
  
  const clearHistory = useCallback(() => {
    setNavigationHistory([]);
    setHistoryIndex(-1);
    resetNavigation();
  }, [resetNavigation]);
  
  // Deep linking
  const generateDeepLink = useCallback(async (
    entity: EntityReference,
    config: DeepLinkConfig = {}
  ): Promise<DeepLinkResult> => {
    const {
      baseUrl = window.location.origin,
      includeFilters = false,
      includeContext = false,
      shortLinks = true,
      expirationTime,
    } = config;
    
    // Build URL parameters
    const params = new URLSearchParams({
      type: entity.entityType,
      id: entity.entityId,
    });
    
    if (includeFilters && currentContext.filters) {
      params.append('filters', JSON.stringify(currentContext.filters));
    }
    
    if (includeContext) {
      params.append('context', JSON.stringify({
        view: currentContext.activeView,
        search: currentContext.searchQuery,
      }));
    }
    
    const url = `${baseUrl}/entity?${params.toString()}`;
    
    // Generate short URL if requested
    let shortUrl: string | undefined;
    if (shortLinks) {
      const shortId = btoa(`${entity.entityType}:${entity.entityId}`).substring(0, 8);
      shortUrl = `${baseUrl}/e/${shortId}`;
      
      // Cache the mapping
      deepLinkCache.current.set(shortId, entity);
    }
    
    return {
      url,
      shortUrl,
      expiresAt: expirationTime 
        ? new Date(Date.now() + expirationTime * 1000).toISOString()
        : undefined,
    };
  }, [currentContext]);
  
  const navigateFromDeepLink = useCallback(async (deepLink: string): Promise<void> => {
    const entity = await resolveDeepLink(deepLink);
    if (entity) {
      navigateToEntity(entity);
    }
  }, [navigateToEntity]);
  
  const resolveDeepLink = useCallback(async (deepLink: string): Promise<EntityReference | null> => {
    try {
      // Check if it's a short link
      if (deepLink.includes('/e/')) {
        const shortId = deepLink.split('/e/')[1];
        const cached = deepLinkCache.current.get(shortId);
        if (cached) return cached;
        
        // Decode short ID
        try {
          const decoded = atob(shortId);
          const [entityType, entityId] = decoded.split(':');
          return { entityType, entityId, displayName: `${entityType}:${entityId}` };
        } catch {
          return null;
        }
      }
      
      // Parse regular deep link
      const url = new URL(deepLink);
      const params = new URLSearchParams(url.search);
      const entityType = params.get('type');
      const entityId = params.get('id');
      
      if (entityType && entityId) {
        return { entityType, entityId, displayName: `${entityType}:${entityId}` };
      }
      
      return null;
    } catch (error) {
      console.error('[NavigationTrace] Failed to resolve deep link:', error);
      return null;
    }
  }, []);
  
  // Graph operations
  const buildEntityGraph = useCallback(async (
    centerEntity: EntityReference,
    depth: number = 2
  ): Promise<EntityGraph> => {
    const graph = relationshipEngine.current.buildGraph(centerEntity, depth);
    setRelationshipGraph(graph);
    return graph;
  }, []);
  
  const expandGraphNode = useCallback(async (nodeId: string): Promise<void> => {
    if (!relationshipGraph) return;
    
    const node = relationshipGraph.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Build subgraph for this node
    const subgraph = relationshipEngine.current.buildGraph(node.entity, 1);
    
    // Merge with existing graph
    const mergedGraph: EntityGraph = {
      nodes: [...relationshipGraph.nodes],
      edges: [...relationshipGraph.edges],
      layout: relationshipGraph.layout,
      metadata: relationshipGraph.metadata,
    };
    
    // Add new nodes and edges
    subgraph.nodes.forEach(newNode => {
      if (!mergedGraph.nodes.find(n => n.id === newNode.id)) {
        mergedGraph.nodes.push(newNode);
      }
    });
    
    subgraph.edges.forEach(newEdge => {
      if (!mergedGraph.edges.find(e => e.id === newEdge.id)) {
        mergedGraph.edges.push(newEdge);
      }
    });
    
    // Update expanded state
    const nodeIndex = mergedGraph.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex >= 0) {
      mergedGraph.nodes[nodeIndex].expanded = true;
    }
    
    setRelationshipGraph(mergedGraph);
  }, [relationshipGraph]);
  
  const collapseGraphNode = useCallback(async (nodeId: string): Promise<void> => {
    if (!relationshipGraph) return;
    
    // Find all nodes that are children of this node
    const childNodes = new Set<string>();
    relationshipGraph.edges.forEach(edge => {
      if (edge.source === nodeId) {
        childNodes.add(edge.target);
      }
    });
    
    // Remove child nodes and their edges
    const filteredGraph: EntityGraph = {
      nodes: relationshipGraph.nodes.filter(n => !childNodes.has(n.id)),
      edges: relationshipGraph.edges.filter(e => 
        !childNodes.has(e.source) && !childNodes.has(e.target)
      ),
      layout: relationshipGraph.layout,
      metadata: relationshipGraph.metadata,
    };
    
    // Update expanded state
    const nodeIndex = filteredGraph.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex >= 0) {
      filteredGraph.nodes[nodeIndex].expanded = false;
    }
    
    setRelationshipGraph(filteredGraph);
  }, [relationshipGraph]);
  
  const highlightPath = useCallback((fromNodeId: string, toNodeId: string) => {
    if (!relationshipGraph) return;
    
    // Find path between nodes
    const fromNode = relationshipGraph.nodes.find(n => n.id === fromNodeId);
    const toNode = relationshipGraph.nodes.find(n => n.id === toNodeId);
    
    if (!fromNode || !toNode) return;
    
    const paths = relationshipEngine.current.findPath(fromNode.entity, toNode.entity);
    if (paths.length === 0) return;
    
    const pathNodeIds = new Set(paths[0].path.map(e => `${e.entityType}:${e.entityId}`));
    
    // Update graph with highlighted path
    const highlightedGraph: EntityGraph = {
      ...relationshipGraph,
      nodes: relationshipGraph.nodes.map(node => ({
        ...node,
        highlighted: pathNodeIds.has(node.id),
      })),
      edges: relationshipGraph.edges.map(edge => ({
        ...edge,
        animated: pathNodeIds.has(edge.source) && pathNodeIds.has(edge.target),
      })),
    };
    
    setRelationshipGraph(highlightedGraph);
  }, [relationshipGraph]);
  
  // Search and discovery
  const searchRelatedEntities = useCallback(async (
    query: string,
    entityType?: string
  ): Promise<EntityReference[]> => {
    // This would typically search backend
    // For now, search through cached relationships
    const results: EntityReference[] = [];
    const seen = new Set<string>();
    
    entityRelationships[Object.keys(entityRelationships)[0]]?.forEach(rel => {
      [rel.fromEntity, rel.toEntity].forEach(entity => {
        const key = `${entity.entityType}:${entity.entityId}`;
        if (!seen.has(key) && 
            (!entityType || entity.entityType === entityType) &&
            entity.displayName.toLowerCase().includes(query.toLowerCase())) {
          seen.add(key);
          results.push(entity);
        }
      });
    });
    
    return results;
  }, [entityRelationships]);
  
  const discoverRelationships = useCallback(async (
    entity: EntityReference
  ): Promise<EntityRelationship[]> => {
    // This would typically call backend ML models to discover relationships
    // For now, return existing relationships
    const key = `${entity.entityType}:${entity.entityId}`;
    return entityRelationships[key] || [];
  }, [entityRelationships]);
  
  const suggestNavigation = useCallback(async (
    currentEntity: EntityReference
  ): Promise<EntityReference[]> => {
    // Get related entities sorted by relevance
    const related = await getRelatedEntities(
      currentEntity.entityType,
      currentEntity.entityId,
      { sortBy: 'relevance', limit: 10 }
    );
    
    return related.map(r => ({
      entityType: r.entityType,
      entityId: r.entityId,
      displayName: r.displayName,
    }));
  }, [getRelatedEntities]);
  
  // Utilities
  const isEntityRelated = useCallback((
    entity1: EntityReference,
    entity2: EntityReference
  ): boolean => {
    const paths = relationshipEngine.current.findPath(entity1, entity2);
    return paths.length > 0;
  }, []);
  
  const getRelationshipStrength = useCallback((
    entity1: EntityReference,
    entity2: EntityReference
  ): number => {
    const paths = relationshipEngine.current.findPath(entity1, entity2, 'strongest');
    if (paths.length === 0) return 0;
    
    return paths[0].totalImpactScore || 0;
  }, []);
  
  const getEntityDistance = useCallback((
    entity1: EntityReference,
    entity2: EntityReference
  ): number => {
    const paths = relationshipEngine.current.findPath(entity1, entity2, 'shortest');
    if (paths.length === 0) return -1;
    
    return paths[0].distance;
  }, []);
  
  // Memoized context value
  const value = useMemo<NavigationTraceContextProps>(() => ({
    // Entity relationships
    entityRelationships,
    relationshipGraph,
    loadingRelationships,
    
    // Navigation state
    navigationHistory,
    currentContext,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < navigationHistory.length - 1,
    
    // Traceability navigation
    getRelatedEntities,
    navigateToEntity,
    buildTraceabilityPath,
    findImpactedEntities,
    findDependencies,
    
    // Contextual actions
    getContextualActions,
    executeContextualAction,
    registerActionHandler,
    unregisterActionHandler,
    
    // Navigation state management
    pushBreadcrumb,
    popBreadcrumb,
    goBack,
    goForward,
    resetNavigation,
    clearHistory,
    
    // Deep linking
    generateDeepLink,
    navigateFromDeepLink,
    resolveDeepLink,
    
    // Graph operations
    buildEntityGraph,
    expandGraphNode,
    collapseGraphNode,
    highlightPath,
    
    // Search and discovery
    searchRelatedEntities,
    discoverRelationships,
    suggestNavigation,
    
    // Utilities
    isEntityRelated,
    getRelationshipStrength,
    getEntityDistance,
  }), [
    entityRelationships,
    relationshipGraph,
    loadingRelationships,
    navigationHistory,
    currentContext,
    historyIndex,
    getRelatedEntities,
    navigateToEntity,
    buildTraceabilityPath,
    findImpactedEntities,
    findDependencies,
    getContextualActions,
    executeContextualAction,
    registerActionHandler,
    unregisterActionHandler,
    pushBreadcrumb,
    popBreadcrumb,
    goBack,
    goForward,
    resetNavigation,
    clearHistory,
    generateDeepLink,
    navigateFromDeepLink,
    resolveDeepLink,
    buildEntityGraph,
    expandGraphNode,
    collapseGraphNode,
    highlightPath,
    searchRelatedEntities,
    discoverRelationships,
    suggestNavigation,
    isEntityRelated,
    getRelationshipStrength,
    getEntityDistance,
  ]);
  
  return (
    <NavigationTraceContext.Provider value={value}>
      {children}
    </NavigationTraceContext.Provider>
  );
};

// ---------------------------------
// 9. Custom Hooks
// ---------------------------------

export const useNavigationTrace = (): NavigationTraceContextProps => {
  const context = useContext(NavigationTraceContext);
  if (!context) {
    throw new Error('useNavigationTrace must be used within NavigationTraceProvider');
  }
  return context;
};

export const useEntityNavigation = (entityType?: string, entityId?: string) => {
  const {
    navigateToEntity,
    currentContext,
    navigationHistory,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useNavigationTrace();
  
  const navigate = useCallback((entity: EntityReference) => {
    navigateToEntity(entity);
  }, [navigateToEntity]);
  
  const isCurrentEntity = useMemo(() => {
    if (!entityType || !entityId || !currentContext.currentEntity) return false;
    return currentContext.currentEntity.entityType === entityType &&
           currentContext.currentEntity.entityId === entityId;
  }, [entityType, entityId, currentContext.currentEntity]);
  
  return {
    navigate,
    currentEntity: currentContext.currentEntity,
    previousEntity: currentContext.previousEntity,
    isCurrentEntity,
    history: navigationHistory,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  };
};

export const useEntityRelationships = (entityType: string, entityId: string) => {
  const {
    getRelatedEntities,
    findImpactedEntities,
    findDependencies,
    discoverRelationships,
    buildEntityGraph,
  } = useNavigationTrace();
  
  const [related, setRelated] = useState<RelatedEntity[]>([]);
  const [impacted, setImpacted] = useState<RelatedEntity[]>([]);
  const [dependencies, setDependencies] = useState<RelatedEntity[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const loadRelationships = async () => {
      setLoading(true);
      try {
        const entity: EntityReference = {
          entityType,
          entityId,
          displayName: `${entityType}:${entityId}`,
        };
        
        const [relatedRes, impactedRes, depsRes] = await Promise.all([
          getRelatedEntities(entityType, entityId),
          findImpactedEntities(entity),
          findDependencies(entity),
        ]);
        
        setRelated(relatedRes);
        setImpacted(impactedRes);
        setDependencies(depsRes);
      } catch (error) {
        console.error('[useEntityRelationships] Failed to load:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadRelationships();
  }, [entityType, entityId, getRelatedEntities, findImpactedEntities, findDependencies]);
  
  const buildGraph = useCallback(async (depth?: number) => {
    const entity: EntityReference = {
      entityType,
      entityId,
      displayName: `${entityType}:${entityId}`,
    };
    return buildEntityGraph(entity, depth);
  }, [entityType, entityId, buildEntityGraph]);
  
  return {
    related,
    impacted,
    dependencies,
    loading,
    buildGraph,
    discoverNew: () => discoverRelationships({
      entityType,
      entityId,
      displayName: `${entityType}:${entityId}`,
    }),
  };
};

export const useContextualActions = (entityType: string, entityId: string) => {
  const {
    getContextualActions,
    executeContextualAction,
    registerActionHandler,
  } = useNavigationTrace();
  
  const [actions, setActions] = useState<ContextualAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  
  useEffect(() => {
    const loadActions = async () => {
      setLoading(true);
      try {
        const actionsRes = await getContextualActions(entityType, entityId);
        setActions(actionsRes);
      } catch (error) {
        console.error('[useContextualActions] Failed to load:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadActions();
  }, [entityType, entityId, getContextualActions]);
  
  const executeAction = useCallback(async (action: ContextualAction) => {
    setExecuting(action.id);
    try {
      const entity: EntityReference = {
        entityType,
        entityId,
        displayName: `${entityType}:${entityId}`,
      };
      await executeContextualAction(action, entity);
    } finally {
      setExecuting(null);
    }
  }, [entityType, entityId, executeContextualAction]);
  
  const registerHandler = useCallback((
    actionType: string,
    handler: ActionHandler
  ) => {
    registerActionHandler(actionType, handler);
  }, [registerActionHandler]);
  
  return {
    actions,
    loading,
    executing,
    executeAction,
    registerHandler,
  };
};