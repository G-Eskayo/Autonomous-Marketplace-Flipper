/**
 * model.ts - State management and validation for DecisionActor
 * Handles state persistence, budget validation, and statistics tracking
 */

import { Decision, AgentStats } from '../types/shared.js';

/**
 * Business rules for decision-making
 */
export const BUSINESS_RULES = {
  MIN_PROFIT_MARGIN: 0.20, // 20% minimum profit margin
  MIN_PROFIT: 50, // $50 minimum profit
} as const;

/**
 * Actor state interface
 */
export interface DecisionActorState {
  budget: number;
  purchasedIds: Set<string>;
  stats: AgentStats;
}

/**
 * Creates initial state with default values
 */
export function createInitialState(): DecisionActorState {
  return {
    budget: 5000,
    purchasedIds: new Set<string>(),
    stats: {
      listings_scanned: 0,
      items_purchased: 0,
      items_listed: 0,
      total_invested: 0,
      potential_revenue: 0,
      expected_profit: 0,
      expected_roi: 0,
    },
  };
}

/**
 * Validates if a purchase price fits within the current budget
 * @param price - The price of the item to purchase
 * @param currentBudget - The current available budget
 * @returns true if price is within budget, false otherwise
 */
export function validateBudget(price: number, currentBudget: number): boolean {
  if (currentBudget <= 0) {
    return false;
  }
  return price <= currentBudget;
}

/**
 * Adds a purchased item ID to the tracking set
 * @param id - The item ID to track
 * @param state - The current actor state
 */
export function addPurchasedId(id: string, state: DecisionActorState): void {
  state.purchasedIds.add(id);
}

/**
 * Checks if an item has already been purchased
 * @param id - The item ID to check
 * @param state - The current actor state
 * @returns true if item was already purchased, false otherwise
 */
export function hasPurchased(id: string, state: DecisionActorState): boolean {
  return state.purchasedIds.has(id);
}

/**
 * Updates running statistics based on a decision
 * Only updates purchase-related stats for BUY decisions
 * @param decision - The decision that was made
 * @param state - The current actor state
 */
export function updateStats(decision: Decision, state: DecisionActorState): void {
  if (decision.action === 'BUY') {
    state.stats.items_purchased += 1;
    state.stats.total_invested += decision.price;
    state.stats.expected_profit += decision.profit_potential;
    state.stats.potential_revenue += decision.price + decision.profit_potential;

    // Calculate ROI: (profit / invested) * 100
    if (state.stats.total_invested > 0) {
      state.stats.expected_roi =
        (state.stats.expected_profit / state.stats.total_invested) * 100;
    }
  }
  // SKIP decisions don't affect purchase stats
}
