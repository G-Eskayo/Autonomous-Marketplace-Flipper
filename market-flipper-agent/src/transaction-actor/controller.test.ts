import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processPurchase,
  processResale,
  getFinancialStats,
} from './controller';
import { EvaluatedListing, InventoryItem, Transaction } from '../types/shared';
import { TransactionState } from './model';

describe('Transaction Controller - Workflow Orchestration', () => {
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

  describe('processPurchase', () => {
    it('should create purchase transaction from evaluated listing', async () => {
      const item: EvaluatedListing = {
        id: 'item_123',
        title: 'Vintage Camera',
        price: 150,
        url: 'https://example.com/item',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T10:00:00.000Z',
        is_undervalued: true,
        score: 8.5,
        estimated_resale: 250,
        profit_potential: 100,
        profit_margin: 0.67,
        reasoning: 'Good deal',
        scores_breakdown: {
          historical: 0.8,
          msrp: 0.9,
          scarcity: 0.7,
          ratio: 0.85,
        },
      };

      const transaction = await processPurchase(item, state, mockEnv);

      expect(transaction.type).toBe('purchase');
      expect(transaction.item_id).toBe('item_123');
      expect(transaction.amount).toBe(150);
      expect(transaction.timestamp).toBeDefined();

      expect(mockEnv.FLIPPER_TRANSACTIONS.put).toHaveBeenCalled();
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Purchase transaction processed',
        expect.objectContaining({
          item_id: 'item_123',
          amount: 150,
        })
      );
    });

    it('should update state totalInvested after purchase', async () => {
      const item: EvaluatedListing = {
        id: 'item_456',
        title: 'Gaming Console',
        price: 300,
        url: 'https://example.com/item2',
        marketplace: 'facebook',
        category: 'electronics',
        timestamp: '2025-10-01T11:00:00.000Z',
        is_undervalued: true,
        score: 9.0,
        estimated_resale: 450,
        profit_potential: 150,
        profit_margin: 0.5,
        reasoning: 'Great deal',
        scores_breakdown: {
          historical: 0.9,
          msrp: 0.95,
          scarcity: 0.8,
          ratio: 0.9,
        },
      };

      await processPurchase(item, state, mockEnv);

      expect(state.totalInvested).toBe(300);
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0]).toBeDefined();
      expect(state.transactions[0]!.type).toBe('purchase');
    });

    it('should add transaction to state transactions array', async () => {
      const item: EvaluatedListing = {
        id: 'item_789',
        title: 'Laptop',
        price: 500,
        url: 'https://example.com/item3',
        marketplace: 'craigslist',
        category: 'electronics',
        timestamp: '2025-10-01T12:00:00.000Z',
        is_undervalued: true,
        score: 7.5,
        estimated_resale: 700,
        profit_potential: 200,
        profit_margin: 0.4,
        reasoning: 'Solid opportunity',
        scores_breakdown: {
          historical: 0.7,
          msrp: 0.8,
          scarcity: 0.75,
          ratio: 0.78,
        },
      };

      const transaction = await processPurchase(item, state, mockEnv);

      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0]).toEqual(transaction);
    });
  });

  describe('processResale', () => {
    it('should create sale transaction from inventory item', async () => {
      const item: InventoryItem = {
        id: 'item_123',
        title: 'Vintage Camera',
        price: 150,
        url: 'https://example.com/item',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T10:00:00.000Z',
        is_undervalued: true,
        score: 8.5,
        estimated_resale: 250,
        profit_potential: 100,
        profit_margin: 0.67,
        reasoning: 'Good deal',
        scores_breakdown: {
          historical: 0.8,
          msrp: 0.9,
          scarcity: 0.7,
          ratio: 0.85,
        },
        purchase_date: '2025-10-01T10:00:00.000Z',
        status: 'sold',
        resale_price: 250,
      };

      const transaction = await processResale(item, state, mockEnv);

      expect(transaction.type).toBe('sale');
      expect(transaction.item_id).toBe('item_123');
      expect(transaction.amount).toBe(250);
      expect(transaction.timestamp).toBeDefined();

      expect(mockEnv.FLIPPER_TRANSACTIONS.put).toHaveBeenCalled();
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Resale transaction processed',
        expect.objectContaining({
          item_id: 'item_123',
          amount: 250,
        })
      );
    });

    it('should update state potentialRevenue after resale', async () => {
      const item: InventoryItem = {
        id: 'item_456',
        title: 'Gaming Console',
        price: 300,
        url: 'https://example.com/item2',
        marketplace: 'facebook',
        category: 'electronics',
        timestamp: '2025-10-01T11:00:00.000Z',
        is_undervalued: true,
        score: 9.0,
        estimated_resale: 450,
        profit_potential: 150,
        profit_margin: 0.5,
        reasoning: 'Great deal',
        scores_breakdown: {
          historical: 0.9,
          msrp: 0.95,
          scarcity: 0.8,
          ratio: 0.9,
        },
        purchase_date: '2025-10-01T11:00:00.000Z',
        status: 'sold',
        resale_price: 450,
      };

      await processResale(item, state, mockEnv);

      expect(state.potentialRevenue).toBe(450);
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0]).toBeDefined();
      expect(state.transactions[0]!.type).toBe('sale');
    });

    it('should use estimated_resale if resale_price is not set', async () => {
      const item: InventoryItem = {
        id: 'item_789',
        title: 'Laptop',
        price: 500,
        url: 'https://example.com/item3',
        marketplace: 'craigslist',
        category: 'electronics',
        timestamp: '2025-10-01T12:00:00.000Z',
        is_undervalued: true,
        score: 7.5,
        estimated_resale: 700,
        profit_potential: 200,
        profit_margin: 0.4,
        reasoning: 'Solid opportunity',
        scores_breakdown: {
          historical: 0.7,
          msrp: 0.8,
          scarcity: 0.75,
          ratio: 0.78,
        },
        purchase_date: '2025-10-01T12:00:00.000Z',
        status: 'listed',
      };

      const transaction = await processResale(item, state, mockEnv);

      expect(transaction.amount).toBe(700);
    });
  });

  describe('getFinancialStats', () => {
    it('should calculate financial statistics correctly', () => {
      state.totalInvested = 1000;
      state.potentialRevenue = 1500;
      state.transactions = [
        { type: 'purchase', item_id: 'item_1', amount: 500, timestamp: '2025-10-01T10:00:00.000Z' },
        { type: 'purchase', item_id: 'item_2', amount: 500, timestamp: '2025-10-01T11:00:00.000Z' },
        { type: 'sale', item_id: 'item_1', amount: 750, timestamp: '2025-10-01T12:00:00.000Z' },
        { type: 'sale', item_id: 'item_2', amount: 750, timestamp: '2025-10-01T13:00:00.000Z' },
      ];

      const stats = getFinancialStats(state);

      expect(stats.total_invested).toBe(1000);
      expect(stats.potential_revenue).toBe(1500);
      expect(stats.expected_profit).toBe(500);
      expect(stats.expected_roi).toBe(0.5);
      expect(stats.transaction_count).toBe(4);
    });

    it('should handle zero invested with zero ROI', () => {
      state.totalInvested = 0;
      state.potentialRevenue = 0;
      state.transactions = [];

      const stats = getFinancialStats(state);

      expect(stats.total_invested).toBe(0);
      expect(stats.potential_revenue).toBe(0);
      expect(stats.expected_profit).toBe(0);
      expect(stats.expected_roi).toBe(0);
      expect(stats.transaction_count).toBe(0);
    });

    it('should calculate ROI correctly with purchases only', () => {
      state.totalInvested = 1000;
      state.potentialRevenue = 0;
      state.transactions = [
        { type: 'purchase', item_id: 'item_1', amount: 1000, timestamp: '2025-10-01T10:00:00.000Z' },
      ];

      const stats = getFinancialStats(state);

      expect(stats.expected_profit).toBe(-1000);
      expect(stats.expected_roi).toBe(-1);
    });

    it('should calculate ROI correctly with mixed transactions', () => {
      state.totalInvested = 2000;
      state.potentialRevenue = 3000;
      state.transactions = [
        { type: 'purchase', item_id: 'item_1', amount: 1000, timestamp: '2025-10-01T10:00:00.000Z' },
        { type: 'purchase', item_id: 'item_2', amount: 1000, timestamp: '2025-10-01T11:00:00.000Z' },
        { type: 'sale', item_id: 'item_1', amount: 1500, timestamp: '2025-10-01T12:00:00.000Z' },
        { type: 'sale', item_id: 'item_2', amount: 1500, timestamp: '2025-10-01T13:00:00.000Z' },
      ];

      const stats = getFinancialStats(state);

      expect(stats.expected_profit).toBe(1000);
      expect(stats.expected_roi).toBe(0.5);
    });
  });
});
