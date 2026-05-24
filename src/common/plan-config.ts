export const PLAN_CONFIG = {
  faith_builder: { name: 'Faith Builder', price: 39.95, votes: 1 },
  faith_hero:    { name: 'Faith Hero',    price: 59.95, votes: 3 },
  faith_fighter: { name: 'Faith Fighter', price: 79.95, votes: 9 },
} as const;

export type PlanKey = keyof typeof PLAN_CONFIG;

export const VALID_PLANS = Object.keys(PLAN_CONFIG) as PlanKey[];
