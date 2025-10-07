/**
 * INDEX for scraper-service (Private Service)
 *
 * This is a private service that provides marketplace scraping functionality.
 * It is called internally by other components (e.g., api-router) via service-to-service calls.
 */

import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import type { ScrapeConfig, Listing } from '../types/shared';
import { scrapeMarketplaces as scrapeMarketplacesController } from './controller';

/**
 * ScraperService - Private service for marketplace scraping
 * Called via env.SCRAPER_SERVICE.scrapeMarketplaces(config)
 */
export default class extends Service<Env> {
  /**
   * fetch() stub - required for all services
   */
  async fetch(request: Request): Promise<Response> {
    return new Response('scraper-service: This is a private service. Use service-to-service calls.', {
      status: 501,
      statusText: 'Not Implemented',
    });
  }

  /**
   * Main service method: Scrape marketplaces
   * Called by other services via: env.SCRAPER_SERVICE.scrapeMarketplaces(config)
   */
  async scrapeMarketplaces(config: ScrapeConfig): Promise<{ listings: Listing[] }> {
    this.env.logger.info('ScraperService: scrapeMarketplaces called', { config });
    const listings = await scrapeMarketplacesController(config, this.env);
    return { listings };
  }
}
