/**
 * Controller layer for api-router
 * Handles orchestration of service and actor calls
 */

import type {
  ScrapeConfig,
  Listing,
  EvaluatedListing,
  Decision,
  AgentStats,
} from '../types/shared';

interface OrchestrateScanResult {
  listings: Listing[];
  evaluated: EvaluatedListing[];
  decisions: Decision[];
}

/**
 * Orchestrates the full scan cycle:
 * 1. Scrape marketplaces
 * 2. Evaluate listings
 * 3. Make purchase decisions
 */
export async function orchestrateScan(
  config: ScrapeConfig,
  env: any
): Promise<OrchestrateScanResult> {
  try {
    env.logger.info('Starting scan orchestration', { config });

    // Step 1: Scrape marketplaces
    env.logger.info('Calling scraper service');
    const scrapeResult = await env.SCRAPER_SERVICE.scrapeMarketplaces(config);
    const listings: Listing[] = scrapeResult.listings || [];

    env.logger.info(`Scraped ${listings.length} listings`);

    // Handle empty listings
    if (listings.length === 0) {
      env.logger.info('No listings found, skipping evaluation and decision steps');
      return {
        listings: [],
        evaluated: [],
        decisions: [],
      };
    }

    // Step 2: Evaluate listings
    env.logger.info('Calling valuation service');
    const valuationResult = await env.VALUATION_SERVICE.evaluateListings(listings);
    const evaluated: EvaluatedListing[] = valuationResult.evaluated || [];

    env.logger.info(`Evaluated ${evaluated.length} listings`);

    // Step 3: Make decisions
    env.logger.info('Calling decision actor');
    const decisionActorId = env.DECISION_ACTOR.idFromName('default');
    const decisionActor = env.DECISION_ACTOR.get(decisionActorId);
    const decisionResult = await decisionActor.makeDecisions(evaluated, 5000); // 5000 is default budget
    const decisions: Decision[] = decisionResult.decisions || [];

    env.logger.info(`Made ${decisions.length} decisions`);

    return {
      listings,
      evaluated,
      decisions,
    };
  } catch (error) {
    env.logger.error('Error in scan orchestration', { error });
    throw error;
  }
}

/**
 * Aggregates status from all actors to provide overall agent statistics
 */
export async function getAgentStatus(env: any): Promise<AgentStats> {
  try {
    env.logger.info('Getting agent status');

    // Get inventory using proper actor ID pattern
    const inventoryActorId = env.INVENTORY_ACTOR.idFromName('default');
    const inventoryActor = env.INVENTORY_ACTOR.get(inventoryActorId);
    const inventory = await inventoryActor.getInventory();

    // Get transactions using proper actor ID pattern
    const transactionActorId = env.TRANSACTION_ACTOR.idFromName('default');
    const transactionActor = env.TRANSACTION_ACTOR.get(transactionActorId);
    const transactions = await transactionActor.getTransactions();

    // Calculate stats from actual data
    const items_purchased = inventory.filter((item: any) => item.status === 'purchased').length;
    const items_listed = inventory.filter((item: any) => item.status === 'listed').length;

    const total_invested = transactions
      .filter((tx: any) => tx.type === 'purchase')
      .reduce((sum: number, tx: any) => sum + tx.amount, 0);

    const potential_revenue = inventory
      .reduce((sum: number, item: any) => sum + (item.estimated_resale || 0), 0);

    const expected_profit = potential_revenue - total_invested;
    const expected_roi = total_invested > 0 ? (expected_profit / total_invested) * 100 : 0;

    const stats: AgentStats = {
      listings_scanned: 0, // This would need to be tracked separately or stored in an actor
      items_purchased,
      items_listed,
      total_invested,
      potential_revenue,
      expected_profit,
      expected_roi,
    };

    env.logger.info('Agent status retrieved', { stats });

    return stats;
  } catch (error) {
    env.logger.error('Error getting agent status', { error });
    throw error;
  }
}
