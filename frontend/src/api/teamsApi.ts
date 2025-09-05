// src/api/teamsApi.ts
import { Team, TeamDetails, TeamType } from "../types/team";

/**
 * Teams API Client - Handles all business logic via backend endpoints
 * Frontend context should ONLY call these methods, never replicate logic
 */
class TeamsApiClient {
  private baseUrl = "/api/v1";

  /**
   * Fetch all teams with optional backend filtering
   * Backend handles: complex filtering, sorting, pagination, business rules
   */
  async getAll(
    tenantId: string,
    options?: {
      type?: TeamType[];
      businessServiceIds?: string[];
      managerId?: string;
      skillId?: string;
      minProficiency?: string;
      location?: string;
      timezone?: string;
      availableOnly?: boolean;
      overloadedThreshold?: number;
      includeMetrics?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    }
  ): Promise<Team[]> {
    const params = new URLSearchParams();
    
    // Let backend handle all filtering logic
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v.toString()));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams?${params.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch single team with full details
   * Backend handles: relationship loading, calculated metrics, business rules
   */
  async getById(tenantId: string, teamId: string): Promise<TeamDetails> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/${teamId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch team: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create team
   * Backend handles: validation, business rules, relationship setup, audit logging
   */
  async create(
    tenantId: string,
    team: Partial<Team>,
    enqueueItem?: (item: any) => void
  ): Promise<Team> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(team),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Failed to create team: ${response.statusText}`);
    }

    const createdTeam = await response.json();

    // Queue for offline sync if needed
    if (enqueueItem && !navigator.onLine) {
      enqueueItem({
        action: "create",
        entity: "teams",
        data: createdTeam,
        tenantId,
      });
    }

    return createdTeam;
  }

  /**
   * Update team
   * Backend handles: validation, business rules, conflict resolution, audit logging
   */
  async update(
    tenantId: string,
    teamId: string,
    updates: Partial<Team>,
    enqueueItem?: (item: any) => void
  ): Promise<Team> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/${teamId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Failed to update team: ${response.statusText}`);
    }

    const updatedTeam = await response.json();

    // Queue for offline sync if needed
    if (enqueueItem && !navigator.onLine) {
      enqueueItem({
        action: "update",
        entity: "teams",
        id: teamId,
        data: updates,
        tenantId,
      });
    }

    return updatedTeam;
  }

  /**
   * Delete team
   * Backend handles: business rule validation, cascade deletion, audit logging
   */
  async delete(
    tenantId: string,
    teamId: string,
    enqueueItem?: (item: any) => void
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/${teamId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Failed to delete team: ${response.statusText}`);
    }

    // Queue for offline sync if needed
    if (enqueueItem && !navigator.onLine) {
      enqueueItem({
        action: "delete",
        entity: "teams",
        id: teamId,
        tenantId,
      });
    }
  }

  /**
   * Add user to team
   * Backend handles: validation, capacity checks, business rules, notifications
   */
  async addUser(
    tenantId: string,
    teamId: string,
    userId: string,
    enqueueItem?: (item: any) => void
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/${teamId}/users`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Failed to add user to team: ${response.statusText}`);
    }

    if (enqueueItem && !navigator.onLine) {
      enqueueItem({
        action: "addUser",
        entity: "teams",
        id: teamId,
        data: { userId },
        tenantId,
      });
    }
  }

  /**
   * Remove user from team
   * Backend handles: validation, reassignment of work, business rules
   */
  async removeUser(
    tenantId: string,
    teamId: string,
    userId: string,
    enqueueItem?: (item: any) => void
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/${teamId}/users/${userId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Failed to remove user from team: ${response.statusText}`);
    }

    if (enqueueItem && !navigator.onLine) {
      enqueueItem({
        action: "removeUser",
        entity: "teams",
        id: teamId,
        data: { userId },
        tenantId,
      });
    }
  }

  /**
   * Update team skills
   * Backend handles: skill validation, proficiency level checks, business rules
   */
  async updateSkills(
    tenantId: string,
    teamId: string,
    skills: Array<{
      skill_id: string;
      team_proficiency: string;
      certified_members: number;
      total_members: number;
    }>,
    enqueueItem?: (item: any) => void
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/${teamId}/skills`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Failed to update team skills: ${response.statusText}`);
    }

    if (enqueueItem && !navigator.onLine) {
      enqueueItem({
        action: "updateSkills",
        entity: "teams",
        id: teamId,
        data: { skills },
        tenantId,
      });
    }
  }

  /**
   * Update team metrics
   * Backend handles: metric calculations, validation, trend analysis
   */
  async updateMetrics(
    tenantId: string,
    teamId: string,
    metrics: {
      mttr_minutes?: number;
      mtta_minutes?: number;
      incidents_resolved?: number;
      // Backend calculates derived metrics
    },
    enqueueItem?: (item: any) => void
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/${teamId}/metrics`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metrics),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Failed to update team metrics: ${response.statusText}`);
    }

    if (enqueueItem && !navigator.onLine) {
      enqueueItem({
        action: "updateMetrics",
        entity: "teams",
        id: teamId,
        data: metrics,
        tenantId,
      });
    }
  }

  /**
   * Assign incident to team
   * Backend handles: workload balancing, capacity checks, skill matching, notifications
   */
  async assignIncident(
    tenantId: string,
    teamId: string,
    incidentId: string,
    enqueueItem?: (item: any) => void
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/${teamId}/incidents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Failed to assign incident: ${response.statusText}`);
    }

    if (enqueueItem && !navigator.onLine) {
      enqueueItem({
        action: "assignIncident",
        entity: "teams",
        id: teamId,
        data: { incidentId },
        tenantId,
      });
    }
  }

  /**
   * Get team performance analytics
   * Backend handles: complex calculations, trend analysis, benchmarking
   */
  async getPerformanceStats(
    tenantId: string,
    teamId: string,
    timeframe?: {
      start: string;
      end: string;
    }
  ): Promise<{
    mttr: number;
    mtta: number;
    incidentsThisMonth: number;
    resolvedThisMonth: number;
    successRate: number;
    workloadTrend: 'increasing' | 'stable' | 'decreasing';
    benchmarkComparison: {
      industry: number;
      company: number;
    };
  }> {
    const params = new URLSearchParams();
    if (timeframe) {
      params.append('start', timeframe.start);
      params.append('end', timeframe.end);
    }

    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/${teamId}/performance?${params.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch performance stats: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get recommended teams for assignment
   * Backend handles: skill matching, workload analysis, availability checks
   */
  async getRecommendedTeams(
    tenantId: string,
    criteria: {
      requiredSkills?: string[];
      incidentType?: string;
      priority?: string;
      businessServiceId?: string;
      timezone?: string;
      maxWorkload?: number;
    }
  ): Promise<Array<{
    team: Team;
    matchScore: number;
    matchReasons: string[];
    estimatedCapacity: number;
  }>> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/recommendations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get team recommendations: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Bulk operations
   * Backend handles: transaction management, validation, rollback on failures
   */
  async bulkUpdate(
    tenantId: string,
    operations: Array<{
      teamId: string;
      operation: 'update' | 'addUser' | 'removeUser' | 'updateSkills';
      data: any;
    }>,
    enqueueItem?: (item: any) => void
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const response = await fetch(
      `${this.baseUrl}/tenants/${tenantId}/teams/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Bulk operation failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (enqueueItem && !navigator.onLine) {
      enqueueItem({
        action: "bulkUpdate",
        entity: "teams",
        data: { operations },
        tenantId,
      });
    }

    return result;
  }
}

