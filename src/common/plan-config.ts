const _PLAN = { name: 'Faith Fighter', price: 30, votes: 30 } as const;

export const PLAN_CONFIG = {
  faith_fighter: _PLAN,
  // Legacy aliases kept for existing DB records
  faith_builder: _PLAN,
  faith_hero:    _PLAN,
} as const;

export type PlanKey = keyof typeof PLAN_CONFIG;

export const VALID_PLANS = Object.keys(PLAN_CONFIG) as PlanKey[];
