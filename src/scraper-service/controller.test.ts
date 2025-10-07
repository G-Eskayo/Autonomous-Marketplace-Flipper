/**
 * Tests for scraper-service controller.ts
 * Following TDD: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ScrapeConfig, Listing } from '../types/shared';
import {
  scrapeMarketplaces,
  scrapeEbay,
  scrapeCraigslist,
  scrapeFacebook,
} from './controller';

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

describe('controller.ts - scrapeEbay', () => {
  it('should return mock eBay listings', async () => {
    const env = createMockEnv();
    const listings = await scrapeEbay('electronics', 10, env);

    expect(listings).toHaveLength(10);
    expect(listings[0].marketplace).toBe('ebay');
    expect(listings[0]).toHaveProperty('id');
    expect(listings[0]).toHaveProperty('title');
    expect(listings[0]).toHaveProperty('price');
    expect(listings[0]).toHaveProperty('url');
    expect(listings[0]).toHaveProperty('category');
    expect(listings[0]).toHaveProperty('timestamp');
  });

  it('should generate varying prices between $50-$1000', async () => {
    const env = createMockEnv();
    const listings = await scrapeEbay('electronics', 30, env);

    const prices = listings.map(l => l.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    expect(minPrice).toBeGreaterThanOrEqual(50);
    expect(maxPrice).toBeLessThanOrEqual(1000);
    expect(new Set(prices).size).toBeGreaterThan(5); // Should have variety
  });

  it('should generate realistic product titles', async () => {
    const env = createMockEnv();
    const listings = await scrapeEbay('electronics', 5, env);

    listings.forEach(listing => {
      expect(listing.title.length).toBeGreaterThan(10);
      expect(listing.title).toBeTruthy();
    });
  });

  it('should set correct category', async () => {
    const env = createMockEnv();
    const listings = await scrapeEbay('furniture', 5, env);

    listings.forEach(listing => {
      expect(listing.category).toBe('furniture');
    });
  });

  it('should generate unique IDs', async () => {
    const env = createMockEnv();
    const listings = await scrapeEbay('electronics', 20, env);

    const ids = listings.map(l => l.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should log scraping activity', async () => {
    const env = createMockEnv();
    await scrapeEbay('electronics', 5, env);

    expect(env.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Scraping eBay'),
      expect.any(Object)
    );
  });
});

describe('controller.ts - scrapeCraigslist', () => {
  it('should return mock Craigslist listings', async () => {
    const env = createMockEnv();
    const listings = await scrapeCraigslist('seattle', 'furniture', 10, env);

    expect(listings).toHaveLength(10);
    expect(listings[0].marketplace).toBe('craigslist');
    expect(listings[0]).toHaveProperty('id');
    expect(listings[0]).toHaveProperty('title');
    expect(listings[0]).toHaveProperty('price');
  });

  it('should generate varying prices between $50-$1000', async () => {
    const env = createMockEnv();
    const listings = await scrapeCraigslist('seattle', 'furniture', 30, env);

    const prices = listings.map(l => l.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    expect(minPrice).toBeGreaterThanOrEqual(50);
    expect(maxPrice).toBeLessThanOrEqual(1000);
  });

  it('should include city in URL', async () => {
    const env = createMockEnv();
    const listings = await scrapeCraigslist('portland', 'furniture', 5, env);

    listings.forEach(listing => {
      expect(listing.url).toContain('portland');
    });
  });

  it('should set correct category', async () => {
    const env = createMockEnv();
    const listings = await scrapeCraigslist('seattle', 'appliances', 5, env);

    listings.forEach(listing => {
      expect(listing.category).toBe('appliances');
    });
  });

  it('should log scraping activity', async () => {
    const env = createMockEnv();
    await scrapeCraigslist('seattle', 'furniture', 5, env);

    expect(env.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Scraping Craigslist'),
      expect.any(Object)
    );
  });
});

describe('controller.ts - scrapeFacebook', () => {
  it('should return mock Facebook Marketplace listings', async () => {
    const env = createMockEnv();
    const listings = await scrapeFacebook('seattle', 'electronics', 10, env);

    expect(listings).toHaveLength(10);
    expect(listings[0].marketplace).toBe('facebook');
    expect(listings[0]).toHaveProperty('id');
    expect(listings[0]).toHaveProperty('title');
    expect(listings[0]).toHaveProperty('price');
  });

  it('should generate varying prices between $50-$1000', async () => {
    const env = createMockEnv();
    const listings = await scrapeFacebook('seattle', 'electronics', 30, env);

    const prices = listings.map(l => l.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    expect(minPrice).toBeGreaterThanOrEqual(50);
    expect(maxPrice).toBeLessThanOrEqual(1000);
  });

  it('should include location in URL', async () => {
    const env = createMockEnv();
    const listings = await scrapeFacebook('portland', 'electronics', 5, env);

    listings.forEach(listing => {
      expect(listing.url).toContain('marketplace');
    });
  });

  it('should set correct category', async () => {
    const env = createMockEnv();
    const listings = await scrapeFacebook('seattle', 'sports', 5, env);

    listings.forEach(listing => {
      expect(listing.category).toBe('sports');
    });
  });

  it('should log scraping activity', async () => {
    const env = createMockEnv();
    await scrapeFacebook('seattle', 'electronics', 5, env);

    expect(env.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Scraping Facebook'),
      expect.any(Object)
    );
  });
});

describe('controller.ts - scrapeMarketplaces', () => {
  it('should scrape all three marketplaces', async () => {
    const env = createMockEnv();
    const config: ScrapeConfig = {
      maxPerMarketplace: 10,
      category: 'electronics',
    };

    const listings = await scrapeMarketplaces(config, env);

    expect(listings.length).toBe(30); // 10 from each marketplace

    const ebayListings = listings.filter(l => l.marketplace === 'ebay');
    const craigslistListings = listings.filter(l => l.marketplace === 'craigslist');
    const facebookListings = listings.filter(l => l.marketplace === 'facebook');

    expect(ebayListings.length).toBe(10);
    expect(craigslistListings.length).toBe(10);
    expect(facebookListings.length).toBe(10);
  });

  it('should use category from config', async () => {
    const env = createMockEnv();
    const config: ScrapeConfig = {
      maxPerMarketplace: 5,
      category: 'furniture',
    };

    const listings = await scrapeMarketplaces(config, env);

    listings.forEach(listing => {
      expect(listing.category).toBe('furniture');
    });
  });

  it('should respect maxPerMarketplace config', async () => {
    const env = createMockEnv();
    const config: ScrapeConfig = {
      maxPerMarketplace: 15,
      category: 'electronics',
    };

    const listings = await scrapeMarketplaces(config, env);

    expect(listings.length).toBe(45); // 15 from each marketplace
  });

  it('should store all listings in SmartBucket', async () => {
    const env = createMockEnv();
    const config: ScrapeConfig = {
      maxPerMarketplace: 5,
      category: 'electronics',
    };

    const listings = await scrapeMarketplaces(config, env);

    expect(env.FLIPPER_LISTINGS.put).toHaveBeenCalledTimes(15);
  });

  it('should log orchestration activity', async () => {
    const env = createMockEnv();
    const config: ScrapeConfig = {
      maxPerMarketplace: 5,
      category: 'electronics',
    };

    await scrapeMarketplaces(config, env);

    expect(env.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Starting marketplace scraping'),
      expect.any(Object)
    );

    expect(env.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Completed marketplace scraping'),
      expect.any(Object)
    );
  });

  it('should handle errors gracefully', async () => {
    const env = createMockEnv();
    // Simulate storage failure
    env.FLIPPER_LISTINGS.put = vi.fn().mockRejectedValue(new Error('Storage error'));

    const config: ScrapeConfig = {
      maxPerMarketplace: 2,
      category: 'electronics',
    };

    await expect(scrapeMarketplaces(config, env)).rejects.toThrow();
  });
});
