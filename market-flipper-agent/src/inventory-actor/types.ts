/**
 * Shared TypeScript interfaces for the Inventory Actor
 */

export interface Listing {
  id: string;
  title: string;
  price: number;
  url: string;
  marketplace: 'ebay' | 'craigslist' | 'facebook';
  category: string;
  timestamp: string;
}

export interface ScoresBreakdown {
  historical: number;
  msrp: number;
  scarcity: number;
  ratio: number;
}

export interface EvaluatedListing extends Listing {
  is_undervalued: boolean;
  score: number;
  estimated_resale: number;
  profit_potential: number;
  profit_margin: number;
  reasoning: string;
  scores_breakdown: ScoresBreakdown;
}

export interface InventoryItem extends EvaluatedListing {
  purchase_date: string;
  status: 'purchased' | 'listed' | 'sold';
  resale_price?: number;
  listed_date?: string;
}

export interface InventoryState {
  inventory: Map<string, InventoryItem>;
  listedIds: Set<string>;
}
