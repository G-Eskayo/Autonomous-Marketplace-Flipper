import { Transaction } from '../types/shared';
import { Env } from './raindrop.gen.js';

export interface TransactionState {
  totalInvested: number;
  potentialRevenue: number;
  transactions: Transaction[];
}

/**
 * Record a transaction in the FLIPPER_TRANSACTIONS SmartBucket
 */
export async function recordTransaction(
  transaction: Transaction,
  env: Env
): Promise<void> {
  try {
    const transactionId = `${transaction.type}_${transaction.item_id}_${transaction.timestamp}`;

    await env.FLIPPER_TRANSACTIONS.put(
      transactionId,
      JSON.stringify(transaction)
    );

    env.logger.info('Transaction recorded', {
      transaction_id: transactionId,
      type: transaction.type,
      amount: transaction.amount,
    });
  } catch (error) {
    env.logger.error('Failed to record transaction', {
      error: error instanceof Error ? error.message : String(error),
      transaction,
    });
    throw error;
  }
}

/**
 * Retrieve all transactions from the FLIPPER_TRANSACTIONS SmartBucket
 */
export async function getTransactionHistory(env: Env): Promise<Transaction[]> {
  try {
    const listResult = await env.FLIPPER_TRANSACTIONS.list();
    const transactions: Transaction[] = [];

    for (const obj of listResult.objects) {
      try {
        const data = await env.FLIPPER_TRANSACTIONS.get(obj.key);
        if (data) {
          const dataStr = typeof data === 'string' ? data : await data.text();
          const transaction = JSON.parse(dataStr) as Transaction;
          transactions.push(transaction);
        }
      } catch (error) {
        env.logger.error('Failed to parse transaction', {
          key: obj.key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return transactions;
  } catch (error) {
    env.logger.error('Failed to retrieve transaction history', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Calculate total amount spent from purchase transactions
 */
export function calculateSpent(state: TransactionState): number {
  return state.transactions
    .filter((tx) => tx.type === 'purchase')
    .reduce((total, tx) => total + tx.amount, 0);
}

/**
 * Calculate total revenue from sale transactions
 */
export function calculateRevenue(state: TransactionState): number {
  return state.transactions
    .filter((tx) => tx.type === 'sale')
    .reduce((total, tx) => total + tx.amount, 0);
}

/**
 * Update financial state based on transaction type
 */
export function updateFinancialState(
  transaction: Transaction,
  state: TransactionState
): void {
  if (transaction.type === 'purchase') {
    state.totalInvested += transaction.amount;
  } else if (transaction.type === 'sale') {
    state.potentialRevenue += transaction.amount;
  }
}
