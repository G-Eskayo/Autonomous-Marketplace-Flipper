/**
 * controller.ts - Decision-making workflows for DecisionActor
 * Orchestrates evaluation logic and coordinates with other actors
 */

import { EvaluatedListing, Decision } from '../types/shared.js';
import {
  DecisionActorState,
  BUSINESS_RULES,
  validateBudget,
  hasPurchased,
  addPurchasedId,
  updateStats,
} from './model.js';
import { Env } from './raindrop.gen.js';

/**
 * Evaluates a single opportunity and returns a decision
 * @param item - The evaluated listing to consider
 * @param state - The current actor state
 * @returns A decision (BUY or SKIP) with reasoning
 */
export function evaluateOpportunity(
  item: EvaluatedListing,
  state: DecisionActorState
): Decision {
  const timestamp = new Date().toISOString();

  // Check for duplicate purchase
  if (hasPurchased(item.id, state)) {
    return {
      action: 'SKIP',
      item_id: item.id,
      title: item.title,
      price: item.price,
      score: item.score,
      profit_potential: item.profit_potential,
      reasoning: 'Already purchased this item',
      timestamp,
    };
  }

  // Check budget constraint
  if (!validateBudget(item.price, state.budget)) {
    return {
      action: 'SKIP',
      item_id: item.id,
      title: item.title,
      price: item.price,
      score: item.score,
      profit_potential: item.profit_potential,
      reasoning: `Exceeds budget: $${item.price} > $${state.budget}`,
      timestamp,
    };
  }

  // Check profit margin requirement (20% minimum)
  if (item.profit_margin < BUSINESS_RULES.MIN_PROFIT_MARGIN) {
    return {
      action: 'SKIP',
      item_id: item.id,
      title: item.title,
      price: item.price,
      score: item.score,
      profit_potential: item.profit_potential,
      reasoning: `Profit margin too low: ${(item.profit_margin * 100).toFixed(1)}% < ${(BUSINESS_RULES.MIN_PROFIT_MARGIN * 100).toFixed(1)}%`,
      timestamp,
    };
  }

  // Check minimum profit amount ($50 minimum)
  if (item.profit_potential < BUSINESS_RULES.MIN_PROFIT) {
    return {
      action: 'SKIP',
      item_id: item.id,
      title: item.title,
      price: item.price,
      score: item.score,
      profit_potential: item.profit_potential,
      reasoning: `Profit amount too low: $${item.profit_potential} < $${BUSINESS_RULES.MIN_PROFIT}`,
      timestamp,
    };
  }

  // All checks passed - BUY!
  return {
    action: 'BUY',
    item_id: item.id,
    title: item.title,
    price: item.price,
    score: item.score,
    profit_potential: item.profit_potential,
    reasoning: `Strong opportunity: Profit: $${item.profit_potential} (${(item.profit_margin * 100).toFixed(1)}% margin), Score: ${item.score}`,
    timestamp,
  };
}

/**
 * Main decision orchestrator - processes all evaluated listings
 * @param evaluated - Array of evaluated listings
 * @param budget - Current available budget
 * @param env - Environment with logger and actor references
 * @param existingState - Optional existing state to use (for persistence)
 * @returns Array of decisions with updated state
 */
export async function makeDecisions(
  evaluated: EvaluatedListing[],
  budget: number,
  env: Env,
  existingState?: DecisionActorState
): Promise<Decision[]> {
  // Use existing state or create temporary state for this decision session
  const state: DecisionActorState = existingState || {
    budget,
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

  const decisions: Decision[] = [];

  for (const item of evaluated) {
    const decision = evaluateOpportunity(item, state);

    // Log the decision
    env.logger.info(`Decision for ${decision.item_id}: ${decision.action}`, {
      item_id: decision.item_id,
      action: decision.action,
      price: decision.price,
      profit_potential: decision.profit_potential,
      reasoning: decision.reasoning,
    });

    // Update state if BUY decision
    if (decision.action === 'BUY') {
      addPurchasedId(item.id, state);
      updateStats(decision, state);
      state.budget -= decision.price; // Deduct from remaining budget
    }

    decisions.push(decision);
  }

  return decisions;
}

/**
 * Processes purchase decisions by coordinating with transaction and inventory actors
 * @param decisions - Array of decisions to process
 * @param evaluated - Original evaluated listings (needed for actor coordination)
 * @param env - Environment with actor references
 */
export async function processPurchases(
  decisions: Decision[],
  evaluated: EvaluatedListing[],
  env: Env
): Promise<void> {
  const buyDecisions = decisions.filter((d) => d.action === 'BUY');

  // Create a map of item_id to EvaluatedListing for quick lookup
  const evaluatedMap = new Map(evaluated.map((item) => [item.id, item]));

  for (const decision of buyDecisions) {
    env.logger.info(`Processing purchase for ${decision.item_id}`, {
      item_id: decision.item_id,
      price: decision.price,
      profit_potential: decision.profit_potential,
    });

    // Get the original evaluated listing
    const evaluatedItem = evaluatedMap.get(decision.item_id);
    if (!evaluatedItem) {
      env.logger.error(`Evaluated listing not found for ${decision.item_id}`);
      continue;
    }

    // Coordinate with transaction actor
    const transactionActorId = env.TRANSACTION_ACTOR.idFromName('default');
    const transactionActorStub = env.TRANSACTION_ACTOR.get(transactionActorId);
    await transactionActorStub.processPurchase(evaluatedItem);

    // Coordinate with inventory actor
    const inventoryActorId = env.INVENTORY_ACTOR.idFromName('default');
    const inventoryActorStub = env.INVENTORY_ACTOR.get(inventoryActorId);
    await inventoryActorStub.processNewPurchase(evaluatedItem);
  }
}