// Export singleton instance
export const teamsApi = new TeamsApiClient();

/**
 * Expected Backend API Contracts
 * 
 * GET /api/v1/tenants/{tenantId}/teams
 * - Query params: type[], businessServiceIds[], managerId, skillId, minProficiency, 
 *   location, timezone, availableOnly, overloadedThreshold, includeMetrics, 
 *   sortBy, sortOrder, limit, offset
 * - Returns: Team[] with calculated metrics and filtered results
 * - Backend handles: complex filtering, sorting, pagination, business rules
 * 
 * GET /api/v1/tenants/{tenantId}/teams/{teamId}
 * - Returns: TeamDetails with related entities loaded
 * - Backend handles: relationship loading, calculated metrics
 * 
 * POST /api/v1/tenants/{tenantId}/teams
 * - Body: Partial<Team>
 * - Returns: Team with generated fields and calculated metrics
 * - Backend handles: validation, business rules, relationship setup, audit
 * 
 * PUT /api/v1/tenants/{tenantId}/teams/{teamId}
 * - Body: Partial<Team>
 * - Returns: Updated Team with recalculated metrics
 * - Backend handles: validation, business rules, conflict resolution, audit
 * 
 * DELETE /api/v1/tenants/{tenantId}/teams/{teamId}
 * - Returns: 204 No Content
 * - Backend handles: business rule validation, cascade deletion, audit
 * 
 * POST /api/v1/tenants/{tenantId}/teams/{teamId}/users
 * - Body: { userId: string }
 * - Returns: 201 Created
 * - Backend handles: validation, capacity checks, business rules, notifications
 * 
 * DELETE /api/v1/tenants/{tenantId}/teams/{teamId}/users/{userId}
 * - Returns: 204 No Content
 * - Backend handles: validation, work reassignment, business rules
 * 
 * PUT /api/v1/tenants/{tenantId}/teams/{teamId}/skills
 * - Body: { skills: TeamSkill[] }
 * - Returns: 200 OK
 * - Backend handles: skill validation, proficiency checks, business rules
 * 
 * PUT /api/v1/tenants/{tenantId}/teams/{teamId}/metrics
 * - Body: Partial<TeamMetrics>
 * - Returns: 200 OK
 * - Backend handles: metric calculations, validation, trend analysis
 * 
 * POST /api/v1/tenants/{tenantId}/teams/{teamId}/incidents
 * - Body: { incidentId: string }
 * - Returns: 201 Created
 * - Backend handles: workload balancing, capacity checks, skill matching
 * 
 * GET /api/v1/tenants/{tenantId}/teams/{teamId}/performance
 * - Query params: start, end (ISO dates)
 * - Returns: PerformanceStats with calculations and benchmarks
 * - Backend handles: complex calculations, trend analysis, benchmarking
 * 
 * POST /api/v1/tenants/{tenantId}/teams/recommendations
 * - Body: RecommendationCriteria
 * - Returns: RecommendedTeam[] with match scores and reasons
 * - Backend handles: skill matching, workload analysis, availability checks
 * 
 * POST /api/v1/tenants/{tenantId}/teams/bulk
 * - Body: { operations: BulkOperation[] }
 * - Returns: BulkResult with success/failure counts
 * - Backend handles: transaction management, validation, rollback
 * 
 * Error Response Format:
 * {
 *   message: string;
 *   field?: string;
 *   code: string;
 *   validationErrors?: Array<{field: string, message: string}>;
 * }
 */