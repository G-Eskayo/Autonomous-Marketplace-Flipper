/**
 * Tests for scraper-service model.ts
 * Following TDD: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Listing, ListingFilter } from '../types/shared';
import {
  storeListings,
  getListingById,
  queryListings,
} from './model';

// Mock environment
const createMockEnv = () => {
  const storage = new Map<string, string>();

  return {
    FLIPPER_LISTINGS: {
      put: vi.fn(async (key: string, value: string) => {
        storage.set(key, value);
      }),
      get: vi.fn(async (key: string) => {
        return storage.get(key) || null;
      }),
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
};

const createValidListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 'test-123',
  title: 'Test Product',
  price: 100,
  url: 'https://example.com/item',
  marketplace: 'ebay',
  category: 'electronics',
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('model.ts - storeListings', () => {
  it('should store valid listings in SmartBucket', async () => {
    const env = createMockEnv();
    const listings = [
      createValidListing({ id: 'item-1', title: 'Product 1' }),
      createValidListing({ id: 'item-2', title: 'Product 2' }),
    ];

    await storeListings(listings, env);

    expect(env.FLIPPER_LISTINGS.put).toHaveBeenCalledTimes(2);
    expect(env.logger.debug).toHaveBeenCalledTimes(2);
  });

  it('should normalize marketplace to lowercase', async () => {
    const env = createMockEnv();
    const listing = createValidListing({ marketplace: 'ebay' });

    await storeListings([listing], env);

    const putCall = env.FLIPPER_LISTINGS.put.mock.calls[0];
    expect(putCall).toBeDefined();
    const storedData = JSON.parse(putCall![1]);
    expect(storedData.marketplace).toBe('ebay');
  });

  it('should trim whitespace from title', async () => {
    const env = createMockEnv();
    const listing = createValidListing({ title: '  Product Name  ' });

    await storeListings([listing], env);

    const putCall = env.FLIPPER_LISTINGS.put.mock.calls[0];
    expect(putCall).toBeDefined();
    const storedData = JSON.parse(putCall![1]);
    expect(storedData.title).toBe('Product Name');
  });

  it('should throw error for missing required fields', async () => {
    const env = createMockEnv();
    const invalidListing = { title: 'Missing ID' } as Listing;

    await expect(storeListings([invalidListing], env)).rejects.toThrow(
      'Invalid listing: missing required fields'
    );
  });

  it('should throw error for price <= 0', async () => {
    const env = createMockEnv();
    const invalidListing = createValidListing({ price: 0 });

    await expect(storeListings([invalidListing], env)).rejects.toThrow(
      'Invalid listing: price must be greater than 0'
    );
  });

  it('should throw error for negative price', async () => {
    const env = createMockEnv();
    const invalidListing = createValidListing({ price: -50 });

    await expect(storeListings([invalidListing], env)).rejects.toThrow(
      'Invalid listing: price must be greater than 0'
    );
  });

  it('should throw error for invalid marketplace', async () => {
    const env = createMockEnv();
    const invalidListing = createValidListing({ marketplace: 'amazon' as any });

    await expect(storeListings([invalidListing], env)).rejects.toThrow(
      'Invalid marketplace'
    );
  });
});

describe('model.ts - getListingById', () => {
  it('should retrieve stored listing by ID', async () => {
    const env = createMockEnv();
    const listing = createValidListing({ id: 'item-123' });

    await storeListings([listing], env);
    const retrieved = await getListingById('item-123', env);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('item-123');
    expect(retrieved?.title).toBe('Test Product');
  });

  it('should return null for non-existent listing', async () => {
    const env = createMockEnv();
    const retrieved = await getListingById('non-existent', env);

    expect(retrieved).toBeNull();
  });

  it('should handle malformed data gracefully', async () => {
    const env = createMockEnv();
    // Directly insert malformed data
    env.FLIPPER_LISTINGS.get = vi.fn(async () => 'invalid-json{');

    const retrieved = await getListingById('bad-id', env);

    expect(retrieved).toBeNull();
    expect(env.logger.error).toHaveBeenCalled();
  });
});

describe('model.ts - queryListings', () => {
  it('should return empty array (placeholder implementation)', async () => {
    const env = createMockEnv();
    const filters: ListingFilter = { marketplace: 'ebay' };

    const results = await queryListings(filters, env);

    expect(results).toEqual([]);
    expect(env.logger.debug).toHaveBeenCalledWith('Query listings', { filters });
  });

  it('should handle category filter', async () => {
    const env = createMockEnv();
    const filters: ListingFilter = { category: 'electronics' };

    const results = await queryListings(filters, env);

    expect(results).toEqual([]);
  });

  it('should handle price range filters', async () => {
    const env = createMockEnv();
    const filters: ListingFilter = { minPrice: 50, maxPrice: 500 };

    const results = await queryListings(filters, env);

    expect(results).toEqual([]);
  });
});
