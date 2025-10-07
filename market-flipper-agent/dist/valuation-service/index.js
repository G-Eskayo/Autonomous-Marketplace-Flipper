globalThis.__RAINDROP_GIT_COMMIT_SHA = "unknown";

// src/valuation-service/index.ts
import { Service } from "./runtime.js";

// src/valuation-service/model.ts
var MIN_PROFIT_MARGIN = 0.2;
var MIN_PROFIT = 50;
var MOCK_HISTORICAL_DATA = {
  iphone: {
    avg: 650,
    min: 400,
    max: 1200,
    msrp: 999
  },
  macbook: {
    avg: 900,
    min: 600,
    max: 1500,
    msrp: 1299
  },
  ps5: {
    avg: 450,
    min: 350,
    max: 600,
    msrp: 499
  },
  laptop: {
    avg: 700,
    min: 400,
    max: 1200,
    msrp: 999
  },
  tv: {
    avg: 400,
    min: 200,
    max: 800,
    msrp: 599
  }
};
var DEFAULT_HISTORICAL_DATA = {
  avg: 500,
  min: 300,
  max: 800,
  msrp: 699
};
function normalizeProductKey(productKey) {
  return productKey.toLowerCase().trim().replace(/\s+/g, "-");
}
async function getHistoricalPrices(productKey, env) {
  const normalizedKey = normalizeProductKey(productKey);
  env.logger.info(`Fetching historical prices for product: ${normalizedKey}`);
  if (MOCK_HISTORICAL_DATA[normalizedKey]) {
    return MOCK_HISTORICAL_DATA[normalizedKey];
  }
  env.logger.warn(
    `No historical data found for product: ${normalizedKey}, using defaults`
  );
  return DEFAULT_HISTORICAL_DATA;
}

// src/valuation-service/controller.ts
var WEIGHT_HISTORICAL = 0.4;
var WEIGHT_MSRP = 0.25;
var WEIGHT_SCARCITY = 0.2;
var WEIGHT_RATIO = 0.15;
var SCARCITY_KEYWORDS = ["limited", "rare", "discontinued", "pro", "max", "ultra"];
function calculateHistoricalScore(current, historical) {
  const { min, max } = historical;
  if (min === max) {
    return 100;
  }
  if (current <= min) {
    return 100;
  }
  if (current >= max) {
    return 0;
  }
  const score = 100 * (1 - (current - min) / (max - min));
  return Math.max(0, Math.min(100, score));
}
function calculateMSRPScore(current, msrp) {
  if (msrp === 0) {
    return 0;
  }
  if (current >= msrp) {
    return 0;
  }
  const ratio = current / msrp;
  if (ratio <= 0.5) {
    return 100;
  }
  const score = 100 * (1 - (ratio - 0.5) / 0.5);
  return Math.max(0, Math.min(100, score));
}
function calculateScarcityScore(title, historical) {
  const titleLower = title.toLowerCase();
  const hasScarcityKeyword = SCARCITY_KEYWORDS.some(
    (keyword) => titleLower.includes(keyword)
  );
  return hasScarcityKeyword ? 100 : 50;
}
function calculatePriceRatioScore(current, avg) {
  if (avg === 0) {
    return 0;
  }
  if (current >= avg) {
    return 0;
  }
  const ratio = current / avg;
  if (ratio <= 0.7) {
    return 100;
  }
  const score = 100 * (1 - (ratio - 0.7) / 0.3);
  return Math.max(0, Math.min(100, score));
}
function extractProductKey(title) {
  const titleLower = title.toLowerCase();
  if (titleLower.includes("iphone")) return "iphone";
  if (titleLower.includes("macbook")) return "macbook";
  if (titleLower.includes("ps5")) return "ps5";
  if (titleLower.includes("laptop")) return "laptop";
  if (titleLower.includes("tv")) return "tv";
  const firstWord = title.split(" ")[0];
  return firstWord ? firstWord.toLowerCase() : "unknown";
}
async function evaluateSingleListing(listing, env) {
  const productKey = extractProductKey(listing.title);
  const historical = await getHistoricalPrices(productKey, env);
  const historicalScore = calculateHistoricalScore(listing.price, historical);
  const msrpScore = calculateMSRPScore(listing.price, historical.msrp);
  const scarcityScore = calculateScarcityScore(listing.title, historical);
  const ratioScore = calculatePriceRatioScore(listing.price, historical.avg);
  const totalScore = historicalScore * WEIGHT_HISTORICAL + msrpScore * WEIGHT_MSRP + scarcityScore * WEIGHT_SCARCITY + ratioScore * WEIGHT_RATIO;
  const estimatedResale = historical.avg;
  const profitPotential = estimatedResale - listing.price;
  const profitMargin = profitPotential / listing.price;
  const isUndervalued = totalScore >= 60 && profitMargin >= MIN_PROFIT_MARGIN && profitPotential >= MIN_PROFIT;
  const reasoning = isUndervalued ? `Item is undervalued with score ${totalScore.toFixed(1)}, margin ${(profitMargin * 100).toFixed(1)}%, profit $${profitPotential.toFixed(2)}` : `Item is not undervalued (score: ${totalScore.toFixed(1)}, margin: ${(profitMargin * 100).toFixed(1)}%, profit: $${profitPotential.toFixed(2)})`;
  const scoresBreakdown = {
    historical: historicalScore,
    msrp: msrpScore,
    scarcity: scarcityScore,
    ratio: ratioScore
  };
  return {
    ...listing,
    is_undervalued: isUndervalued,
    score: totalScore,
    estimated_resale: estimatedResale,
    profit_potential: profitPotential,
    profit_margin: profitMargin,
    reasoning,
    scores_breakdown: scoresBreakdown
  };
}
async function evaluateListings(listings, env) {
  env.logger.info(`Evaluating ${listings.length} listings`);
  if (listings.length === 0) {
    return [];
  }
  const evaluated = await Promise.all(
    listings.map((listing) => evaluateSingleListing(listing, env))
  );
  evaluated.sort((a, b) => b.score - a.score);
  env.logger.info(
    `Evaluation complete: ${evaluated.filter((e) => e.is_undervalued).length} undervalued items found`
  );
  return evaluated;
}

// src/valuation-service/index.ts
var valuation_service_default = class extends Service {
  /**
   * fetch() stub - required for all services
   */
  async fetch(request) {
    return new Response("valuation-service: This is a private service. Use service-to-service calls.", {
      status: 501,
      statusText: "Not Implemented"
    });
  }
  /**
   * Main service method: Evaluate listings
   * Called by other services via: env.VALUATION_SERVICE.evaluateListings(listings)
   */
  async evaluateListings(listings) {
    this.env.logger.info("ValuationService: evaluateListings called", { count: listings.length });
    const evaluated = await evaluateListings(listings, this.env);
    return { evaluated };
  }
};
export {
  valuation_service_default as default
};
