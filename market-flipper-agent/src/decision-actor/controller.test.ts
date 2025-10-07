import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  makeDecisions,
  evaluateOpportunity,
  processPurchases,
} from './controller.js';
import { EvaluatedListing, Decision } from '../types/shared.js';
import { createInitialState, DecisionActorState, BUSINESS_RULES } from './model.js';
import { Env } from './raindrop.gen.js';

describe('controller.ts - Decision-making workflows', () => {
  let state: DecisionActorState;
  let mockEnv: Partial<Env>;

  beforeEach(() => {
    state = createInitialState();

    // Create mock actor stubs
    const mockTransactionActorStub = {
      processPurchase: vi.fn().mockResolvedValue(undefined),
    };

    const mockInventoryActorStub = {
      processNewPurchase: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock environment
    mockEnv = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
      TRANSACTION_ACTOR: {
        idFromName: vi.fn().mockReturnValue('mock-transaction-id'),
        get: vi.fn().mockReturnValue(mockTransactionActorStub),
      } as any,
      INVENTORY_ACTOR: {
        idFromName: vi.fn().mockReturnValue('mock-inventory-id'),
        get: vi.fn().mockReturnValue(mockInventoryActorStub),
      } as any,
    };
  });

  describe('evaluateOpportunity', () => {
    test('should return BUY decision for profitable item meeting business rules', () => {
      const item: EvaluatedListing = {
        id: 'item-1',
        title: 'Vintage Camera',
        price: 200,
        url: 'http://example.com/item-1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: new Date().toISOString(),
        is_undervalued: true,
        score: 85,
        estimated_resale: 300,
        profit_potential: 100,
        profit_margin: 0.50, // 50% margin
        reasoning: 'Great condition, high demand',
        scores_breakdown: {
          historical: 90,
          msrp: 85,
          scarcity: 80,
          ratio: 88,
        },
      };

      const decision = evaluateOpportunity(item, state);

      expect(decision.action).toBe('BUY');
      expect(decision.item_id).toBe('item-1');
      expect(decision.title).toBe('Vintage Camera');
      expect(decision.price).toBe(200);
      expect(decision.profit_potential).toBe(100);
      expect(decision.reasoning).toContain('Profit: $100');
      expect(decision.timestamp).toBeDefined();
    });

    test('should return SKIP decision for item with low profit margin', () => {
      const item: EvaluatedListing = {
        id: 'item-2',
        title: 'Low Margin Item',
        price: 100,
        url: 'http://example.com/item-2',
        marketplace: 'craigslist',
        category: 'electronics',
        timestamp: new Date().toISOString(),
        is_undervalued: true,
        score: 60,
        estimated_resale: 115,
        profit_potential: 15,
        profit_margin: 0.15, // 15% margin - below 20% minimum
        reasoning: 'Marginal deal',
        scores_breakdown: {
          historical: 65,
          msrp: 60,
          scarcity: 55,
          ratio: 62,
        },
      };

      const decision = evaluateOpportunity(item, state);

      expect(decision.action).toBe('SKIP');
      expect(decision.reasoning).toContain('Profit margin too low');
      expect(decision.reasoning).toContain('15.0%');
      expect(decision.reasoning).toContain('20.0%');
    });

    test('should return SKIP decision for item with low profit amount', () => {
      const item: EvaluatedListing = {
        id: 'item-3',
        title: 'Low Profit Item',
        price: 50,
        url: 'http://example.com/item-3',
        marketplace: 'facebook',
        category: 'electronics',
        timestamp: new Date().toISOString(),
        is_undervalued: true,
        score: 70,
        estimated_resale: 85,
        profit_potential: 35,
        profit_margin: 0.70, // 70% margin - good margin but low profit
        reasoning: 'High margin but low value',
        scores_breakdown: {
          historical: 75,
          msrp: 70,
          scarcity: 68,
          ratio: 72,
        },
      };

      const decision = evaluateOpportunity(item, state);

      expect(decision.action).toBe('SKIP');
      expect(decision.reasoning).toContain('Profit amount too low');
      expect(decision.reasoning).toContain('$35');
      expect(decision.reasoning).toContain('$50');
    });

    test('should return SKIP decision for already purchased item', () => {
      const item: EvaluatedListing = {
        id: 'item-already-bought',
        title: 'Duplicate Item',
        price: 200,
        url: 'http://example.com/item',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: new Date().toISOString(),
        is_undervalued: true,
        score: 90,
        estimated_resale: 350,
        profit_potential: 150,
        profit_margin: 0.75,
        reasoning: 'Excellent deal',
        scores_breakdown: {
          historical: 95,
          msrp: 90,
          scarcity: 88,
          ratio: 92,
        },
      };

      // Mark item as already purchased
      state.purchasedIds.add('item-already-bought');

      const decision = evaluateOpportunity(item, state);

      expect(decision.action).toBe('SKIP');
      expect(decision.reasoning).toContain('Already purchased');
    });

    test('should return SKIP decision when price exceeds budget', () => {
      const item: EvaluatedListing = {
        id: 'expensive-item',
        title: 'Expensive Item',
        price: 6000,
        url: 'http://example.com/item',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: new Date().toISOString(),
        is_undervalued: true,
        score: 95,
        estimated_resale: 9000,
        profit_potential: 3000,
        profit_margin: 0.50,
        reasoning: 'Amazing deal',
        scores_breakdown: {
          historical: 98,
          msrp: 95,
          scarcity: 92,
          ratio: 96,
        },
      };

      // Budget is 5000 by default
      const decision = evaluateOpportunity(item, state);

      expect(decision.action).toBe('SKIP');
      expect(decision.reasoning).toContain('Exceeds budget');
      expect(decision.reasoning).toContain('$6000');
      expect(decision.reasoning).toContain('$5000');
    });
  });

  describe('makeDecisions', () => {
    test('should make BUY decisions for multiple valid items', async () => {
      const evaluatedListings: EvaluatedListing[] = [
        {
          id: 'item-1',
          title: 'Item 1',
          price: 100,
          url: 'http://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 85,
          estimated_resale: 200,
          profit_potential: 100,
          profit_margin: 1.0,
          reasoning: 'Great deal',
          scores_breakdown: { historical: 85, msrp: 85, scarcity: 85, ratio: 85 },
        },
        {
          id: 'item-2',
          title: 'Item 2',
          price: 150,
          url: 'http://example.com/2',
          marketplace: 'craigslist',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 90,
          estimated_resale: 300,
          profit_potential: 150,
          profit_margin: 1.0,
          reasoning: 'Excellent deal',
          scores_breakdown: { historical: 90, msrp: 90, scarcity: 90, ratio: 90 },
        },
      ];

      const decisions = await makeDecisions(
        evaluatedListings,
        5000,
        mockEnv as Env
      );

      expect(decisions).toHaveLength(2);
      expect(decisions[0]!.action).toBe('BUY');
      expect(decisions[1]!.action).toBe('BUY');
      expect(mockEnv.logger?.info).toHaveBeenCalled();
    });

    test('should skip items that do not meet business rules', async () => {
      const evaluatedListings: EvaluatedListing[] = [
        {
          id: 'bad-margin',
          title: 'Bad Margin',
          price: 100,
          url: 'http://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: false,
          score: 50,
          estimated_resale: 110,
          profit_potential: 10,
          profit_margin: 0.10, // Too low
          reasoning: 'Marginal',
          scores_breakdown: { historical: 50, msrp: 50, scarcity: 50, ratio: 50 },
        },
        {
          id: 'good-item',
          title: 'Good Item',
          price: 200,
          url: 'http://example.com/2',
          marketplace: 'facebook',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 85,
          estimated_resale: 300,
          profit_potential: 100,
          profit_margin: 0.50,
          reasoning: 'Great deal',
          scores_breakdown: { historical: 85, msrp: 85, scarcity: 85, ratio: 85 },
        },
      ];

      const decisions = await makeDecisions(
        evaluatedListings,
        5000,
        mockEnv as Env
      );

      expect(decisions).toHaveLength(2);
      expect(decisions[0]!.action).toBe('SKIP');
      expect(decisions[1]!.action).toBe('BUY');
    });

    test('should respect budget constraints across multiple items', async () => {
      const evaluatedListings: EvaluatedListing[] = [
        {
          id: 'item-1',
          title: 'Item 1',
          price: 300,
          url: 'http://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 85,
          estimated_resale: 500,
          profit_potential: 200,
          profit_margin: 0.67,
          reasoning: 'Great',
          scores_breakdown: { historical: 85, msrp: 85, scarcity: 85, ratio: 85 },
        },
        {
          id: 'item-2',
          title: 'Item 2',
          price: 300,
          url: 'http://example.com/2',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 90,
          estimated_resale: 500,
          profit_potential: 200,
          profit_margin: 0.67,
          reasoning: 'Excellent',
          scores_breakdown: { historical: 90, msrp: 90, scarcity: 90, ratio: 90 },
        },
      ];

      const decisions = await makeDecisions(
        evaluatedListings,
        500, // Limited budget
        mockEnv as Env
      );

      const buyDecisions = decisions.filter((d) => d.action === 'BUY');
      expect(buyDecisions.length).toBeLessThanOrEqual(1); // Can only afford one
    });

    test('should log all decisions', async () => {
      const evaluatedListings: EvaluatedListing[] = [
        {
          id: 'item-1',
          title: 'Test Item',
          price: 100,
          url: 'http://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 85,
          estimated_resale: 200,
          profit_potential: 100,
          profit_margin: 1.0,
          reasoning: 'Good',
          scores_breakdown: { historical: 85, msrp: 85, scarcity: 85, ratio: 85 },
        },
      ];

      await makeDecisions(evaluatedListings, 5000, mockEnv as Env);

      expect(mockEnv.logger?.info).toHaveBeenCalledWith(
        expect.stringContaining('Decision for item-1'),
        expect.any(Object)
      );
    });
  });

  describe('processPurchases', () => {
    test('should call transaction and inventory actors for BUY decisions', async () => {
      const evaluatedListings: EvaluatedListing[] = [
        {
          id: 'item-1',
          title: 'Item 1',
          price: 100,
          url: 'http://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 85,
          estimated_resale: 200,
          profit_potential: 50,
          profit_margin: 0.5,
          reasoning: 'Good deal',
          scores_breakdown: { historical: 85, msrp: 85, scarcity: 85, ratio: 85 },
        },
        {
          id: 'item-2',
          title: 'Item 2',
          price: 200,
          url: 'http://example.com/2',
          marketplace: 'craigslist',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 90,
          estimated_resale: 400,
          profit_potential: 100,
          profit_margin: 0.5,
          reasoning: 'Great deal',
          scores_breakdown: { historical: 90, msrp: 90, scarcity: 90, ratio: 90 },
        },
      ];

      const decisions: Decision[] = [
        {
          action: 'BUY',
          item_id: 'item-1',
          title: 'Item 1',
          price: 100,
          score: 85,
          profit_potential: 50,
          reasoning: 'Good deal',
          timestamp: new Date().toISOString(),
        },
        {
          action: 'BUY',
          item_id: 'item-2',
          title: 'Item 2',
          price: 200,
          score: 90,
          profit_potential: 100,
          reasoning: 'Great deal',
          timestamp: new Date().toISOString(),
        },
      ];

      await processPurchases(decisions, evaluatedListings, mockEnv as Env);

      // Get the mock stub from the last call
      const transactionStub = (mockEnv.TRANSACTION_ACTOR as any).get();
      const inventoryStub = (mockEnv.INVENTORY_ACTOR as any).get();

      expect(transactionStub.processPurchase).toHaveBeenCalledTimes(2);
      expect(inventoryStub.processNewPurchase).toHaveBeenCalledTimes(2);
    });

    test('should not call actors for SKIP decisions', async () => {
      const evaluatedListings: EvaluatedListing[] = [
        {
          id: 'item-1',
          title: 'Item 1',
          price: 100,
          url: 'http://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: false,
          score: 45,
          estimated_resale: 120,
          profit_potential: 10,
          profit_margin: 0.1,
          reasoning: 'Too risky',
          scores_breakdown: { historical: 45, msrp: 45, scarcity: 45, ratio: 45 },
        },
      ];

      const decisions: Decision[] = [
        {
          action: 'SKIP',
          item_id: 'item-1',
          title: 'Item 1',
          price: 100,
          score: 45,
          profit_potential: 10,
          reasoning: 'Too risky',
          timestamp: new Date().toISOString(),
        },
      ];

      await processPurchases(decisions, evaluatedListings, mockEnv as Env);

      // Get the mock stub
      const transactionStub = (mockEnv.TRANSACTION_ACTOR as any).get();
      const inventoryStub = (mockEnv.INVENTORY_ACTOR as any).get();

      expect(transactionStub.processPurchase).not.toHaveBeenCalled();
      expect(inventoryStub.processNewPurchase).not.toHaveBeenCalled();
    });

    test('should handle mixed BUY and SKIP decisions', async () => {
      const evaluatedListings: EvaluatedListing[] = [
        {
          id: 'item-buy',
          title: 'Buy Item',
          price: 100,
          url: 'http://example.com/buy',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 85,
          estimated_resale: 200,
          profit_potential: 50,
          profit_margin: 0.5,
          reasoning: 'Good',
          scores_breakdown: { historical: 85, msrp: 85, scarcity: 85, ratio: 85 },
        },
        {
          id: 'item-skip',
          title: 'Skip Item',
          price: 100,
          url: 'http://example.com/skip',
          marketplace: 'craigslist',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: false,
          score: 40,
          estimated_resale: 110,
          profit_potential: 5,
          profit_margin: 0.05,
          reasoning: 'Bad',
          scores_breakdown: { historical: 40, msrp: 40, scarcity: 40, ratio: 40 },
        },
      ];

      const decisions: Decision[] = [
        {
          action: 'BUY',
          item_id: 'item-buy',
          title: 'Buy Item',
          price: 100,
          score: 85,
          profit_potential: 50,
          reasoning: 'Good',
          timestamp: new Date().toISOString(),
        },
        {
          action: 'SKIP',
          item_id: 'item-skip',
          title: 'Skip Item',
          price: 100,
          score: 40,
          profit_potential: 5,
          reasoning: 'Bad',
          timestamp: new Date().toISOString(),
        },
      ];

      await processPurchases(decisions, evaluatedListings, mockEnv as Env);

      // Get the mock stub
      const transactionStub = (mockEnv.TRANSACTION_ACTOR as any).get();
      const inventoryStub = (mockEnv.INVENTORY_ACTOR as any).get();

      expect(transactionStub.processPurchase).toHaveBeenCalledTimes(1);
      expect(inventoryStub.processNewPurchase).toHaveBeenCalledTimes(1);
    });

    test('should log purchase processing', async () => {
      const evaluatedListings: EvaluatedListing[] = [
        {
          id: 'item-1',
          title: 'Item 1',
          price: 100,
          url: 'http://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: new Date().toISOString(),
          is_undervalued: true,
          score: 85,
          estimated_resale: 200,
          profit_potential: 50,
          profit_margin: 0.5,
          reasoning: 'Good',
          scores_breakdown: { historical: 85, msrp: 85, scarcity: 85, ratio: 85 },
        },
      ];

      const decisions: Decision[] = [
        {
          action: 'BUY',
          item_id: 'item-1',
          title: 'Item 1',
          price: 100,
          score: 85,
          profit_potential: 50,
          reasoning: 'Good',
          timestamp: new Date().toISOString(),
        },
      ];

      await processPurchases(decisions, evaluatedListings, mockEnv as Env);

      expect(mockEnv.logger?.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing purchase'),
        expect.any(Object)
      );
    });
  });
});
