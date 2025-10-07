import { EvaluatedListing, InventoryItem, Transaction, FinancialStats } from '../types/shared';
import { Env } from './raindrop.gen.js';
import { recordTransaction, updateFinancialState, TransactionState } from './model';

/**
 * Process a purchase transaction for an evaluated listing
 */
export async function processPurchase(
  item: EvaluatedListing,
  state: TransactionState,
  env: Env
): Promise<Transaction> {
  const transaction: Transaction = {
    type: 'purchase',
    item_id: item.id,
    amount: item.price,
    timestamp: new Date().toISOString(),
  };

  await recordTransaction(transaction, env);
  updateFinancialState(transaction, state);
  state.transactions.push(transaction);

  env.logger.info('Purchase transaction processed', {
    item_id: item.id,
    amount: item.price,
    title: item.title,
  });

  return transaction;
}

/**
 * Process a resale transaction for an inventory item
 */
export async function processResale(
  item: InventoryItem,
  state: TransactionState,
  env: Env
): Promise<Transaction> {
  const resaleAmount = item.resale_price ?? item.estimated_resale;

  const transaction: Transaction = {
    type: 'sale',
    item_id: item.id,
    amount: resaleAmount,
    timestamp: new Date().toISOString(),
  };

  await recordTransaction(transaction, env);
  updateFinancialState(transaction, state);
  state.transactions.push(transaction);

  env.logger.info('Resale transaction processed', {
    item_id: item.id,
    amount: resaleAmount,
    title: item.title,
  });

  return transaction;
}

/**
 * Generate financial statistics from current state
 */
export function getFinancialStats(state: TransactionState): FinancialStats {
  const expectedProfit = state.potentialRevenue - state.totalInvested;
  const expectedROI = state.totalInvested === 0
    ? 0
    : expectedProfit / state.totalInvested;

  return {
    total_invested: state.totalInvested,
    potential_revenue: state.potentialRevenue,
    expected_profit: expectedProfit,
    expected_roi: expectedROI,
    transaction_count: state.transactions.length,
  };
}
