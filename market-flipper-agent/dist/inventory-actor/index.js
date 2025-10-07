globalThis.__RAINDROP_GIT_COMMIT_SHA = "unknown";

// src/inventory-actor/index.ts
import { Actor } from "./runtime.js";

// src/inventory-actor/model.ts
async function addToInventory(item, state, env) {
  state.inventory.set(item.id, item);
  await env.FLIPPER_INVENTORY.put(item.id, JSON.stringify(item));
  env.logger.info("Added item to inventory", {
    itemId: item.id,
    title: item.title,
    status: item.status
  });
}
async function getInventory(state, env) {
  return Array.from(state.inventory.values());
}
async function updateItemStatus(id, status, state, env) {
  const item = state.inventory.get(id);
  if (!item) {
    throw new Error("Item not found in inventory");
  }
  item.status = status;
  if (status === "listed") {
    item.listed_date = (/* @__PURE__ */ new Date()).toISOString();
    state.listedIds.add(id);
  }
  state.inventory.set(id, item);
  await env.FLIPPER_INVENTORY.put(id, JSON.stringify(item));
  env.logger.info("Updated item status", {
    itemId: id,
    newStatus: status
  });
}

// src/inventory-actor/controller.ts
async function processNewPurchase(item, state, env) {
  const inventoryItem = {
    ...item,
    purchase_date: (/* @__PURE__ */ new Date()).toISOString(),
    status: "purchased"
  };
  await addToInventory(inventoryItem, state, env);
  return inventoryItem;
}
function createReListing(item) {
  return {
    id: `resale_${item.id}`,
    title: item.title,
    price: item.estimated_resale,
    // Use estimated_resale as resale price
    url: item.url,
    marketplace: item.marketplace,
    category: item.category,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function relistItems(state, env) {
  const listings = [];
  const purchasedItems = Array.from(state.inventory.values()).filter(
    (item) => item.status === "purchased"
  );
  for (const item of purchasedItems) {
    const listing = createReListing(item);
    listings.push(listing);
    await updateItemStatus(item.id, "listed", state, env);
    const updatedItem = state.inventory.get(item.id);
    if (updatedItem) {
      updatedItem.resale_price = item.estimated_resale;
      state.inventory.set(item.id, updatedItem);
      await env.FLIPPER_INVENTORY.put(item.id, JSON.stringify(updatedItem));
    }
  }
  env.logger.info("Created re-listings for purchased items", {
    count: listings.length
  });
  return listings;
}

// src/inventory-actor/index.ts
var InventoryActor = class extends Actor {
  inventoryState;
  constructor(state, env) {
    super(state, env);
    this.inventoryState = {
      inventory: /* @__PURE__ */ new Map(),
      listedIds: /* @__PURE__ */ new Set()
    };
  }
  /**
   * Process a new purchase and add to inventory
   */
  async processNewPurchase(item) {
    return await processNewPurchase(item, this.inventoryState, this.env);
  }
  /**
   * Get all items in inventory
   */
  async getInventory() {
    return await getInventory(this.inventoryState, this.env);
  }
  /**
   * Create re-listings for all purchased items
   */
  async relistItems() {
    return await relistItems(this.inventoryState, this.env);
  }
};
export {
  InventoryActor
};
