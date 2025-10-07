/**
 * Shared TypeScript interfaces for the Autonomous Flipper Agent
 * These types are used across all components (services, actors)
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

export interface HistoricalData {
  avg: number;
  min: number;
  max: number;
  msrp: number;
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

export interface Decision {
  action: 'BUY' | 'SKIP';
  item_id: string;
  title: string;
  price: number;
  score: number;
  profit_potential: number;
  reasoning: string;
  timestamp: string;
}

export interface Transaction {
  type: 'purchase' | 'sale';
  item_id: string;
  amount: number;
  timestamp: string;
}

export interface InventoryItem extends EvaluatedListing {
  purchase_date: string;
  status: 'purchased' | 'listed' | 'sold';
  resale_price?: number;
  listed_date?: string;
}

export interface AgentStats {
  listings_scanned: number;
  items_purchased: number;
  items_listed: number;
  total_invested: number;
  potential_revenue: number;
  expected_profit: number;
  expected_roi: number;
}

export interface AgentConfig {
  budget: number;
  minProfitMargin: number;
  minProfit: number;
  maxPerMarketplace: number;
  category: string;
}

export interface ScrapeConfig {
  maxPerMarketplace: number;
  category: string;
}

export interface FinancialStats {
  total_invested: number;
  potential_revenue: number;
  expected_profit: number;
  expected_roi: number;
  transaction_count: number;
}

export interface ListingFilter {
  marketplace?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}
