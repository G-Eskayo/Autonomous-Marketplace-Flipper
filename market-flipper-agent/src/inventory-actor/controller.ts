/**
 * Inventory Controller - Workflow Orchestration
 * Handles re-listing logic and business workflows
 */

import { EvaluatedListing, InventoryItem, InventoryState, Listing } from './types.js';
import { Env } from './raindrop.gen.js';
import { addToInventory, updateItemStatus } from './model.js';

/**
 * Process a new purchase and add to inventory
 */
export async function processNewPurchase(
  item: EvaluatedListing,
  state: InventoryState,
  env: Env
): Promise<InventoryItem> {
  // Convert EvaluatedListing to InventoryItem
  const inventoryItem: InventoryItem = {
    ...item,
    purchase_date: new Date().toISOString(),
    status: 'purchased',
  };

  // Add to inventory
  await addToInventory(inventoryItem, state, env);

  return inventoryItem;
}

/**
 * Create a re-listing for a purchased item
 */
export function createReListing(item: InventoryItem): Listing {
  return {
    id: `resale_${item.id}`,
    title: item.title,
    price: item.estimated_resale, // Use estimated_resale as resale price
    url: item.url,
    marketplace: item.marketplace,
    category: item.category,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create re-listings for all purchased items in inventory
 */
export async function relistItems(
  state: InventoryState,
  env: Env
): Promise<Listing[]> {
  const listings: Listing[] = [];

  // Get all purchased items (not yet listed)
  const purchasedItems = Array.from(state.inventory.values()).filter(
    (item) => item.status === 'purchased'
  );

  // Create re-listings
  for (const item of purchasedItems) {
    const listing = createReListing(item);
    listings.push(listing);

    // Update item status to 'listed'
    await updateItemStatus(item.id, 'listed', state, env);

    // Set resale_price
    const updatedItem = state.inventory.get(item.id);
    if (updatedItem) {
      updatedItem.resale_price = item.estimated_resale;
      state.inventory.set(item.id, updatedItem);
      await env.FLIPPER_INVENTORY.put(item.id, JSON.stringify(updatedItem));
    }
  }

  // Log operation
  env.logger.info('Created re-listings for purchased items', {
    count: listings.length,
  });

  return listings;
}
