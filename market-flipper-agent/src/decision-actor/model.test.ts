import { describe, test, expect, beforeEach } from 'vitest';
import {
  validateBudget,
  addPurchasedId,
  hasPurchased,
  updateStats,
  createInitialState,
  BUSINESS_RULES,
} from './model.js';
import { Decision, AgentStats } from '../types/shared.js';

describe('model.ts - State Management', () => {
  describe('createInitialState', () => {
    test('should create initial state with default values', () => {
      const state = createInitialState();

      expect(state.budget).toBe(5000);
      expect(state.purchasedIds).toBeInstanceOf(Set);
      expect(state.purchasedIds.size).toBe(0);
      expect(state.stats).toEqual({
        listings_scanned: 0,
        items_purchased: 0,
        items_listed: 0,
        total_invested: 0,
        potential_revenue: 0,
        expected_profit: 0,
        expected_roi: 0,
      });
    });
  });

  describe('validateBudget', () => {
    test('should return true when price is within budget', () => {
      expect(validateBudget(100, 5000)).toBe(true);
      expect(validateBudget(5000, 5000)).toBe(true);
    });

    test('should return false when price exceeds budget', () => {
      expect(validateBudget(5001, 5000)).toBe(false);
      expect(validateBudget(10000, 5000)).toBe(false);
    });

    test('should return false for negative budget', () => {
      expect(validateBudget(100, -100)).toBe(false);
    });

    test('should return false for zero budget', () => {
      expect(validateBudget(100, 0)).toBe(false);
    });
  });

  describe('addPurchasedId', () => {
    let state: ReturnType<typeof createInitialState>;

    beforeEach(() => {
      state = createInitialState();
    });

    test('should add new item ID to purchasedIds set', () => {
      addPurchasedId('item-123', state);
      expect(state.purchasedIds.has('item-123')).toBe(true);
      expect(state.purchasedIds.size).toBe(1);
    });

    test('should handle multiple unique IDs', () => {
      addPurchasedId('item-1', state);
      addPurchasedId('item-2', state);
      addPurchasedId('item-3', state);

      expect(state.purchasedIds.size).toBe(3);
      expect(state.purchasedIds.has('item-1')).toBe(true);
      expect(state.purchasedIds.has('item-2')).toBe(true);
      expect(state.purchasedIds.has('item-3')).toBe(true);
    });

    test('should not add duplicate IDs', () => {
      addPurchasedId('item-123', state);
      addPurchasedId('item-123', state);

      expect(state.purchasedIds.size).toBe(1);
    });
  });

  describe('hasPurchased', () => {
    let state: ReturnType<typeof createInitialState>;

    beforeEach(() => {
      state = createInitialState();
      addPurchasedId('item-123', state);
      addPurchasedId('item-456', state);
    });

    test('should return true for purchased item', () => {
      expect(hasPurchased('item-123', state)).toBe(true);
      expect(hasPurchased('item-456', state)).toBe(true);
    });

    test('should return false for unpurchased item', () => {
      expect(hasPurchased('item-789', state)).toBe(false);
      expect(hasPurchased('unknown-id', state)).toBe(false);
    });
  });

  describe('updateStats', () => {
    let state: ReturnType<typeof createInitialState>;

    beforeEach(() => {
      state = createInitialState();
    });

    test('should update stats for BUY decision', () => {
      const buyDecision: Decision = {
        action: 'BUY',
        item_id: 'item-1',
        title: 'Test Item',
        price: 100,
        score: 85,
        profit_potential: 50,
        reasoning: 'Good deal',
        timestamp: new Date().toISOString(),
      };

      updateStats(buyDecision, state);

      expect(state.stats.items_purchased).toBe(1);
      expect(state.stats.total_invested).toBe(100);
      expect(state.stats.potential_revenue).toBe(150); // price + profit_potential
      expect(state.stats.expected_profit).toBe(50);
    });

    test('should calculate ROI correctly for BUY decision', () => {
      const buyDecision: Decision = {
        action: 'BUY',
        item_id: 'item-1',
        title: 'Test Item',
        price: 200,
        score: 90,
        profit_potential: 100,
        reasoning: 'Great deal',
        timestamp: new Date().toISOString(),
      };

      updateStats(buyDecision, state);

      // ROI = (profit / invested) * 100 = (100 / 200) * 100 = 50
      expect(state.stats.expected_roi).toBe(50);
    });

    test('should not change purchase stats for SKIP decision', () => {
      const skipDecision: Decision = {
        action: 'SKIP',
        item_id: 'item-1',
        title: 'Test Item',
        price: 100,
        score: 45,
        profit_potential: 10,
        reasoning: 'Too risky',
        timestamp: new Date().toISOString(),
      };

      updateStats(skipDecision, state);

      expect(state.stats.items_purchased).toBe(0);
      expect(state.stats.total_invested).toBe(0);
      expect(state.stats.potential_revenue).toBe(0);
      expect(state.stats.expected_profit).toBe(0);
    });

    test('should accumulate stats for multiple BUY decisions', () => {
      const buy1: Decision = {
        action: 'BUY',
        item_id: 'item-1',
        title: 'Item 1',
        price: 100,
        score: 85,
        profit_potential: 50,
        reasoning: 'Good deal',
        timestamp: new Date().toISOString(),
      };

      const buy2: Decision = {
        action: 'BUY',
        item_id: 'item-2',
        title: 'Item 2',
        price: 200,
        score: 90,
        profit_potential: 100,
        reasoning: 'Great deal',
        timestamp: new Date().toISOString(),
      };

      updateStats(buy1, state);
      updateStats(buy2, state);

      expect(state.stats.items_purchased).toBe(2);
      expect(state.stats.total_invested).toBe(300);
      expect(state.stats.potential_revenue).toBe(450); // (100+50) + (200+100)
      expect(state.stats.expected_profit).toBe(150);
      // ROI = (150 / 300) * 100 = 50
      expect(state.stats.expected_roi).toBe(50);
    });

    test('should handle zero investment edge case', () => {
      // ROI should be 0 when total_invested is 0
      expect(state.stats.expected_roi).toBe(0);
    });
  });

  describe('BUSINESS_RULES', () => {
    test('should define minimum profit margin of 20%', () => {
      expect(BUSINESS_RULES.MIN_PROFIT_MARGIN).toBe(0.20);
    });

    test('should define minimum profit of $50', () => {
      expect(BUSINESS_RULES.MIN_PROFIT).toBe(50);
    });
  });
});
