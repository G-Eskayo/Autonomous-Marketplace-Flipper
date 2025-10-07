globalThis.__RAINDROP_GIT_COMMIT_SHA = "unknown";

// src/decision-actor/index.ts
import { Actor } from "./runtime.js";

// src/decision-actor/model.ts
var BUSINESS_RULES = {
  MIN_PROFIT_MARGIN: 0.2,
  // 20% minimum profit margin
  MIN_PROFIT: 50
  // $50 minimum profit
};
function createInitialState() {
  return {
    budget: 5e3,
    purchasedIds: /* @__PURE__ */ new Set(),
    stats: {
      listings_scanned: 0,
      items_purchased: 0,
      items_listed: 0,
      total_invested: 0,
      potential_revenue: 0,
      expected_profit: 0,
      expected_roi: 0
    }
  };
}
function validateBudget(price, currentBudget) {
  if (currentBudget <= 0) {
    return false;
  }
  return price <= currentBudget;
}
function addPurchasedId(id, state) {
  state.purchasedIds.add(id);
}
function hasPurchased(id, state) {
  return state.purchasedIds.has(id);
}
function updateStats(decision, state) {
  if (decision.action === "BUY") {
    state.stats.items_purchased += 1;
    state.stats.total_invested += decision.price;
    state.stats.expected_profit += decision.profit_potential;
    state.stats.potential_revenue += decision.price + decision.profit_potential;
    if (state.stats.total_invested > 0) {
      state.stats.expected_roi = state.stats.expected_profit / state.stats.total_invested * 100;
    }
  }
}

// src/decision-actor/controller.ts
function evaluateOpportunity(item, state) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  if (hasPurchased(item.id, state)) {
    return {
      action: "SKIP",
      item_id: item.id,
      title: item.title,
      price: item.price,
      score: item.score,
      profit_potential: item.profit_potential,
      reasoning: "Already purchased this item",
      timestamp
    };
  }
  if (!validateBudget(item.price, state.budget)) {
    return {
      action: "SKIP",
      item_id: item.id,
      title: item.title,
      price: item.price,
      score: item.score,
      profit_potential: item.profit_potential,
      reasoning: `Exceeds budget: $${item.price} > $${state.budget}`,
      timestamp
    };
  }
  if (item.profit_margin < BUSINESS_RULES.MIN_PROFIT_MARGIN) {
    return {
      action: "SKIP",
      item_id: item.id,
      title: item.title,
      price: item.price,
      score: item.score,
      profit_potential: item.profit_potential,
      reasoning: `Profit margin too low: ${(item.profit_margin * 100).toFixed(1)}% < ${(BUSINESS_RULES.MIN_PROFIT_MARGIN * 100).toFixed(1)}%`,
      timestamp
    };
  }
  if (item.profit_potential < BUSINESS_RULES.MIN_PROFIT) {
    return {
      action: "SKIP",
      item_id: item.id,
      title: item.title,
      price: item.price,
      score: item.score,
      profit_potential: item.profit_potential,
      reasoning: `Profit amount too low: $${item.profit_potential} < $${BUSINESS_RULES.MIN_PROFIT}`,
      timestamp
    };
  }
  return {
    action: "BUY",
    item_id: item.id,
    title: item.title,
    price: item.price,
    score: item.score,
    profit_potential: item.profit_potential,
    reasoning: `Strong opportunity: Profit: $${item.profit_potential} (${(item.profit_margin * 100).toFixed(1)}% margin), Score: ${item.score}`,
    timestamp
  };
}
async function makeDecisions(evaluated, budget, env, existingState) {
  const state = existingState || {
    budget,
    purchasedIds: /* @__PURE__ */ new Set(),
    stats: {
      listings_scanned: 0,
      items_purchased: 0,
      items_listed: 0,
      total_invested: 0,
      potential_revenue: 0,
      expected_profit: 0,
      expected_roi: 0
    }
  };
  const decisions = [];
  for (const item of evaluated) {
    const decision = evaluateOpportunity(item, state);
    env.logger.info(`Decision for ${decision.item_id}: ${decision.action}`, {
      item_id: decision.item_id,
      action: decision.action,
      price: decision.price,
      profit_potential: decision.profit_potential,
      reasoning: decision.reasoning
    });
    if (decision.action === "BUY") {
      addPurchasedId(item.id, state);
      updateStats(decision, state);
      state.budget -= decision.price;
    }
    decisions.push(decision);
  }
  return decisions;
}
async function processPurchases(decisions, evaluated, env) {
  const buyDecisions = decisions.filter((d) => d.action === "BUY");
  const evaluatedMap = new Map(evaluated.map((item) => [item.id, item]));
  for (const decision of buyDecisions) {
    env.logger.info(`Processing purchase for ${decision.item_id}`, {
      item_id: decision.item_id,
      price: decision.price,
      profit_potential: decision.profit_potential
    });
    const evaluatedItem = evaluatedMap.get(decision.item_id);
    if (!evaluatedItem) {
      env.logger.error(`Evaluated listing not found for ${decision.item_id}`);
      continue;
    }
    const transactionActorId = env.TRANSACTION_ACTOR.idFromName("default");
    const transactionActorStub = env.TRANSACTION_ACTOR.get(transactionActorId);
    await transactionActorStub.processPurchase(evaluatedItem);
    const inventoryActorId = env.INVENTORY_ACTOR.idFromName("default");
    const inventoryActorStub = env.INVENTORY_ACTOR.get(inventoryActorId);
    await inventoryActorStub.processNewPurchase(evaluatedItem);
  }
}

