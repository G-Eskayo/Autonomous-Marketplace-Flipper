/**
 * INDEX for valuation-service (Private Service)
 *
 * This is a private service that provides listing valuation functionality.
 * It is called internally by other components (e.g., api-router) via service-to-service calls.
 */

import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import type { Listing, EvaluatedListing } from '../types/shared';
import { evaluateListings as evaluateListingsController } from './controller';

/**
 * ValuationService - Private service for listing evaluation
 * Called via env.VALUATION_SERVICE.evaluateListings(listings)
 */
export default class extends Service<Env> {
  /**
   * fetch() stub - required for all services
   */
  async fetch(request: Request): Promise<Response> {
    return new Response('valuation-service: This is a private service. Use service-to-service calls.', {
      status: 501,
      statusText: 'Not Implemented',
    });
  }

  /**
   * Main service method: Evaluate listings
   * Called by other services via: env.VALUATION_SERVICE.evaluateListings(listings)
   */
  async evaluateListings(listings: Listing[]): Promise<{ evaluated: EvaluatedListing[] }> {
    this.env.logger.info('ValuationService: evaluateListings called', { count: listings.length });
    const evaluated = await evaluateListingsController(listings, this.env);
    return { evaluated };
  }
}
