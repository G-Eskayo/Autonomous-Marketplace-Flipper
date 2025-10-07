/**
 * Inventory Model - State & Data Operations
 * Handles inventory state management and SmartBucket persistence
 */

import { InventoryItem, InventoryState } from './types.js';
import { Env } from './raindrop.gen.js';

/**
 * Add item to inventory state and persist to SmartBucket
 */
export async function addToInventory(
  item: InventoryItem,
  state: InventoryState,
  env: Env
): Promise<void> {
  // Add to state
  state.inventory.set(item.id, item);

  // Persist to SmartBucket
  await env.FLIPPER_INVENTORY.put(item.id, JSON.stringify(item));

  // Log operation
  env.logger.info('Added item to inventory', {
    itemId: item.id,
    title: item.title,
    status: item.status,
  });
}

/**
 * Retrieve all items from inventory state
 */
export async function getInventory(
  state: InventoryState,
  env: Env
): Promise<InventoryItem[]> {
  return Array.from(state.inventory.values());
}

/**
 * Update item status and persist changes
 */
export async function updateItemStatus(
  id: string,
  status: string,
  state: InventoryState,
  env: Env
): Promise<void> {
  const item = state.inventory.get(id);

  if (!item) {
    throw new Error('Item not found in inventory');
  }

  // Update status
  item.status = status as 'purchased' | 'listed' | 'sold';

  // Add listed_date if status is 'listed'
  if (status === 'listed') {
    item.listed_date = new Date().toISOString();
    state.listedIds.add(id);
  }

  // Update in state
  state.inventory.set(id, item);

  // Persist to SmartBucket
  await env.FLIPPER_INVENTORY.put(id, JSON.stringify(item));

  // Log operation
  env.logger.info('Updated item status', {
    itemId: id,
    newStatus: status,
  });
}

/**
 * Remove item from inventory state
 */
export function removeFromInventory(
  id: string,
  state: InventoryState
): void {
  state.inventory.delete(id);
  state.listedIds.delete(id);
}
