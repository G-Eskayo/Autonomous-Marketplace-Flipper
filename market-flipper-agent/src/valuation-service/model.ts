/**
 * model.ts - Data Layer for Historical Price Operations
 * Handles retrieval and storage of historical pricing data
 */

import type { HistoricalData } from '../types/shared';
import type { Env } from './raindrop.gen';

// Business Rules
export const MIN_PROFIT_MARGIN = 0.20; // 20%
export const MIN_PROFIT = 50; // $50

// Mock Historical Data Store
const MOCK_HISTORICAL_DATA: Record<string, HistoricalData> = {
  iphone: {
    avg: 650,
    min: 400,
    max: 1200,
    msrp: 999,
  },
  macbook: {
    avg: 900,
    min: 600,
    max: 1500,
    msrp: 1299,
  },
  ps5: {
    avg: 450,
    min: 350,
    max: 600,
    msrp: 499,
  },
  laptop: {
    avg: 700,
    min: 400,
    max: 1200,
    msrp: 999,
  },
  tv: {
    avg: 400,
    min: 200,
    max: 800,
    msrp: 599,
  },
};

// Default data for unknown products
const DEFAULT_HISTORICAL_DATA: HistoricalData = {
  avg: 500,
  min: 300,
  max: 800,
  msrp: 699,
};

/**
 * Normalize product key to lowercase and trim whitespace
 */
function normalizeProductKey(productKey: string): string {
  return productKey.toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * Get historical prices for a product from SmartBucket
 * @param productKey - The product identifier
 * @param env - Environment with HISTORICAL_PRICES SmartBucket
 * @returns Historical price data
 */
export async function getHistoricalPrices(
  productKey: string,
  env: Env
): Promise<HistoricalData> {
  const normalizedKey = normalizeProductKey(productKey);

  env.logger.info(`Fetching historical prices for product: ${normalizedKey}`);

  // Check if we have mock data for this product
  if (MOCK_HISTORICAL_DATA[normalizedKey]) {
    return MOCK_HISTORICAL_DATA[normalizedKey];
  }

  // Try to get from SmartBucket (for future implementation)
  // const stored = await env.HISTORICAL_PRICES.get(normalizedKey);
  // if (stored) {
  //   return JSON.parse(stored);
  // }

  // Return default data if not found
  env.logger.warn(
    `No historical data found for product: ${normalizedKey}, using defaults`
  );
  return DEFAULT_HISTORICAL_DATA;
}

/**
 * Store historical data in SmartBucket
 * @param productKey - The product identifier
 * @param data - Historical data to store
 * @param env - Environment with HISTORICAL_PRICES SmartBucket
 */
export async function storeHistoricalData(
  productKey: string,
  data: HistoricalData,
  env: Env
): Promise<void> {
  const normalizedKey = normalizeProductKey(productKey);

  try {
    await env.HISTORICAL_PRICES.put(normalizedKey, JSON.stringify(data));
    env.logger.info(`Stored historical data for product: ${normalizedKey}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    env.logger.error(
      `Failed to store historical data for product: ${normalizedKey}`,
      { error: errorMessage }
    );
    throw error;
  }
}