// src/decision-actor/index.ts
var DecisionActor = class extends Actor {
  actorState;
  stateInitialized = false;
  constructor(state, env) {
    super(state, env);
    this.actorState = this.loadState();
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get("state");
      if (stored) {
        this.actorState = {
          budget: stored.budget,
          purchasedIds: new Set(stored.purchasedIds),
          stats: stored.stats
        };
      }
      this.stateInitialized = true;
    });
  }
  /**
   * Loads state from DurableObject storage or creates initial state
   */
  loadState() {
    return createInitialState();
  }
  /**
   * Persists current state to DurableObject storage
   */
  async saveState() {
    const persisted = {
      budget: this.actorState.budget,
      purchasedIds: Array.from(this.actorState.purchasedIds),
      stats: this.actorState.stats
    };
    await this.state.storage.put("state", persisted);
  }
  /**
   * Main public method: Make purchase decisions for evaluated listings
   * @param evaluated - Array of evaluated listings to consider
   * @param budget - Current available budget
   * @returns Array of decisions (BUY or SKIP)
   */
  async makeDecisions(evaluated, budget) {
    this.env.logger.info("DecisionActor: Making decisions", {
      count: evaluated.length,
      budget
    });
    if (budget !== void 0) {
      this.actorState.budget = budget;
    }
    const decisions = await makeDecisions(evaluated, this.actorState.budget, this.env, this.actorState);
    this.actorState.stats.listings_scanned += evaluated.length;
    await processPurchases(decisions, evaluated, this.env);
    await this.saveState();
    this.env.logger.info("DecisionActor: Decisions complete", {
      total: decisions.length,
      buy: decisions.filter((d) => d.action === "BUY").length,
      skip: decisions.filter((d) => d.action === "SKIP").length,
      remaining_budget: this.actorState.budget
    });
    return decisions;
  }
  /**
   * Get current agent statistics
   * @returns Current statistics
   */
  async getStats() {
    return { ...this.actorState.stats };
  }
  /**
   * Update agent configuration
   * @param config - New configuration settings
   */
  async updateConfig(config) {
    this.env.logger.info("DecisionActor: Updating config", config);
    if (config.budget !== void 0) {
      this.actorState.budget = config.budget;
    }
    await this.saveState();
  }
  /**
   * Reset actor state (useful for testing)
   */
  async resetState() {
    this.env.logger.info("DecisionActor: Resetting state");
    this.actorState = createInitialState();
    await this.saveState();
  }
};
export {
  DecisionActor
};
