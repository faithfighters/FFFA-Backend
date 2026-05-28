export const PLAN_CONFIG = {
  faith_builder: { name: 'Faith Builder', price: 30, votes: 30 },
  faith_hero:    { name: 'Faith Hero',    price: 30, votes: 30 },
  faith_fighter: { name: 'Faith Fighter', price: 30, votes: 30 },
} as const;

export type PlanKey = keyof typeof PLAN_CONFIG;

export const VALID_PLANS = Object.keys(PLAN_CONFIG) as PlanKey[];
