import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  evaluateListings,
  calculateHistoricalScore,
  calculateMSRPScore,
  calculateScarcityScore,
  calculatePriceRatioScore,
} from './controller';
import type { Listing, HistoricalData } from '../types/shared';

describe('controller.ts - Heuristic Evaluation Algorithms', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      HISTORICAL_PRICES: {
        get: vi.fn(),
        put: vi.fn(),
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    };
  });

  describe('calculateHistoricalScore', () => {
    it('should return 100 for price at minimum', () => {
      const historical: HistoricalData = { avg: 650, min: 400, max: 1200, msrp: 999 };
      const score = calculateHistoricalScore(400, historical);
      expect(score).toBe(100);
    });

    it('should return 0 for price at maximum', () => {
      const historical: HistoricalData = { avg: 650, min: 400, max: 1200, msrp: 999 };
      const score = calculateHistoricalScore(1200, historical);
      expect(score).toBe(0);
    });

    it('should return 50 for price at midpoint', () => {
      const historical: HistoricalData = { avg: 650, min: 400, max: 1200, msrp: 999 };
      const midpoint = (400 + 1200) / 2;
      const score = calculateHistoricalScore(midpoint, historical);
      expect(score).toBe(50);
    });

    it('should return 100 for price below minimum', () => {
      const historical: HistoricalData = { avg: 650, min: 400, max: 1200, msrp: 999 };
      const score = calculateHistoricalScore(300, historical);
      expect(score).toBe(100);
    });

    it('should return 0 for price above maximum', () => {
      const historical: HistoricalData = { avg: 650, min: 400, max: 1200, msrp: 999 };
      const score = calculateHistoricalScore(1500, historical);
      expect(score).toBe(0);
    });

    it('should handle edge case where min equals max', () => {
      const historical: HistoricalData = { avg: 500, min: 500, max: 500, msrp: 500 };
      const score = calculateHistoricalScore(500, historical);
      expect(score).toBe(100);
    });
  });

  describe('calculateMSRPScore', () => {
    it('should return 100 when current price is 50% or less of MSRP', () => {
      const score = calculateMSRPScore(250, 1000);
      expect(score).toBe(100);
    });

    it('should return 0 when current price equals MSRP', () => {
      const score = calculateMSRPScore(1000, 1000);
      expect(score).toBe(0);
    });

    it('should return 50 when current price is 75% of MSRP', () => {
      const score = calculateMSRPScore(750, 1000);
      expect(score).toBe(50);
    });

    it('should return 0 when current price exceeds MSRP', () => {
      const score = calculateMSRPScore(1200, 1000);
      expect(score).toBe(0);
    });

    it('should return 100 when current price is 40% of MSRP', () => {
      const score = calculateMSRPScore(400, 1000);
      expect(score).toBe(100);
    });

    it('should handle edge case where MSRP is 0', () => {
      const score = calculateMSRPScore(500, 0);
      expect(score).toBe(0);
    });
  });

  describe('calculateScarcityScore', () => {
    const mockHistorical: HistoricalData = { avg: 650, min: 400, max: 1200, msrp: 999 };

    it('should return 100 for "limited edition" keyword', () => {
      const score = calculateScarcityScore('iPhone 15 Pro Limited Edition', mockHistorical);
      expect(score).toBe(100);
    });

    it('should return 100 for "rare" keyword', () => {
      const score = calculateScarcityScore('Rare MacBook Pro 2023', mockHistorical);
      expect(score).toBe(100);
    });

    it('should return 100 for "discontinued" keyword', () => {
      const score = calculateScarcityScore('Discontinued PS5 Model', mockHistorical);
      expect(score).toBe(100);
    });

    it('should return 100 for "pro" keyword', () => {
      const score = calculateScarcityScore('MacBook Pro 16-inch', mockHistorical);
      expect(score).toBe(100);
    });

    it('should return 100 for "max" keyword', () => {
      const score = calculateScarcityScore('iPhone 15 Pro Max', mockHistorical);
      expect(score).toBe(100);
    });

    it('should return 100 for "ultra" keyword', () => {
      const score = calculateScarcityScore('Samsung Galaxy Ultra', mockHistorical);
      expect(score).toBe(100);
    });

    it('should return 50 for no scarcity keywords', () => {
      const score = calculateScarcityScore('Regular Laptop', mockHistorical);
      expect(score).toBe(50);
    });

    it('should be case-insensitive for keywords', () => {
      const score = calculateScarcityScore('RARE DISCONTINUED ITEM', mockHistorical);
      expect(score).toBe(100);
    });

    it('should handle multiple keywords (should still return 100)', () => {
      const score = calculateScarcityScore('Limited Edition Pro Max', mockHistorical);
      expect(score).toBe(100);
    });
  });

  describe('calculatePriceRatioScore', () => {
    it('should return 100 when current is 70% or less of average', () => {
      const score = calculatePriceRatioScore(350, 500);
      expect(score).toBe(100);
    });

    it('should return 0 when current equals average', () => {
      const score = calculatePriceRatioScore(500, 500);
      expect(score).toBe(0);
    });

    it('should return 50 when current is 85% of average', () => {
      const score = calculatePriceRatioScore(425, 500);
      expect(score).toBeCloseTo(50, 1);
    });

    it('should return 0 when current exceeds average', () => {
      const score = calculatePriceRatioScore(600, 500);
      expect(score).toBe(0);
    });

    it('should return 100 when current is 60% of average', () => {
      const score = calculatePriceRatioScore(300, 500);
      expect(score).toBe(100);
    });

    it('should handle edge case where average is 0', () => {
      const score = calculatePriceRatioScore(500, 0);
      expect(score).toBe(0);
    });
  });

  describe('evaluateListings', () => {
    it('should evaluate a single undervalued listing correctly', async () => {
      const listings: Listing[] = [
        {
          id: '1',
          title: 'iPhone 15 Pro',
          price: 400,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results).toHaveLength(1);
      expect(results[0]).toBeDefined();
      expect(results[0]!.is_undervalued).toBe(true);
      expect(results[0]!.score).toBeGreaterThanOrEqual(60);
      expect(results[0]!.estimated_resale).toBe(650); // historical.avg for iPhone
      expect(results[0]!.profit_potential).toBe(250); // 650 - 400
      expect(results[0]!.profit_margin).toBeCloseTo(0.625); // 250 / 400
      expect(results[0]!.scores_breakdown).toBeDefined();
      expect(results[0]!.reasoning).toContain('undervalued');
    });

    it('should evaluate a listing as not undervalued if score < 60', async () => {
      const listings: Listing[] = [
        {
          id: '2',
          title: 'iPhone 15',
          price: 1100, // Above max price
          url: 'https://example.com/2',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results).toHaveLength(1);
      expect(results[0]).toBeDefined();
      expect(results[0]!.is_undervalued).toBe(false);
      expect(results[0]!.score).toBeLessThan(60);
      expect(results[0]!.reasoning).toContain('not undervalued');
    });

    it('should evaluate listing as not undervalued if profit margin < 20%', async () => {
      const listings: Listing[] = [
        {
          id: '3',
          title: 'iPhone 15',
          price: 640, // Close to avg, low margin
          url: 'https://example.com/3',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results[0]).toBeDefined();
      expect(results[0]!.profit_margin).toBeLessThan(0.20);
      expect(results[0]!.is_undervalued).toBe(false);
    });

    it('should evaluate listing as not undervalued if profit < $50', async () => {
      const listings: Listing[] = [
        {
          id: '4',
          title: 'Laptop',
          price: 680, // Profit would be $20
          url: 'https://example.com/4',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results[0]).toBeDefined();
      expect(results[0]!.profit_potential).toBeLessThan(50);
      expect(results[0]!.is_undervalued).toBe(false);
    });

    it('should calculate weighted total score correctly (40/25/20/15)', async () => {
      const listings: Listing[] = [
        {
          id: '5',
          title: 'MacBook Pro Limited Edition',
          price: 600,
          url: 'https://example.com/5',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results[0]).toBeDefined();
      const breakdown = results[0]!.scores_breakdown;
      const expectedScore =
        breakdown.historical * 0.4 +
        breakdown.msrp * 0.25 +
        breakdown.scarcity * 0.2 +
        breakdown.ratio * 0.15;

      expect(results[0]!.score).toBeCloseTo(expectedScore, 1);
    });

    it('should sort results by score in descending order', async () => {
      const listings: Listing[] = [
        {
          id: '1',
          title: 'iPhone 15',
          price: 1000, // Low score
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
        {
          id: '2',
          title: 'iPhone 15 Pro',
          price: 400, // High score
          url: 'https://example.com/2',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
        {
          id: '3',
          title: 'iPhone 15',
          price: 700, // Medium score
          url: 'https://example.com/3',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results).toHaveLength(3);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[2]).toBeDefined();
      expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
      expect(results[1]!.score).toBeGreaterThanOrEqual(results[2]!.score);
    });

    it('should handle empty listings array', async () => {
      const results = await evaluateListings([], mockEnv);
      expect(results).toEqual([]);
    });

    it('should evaluate multiple listings in batch', async () => {
      const listings: Listing[] = [
        {
          id: '1',
          title: 'PS5 Console',
          price: 350,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'gaming',
          timestamp: '2025-10-01T00:00:00Z',
        },
        {
          id: '2',
          title: 'MacBook Pro',
          price: 600,
          url: 'https://example.com/2',
          marketplace: 'facebook',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results).toHaveLength(2);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[0]!).toHaveProperty('score');
      expect(results[1]!).toHaveProperty('score');
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Evaluating 2 listings'
      );
    });

    it('should extract product key from title for historical lookup', async () => {
      const listings: Listing[] = [
        {
          id: '1',
          title: 'Brand New iPhone 15 Pro Max Sealed',
          price: 400,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results[0]).toBeDefined();
      expect(results[0]!.estimated_resale).toBe(650); // Should use iPhone data
    });

    it('should provide reasoning for undervalued items', async () => {
      const listings: Listing[] = [
        {
          id: '1',
          title: 'iPhone 15 Pro',
          price: 400,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results[0]).toBeDefined();
      expect(results[0]!.reasoning).toContain('undervalued');
      expect(results[0]!.reasoning).toContain('score');
      expect(results[0]!.reasoning).toContain('margin');
    });

    it('should provide reasoning for not undervalued items', async () => {
      const listings: Listing[] = [
        {
          id: '1',
          title: 'iPhone 15',
          price: 1100,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T00:00:00Z',
        },
      ];

      const results = await evaluateListings(listings, mockEnv);

      expect(results[0]).toBeDefined();
      expect(results[0]!.reasoning).toContain('not undervalued');
    });
  });
});
