export const PLANNER_CAPABILITY = 'schema-validated-graph-patches-only' as const;

export interface PlanningAgentBoundary {
  readonly canAccessDatabase: false;
  readonly canCallProviders: false;
  readonly canAccessBilling: false;
  readonly capability: typeof PLANNER_CAPABILITY;
}

export function planningAgentBoundary(): PlanningAgentBoundary {
  return {
    canAccessDatabase: false,
    canCallProviders: false,
    canAccessBilling: false,
    capability: PLANNER_CAPABILITY,
  };
}
