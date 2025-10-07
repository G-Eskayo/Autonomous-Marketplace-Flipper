import { describe, it, expect, vi } from 'vitest';
import ValuationService from './index';

describe('index.ts - ValuationService', () => {
  it('should have fetch() method that returns "not implemented" message', async () => {
    const mockEnv = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    } as any;

    const service = new ValuationService(null as any, mockEnv);
    const response = await service.fetch(new Request('http://localhost'));
    const text = await response.text();
    expect(text).toContain('private service');
    expect(response.status).toBe(501);
  });

  it('should have evaluateListings service method', async () => {
    const mockEnv = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
      HISTORICAL_PRICES: {
        query: vi.fn(async () => []),
      },
    } as any;

    const service = new ValuationService(null as any, mockEnv);
    expect(typeof service.evaluateListings).toBe('function');

    // Test that it can be called
    const result = await service.evaluateListings([]);
    expect(result).toHaveProperty('evaluated');
    expect(Array.isArray(result.evaluated)).toBe(true);
  });
});
