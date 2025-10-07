globalThis.__RAINDROP_GIT_COMMIT_SHA = "unknown";

// src/scraper-service/index.ts
import { Service } from "./runtime.js";

// src/scraper-service/model.ts
async function storeListings(listings, env) {
  for (const listing of listings) {
    validateListing(listing);
    const normalized = normalizeListing(listing);
    await env.FLIPPER_LISTINGS.put(listing.id, JSON.stringify(normalized));
    env.logger.debug("Stored listing", { listingId: listing.id });
  }
}
function validateListing(listing) {
  if (!listing.id || !listing.title || listing.price === void 0 || listing.price === null || !listing.marketplace) {
    throw new Error("Invalid listing: missing required fields");
  }
  if (listing.price <= 0) {
    throw new Error("Invalid listing: price must be greater than 0");
  }
  const validMarketplaces = ["ebay", "craigslist", "facebook"];
  if (!validMarketplaces.includes(listing.marketplace)) {
    throw new Error(`Invalid marketplace: ${listing.marketplace}`);
  }
}
function normalizeListing(listing) {
  return {
    ...listing,
    marketplace: listing.marketplace.toLowerCase(),
    title: listing.title.trim()
  };
}

// src/scraper-service/controller.ts
var PRODUCT_TEMPLATES = {
  electronics: [
    "iPhone 13 Pro Max",
    "Samsung Galaxy S21 Ultra",
    "Sony PlayStation 5",
    "Xbox Series X",
    "Apple AirPods Pro",
    "Dell XPS 13 Laptop",
    'iPad Pro 12.9"',
    "Canon EOS R6 Camera",
    "Bose QuietComfort Headphones",
    "Nintendo Switch OLED",
    "Apple Watch Series 8",
    "GoPro Hero 11",
    "DJI Mavic 3 Drone",
    "Kindle Paperwhite",
    "Ring Video Doorbell",
    "Nest Learning Thermostat",
    "Sony WH-1000XM5 Headphones",
    "MacBook Air M2",
    "Surface Pro 9",
    "Fitbit Charge 5"
  ],
  furniture: [
    "Mid-Century Modern Sofa",
    "Leather Recliner Chair",
    "Oak Dining Table Set",
    "Queen Size Bed Frame",
    "Vintage Coffee Table",
    "Bookshelf - Solid Wood",
    "Office Desk with Drawers",
    "Sectional Couch",
    "Antique Dresser",
    "Patio Furniture Set",
    "Velvet Armchair",
    "Kitchen Island Cart",
    "Entertainment Center",
    "Bar Stools Set of 4",
    "Standing Desk",
    "Ottoman Storage Bench",
    "Console Table",
    "Nightstand Pair",
    "Outdoor Lounge Chairs",
    "Wardrobe Closet"
  ],
  appliances: [
    "KitchenAid Stand Mixer",
    "Dyson V15 Vacuum",
    "Instant Pot Duo Plus",
    "Ninja Blender System",
    "Breville Espresso Machine",
    "Samsung Washer & Dryer",
    "Cuisinart Food Processor",
    "Air Fryer XL",
    "Refrigerator - Stainless Steel",
    "Dishwasher - Energy Star"
  ],
  sports: [
    "Peloton Bike",
    "NordicTrack Treadmill",
    "Bowflex Dumbbells Set",
    "Kayak - 2 Person",
    "Mountain Bike - Full Suspension",
    "Golf Club Set",
    "Surfboard - 7ft",
    "Snowboard with Bindings",
    "Yoga Mat & Accessories",
    "Exercise Bench"
  ]
};
function randomPrice(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomProduct(category) {
  const templates = PRODUCT_TEMPLATES[category] || PRODUCT_TEMPLATES.electronics;
  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex] ?? "Unknown Product";
}
function generateId(marketplace, index) {
  return `${marketplace}-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`;
}
function generateUrl(marketplace, id, location) {
  switch (marketplace) {
    case "ebay":
      return `https://www.ebay.com/itm/${id}`;
    case "craigslist":
      return `https://${location}.craigslist.org/d/item/${id}.html`;
    case "facebook":
      return `https://www.facebook.com/marketplace/item/${id}`;
    default:
      return `https://example.com/${id}`;
  }
}
function generateMockListings(marketplace, category, maxResults, location) {
  const listings = [];
  for (let i = 0; i < maxResults; i++) {
    const id = generateId(marketplace, i);
    const listing = {
      id,
      title: getRandomProduct(category),
      price: randomPrice(50, 1e3),
      url: generateUrl(marketplace, id, location),
      marketplace,
      category,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    listings.push(listing);
  }
  return listings;
}
async function scrapeEbay(category, maxResults, env) {
  env.logger.info("Scraping eBay", { category, maxResults });
  const listings = generateMockListings("ebay", category, maxResults);
  env.logger.debug("Generated eBay listings", { count: listings.length });
  return listings;
}
async function scrapeCraigslist(city, category, maxResults, env) {
  env.logger.info("Scraping Craigslist", { city, category, maxResults });
  const listings = generateMockListings("craigslist", category, maxResults, city);
  env.logger.debug("Generated Craigslist listings", { count: listings.length });
  return listings;
}
async function scrapeFacebook(location, category, maxResults, env) {
  env.logger.info("Scraping Facebook Marketplace", { location, category, maxResults });
  const listings = generateMockListings("facebook", category, maxResults, location);
  env.logger.debug("Generated Facebook listings", { count: listings.length });
  return listings;
}
async function scrapeMarketplaces(config, env) {
  env.logger.info("Starting marketplace scraping", {
    category: config.category,
    maxPerMarketplace: config.maxPerMarketplace
  });
  const allListings = [];
  const [ebayListings, craigslistListings, facebookListings] = await Promise.all([
    scrapeEbay(config.category, config.maxPerMarketplace, env),
    scrapeCraigslist("seattle", config.category, config.maxPerMarketplace, env),
    scrapeFacebook("seattle", config.category, config.maxPerMarketplace, env)
  ]);
  allListings.push(...ebayListings, ...craigslistListings, ...facebookListings);
  await storeListings(allListings, env);
  env.logger.info("Completed marketplace scraping", {
    totalListings: allListings.length,
    ebay: ebayListings.length,
    craigslist: craigslistListings.length,
    facebook: facebookListings.length
  });
  return allListings;
}

// src/scraper-service/index.ts
var scraper_service_default = class extends Service {
  /**
   * fetch() stub - required for all services
   */
  async fetch(request) {
    return new Response("scraper-service: This is a private service. Use service-to-service calls.", {
      status: 501,
      statusText: "Not Implemented"
    });
  }
  /**
   * Main service method: Scrape marketplaces
   * Called by other services via: env.SCRAPER_SERVICE.scrapeMarketplaces(config)
   */
  async scrapeMarketplaces(config) {
    this.env.logger.info("ScraperService: scrapeMarketplaces called", { config });
    const listings = await scrapeMarketplaces(config, this.env);
    return { listings };
  }
};
export {
  scraper_service_default as default
};
