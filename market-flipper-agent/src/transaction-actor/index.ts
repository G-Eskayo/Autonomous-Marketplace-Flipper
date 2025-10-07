import { Actor, ActorState } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen.js';
import { EvaluatedListing, InventoryItem, Transaction, FinancialStats } from '../types/shared';
import { TransactionState, getTransactionHistory } from './model';
import { processPurchase, processResale, getFinancialStats } from './controller';

export class TransactionActor extends Actor<Env> {
  private transactionState: TransactionState;

  constructor(actorState: ActorState, env: Env) {
    super(actorState, env);

    // Initialize transaction state with default values
    this.transactionState = {
      totalInvested: 0,
      potentialRevenue: 0,
      transactions: [],
    };
  }

  /**
   * Process a purchase transaction for an evaluated listing
   */
  async processPurchase(item: EvaluatedListing): Promise<Transaction> {
    return processPurchase(item, this.transactionState, this.env);
  }

  /**
   * Process a resale transaction for an inventory item
   */
  async processResale(item: InventoryItem): Promise<Transaction> {
    return processResale(item, this.transactionState, this.env);
  }

  /**
   * Get all transactions from SmartBucket
   */
  async getTransactions(): Promise<Transaction[]> {
    return getTransactionHistory(this.env);
  }

  /**
   * Get financial statistics
   */
  getFinancialStats(): FinancialStats {
    return getFinancialStats(this.transactionState);
  }
}
