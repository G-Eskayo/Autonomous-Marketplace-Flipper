import { expect, test, describe, vi, beforeEach } from 'vitest';
import { orchestrateScan, getAgentStatus } from './controller';
import type {
  ScrapeConfig,
  Listing,
  EvaluatedListing,
  Decision,
  AgentStats
} from '../types/shared';

describe('controller.ts - Orchestration Layer', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      SCRAPER_SERVICE: {
        scrapeMarketplaces: vi.fn(),
      },
      VALUATION_SERVICE: {
        evaluateListings: vi.fn(),
      },
      DECISION_ACTOR: {
        idFromName: vi.fn((name) => `actor-id-${name}`),
        get: vi.fn(() => ({
          makeDecisions: vi.fn(),
        })),
      },
      INVENTORY_ACTOR: {
        idFromName: vi.fn((name) => `actor-id-${name}`),
        get: vi.fn(() => ({
          getInventory: vi.fn(),
        })),
      },
      TRANSACTION_ACTOR: {
        idFromName: vi.fn((name) => `actor-id-${name}`),
        get: vi.fn(() => ({
          getTransactions: vi.fn(),
        })),
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    };
  });

  describe('orchestrateScan', () => {
    test('should orchestrate full scan cycle and return all results', async () => {
      const config: ScrapeConfig = {
        maxPerMarketplace: 10,
        category: 'electronics',
      };

      const mockListings: Listing[] = [
        {
          id: 'listing-1',
          title: 'iPhone 13',
          price: 400,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T10:00:00Z',
        },
      ];

      const mockEvaluated: EvaluatedListing[] = [
        {
          id: 'listing-1',
          title: 'iPhone 13',
          price: 400,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T10:00:00Z',
          is_undervalued: true,
          score: 85,
          estimated_resale: 600,
          profit_potential: 200,
          profit_margin: 0.5,
          reasoning: 'Good deal',
          scores_breakdown: {
            historical: 80,
            msrp: 90,
            scarcity: 85,
            ratio: 85,
          },
        },
      ];

      const mockDecisions: Decision[] = [
        {
          action: 'BUY',
          item_id: 'listing-1',
          title: 'iPhone 13',
          price: 400,
          score: 85,
          profit_potential: 200,
          reasoning: 'Strong profit margin',
          timestamp: '2025-10-01T10:05:00Z',
        },
      ];

      mockEnv.SCRAPER_SERVICE.scrapeMarketplaces.mockResolvedValue({
        success: true,
        listings: mockListings,
      });

      mockEnv.VALUATION_SERVICE.evaluateListings.mockResolvedValue({
        success: true,
        evaluated: mockEvaluated,
      });

      const mockDecisionActor = {
        makeDecisions: vi.fn().mockResolvedValue({
          success: true,
          decisions: mockDecisions,
        }),
      };
      mockEnv.DECISION_ACTOR.get.mockReturnValue(mockDecisionActor);

      const result = await orchestrateScan(config, mockEnv);

      expect(mockEnv.SCRAPER_SERVICE.scrapeMarketplaces).toHaveBeenCalledWith(config);
      expect(mockEnv.VALUATION_SERVICE.evaluateListings).toHaveBeenCalledWith(mockListings);
      expect(mockDecisionActor.makeDecisions).toHaveBeenCalledWith(mockEvaluated, 5000);

      expect(result).toEqual({
        listings: mockListings,
        evaluated: mockEvaluated,
        decisions: mockDecisions,
      });
    });

    test('should handle scraper service errors gracefully', async () => {
      const config: ScrapeConfig = {
        maxPerMarketplace: 10,
        category: 'electronics',
      };

      mockEnv.SCRAPER_SERVICE.scrapeMarketplaces.mockRejectedValue(
        new Error('Scraper failed')
      );

      await expect(orchestrateScan(config, mockEnv)).rejects.toThrow('Scraper failed');
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    test('should handle valuation service errors gracefully', async () => {
      const config: ScrapeConfig = {
        maxPerMarketplace: 10,
        category: 'electronics',
      };

      const mockListings: Listing[] = [
        {
          id: 'listing-1',
          title: 'iPhone 13',
          price: 400,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T10:00:00Z',
        },
      ];

      mockEnv.SCRAPER_SERVICE.scrapeMarketplaces.mockResolvedValue({
        success: true,
        listings: mockListings,
      });

      mockEnv.VALUATION_SERVICE.evaluateListings.mockRejectedValue(
        new Error('Valuation failed')
      );

      await expect(orchestrateScan(config, mockEnv)).rejects.toThrow('Valuation failed');
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    test('should handle decision actor errors gracefully', async () => {
      const config: ScrapeConfig = {
        maxPerMarketplace: 10,
        category: 'electronics',
      };

      const mockListings: Listing[] = [
        {
          id: 'listing-1',
          title: 'iPhone 13',
          price: 400,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T10:00:00Z',
        },
      ];

      const mockEvaluated: EvaluatedListing[] = [
        {
          id: 'listing-1',
          title: 'iPhone 13',
          price: 400,
          url: 'https://example.com/1',
          marketplace: 'ebay',
          category: 'electronics',
          timestamp: '2025-10-01T10:00:00Z',
          is_undervalued: true,
          score: 85,
          estimated_resale: 600,
          profit_potential: 200,
          profit_margin: 0.5,
          reasoning: 'Good deal',
          scores_breakdown: {
            historical: 80,
            msrp: 90,
            scarcity: 85,
            ratio: 85,
          },
        },
      ];

      mockEnv.SCRAPER_SERVICE.scrapeMarketplaces.mockResolvedValue({
        success: true,
        listings: mockListings,
      });

      mockEnv.VALUATION_SERVICE.evaluateListings.mockResolvedValue({
        success: true,
        evaluated: mockEvaluated,
      });

      const mockDecisionActor = {
        makeDecisions: vi.fn().mockRejectedValue(new Error('Decision failed')),
      };
      mockEnv.DECISION_ACTOR.get.mockReturnValue(mockDecisionActor);

      await expect(orchestrateScan(config, mockEnv)).rejects.toThrow('Decision failed');
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    test('should handle empty listings array', async () => {
      const config: ScrapeConfig = {
        maxPerMarketplace: 10,
        category: 'electronics',
      };

      mockEnv.SCRAPER_SERVICE.scrapeMarketplaces.mockResolvedValue({
        success: true,
        listings: [],
      });

      const result = await orchestrateScan(config, mockEnv);

      expect(result).toEqual({
        listings: [],
        evaluated: [],
        decisions: [],
      });

      expect(mockEnv.VALUATION_SERVICE.evaluateListings).not.toHaveBeenCalled();
    });
  });

  describe('getAgentStatus', () => {
    test('should aggregate stats from all actors', async () => {
      const mockInventory = [
        { id: '1', status: 'purchased', price: 100, estimated_resale: 150 },
        { id: '2', status: 'purchased', price: 200, estimated_resale: 300 },
        { id: '3', status: 'listed', price: 150, estimated_resale: 200 },
      ];

      const mockTransactions = [
        { type: 'purchase', amount: 100 },
        { type: 'purchase', amount: 200 },
      ];

      const mockInventoryActor = {
        getInventory: vi.fn().mockResolvedValue(mockInventory),
      };

      const mockTransactionActor = {
        getTransactions: vi.fn().mockResolvedValue(mockTransactions),
      };

      mockEnv.INVENTORY_ACTOR.get.mockReturnValue(mockInventoryActor);
      mockEnv.TRANSACTION_ACTOR.get.mockReturnValue(mockTransactionActor);

      const result = await getAgentStatus(mockEnv);

      expect(mockInventoryActor.getInventory).toHaveBeenCalled();
      expect(mockTransactionActor.getTransactions).toHaveBeenCalled();

      expect(result).toEqual({
        listings_scanned: 0,
        items_purchased: 2,
        items_listed: 1,
        total_invested: 300,
        potential_revenue: 650,
        expected_profit: 350,
        expected_roi: expect.any(Number),
      });
    });

    test('should handle actor errors gracefully', async () => {
      const mockInventoryActor = {
        getInventory: vi.fn().mockRejectedValue(new Error('Inventory actor failed')),
      };

      mockEnv.INVENTORY_ACTOR.get.mockReturnValue(mockInventoryActor);

      await expect(getAgentStatus(mockEnv)).rejects.toThrow('Inventory actor failed');
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    test('should handle missing stats gracefully', async () => {
      const mockInventoryActor = {
        getInventory: vi.fn().mockResolvedValue([]),
      };

      const mockTransactionActor = {
        getTransactions: vi.fn().mockResolvedValue([]),
      };

      mockEnv.INVENTORY_ACTOR.get.mockReturnValue(mockInventoryActor);
      mockEnv.TRANSACTION_ACTOR.get.mockReturnValue(mockTransactionActor);

      const result = await getAgentStatus(mockEnv);

      expect(result).toEqual({
        listings_scanned: 0,
        items_purchased: 0,
        items_listed: 0,
        total_invested: 0,
        potential_revenue: 0,
        expected_profit: 0,
        expected_roi: 0,
      });
    });
  });
});
