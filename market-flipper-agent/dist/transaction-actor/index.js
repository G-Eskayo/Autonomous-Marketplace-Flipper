globalThis.__RAINDROP_GIT_COMMIT_SHA = "unknown";

// src/transaction-actor/index.ts
import { Actor } from "./runtime.js";

// src/transaction-actor/model.ts
async function recordTransaction(transaction, env) {
  try {
    const transactionId = `${transaction.type}_${transaction.item_id}_${transaction.timestamp}`;
    await env.FLIPPER_TRANSACTIONS.put(
      transactionId,
      JSON.stringify(transaction)
    );
    env.logger.info("Transaction recorded", {
      transaction_id: transactionId,
      type: transaction.type,
      amount: transaction.amount
    });
  } catch (error) {
    env.logger.error("Failed to record transaction", {
      error: error instanceof Error ? error.message : String(error),
      transaction
    });
    throw error;
  }
}
async function getTransactionHistory(env) {
  try {
    const listResult = await env.FLIPPER_TRANSACTIONS.list();
    const transactions = [];
    for (const obj of listResult.objects) {
      try {
        const data = await env.FLIPPER_TRANSACTIONS.get(obj.key);
        if (data) {
          const dataStr = typeof data === "string" ? data : await data.text();
          const transaction = JSON.parse(dataStr);
          transactions.push(transaction);
        }
      } catch (error) {
        env.logger.error("Failed to parse transaction", {
          key: obj.key,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return transactions;
  } catch (error) {
    env.logger.error("Failed to retrieve transaction history", {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}
function updateFinancialState(transaction, state) {
  if (transaction.type === "purchase") {
    state.totalInvested += transaction.amount;
  } else if (transaction.type === "sale") {
    state.potentialRevenue += transaction.amount;
  }
}

// src/transaction-actor/controller.ts
async function processPurchase(item, state, env) {
  const transaction = {
    type: "purchase",
    item_id: item.id,
    amount: item.price,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  await recordTransaction(transaction, env);
  updateFinancialState(transaction, state);
  state.transactions.push(transaction);
  env.logger.info("Purchase transaction processed", {
    item_id: item.id,
    amount: item.price,
    title: item.title
  });
  return transaction;
}
async function processResale(item, state, env) {
  const resaleAmount = item.resale_price ?? item.estimated_resale;
  const transaction = {
    type: "sale",
    item_id: item.id,
    amount: resaleAmount,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  await recordTransaction(transaction, env);
  updateFinancialState(transaction, state);
  state.transactions.push(transaction);
  env.logger.info("Resale transaction processed", {
    item_id: item.id,
    amount: resaleAmount,
    title: item.title
  });
  return transaction;
}
function getFinancialStats(state) {
  const expectedProfit = state.potentialRevenue - state.totalInvested;
  const expectedROI = state.totalInvested === 0 ? 0 : expectedProfit / state.totalInvested;
  return {
    total_invested: state.totalInvested,
    potential_revenue: state.potentialRevenue,
    expected_profit: expectedProfit,
    expected_roi: expectedROI,
    transaction_count: state.transactions.length
  };
}

// src/transaction-actor/index.ts
var TransactionActor = class extends Actor {
  transactionState;
  constructor(actorState, env) {
    super(actorState, env);
    this.transactionState = {
      totalInvested: 0,
      potentialRevenue: 0,
      transactions: []
    };
  }
  /**
   * Process a purchase transaction for an evaluated listing
   */
  async processPurchase(item) {
    return processPurchase(item, this.transactionState, this.env);
  }
  /**
   * Process a resale transaction for an inventory item
   */
  async processResale(item) {
    return processResale(item, this.transactionState, this.env);
  }
  /**
   * Get all transactions from SmartBucket
   */
  async getTransactions() {
    return getTransactionHistory(this.env);
  }
  /**
   * Get financial statistics
   */
  getFinancialStats() {
    return getFinancialStats(this.transactionState);
  }
};
export {
  TransactionActor
};
