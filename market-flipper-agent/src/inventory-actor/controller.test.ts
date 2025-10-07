import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processNewPurchase, createReListing, relistItems } from './controller.js';
import { EvaluatedListing, InventoryItem, InventoryState, Listing } from './types.js';
import { Env } from './raindrop.gen.js';

describe('Inventory Controller - Workflow Orchestration', () => {
  let mockEnv: Env;
  let state: InventoryState;

  beforeEach(() => {
    // Initialize fresh state
    state = {
      inventory: new Map<string, InventoryItem>(),
      listedIds: new Set<string>(),
    };

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
  });

  describe('processNewPurchase', () => {
    it('should convert EvaluatedListing to InventoryItem', async () => {
      const evaluatedListing: EvaluatedListing = {
        id: 'listing-1',
        title: 'Vintage Camera',
        price: 100,
        url: 'https://example.com/listing-1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T12:00:00Z',
        is_undervalued: true,
        score: 85,
        estimated_resale: 150,
        profit_potential: 50,
        profit_margin: 50,
        reasoning: 'Great deal on vintage camera',
        scores_breakdown: {
          historical: 80,
          msrp: 90,
          scarcity: 85,
          ratio: 85,
        },
      };

      const result = await processNewPurchase(evaluatedListing, state, mockEnv);

      expect(result.id).toBe('listing-1');
      expect(result.status).toBe('purchased');
      expect(result.purchase_date).toBeDefined();
      expect(result.title).toBe('Vintage Camera');
      expect(result.price).toBe(100);
    });

    it('should add item to inventory state', async () => {
      const evaluatedListing: EvaluatedListing = {
        id: 'listing-2',
        title: 'Retro Console',
        price: 200,
        url: 'https://example.com/listing-2',
        marketplace: 'facebook',
        category: 'gaming',
        timestamp: '2025-10-01T13:00:00Z',
        is_undervalued: true,
        score: 90,
        estimated_resale: 300,
        profit_potential: 100,
        profit_margin: 50,
        reasoning: 'High demand retro console',
        scores_breakdown: {
          historical: 85,
          msrp: 95,
          scarcity: 90,
          ratio: 90,
        },
      };

      await processNewPurchase(evaluatedListing, state, mockEnv);

      expect(state.inventory.has('listing-2')).toBe(true);
      expect(state.inventory.get('listing-2')?.status).toBe('purchased');
    });

    it('should persist item to SmartBucket', async () => {
      const evaluatedListing: EvaluatedListing = {
        id: 'listing-3',
        title: 'Antique Lamp',
        price: 50,
        url: 'https://example.com/listing-3',
        marketplace: 'craigslist',
        category: 'furniture',
        timestamp: '2025-10-01T14:00:00Z',
        is_undervalued: true,
        score: 75,
        estimated_resale: 80,
        profit_potential: 30,
        profit_margin: 60,
        reasoning: 'Unique antique piece',
        scores_breakdown: {
          historical: 70,
          msrp: 80,
          scarcity: 75,
          ratio: 75,
        },
      };

      await processNewPurchase(evaluatedListing, state, mockEnv);

      expect(mockEnv.FLIPPER_INVENTORY.put).toHaveBeenCalledWith(
        'listing-3',
        expect.stringContaining('"status":"purchased"')
      );
    });
  });

  describe('createReListing', () => {
    it('should generate resale listing with estimated_resale price', () => {
      const inventoryItem: InventoryItem = {
        id: 'item-1',
        title: 'Vintage Camera',
        price: 100,
        url: 'https://example.com/item-1',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T12:00:00Z',
        is_undervalued: true,
        score: 85,
        estimated_resale: 150,
        profit_potential: 50,
        profit_margin: 50,
        reasoning: 'Great deal',
        scores_breakdown: {
          historical: 80,
          msrp: 90,
          scarcity: 85,
          ratio: 85,
        },
        purchase_date: '2025-10-01T12:00:00Z',
        status: 'purchased',
      };

      const result = createReListing(inventoryItem);

      expect(result.price).toBe(150); // estimated_resale
      expect(result.id).toBe('resale_item-1');
      expect(result.title).toBe('Vintage Camera');
    });

    it('should include original marketplace and category', () => {
      const inventoryItem: InventoryItem = {
        id: 'item-2',
        title: 'Retro Console',
        price: 200,
        url: 'https://example.com/item-2',
        marketplace: 'facebook',
        category: 'gaming',
        timestamp: '2025-10-01T13:00:00Z',
        is_undervalued: true,
        score: 90,
        estimated_resale: 300,
        profit_potential: 100,
        profit_margin: 50,
        reasoning: 'High demand',
        scores_breakdown: {
          historical: 85,
          msrp: 95,
          scarcity: 90,
          ratio: 90,
        },
        purchase_date: '2025-10-01T13:00:00Z',
        status: 'purchased',
      };

      const result = createReListing(inventoryItem);

      expect(result.marketplace).toBe('facebook');
      expect(result.category).toBe('gaming');
    });

    it('should generate new listing ID with resale_ prefix', () => {
      const inventoryItem: InventoryItem = {
        id: 'item-3',
        title: 'Antique Lamp',
        price: 50,
        url: 'https://example.com/item-3',
        marketplace: 'craigslist',
        category: 'furniture',
        timestamp: '2025-10-01T14:00:00Z',
        is_undervalued: true,
        score: 75,
        estimated_resale: 80,
        profit_potential: 30,
        profit_margin: 60,
        reasoning: 'Unique piece',
        scores_breakdown: {
          historical: 70,
          msrp: 80,
          scarcity: 75,
          ratio: 75,
        },
        purchase_date: '2025-10-01T14:00:00Z',
        status: 'purchased',
      };

      const result = createReListing(inventoryItem);

      expect(result.id).toBe('resale_item-3');
    });

    it('should include timestamp in re-listing', () => {
      const inventoryItem: InventoryItem = {
        id: 'item-4',
        title: 'Test Item',
        price: 100,
        url: 'https://example.com/item-4',
        marketplace: 'ebay',
        category: 'electronics',
        timestamp: '2025-10-01T15:00:00Z',
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
        purchase_date: '2025-10-01T15:00:00Z',
        status: 'purchased',
      };

      const result = createReListing(inventoryItem);

      expect(result.timestamp).toBeDefined();
    });
  });

  describe('relistItems', () => {
    it('should create re-listings for all purchased items', async () => {
      const item1: InventoryItem = {
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
        purchase_date: '2025-10-01T12:00:00Z',
        status: 'purchased',
      };

      const item2: InventoryItem = {
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
        purchase_date: '2025-10-01T13:00:00Z',
        status: 'purchased',
      };

      state.inventory.set('item-1', item1);
      state.inventory.set('item-2', item2);

      const result = await relistItems(state, mockEnv);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeDefined();
      expect(result[0]!.id).toBe('resale_item-1');
      expect(result[1]).toBeDefined();
      expect(result[1]!.id).toBe('resale_item-2');
    });

    it('should mark items as "listed" after creating re-listings', async () => {
      const item: InventoryItem = {
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
        purchase_date: '2025-10-01T12:00:00Z',
        status: 'purchased',
      };

      state.inventory.set('item-1', item);

      await relistItems(state, mockEnv);

      const updatedItem = state.inventory.get('item-1');
      expect(updatedItem?.status).toBe('listed');
      expect(updatedItem?.resale_price).toBe(150);
      expect(state.listedIds.has('item-1')).toBe(true);
    });

    it('should skip already listed items', async () => {
      const item1: InventoryItem = {
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
        purchase_date: '2025-10-01T12:00:00Z',
        status: 'listed',
      };

      const item2: InventoryItem = {
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
        purchase_date: '2025-10-01T13:00:00Z',
        status: 'purchased',
      };

      state.inventory.set('item-1', item1);
      state.inventory.set('item-2', item2);

      const result = await relistItems(state, mockEnv);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
      expect(result[0]!.id).toBe('resale_item-2');
    });

    it('should return empty array when no items to relist', async () => {
      const result = await relistItems(state, mockEnv);

      expect(result).toEqual([]);
    });

    it('should log re-listing operation', async () => {
      const item: InventoryItem = {
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
        purchase_date: '2025-10-01T12:00:00Z',
        status: 'purchased',
      };

      state.inventory.set('item-1', item);

      await relistItems(state, mockEnv);

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created re-listings'),
        expect.objectContaining({ count: 1 })
      );
    });
  });
});
