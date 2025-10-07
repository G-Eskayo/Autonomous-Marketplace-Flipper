import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryActor } from './index.js';
import { ActorState } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen.js';
import { EvaluatedListing } from './types.js';

describe('InventoryActor - Integration Tests', () => {
  let actor: InventoryActor;
  let mockEnv: Env;
  let mockState: ActorState;

  beforeEach(() => {
    // Mock environment
    mockEnv = {
      FLIPPER_INVENTORY: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue([]),
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    } as any;

    // Mock actor state
    mockState = {
      id: 'test-actor',
      storage: {},
    } as any;

    // Create actor instance
    actor = new InventoryActor(mockState, mockEnv);
  });

  describe('Actor Initialization', () => {
    it('should initialize with empty inventory', async () => {
      const inventory = await actor.getInventory();
      expect(inventory).toEqual([]);
    });

    it('should have default state with inventory Map and listedIds Set', () => {
      expect(actor).toBeDefined();
      expect(actor.processNewPurchase).toBeDefined();
      expect(actor.getInventory).toBeDefined();
      expect(actor.relistItems).toBeDefined();
    });
  });

  describe('processNewPurchase', () => {
    it('should add item to inventory through public interface', async () => {
      const evaluatedListing: EvaluatedListing = {
        id: 'listing-1',
        title: 'Test Item',
        price: 100,
        url: 'https://example.com/1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T12:00:00Z',
        is_undervalued: true,
        score: 85,
        estimated_resale: 150,
        profit_potential: 50,
        profit_margin: 50,
        reasoning: 'Good deal',
        scores_breakdown: {
          historical: 80,
          msrp: 90,
          scarcity: 85,
          ratio: 85,
        },
      };

      const result = await actor.processNewPurchase(evaluatedListing);

      expect(result.id).toBe('listing-1');
      expect(result.status).toBe('purchased');
      expect(result.purchase_date).toBeDefined();
    });

    it('should persist item to SmartBucket', async () => {
      const evaluatedListing: EvaluatedListing = {
        id: 'listing-2',
        title: 'Another Item',
        price: 200,
        url: 'https://example.com/2',
        marketplace: 'facebook',
        category: 'furniture',
        timestamp: '2025-10-01T13:00:00Z',
        is_undervalued: true,
        score: 90,
        estimated_resale: 300,
        profit_potential: 100,
        profit_margin: 50,
        reasoning: 'Great deal',
        scores_breakdown: {
          historical: 85,
          msrp: 95,
          scarcity: 90,
          ratio: 90,
        },
      };

      await actor.processNewPurchase(evaluatedListing);

      expect(mockEnv.FLIPPER_INVENTORY.put).toHaveBeenCalledWith(
        'listing-2',
        expect.stringContaining('"status":"purchased"')
      );
    });
  });

  describe('getInventory', () => {
    it('should return all items in inventory', async () => {
      const item1: EvaluatedListing = {
        id: 'item-1',
        title: 'Item 1',
        price: 100,
        url: 'https://example.com/1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T12:00:00Z',
        is_undervalued: true,
        score: 85,
        estimated_resale: 150,
        profit_potential: 50,
        profit_margin: 50,
        reasoning: 'Good',
        scores_breakdown: {
          historical: 80,
          msrp: 90,
          scarcity: 85,
          ratio: 85,
        },
      };

      const item2: EvaluatedListing = {
        id: 'item-2',
        title: 'Item 2',
        price: 200,
        url: 'https://example.com/2',
        marketplace: 'facebook',
        category: 'gaming',
        timestamp: '2025-10-01T13:00:00Z',
        is_undervalued: true,
        score: 90,
        estimated_resale: 300,
        profit_potential: 100,
        profit_margin: 50,
        reasoning: 'Great',
        scores_breakdown: {
          historical: 85,
          msrp: 95,
          scarcity: 90,
          ratio: 90,
        },
      };

      await actor.processNewPurchase(item1);
      await actor.processNewPurchase(item2);

      const inventory = await actor.getInventory();

      expect(inventory).toHaveLength(2);
      expect(inventory[0]).toBeDefined();
      expect(inventory[0]!.id).toBe('item-1');
      expect(inventory[1]).toBeDefined();
      expect(inventory[1]!.id).toBe('item-2');
    });
  });

  describe('relistItems', () => {
    it('should create re-listings for purchased items', async () => {
      const item: EvaluatedListing = {
        id: 'item-1',
        title: 'Test Item',
        price: 100,
        url: 'https://example.com/1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T12:00:00Z',
        is_undervalued: true,
        score: 85,
        estimated_resale: 150,
        profit_potential: 50,
        profit_margin: 50,
        reasoning: 'Good',
        scores_breakdown: {
          historical: 80,
          msrp: 90,
          scarcity: 85,
          ratio: 85,
        },
      };

      await actor.processNewPurchase(item);

      const listings = await actor.relistItems();

      expect(listings).toHaveLength(1);
      expect(listings[0]).toBeDefined();
      expect(listings[0]!.id).toBe('resale_item-1');
      expect(listings[0]!.price).toBe(150); // estimated_resale
    });

    it('should mark items as listed after re-listing', async () => {
      const item: EvaluatedListing = {
        id: 'item-1',
        title: 'Test Item',
        price: 100,
        url: 'https://example.com/1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T12:00:00Z',
        is_undervalued: true,
        score: 85,
        estimated_resale: 150,
        profit_potential: 50,
        profit_margin: 50,
        reasoning: 'Good',
        scores_breakdown: {
          historical: 80,
          msrp: 90,
          scarcity: 85,
          ratio: 85,
        },
      };

      await actor.processNewPurchase(item);
      await actor.relistItems();

      const inventory = await actor.getInventory();
      expect(inventory[0]).toBeDefined();
      expect(inventory[0]!.status).toBe('listed');
      expect(inventory[0]!.resale_price).toBe(150);
    });

    it('should handle multiple items', async () => {
      const items: EvaluatedListing[] = [
        {
          id: 'item-1',
          title: 'Item 1',
          price: 100,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T12:00:00Z',
          is_undervalued: true,
          score: 85,
          estimated_resale: 150,
          profit_potential: 50,
          profit_margin: 50,
          reasoning: 'Good',
          scores_breakdown: {
            historical: 80,
            msrp: 90,
            scarcity: 85,
            ratio: 85,
          },
        },
        {
          id: 'item-2',
          title: 'Item 2',
          price: 200,
          url: 'https://example.com/2',
          marketplace: 'facebook',
          category: 'gaming',
          timestamp: '2025-10-01T13:00:00Z',
          is_undervalued: true,
          score: 90,
          estimated_resale: 300,
          profit_potential: 100,
          profit_margin: 50,
          reasoning: 'Great',
          scores_breakdown: {
            historical: 85,
            msrp: 95,
            scarcity: 90,
            ratio: 90,
          },
        },
      ];

      for (const item of items) {
        await actor.processNewPurchase(item);
      }

      const listings = await actor.relistItems();

      expect(listings).toHaveLength(2);
      expect(listings[0]).toBeDefined();
      expect(listings[0]!.id).toBe('resale_item-1');
      expect(listings[1]).toBeDefined();
      expect(listings[1]!.id).toBe('resale_item-2');
    });
  });

  describe('Complete Workflow', () => {
    it('should handle purchase -> relist workflow', async () => {
      // Purchase an item
      const evaluatedListing: EvaluatedListing = {
        id: 'workflow-1',
        title: 'Workflow Test Item',
        price: 100,
        url: 'https://example.com/workflow-1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T12:00:00Z',
        is_undervalued: true,
        score: 85,
        estimated_resale: 150,
        profit_potential: 50,
        profit_margin: 50,
        reasoning: 'Good deal',
        scores_breakdown: {
          historical: 80,
          msrp: 90,
          scarcity: 85,
          ratio: 85,
        },
      };

      const purchasedItem = await actor.processNewPurchase(evaluatedListing);
      expect(purchasedItem.status).toBe('purchased');

      // Verify in inventory
      let inventory = await actor.getInventory();
      expect(inventory).toHaveLength(1);
      expect(inventory[0]).toBeDefined();
      expect(inventory[0]!.status).toBe('purchased');

      // Relist the item
      const listings = await actor.relistItems();
      expect(listings).toHaveLength(1);
      expect(listings[0]).toBeDefined();
      expect(listings[0]!.price).toBe(150);

      // Verify status updated
      inventory = await actor.getInventory();
      expect(inventory[0]).toBeDefined();
      expect(inventory[0]!.status).toBe('listed');
      expect(inventory[0]!.resale_price).toBe(150);
    });
  });
});
