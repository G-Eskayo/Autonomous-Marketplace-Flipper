import { expect, test, describe, vi, beforeEach } from 'vitest';
import ApiRouter from './index';
import type {
  ScrapeConfig,
  AgentConfig,
  Listing,
  EvaluatedListing,
  Decision,
  AgentStats,
  InventoryItem,
  Transaction,
} from '../types/shared';

describe('index.ts - Hono Router & Endpoints', () => {
  let service: ApiRouter;
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
          updateConfig: vi.fn(),
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

    service = new ApiRouter(null as any, mockEnv);
  });

  describe('POST /scan', () => {
    test('should trigger marketplace scan and return results', async () => {
      const requestBody = {
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
        updateConfig: vi.fn(),
      };
      mockEnv.DECISION_ACTOR.get.mockReturnValue(mockDecisionActor);

      const request = new Request('http://localhost/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        data: { listings: Listing[]; evaluated: EvaluatedListing[]; decisions: Decision[] };
        timestamp: string;
      };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.listings).toHaveLength(1);
      expect(data.data.evaluated).toHaveLength(1);
      expect(data.data.decisions).toHaveLength(1);
      expect(data.timestamp).toBeDefined();
    });

    test('should validate request body', async () => {
      const request = new Request('http://localhost/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });

    test('should handle scan errors gracefully', async () => {
      mockEnv.SCRAPER_SERVICE.scrapeMarketplaces.mockRejectedValue(
        new Error('Scraper failed')
      );

      const request = new Request('http://localhost/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxPerMarketplace: 10,
          category: 'electronics',
        }),
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        error?: string;
        timestamp: string;
      };

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /status', () => {
    test('should return agent status', async () => {
      const mockInventory = [
        { id: '1', status: 'purchased', price: 100, estimated_resale: 150 },
        { id: '2', status: 'purchased', price: 200, estimated_resale: 300 },
        { id: '3', status: 'listed', price: 150, estimated_resale: 200 },
        { id: '4', status: 'purchased', price: 150, estimated_resale: 250 },
        { id: '5', status: 'purchased', price: 200, estimated_resale: 350 },
        { id: '6', status: 'purchased', price: 350, estimated_resale: 450 },
      ];

      const mockTransactions = [
        { type: 'purchase', amount: 100 },
        { type: 'purchase', amount: 200 },
        { type: 'purchase', amount: 150 },
        { type: 'purchase', amount: 200 },
        { type: 'purchase', amount: 350 },
      ];

      const mockInventoryActor = {
        getInventory: vi.fn().mockResolvedValue(mockInventory),
      };

      const mockTransactionActor = {
        getTransactions: vi.fn().mockResolvedValue(mockTransactions),
      };

      mockEnv.INVENTORY_ACTOR.get.mockReturnValue(mockInventoryActor);
      mockEnv.TRANSACTION_ACTOR.get.mockReturnValue(mockTransactionActor);

      const request = new Request('http://localhost/status', {
        method: 'GET',
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        data: AgentStats;
        timestamp: string;
      };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items_purchased).toBe(5);
      expect(data.data.items_listed).toBe(1);
      expect(data.data.total_invested).toBe(1000);
    });

    test('should handle status errors gracefully', async () => {
      const mockInventoryActor = {
        getInventory: vi.fn().mockRejectedValue(new Error('Stats failed')),
      };

      mockEnv.INVENTORY_ACTOR.get.mockReturnValue(mockInventoryActor);

      const request = new Request('http://localhost/status', {
        method: 'GET',
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        error?: string;
        timestamp: string;
      };

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /inventory', () => {
    test('should return inventory items', async () => {
      const mockInventory: InventoryItem[] = [
        {
          id: 'item-1',
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
          purchase_date: '2025-10-01T11:00:00Z',
          status: 'purchased',
        },
      ];

      const mockInventoryActor = {
        getInventory: vi.fn().mockResolvedValue(mockInventory),
      };

      mockEnv.INVENTORY_ACTOR.get.mockReturnValue(mockInventoryActor);

      const request = new Request('http://localhost/inventory', {
        method: 'GET',
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        data: InventoryItem[];
        timestamp: string;
      };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0]?.id).toBe('item-1');
    });

    test('should handle inventory errors gracefully', async () => {
      const mockInventoryActor = {
        getInventory: vi.fn().mockRejectedValue(new Error('Inventory failed')),
        getStats: vi.fn(),
      };

      mockEnv.INVENTORY_ACTOR.get.mockReturnValue(mockInventoryActor);

      const request = new Request('http://localhost/inventory', {
        method: 'GET',
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        error?: string;
        timestamp: string;
      };

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /transactions', () => {
    test('should return transaction history', async () => {
      const mockTransactions: Transaction[] = [
        {
          type: 'purchase',
          item_id: 'item-1',
          amount: 400,
          timestamp: '2025-10-01T11:00:00Z',
        },
      ];

      const mockTransactionActor = {
        getTransactions: vi.fn().mockResolvedValue(mockTransactions),
      };

      mockEnv.TRANSACTION_ACTOR.get.mockReturnValue(mockTransactionActor);

      const request = new Request('http://localhost/transactions', {
        method: 'GET',
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        data: Transaction[];
        timestamp: string;
      };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0]?.type).toBe('purchase');
    });

    test('should handle transaction errors gracefully', async () => {
      const mockTransactionActor = {
        getTransactions: vi.fn().mockRejectedValue(new Error('Transaction failed')),
      };

      mockEnv.TRANSACTION_ACTOR.get.mockReturnValue(mockTransactionActor);

      const request = new Request('http://localhost/transactions', {
        method: 'GET',
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        error?: string;
        timestamp: string;
      };

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /config', () => {
    test('should update agent config', async () => {
      const configUpdate: AgentConfig = {
        budget: 5000,
        minProfitMargin: 0.3,
        minProfit: 50,
        maxPerMarketplace: 20,
        category: 'electronics',
      };

      const mockDecisionActor = {
        updateConfig: vi.fn().mockResolvedValue({
          success: true,
        }),
        makeDecisions: vi.fn(),
      };

      mockEnv.DECISION_ACTOR.get.mockReturnValue(mockDecisionActor);

      const request = new Request('http://localhost/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configUpdate),
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        data: { message: string };
        timestamp: string;
      };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDecisionActor.updateConfig).toHaveBeenCalledWith(configUpdate);
    });

    test('should validate config update request', async () => {
      const request = new Request('http://localhost/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'config' }),
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });

    test('should handle config update errors', async () => {
      const mockDecisionActor = {
        updateConfig: vi.fn().mockRejectedValue(new Error('Config update failed')),
        makeDecisions: vi.fn(),
      };

      mockEnv.DECISION_ACTOR.get.mockReturnValue(mockDecisionActor);

      const request = new Request('http://localhost/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: 5000,
          minProfitMargin: 0.3,
          minProfit: 50,
          maxPerMarketplace: 20,
          category: 'electronics',
        }),
      });

      const response = await service.fetch(request);
      const data = await response.json() as {
        success: boolean;
        error?: string;
        timestamp: string;
      };

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('CORS', () => {
    test('should include CORS headers on all responses', async () => {
      const request = new Request('http://localhost/status', {
        method: 'GET',
      });

      const mockInventoryActor = {
        getStats: vi.fn().mockResolvedValue({
          items_purchased: 0,
          items_listed: 0,
        }),
        getInventory: vi.fn(),
      };

      const mockTransactionActor = {
        getStats: vi.fn().mockResolvedValue({
          total_invested: 0,
          potential_revenue: 0,
          expected_profit: 0,
          expected_roi: 0,
        }),
        getTransactions: vi.fn(),
      };

      mockEnv.INVENTORY_ACTOR.get.mockReturnValue(mockInventoryActor);
      mockEnv.TRANSACTION_ACTOR.get.mockReturnValue(mockTransactionActor);

      const response = await service.fetch(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });

    test('should handle OPTIONS preflight requests', async () => {
      const request = new Request('http://localhost/scan', {
        method: 'OPTIONS',
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });
  });

  describe('404 Not Found', () => {
    test('should return 404 for unknown routes', async () => {
      const request = new Request('http://localhost/unknown-route', {
        method: 'GET',
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(404);
    });
  });
});
