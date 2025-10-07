/**
 * controller.ts - Heuristic Evaluation Algorithms
 * Contains scoring logic for evaluating listings
 */

import type { Listing, EvaluatedListing, HistoricalData, ScoresBreakdown } from '../types/shared';
import type { Env } from './raindrop.gen';
import { getHistoricalPrices, MIN_PROFIT_MARGIN, MIN_PROFIT } from './model';

// Scoring weights
const WEIGHT_HISTORICAL = 0.40;
const WEIGHT_MSRP = 0.25;
const WEIGHT_SCARCITY = 0.20;
const WEIGHT_RATIO = 0.15;

// Scarcity keywords
const SCARCITY_KEYWORDS = ['limited', 'rare', 'discontinued', 'pro', 'max', 'ultra'];

/**
 * Calculate historical score based on current price vs historical range
 * Score: 100 at min price, 0 at max price
 * @param current - Current listing price
 * @param historical - Historical price data
 * @returns Score 0-100
 */
export function calculateHistoricalScore(current: number, historical: HistoricalData): number {
  const { min, max } = historical;

  // Handle edge case where min equals max
  if (min === max) {
    return 100;
  }

  // Price below minimum gets max score
  if (current <= min) {
    return 100;
  }

  // Price above maximum gets min score
  if (current >= max) {
    return 0;
  }

  // Linear interpolation: 100 at min, 0 at max
  const score = 100 * (1 - (current - min) / (max - min));
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate MSRP score based on current price vs MSRP
 * Score: 100 when price is 50% or less of MSRP, 0 when price equals MSRP
 * @param current - Current listing price
 * @param msrp - Manufacturer's Suggested Retail Price
 * @returns Score 0-100
 */
export function calculateMSRPScore(current: number, msrp: number): number {
  // Handle edge case
  if (msrp === 0) {
    return 0;
  }

  // Price above MSRP gets 0
  if (current >= msrp) {
    return 0;
  }

  // Calculate ratio
  const ratio = current / msrp;

  // 50% or less of MSRP = 100 score
  if (ratio <= 0.5) {
    return 100;
  }

  // Linear interpolation from 50% to 100%
  // At 50% (0.5): score = 100
  // At 100% (1.0): score = 0
  const score = 100 * (1 - (ratio - 0.5) / 0.5);
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate scarcity score based on keywords in title
 * Score: 100 if scarcity keywords found, 50 otherwise
 * Keywords: limited, rare, discontinued, pro, max, ultra
 * @param title - Listing title
 * @param historical - Historical data (for future use)
 * @returns Score 0-100
 */
export function calculateScarcityScore(title: string, historical: HistoricalData): number {
  const titleLower = title.toLowerCase();

  // Check for scarcity keywords
  const hasScarcityKeyword = SCARCITY_KEYWORDS.some((keyword) =>
    titleLower.includes(keyword)
  );

  return hasScarcityKeyword ? 100 : 50;
}

/**
 * Calculate price ratio score based on current vs average price
 * Score: 100 when price is 70% or less of average, 0 when price equals average
 * @param current - Current listing price
 * @param avg - Average historical price
 * @returns Score 0-100
 */
export function calculatePriceRatioScore(current: number, avg: number): number {
  // Handle edge case
  if (avg === 0) {
    return 0;
  }

  // Price above average gets 0
  if (current >= avg) {
    return 0;
  }

  // Calculate ratio
  const ratio = current / avg;

  // 70% or less of average = 100 score
  if (ratio <= 0.7) {
    return 100;
  }

  // Linear interpolation from 70% to 100%
  // At 70% (0.7): score = 100
  // At 100% (1.0): score = 0
  const score = 100 * (1 - (ratio - 0.7) / 0.3);
  return Math.max(0, Math.min(100, score));
}

/**
 * Extract product key from listing title
 * Looks for known product keywords
 */
function extractProductKey(title: string): string {
  const titleLower = title.toLowerCase();

  // Check for known products in order of specificity
  if (titleLower.includes('iphone')) return 'iphone';
  if (titleLower.includes('macbook')) return 'macbook';
  if (titleLower.includes('ps5')) return 'ps5';
  if (titleLower.includes('laptop')) return 'laptop';
  if (titleLower.includes('tv')) return 'tv';

  // Default to first word
  const firstWord = title.split(' ')[0];
  return firstWord ? firstWord.toLowerCase() : 'unknown';
}

/**
 * Evaluate a single listing
 */
async function evaluateSingleListing(
  listing: Listing,
  env: Env
): Promise<EvaluatedListing> {
  // Extract product key and get historical data
  const productKey = extractProductKey(listing.title);
  const historical = await getHistoricalPrices(productKey, env);

  // Calculate individual scores
  const historicalScore = calculateHistoricalScore(listing.price, historical);
  const msrpScore = calculateMSRPScore(listing.price, historical.msrp);
  const scarcityScore = calculateScarcityScore(listing.title, historical);
  const ratioScore = calculatePriceRatioScore(listing.price, historical.avg);

  // Calculate weighted total score
  const totalScore =
    historicalScore * WEIGHT_HISTORICAL +
    msrpScore * WEIGHT_MSRP +
    scarcityScore * WEIGHT_SCARCITY +
    ratioScore * WEIGHT_RATIO;

  // Calculate profit metrics (using conservative approach: resale = historical avg)
  const estimatedResale = historical.avg;
  const profitPotential = estimatedResale - listing.price;
  const profitMargin = profitPotential / listing.price;

  // Determine if undervalued
  const isUndervalued =
    totalScore >= 60 &&
    profitMargin >= MIN_PROFIT_MARGIN &&
    profitPotential >= MIN_PROFIT;

  // Generate reasoning
  const reasoning = isUndervalued
    ? `Item is undervalued with score ${totalScore.toFixed(1)}, margin ${(profitMargin * 100).toFixed(1)}%, profit $${profitPotential.toFixed(2)}`
    : `Item is not undervalued (score: ${totalScore.toFixed(1)}, margin: ${(profitMargin * 100).toFixed(1)}%, profit: $${profitPotential.toFixed(2)})`;

  const scoresBreakdown: ScoresBreakdown = {
    historical: historicalScore,
    msrp: msrpScore,
    scarcity: scarcityScore,
    ratio: ratioScore,
  };

  return {
    ...listing,
    is_undervalued: isUndervalued,
    score: totalScore,
    estimated_resale: estimatedResale,
    profit_potential: profitPotential,
    profit_margin: profitMargin,
    reasoning,
    scores_breakdown: scoresBreakdown,
  };
}

/**
 * Evaluate multiple listings in batch and sort by score descending
 * @param listings - Array of listings to evaluate
 * @param env - Environment with dependencies
 * @returns Array of evaluated listings sorted by score (highest first)
 */
export async function evaluateListings(
  listings: Listing[],
  env: Env
): Promise<EvaluatedListing[]> {
  env.logger.info(`Evaluating ${listings.length} listings`);

  // Handle empty array
  if (listings.length === 0) {
    return [];
  }

  // Evaluate all listings
  const evaluated = await Promise.all(
    listings.map((listing) => evaluateSingleListing(listing, env))
  );

  // Sort by score descending
  evaluated.sort((a, b) => b.score - a.score);

  env.logger.info(
    `Evaluation complete: ${evaluated.filter((e) => e.is_undervalued).length} undervalued items found`
  );

  return evaluated;
}
