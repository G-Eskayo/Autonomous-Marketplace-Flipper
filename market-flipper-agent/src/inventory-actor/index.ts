import { Actor, ActorState } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen.js';
import { InventoryState, EvaluatedListing, InventoryItem, Listing } from './types.js';
import { getInventory } from './model.js';
import { processNewPurchase, relistItems } from './controller.js';

export class InventoryActor extends Actor<Env> {
  private inventoryState: InventoryState;

  constructor(state: ActorState, env: Env) {
    super(state, env);

    // Initialize actor state with default values
    this.inventoryState = {
      inventory: new Map<string, InventoryItem>(),
      listedIds: new Set<string>(),
    };
  }

  /**
   * Process a new purchase and add to inventory
   */
  async processNewPurchase(item: EvaluatedListing): Promise<InventoryItem> {
    return await processNewPurchase(item, this.inventoryState, this.env);
  }

  /**
   * Get all items in inventory
   */
  async getInventory(): Promise<InventoryItem[]> {
    return await getInventory(this.inventoryState, this.env);
  }

  /**
   * Create re-listings for all purchased items
   */
  async relistItems(): Promise<Listing[]> {
    return await relistItems(this.inventoryState, this.env);
  }
}

// Export types for external use
export type { InventoryItem, EvaluatedListing, Listing, InventoryState } from './types.js';
