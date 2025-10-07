import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addToInventory, getInventory, updateItemStatus, removeFromInventory } from './model.js';
import { InventoryItem, InventoryState } from './types.js';
import { Env } from './raindrop.gen.js';

describe('Inventory Model - State & Data Operations', () => {
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

  describe('addToInventory', () => {
    it('should add an item to inventory state', async () => {
      const item: InventoryItem = {
        id: 'item-1',
        title: 'Test Item',
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
        reasoning: 'Good deal',
        scores_breakdown: { historical: 80, msrp: 90, scarcity: 85, ratio: 85 },
        purchase_date: '2025-10-01T12:00:00Z',
        status: 'purchased',
      };

      await addToInventory(item, state, mockEnv);

      expect(state.inventory.has('item-1')).toBe(true);
      expect(state.inventory.get('item-1')).toEqual(item);
    });

    it('should persist item to SmartBucket FLIPPER_INVENTORY', async () => {
      const item: InventoryItem = {
        id: 'item-2',
        title: 'Test Item 2',
        price: 200,
        url: 'https://example.com/item-2',
        marketplace: 'facebook',
        category: 'furniture',
        timestamp: '2025-10-01T13:00:00Z',
        is_undervalued: true,
        score: 90,
        estimated_resale: 300,
        profit_potential: 100,
        profit_margin: 50,
        reasoning: 'Great deal',
        scores_breakdown: { historical: 85, msrp: 95, scarcity: 90, ratio: 90 },
        purchase_date: '2025-10-01T13:00:00Z',
        status: 'purchased',
      };

      await addToInventory(item, state, mockEnv);

      expect(mockEnv.FLIPPER_INVENTORY.put).toHaveBeenCalledWith(
        'item-2',
        JSON.stringify(item)
      );
    });

    it('should log inventory addition', async () => {
      const item: InventoryItem = {
        id: 'item-3',
        title: 'Test Item 3',
        price: 50,
        url: 'https://example.com/item-3',
        marketplace: 'craigslist',
        category: 'tools',
        timestamp: '2025-10-01T14:00:00Z',
        is_undervalued: true,
        score: 75,
        estimated_resale: 80,
        profit_potential: 30,
        profit_margin: 60,
        reasoning: 'Decent deal',
        scores_breakdown: { historical: 70, msrp: 80, scarcity: 75, ratio: 75 },
        purchase_date: '2025-10-01T14:00:00Z',
        status: 'purchased',
      };

      await addToInventory(item, state, mockEnv);

      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Added item to inventory'),
        expect.objectContaining({ itemId: 'item-3' })
      );
    });
  });

  describe('getInventory', () => {
    it('should return all items from inventory state', async () => {
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
        scores_breakdown: { historical: 80, msrp: 90, scarcity: 85, ratio: 85 },
        purchase_date: '2025-10-01T12:00:00Z',
        status: 'purchased',
      };

      const item2: InventoryItem = {
        id: 'item-2',
        title: 'Item 2',
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
        reasoning: 'Great',
        scores_breakdown: { historical: 85, msrp: 95, scarcity: 90, ratio: 90 },
        purchase_date: '2025-10-01T13:00:00Z',
        status: 'listed',
      };

      state.inventory.set('item-1', item1);
      state.inventory.set('item-2', item2);

      const result = await getInventory(state, mockEnv);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(item1);
      expect(result).toContainEqual(item2);
    });

    it('should return empty array when inventory is empty', async () => {
      const result = await getInventory(state, mockEnv);

      expect(result).toEqual([]);
    });
  });

  describe('updateItemStatus', () => {
    it('should update item status to "listed"', async () => {
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
        scores_breakdown: { historical: 80, msrp: 90, scarcity: 85, ratio: 85 },
        purchase_date: '2025-10-01T12:00:00Z',
        status: 'purchased',
      };

      state.inventory.set('item-1', item);

      await updateItemStatus('item-1', 'listed', state, mockEnv);

      const updatedItem = state.inventory.get('item-1');
      expect(updatedItem?.status).toBe('listed');
      expect(state.listedIds.has('item-1')).toBe(true);
    });

    it('should add listed_date when status changes to "listed"', async () => {
      const item: InventoryItem = {
        id: 'item-2',
        title: 'Test Item 2',
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
        reasoning: 'Great',
        scores_breakdown: { historical: 85, msrp: 95, scarcity: 90, ratio: 90 },
        purchase_date: '2025-10-01T13:00:00Z',
        status: 'purchased',
      };

      state.inventory.set('item-2', item);

      await updateItemStatus('item-2', 'listed', state, mockEnv);

      const updatedItem = state.inventory.get('item-2');
      expect(updatedItem?.listed_date).toBeDefined();
    });

    it('should persist updated item to SmartBucket', async () => {
      const item: InventoryItem = {
        id: 'item-3',
        title: 'Test Item 3',
        price: 50,
        url: 'https://example.com/3',
        marketplace: 'craigslist',
        category: 'tools',
        timestamp: '2025-10-01T14:00:00Z',
        is_undervalued: true,
        score: 75,
        estimated_resale: 80,
        profit_potential: 30,
        profit_margin: 60,
        reasoning: 'Decent',
        scores_breakdown: { historical: 70, msrp: 80, scarcity: 75, ratio: 75 },
        purchase_date: '2025-10-01T14:00:00Z',
        status: 'purchased',
      };

      state.inventory.set('item-3', item);

      await updateItemStatus('item-3', 'sold', state, mockEnv);

      expect(mockEnv.FLIPPER_INVENTORY.put).toHaveBeenCalledWith(
        'item-3',
        expect.stringContaining('"status":"sold"')
      );
    });

    it('should throw error if item does not exist', async () => {
      await expect(
        updateItemStatus('nonexistent', 'listed', state, mockEnv)
      ).rejects.toThrow('Item not found in inventory');
    });
  });

  describe('removeFromInventory', () => {
    it('should remove item from inventory state', () => {
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
        scores_breakdown: { historical: 80, msrp: 90, scarcity: 85, ratio: 85 },
        purchase_date: '2025-10-01T12:00:00Z',
        status: 'sold',
      };

      state.inventory.set('item-1', item);
      state.listedIds.add('item-1');

      removeFromInventory('item-1', state);

      expect(state.inventory.has('item-1')).toBe(false);
      expect(state.listedIds.has('item-1')).toBe(false);
    });

    it('should handle removal of non-existent item gracefully', () => {
      expect(() => removeFromInventory('nonexistent', state)).not.toThrow();
    });
  });
});
