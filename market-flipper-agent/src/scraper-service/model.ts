/**
 * MODEL for scraper-service (Private Service)
 *
 * PRD REQUIREMENTS:
 * - SmartBucket operations for listing storage/retrieval
 * - Listing validation and normalization
 * - Data persistence layer
 *
 * MUST IMPLEMENT:
 * 1. Store scraped listings in SmartBucket 'flipper-listings'
 * 2. Retrieve specific listing by ID
 * 3. Query listings with filters
 * 4. Validate and normalize listing data
 *
 * INTERFACES TO EXPORT:
 * - storeListings(listings: Listing[], env: Env): Promise<void>
 * - getListingById(id: string, env: Env): Promise<Listing | null>
 * - queryListings(filters: ListingFilter, env: Env): Promise<Listing[]>
 *
 * IMPORTS NEEDED:
 * - From shared types: Listing, ListingFilter
 * - From env: env.FLIPPER_LISTINGS (SmartBucket)
 *
 * BUSINESS RULES:
 * - Validate price > 0
 * - Validate required fields (id, title, price, marketplace)
 * - Normalize marketplace names to lowercase
 *
 * ERROR HANDLING:
 * - ValidationError for invalid listing data
 * - StorageError for SmartBucket failures
 */

import type { Listing, ListingFilter } from '../types/shared';

interface Env {
  FLIPPER_LISTINGS: any;
  logger: any;
}

export async function storeListings(listings: Listing[], env: Env): Promise<void> {
  for (const listing of listings) {
    validateListing(listing);
    const normalized = normalizeListing(listing);

    await env.FLIPPER_LISTINGS.put(listing.id, JSON.stringify(normalized));
    env.logger.debug('Stored listing', { listingId: listing.id });
  }
}

export async function getListingById(id: string, env: Env): Promise<Listing | null> {
  try {
    const data = await env.FLIPPER_LISTINGS.get(id);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as Listing;
  } catch (error) {
    env.logger.error('Failed to retrieve listing', { id, error });
    return null;
  }
}

export async function queryListings(filters: ListingFilter, env: Env): Promise<Listing[]> {
  // SmartBuckets provide semantic search - for now, return empty array
  // In production, would use SmartBucket query capabilities
  env.logger.debug('Query listings', { filters });
  return [];
}

function validateListing(listing: Listing): void {
  if (!listing.id || !listing.title || listing.price === undefined || listing.price === null || !listing.marketplace) {
    throw new Error('Invalid listing: missing required fields');
  }

  if (listing.price <= 0) {
    throw new Error('Invalid listing: price must be greater than 0');
  }

  const validMarketplaces = ['ebay', 'craigslist', 'facebook'];
  if (!validMarketplaces.includes(listing.marketplace)) {
    throw new Error(`Invalid marketplace: ${listing.marketplace}`);
  }
}

function normalizeListing(listing: Listing): Listing {
  return {
    ...listing,
    marketplace: listing.marketplace.toLowerCase() as 'ebay' | 'craigslist' | 'facebook',
    title: listing.title.trim(),
  };
}
