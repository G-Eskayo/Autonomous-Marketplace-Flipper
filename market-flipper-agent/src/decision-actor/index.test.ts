import { describe, test, expect, beforeEach, vi } from 'vitest';
import { DecisionActor } from './index.js';
import { EvaluatedListing } from '../types/shared.js';
import { ActorState } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen.js';

describe('DecisionActor Integration Tests', () => {
  let actor: DecisionActor;
  let mockActorState: ActorState;
  let mockEnv: Partial<Env>;

  beforeEach(() => {
    // Create mock actor state
    const storage = new Map();
    mockActorState = {
      storage: {
        get: vi.fn((key: string) => storage.get(key)),
        put: vi.fn((key: string, value: any) => {
          storage.set(key, value);
          return Promise.resolve();
        }),
        delete: vi.fn((key: string) => {
          storage.delete(key);
          return Promise.resolve();
        }),
        list: vi.fn(() => Promise.resolve(new Map())),
      },
    } as any;

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

    actor = new DecisionActor(mockActorState, mockEnv as Env);
  });

  test('should initialize with default state', async () => {
    const stats = await actor.getStats();

    expect(stats.items_purchased).toBe(0);
    expect(stats.total_invested).toBe(0);
    expect(stats.expected_profit).toBe(0);
  });

  test('should make BUY decision for profitable item', async () => {
    const listings: EvaluatedListing[] = [
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
        estimated_resale: 250,
        profit_potential: 150,
        profit_margin: 1.5,
        reasoning: 'Great deal',
        scores_breakdown: {
          historical: 85,
          msrp: 85,
          scarcity: 85,
          ratio: 85,
        },
      },
    ];

    const decisions = await actor.makeDecisions(listings, 5000);

    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.action).toBe('BUY');
    expect(decisions[0]!.item_id).toBe('item-1');
  });

  test('should track statistics after purchases', async () => {
    const listings: EvaluatedListing[] = [
      {
        id: 'item-1',
        title: 'Item 1',
        price: 200,
        url: 'http://example.com/1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: new Date().toISOString(),
        is_undervalued: true,
        score: 85,
        estimated_resale: 300,
        profit_potential: 100,
        profit_margin: 0.50,
        reasoning: 'Good',
        scores_breakdown: {
          historical: 85,
          msrp: 85,
          scarcity: 85,
          ratio: 85,
        },
      },
    ];

    await actor.makeDecisions(listings, 5000);
    const stats = await actor.getStats();

    expect(stats.items_purchased).toBe(1);
    expect(stats.total_invested).toBe(200);
    expect(stats.expected_profit).toBe(100);
    expect(stats.listings_scanned).toBe(1);
  });

  test('should update budget configuration', async () => {
    await actor.updateConfig({ budget: 10000 });

    // Verify by making a decision with high-price item
    const listings: EvaluatedListing[] = [
      {
        id: 'expensive-item',
        title: 'Expensive Item',
        price: 8000,
        url: 'http://example.com/1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: new Date().toISOString(),
        is_undervalued: true,
        score: 90,
        estimated_resale: 12000,
        profit_potential: 4000,
        profit_margin: 0.50,
        reasoning: 'Great',
        scores_breakdown: {
          historical: 90,
          msrp: 90,
          scarcity: 90,
          ratio: 90,
        },
      },
    ];

    const decisions = await actor.makeDecisions(listings, 10000);
    expect(decisions[0]!.action).toBe('BUY');
  });

  test('should prevent duplicate purchases', async () => {
    const listing: EvaluatedListing = {
      id: 'duplicate-item',
      title: 'Duplicate Item',
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
      scores_breakdown: {
        historical: 85,
        msrp: 85,
        scarcity: 85,
        ratio: 85,
      },
    };

    // First purchase
    const decisions1 = await actor.makeDecisions([listing], 5000);
    expect(decisions1[0]!.action).toBe('BUY');

    // Second attempt should be skipped
    const decisions2 = await actor.makeDecisions([listing], 5000);
    expect(decisions2[0]!.action).toBe('SKIP');
    expect(decisions2[0]!.reasoning).toContain('Already purchased');
  });

  test('should coordinate with transaction and inventory actors', async () => {
    const listings: EvaluatedListing[] = [
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
        reasoning: 'Good',
        scores_breakdown: {
          historical: 85,
          msrp: 85,
          scarcity: 85,
          ratio: 85,
        },
      },
    ];

    await actor.makeDecisions(listings, 5000);

    // Get the mock stubs
    const transactionStub = (mockEnv.TRANSACTION_ACTOR as any).get();
    const inventoryStub = (mockEnv.INVENTORY_ACTOR as any).get();

    expect(transactionStub.processPurchase).toHaveBeenCalled();
    expect(inventoryStub.processNewPurchase).toHaveBeenCalled();
  });
});
