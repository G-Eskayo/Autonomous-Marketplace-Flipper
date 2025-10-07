/**
 * DecisionActor - Stateful actor for making purchase decisions
 * Maintains state across invocations including budget, purchased items, and statistics
 */

import { Actor, ActorState } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen.js';
import { EvaluatedListing, Decision, AgentStats, AgentConfig } from '../types/shared.js';
import { makeDecisions, processPurchases } from './controller.js';
import { createInitialState, DecisionActorState, BUSINESS_RULES } from './model.js';

interface PersistedState {
  budget: number;
  purchasedIds: string[];
  stats: AgentStats;
}

export class DecisionActor extends Actor<Env> {
  private actorState: DecisionActorState;
  private stateInitialized: boolean = false;

  constructor(state: ActorState, env: Env) {
    super(state, env);

    // Initialize with default state
    this.actorState = this.loadState();

    // Load persisted state asynchronously in blockConcurrencyWhile
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<PersistedState>('state');
      if (stored) {
        this.actorState = {
          budget: stored.budget,
          purchasedIds: new Set(stored.purchasedIds),
          stats: stored.stats,
        };
      }
      this.stateInitialized = true;
    });
  }

  /**
   * Loads state from DurableObject storage or creates initial state
   */
  private loadState(): DecisionActorState {
    // Note: storage.get() returns a Promise, but we handle it in constructor initialization
    // For now, we initialize with default state and will load asynchronously if needed
    return createInitialState();
  }

  /**
   * Persists current state to DurableObject storage
   */
  private async saveState(): Promise<void> {
    const persisted: PersistedState = {
      budget: this.actorState.budget,
      purchasedIds: Array.from(this.actorState.purchasedIds),
      stats: this.actorState.stats,
    };

    await this.state.storage.put('state', persisted);
  }

  /**
   * Main public method: Make purchase decisions for evaluated listings
   * @param evaluated - Array of evaluated listings to consider
   * @param budget - Current available budget
   * @returns Array of decisions (BUY or SKIP)
   */
  public async makeDecisions(
    evaluated: EvaluatedListing[],
    budget: number
  ): Promise<Decision[]> {
    this.env.logger.info('DecisionActor: Making decisions', {
      count: evaluated.length,
      budget,
    });

    // Update budget if provided
    if (budget !== undefined) {
      this.actorState.budget = budget;
    }

    // Make decisions using controller - pass our state directly
    const decisions = await makeDecisions(evaluated, this.actorState.budget, this.env, this.actorState);

    // Update scanned count
    this.actorState.stats.listings_scanned += evaluated.length;

    // Process purchases through other actors - pass evaluated listings
    await processPurchases(decisions, evaluated, this.env);

    // Persist state
    await this.saveState();

    this.env.logger.info('DecisionActor: Decisions complete', {
      total: decisions.length,
      buy: decisions.filter((d) => d.action === 'BUY').length,
      skip: decisions.filter((d) => d.action === 'SKIP').length,
      remaining_budget: this.actorState.budget,
    });

    return decisions;
  }

  /**
   * Get current agent statistics
   * @returns Current statistics
   */
  public async getStats(): Promise<AgentStats> {
    return { ...this.actorState.stats };
  }

  /**
   * Update agent configuration
   * @param config - New configuration settings
   */
  public async updateConfig(config: Partial<AgentConfig>): Promise<void> {
    this.env.logger.info('DecisionActor: Updating config', config);

    if (config.budget !== undefined) {
      this.actorState.budget = config.budget;
    }

    // Note: minProfitMargin, minProfit, etc. are in BUSINESS_RULES
    // If we need dynamic config, we'd store it in state

    await this.saveState();
  }

  /**
   * Reset actor state (useful for testing)
   */
  public async resetState(): Promise<void> {
    this.env.logger.info('DecisionActor: Resetting state');
    this.actorState = createInitialState();
    await this.saveState();
  }
}
