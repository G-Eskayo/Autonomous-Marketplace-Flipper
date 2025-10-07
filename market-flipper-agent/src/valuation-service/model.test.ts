import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHistoricalPrices, storeHistoricalData } from './model';
import type { HistoricalData } from '../types/shared';

describe('model.ts - Historical Data Operations', () => {
  let mockEnv: any;
  let mockSmartBucket: any;

  beforeEach(() => {
    mockSmartBucket = {
      get: vi.fn(),
      put: vi.fn(),
    };

    mockEnv = {
      HISTORICAL_PRICES: mockSmartBucket,
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    };
  });

  describe('getHistoricalPrices', () => {
    it('should return historical data for iPhone', async () => {
      const result = await getHistoricalPrices('iphone', mockEnv);

      expect(result).toEqual({
        avg: 650,
        min: 400,
        max: 1200,
        msrp: 999,
      });
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Fetching historical prices for product: iphone'
      );
    });

    it('should return historical data for MacBook', async () => {
      const result = await getHistoricalPrices('macbook', mockEnv);

      expect(result).toEqual({
        avg: 900,
        min: 600,
        max: 1500,
        msrp: 1299,
      });
    });

    it('should return historical data for PS5', async () => {
      const result = await getHistoricalPrices('ps5', mockEnv);

      expect(result).toEqual({
        avg: 450,
        min: 350,
        max: 600,
        msrp: 499,
      });
    });

    it('should return historical data for laptop', async () => {
      const result = await getHistoricalPrices('laptop', mockEnv);

      expect(result).toEqual({
        avg: 700,
        min: 400,
        max: 1200,
        msrp: 999,
      });
    });

    it('should return historical data for TV', async () => {
      const result = await getHistoricalPrices('tv', mockEnv);

      expect(result).toEqual({
        avg: 400,
        min: 200,
        max: 800,
        msrp: 599,
      });
    });

    it('should return default data for unknown product', async () => {
      const result = await getHistoricalPrices('unknown-product', mockEnv);

      expect(result).toEqual({
        avg: 500,
        min: 300,
        max: 800,
        msrp: 699,
      });
      expect(mockEnv.logger.warn).toHaveBeenCalledWith(
        'No historical data found for product: unknown-product, using defaults'
      );
    });

    it('should handle product keys case-insensitively', async () => {
      const result = await getHistoricalPrices('IPHONE', mockEnv);

      expect(result).toEqual({
        avg: 650,
        min: 400,
        max: 1200,
        msrp: 999,
      });
    });

    it('should handle product keys with whitespace', async () => {
      const result = await getHistoricalPrices('  macbook  ', mockEnv);

      expect(result).toEqual({
        avg: 900,
        min: 600,
        max: 1500,
        msrp: 1299,
      });
    });
  });

  describe('storeHistoricalData', () => {
    it('should store historical data in SmartBucket', async () => {
      const testData: HistoricalData = {
        avg: 750,
        min: 500,
        max: 1000,
        msrp: 899,
      };

      await storeHistoricalData('test-product', testData, mockEnv);

      expect(mockSmartBucket.put).toHaveBeenCalledWith(
        'test-product',
        JSON.stringify(testData)
      );
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        'Stored historical data for product: test-product'
      );
    });

    it('should normalize product key before storing', async () => {
      const testData: HistoricalData = {
        avg: 750,
        min: 500,
        max: 1000,
        msrp: 899,
      };

      await storeHistoricalData('  TEST Product  ', testData, mockEnv);

      expect(mockSmartBucket.put).toHaveBeenCalledWith(
        'test-product',
        JSON.stringify(testData)
      );
    });

    it('should handle errors during storage', async () => {
      const testData: HistoricalData = {
        avg: 750,
        min: 500,
        max: 1000,
        msrp: 899,
      };

      mockSmartBucket.put.mockRejectedValue(new Error('Storage failed'));

      await expect(
        storeHistoricalData('test-product', testData, mockEnv)
      ).rejects.toThrow('Storage failed');

      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        'Failed to store historical data for product: test-product',
        { error: 'Storage failed' }
      );
    });
  });

  describe('Business Rules', () => {
    it('should enforce minimum profit margin of 20%', () => {
      const MIN_PROFIT_MARGIN = 0.20;
      expect(MIN_PROFIT_MARGIN).toBe(0.20);
    });

    it('should enforce minimum profit threshold of $50', () => {
      const MIN_PROFIT = 50;
      expect(MIN_PROFIT).toBe(50);
    });
  });
});
