import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordTransaction,
  getTransactionHistory,
  calculateSpent,
  calculateRevenue,
  updateFinancialState,
  TransactionState,
} from './model';
import { Transaction } from '../types/shared';

describe('Transaction Model - State Management', () => {
  let mockEnv: any;
  let state: TransactionState;

  beforeEach(() => {
    mockEnv = {
      FLIPPER_TRANSACTIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue({ objects: [] }),
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    };

    state = {
      totalInvested: 0,
      potentialRevenue: 0,
      transactions: [],
    };
  });

  describe('recordTransaction', () => {
    it('should store a purchase transaction in SmartBucket', async () => {
      const transaction: Transaction = {
        type: 'purchase',
        item_id: 'item_123',
        amount: 150,
        timestamp: '2025-10-01T10:00:00.000Z',
      };

      await recordTransaction(transaction, mockEnv);

      expect(mockEnv.FLIPPER_TRANSACTIONS.put).toHaveBeenCalledWith(
        'purchase_item_123_2025-10-01T10:00:00.000Z',
        JSON.stringify(transaction)
      );
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Transaction recorded',
        expect.objectContaining({ transaction_id: 'purchase_item_123_2025-10-01T10:00:00.000Z' })
      );
    });

    it('should store a sale transaction in SmartBucket', async () => {
      const transaction: Transaction = {
        type: 'sale',
        item_id: 'item_456',
        amount: 250,
        timestamp: '2025-10-01T12:00:00.000Z',
      };

      await recordTransaction(transaction, mockEnv);

      expect(mockEnv.FLIPPER_TRANSACTIONS.put).toHaveBeenCalledWith(
        'sale_item_456_2025-10-01T12:00:00.000Z',
        JSON.stringify(transaction)
      );
    });

    it('should handle SmartBucket errors gracefully', async () => {
      const transaction: Transaction = {
        type: 'purchase',
        item_id: 'item_789',
        amount: 100,
        timestamp: '2025-10-01T14:00:00.000Z',
      };

      mockEnv.FLIPPER_TRANSACTIONS.put.mockRejectedValue(new Error('SmartBucket error'));

      await expect(recordTransaction(transaction, mockEnv)).rejects.toThrow('SmartBucket error');
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });
  });

  describe('getTransactionHistory', () => {
    it('should retrieve all transactions from SmartBucket', async () => {
      const tx1: Transaction = {
        type: 'purchase',
        item_id: 'item_1',
        amount: 100,
        timestamp: '2025-10-01T10:00:00.000Z',
      };
      const tx2: Transaction = {
        type: 'sale',
        item_id: 'item_1',
        amount: 150,
        timestamp: '2025-10-01T12:00:00.000Z',
      };

      mockEnv.FLIPPER_TRANSACTIONS.list.mockResolvedValue({
        objects: [
          { key: 'purchase_item_1_2025-10-01T10:00:00.000Z' },
          { key: 'sale_item_1_2025-10-01T12:00:00.000Z' },
        ],
      });

      mockEnv.FLIPPER_TRANSACTIONS.get
        .mockResolvedValueOnce(JSON.stringify(tx1))
        .mockResolvedValueOnce(JSON.stringify(tx2));

      const transactions = await getTransactionHistory(mockEnv);

      expect(transactions).toHaveLength(2);
      expect(transactions[0]).toEqual(tx1);
      expect(transactions[1]).toEqual(tx2);
    });

    it('should return empty array when no transactions exist', async () => {
      mockEnv.FLIPPER_TRANSACTIONS.list.mockResolvedValue({ objects: [] });

      const transactions = await getTransactionHistory(mockEnv);

      expect(transactions).toEqual([]);
    });

    it('should skip invalid transaction data', async () => {
      mockEnv.FLIPPER_TRANSACTIONS.list.mockResolvedValue({
        objects: [{ key: 'tx1' }, { key: 'tx2' }],
      });

      mockEnv.FLIPPER_TRANSACTIONS.get
        .mockResolvedValueOnce('invalid json')
        .mockResolvedValueOnce(null);

      const transactions = await getTransactionHistory(mockEnv);

      expect(transactions).toEqual([]);
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });
  });

  describe('calculateSpent', () => {
    it('should calculate total spent from purchase transactions', () => {
      state.transactions = [
        { type: 'purchase', item_id: 'item_1', amount: 100, timestamp: '2025-10-01T10:00:00.000Z' },
        { type: 'purchase', item_id: 'item_2', amount: 200, timestamp: '2025-10-01T11:00:00.000Z' },
        { type: 'sale', item_id: 'item_1', amount: 150, timestamp: '2025-10-01T12:00:00.000Z' },
      ];

      const spent = calculateSpent(state);

      expect(spent).toBe(300);
    });

    it('should return 0 when no purchase transactions exist', () => {
      state.transactions = [
        { type: 'sale', item_id: 'item_1', amount: 150, timestamp: '2025-10-01T12:00:00.000Z' },
      ];

      const spent = calculateSpent(state);

      expect(spent).toBe(0);
    });

    it('should return 0 for empty transactions array', () => {
      state.transactions = [];

      const spent = calculateSpent(state);

      expect(spent).toBe(0);
    });
  });

  describe('calculateRevenue', () => {
    it('should calculate total revenue from sale transactions', () => {
      state.transactions = [
        { type: 'purchase', item_id: 'item_1', amount: 100, timestamp: '2025-10-01T10:00:00.000Z' },
        { type: 'sale', item_id: 'item_1', amount: 150, timestamp: '2025-10-01T12:00:00.000Z' },
        { type: 'sale', item_id: 'item_2', amount: 200, timestamp: '2025-10-01T13:00:00.000Z' },
      ];

      const revenue = calculateRevenue(state);

      expect(revenue).toBe(350);
    });

    it('should return 0 when no sale transactions exist', () => {
      state.transactions = [
        { type: 'purchase', item_id: 'item_1', amount: 100, timestamp: '2025-10-01T10:00:00.000Z' },
      ];

      const revenue = calculateRevenue(state);

      expect(revenue).toBe(0);
    });

    it('should return 0 for empty transactions array', () => {
      state.transactions = [];

      const revenue = calculateRevenue(state);

      expect(revenue).toBe(0);
    });
  });

  describe('updateFinancialState', () => {
    it('should update totalInvested for purchase transaction', () => {
      const transaction: Transaction = {
        type: 'purchase',
        item_id: 'item_1',
        amount: 100,
        timestamp: '2025-10-01T10:00:00.000Z',
      };

      updateFinancialState(transaction, state);

      expect(state.totalInvested).toBe(100);
      expect(state.potentialRevenue).toBe(0);
    });

    it('should update potentialRevenue for sale transaction', () => {
      const transaction: Transaction = {
        type: 'sale',
        item_id: 'item_1',
        amount: 150,
        timestamp: '2025-10-01T12:00:00.000Z',
      };

      updateFinancialState(transaction, state);

      expect(state.totalInvested).toBe(0);
      expect(state.potentialRevenue).toBe(150);
    });

    it('should accumulate multiple transactions correctly', () => {
      const tx1: Transaction = {
        type: 'purchase',
        item_id: 'item_1',
        amount: 100,
        timestamp: '2025-10-01T10:00:00.000Z',
      };
      const tx2: Transaction = {
        type: 'purchase',
        item_id: 'item_2',
        amount: 200,
        timestamp: '2025-10-01T11:00:00.000Z',
      };
      const tx3: Transaction = {
        type: 'sale',
        item_id: 'item_1',
        amount: 150,
        timestamp: '2025-10-01T12:00:00.000Z',
      };

      updateFinancialState(tx1, state);
      updateFinancialState(tx2, state);
      updateFinancialState(tx3, state);

      expect(state.totalInvested).toBe(300);
      expect(state.potentialRevenue).toBe(150);
    });
  });
});
