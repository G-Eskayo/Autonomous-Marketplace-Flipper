# Market Flipper Agent - Hackathon Submission

## Project Overview
**Market Flipper Agent** is an autonomous marketplace arbitrage system built on Raindrop MCP that scans multiple marketplaces (eBay, Craigslist, Facebook Marketplace), identifies undervalued items using advanced heuristics, and makes intelligent buy/sell decisions.

### ⚠️ Demo Mode Notice
**This implementation uses simulated marketplace data for demonstration purposes.** The listings, prices, and URLs are generated using mock data to showcase the agent's architecture, valuation algorithms, and decision-making logic without requiring external API keys or handling anti-bot measures.

**Production Implementation Path:**
- Integrate with official marketplace APIs (eBay API, Facebook Marketplace API, etc.)
- Implement real-time web scraping using Puppeteer/Playwright with proper rate limiting
- Add CAPTCHA handling and proxy rotation for anti-bot measures
- Connect to third-party data providers (ScraperAPI, Apify) as needed

The current demo validates the complete technical architecture and business logic using Raindrop MCP's powerful features.

## Architecture

### Components Implemented
- **3 Services**:
  - `api-router` (public) - REST API gateway with 5 endpoints
  - `scraper-service` (private) - Marketplace data ingestion (currently mock data for demo)
  - `valuation-service` (private) - Multi-algorithm valuation engine
  
- **3 Stateful Actors**:
  - `decision-actor` - Purchase decision making with budget management
  - `inventory-actor` - Item inventory and re-listing management
  - `transaction-actor` - Financial transaction tracking
  
- **4 SmartBuckets**:
  - `flipper-listings` - Stores scraped marketplace listings
  - `flipper-transactions` - Stores transaction history
  - `flipper-inventory` - Stores inventory items
  - `historical-prices` - Stores historical price data for valuation

### Tech Stack
- **Framework**: Raindrop MCP
- **Language**: TypeScript
- **HTTP Framework**: Hono
- **Testing**: Vitest (211 tests passing)
- **Architecture Pattern**: MVC with strict separation of concerns

## API Endpoints

### Base URL
```
https://svc-01k6k5fjyd9amzg26kz7n3hyrk.01k507j1ctjqm9r2t725jq93x1.lmapp.run
```

### Endpoints

#### 1. POST /scan
Triggers marketplace scan and returns listings, evaluations, and purchase decisions.

**Request:**
```bash
curl -X POST "${BASE_URL}/scan" \
  -H "Content-Type: application/json" \
  -d '{"maxPerMarketplace": 5, "category": "electronics"}'
```

**Response:** Returns listings, evaluated items, and buy/skip decisions.

#### 2. GET /status
Returns agent statistics including items purchased, total invested, expected ROI.

```bash
curl -X GET "${BASE_URL}/status"
```

#### 3. GET /inventory
Returns current inventory of purchased items.

```bash
curl -X GET "${BASE_URL}/inventory"
```

#### 4. GET /transactions
Returns transaction history.

```bash
curl -X GET "${BASE_URL}/transactions"
```

#### 5. POST /config
Updates agent configuration (budget, profit margins, etc.).

```bash
curl -X POST "${BASE_URL}/config" \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 5000,
    "minProfitMargin": 0.20,
    "minProfit": 50,
    "maxPerMarketplace": 10,
    "category": "electronics"
  }'
```

## Valuation Heuristics

The agent uses 4 weighted algorithms to identify undervalued items:

1. **Historical Price Analysis (40% weight)** - Compares current price to historical averages
2. **MSRP Anchoring (25% weight)** - Evaluates against manufacturer's suggested retail price
3. **Scarcity Analysis (20% weight)** - Factors in item availability and demand
4. **Price Ratio Score (15% weight)** - Analyzes price-to-value ratios

Combined score > 70 = Undervalued item

## Test Coverage
- **Total Tests**: 211 passing
- **Components Tested**: All 6 components (100% coverage)
- **Testing Approach**: TDD (Test-Driven Development) with RED-GREEN-REFACTOR cycle

## Deployment Info
- **Version**: 01k6k5fd9q3efs1j68d4a7e5pk
- **Status**: All 12 modules running
- **Organization**: Gil Eskayo's Personal Account

## Key Features
- ✅ **Architecture Proof-of-Concept** - Full multi-marketplace agent design (currently demo data)
- ✅ **Advanced Valuation** - 4 heuristic algorithms for identifying undervalued items
- ✅ **Intelligent Decision-Making** - Budget-aware purchase decisions with profit analysis
- ✅ **Automated Inventory Management** - Item tracking and re-listing workflows
- ✅ **Financial Analytics** - ROI tracking and transaction history
- ✅ **RESTful API** - 5 endpoints with full CORS support
- ✅ **Comprehensive Testing** - 211 tests with 100% component coverage
- ✅ **Production Deployment** - Live on Raindrop MCP with all 12 modules running

### What's Real vs Demo
**Real Implementation:**
- ✅ Complete Raindrop MCP architecture (services, actors, SmartBuckets)
- ✅ Valuation algorithms and scoring logic
- ✅ Decision-making engine with budget management
- ✅ Inventory and transaction tracking
- ✅ Full API with error handling and CORS
- ✅ Comprehensive test suite

**Demo Mode:**
- ⚠️ Marketplace data is simulated (mock listings, prices, URLs)
- ⚠️ URLs are generated and don't point to real listings

**Production Ready-ness:**
- 🔧 Ready to integrate real marketplace APIs with API keys
- 🔧 Architecture supports swapping mock scraper with real implementation
- 🔧 All business logic validated and tested

## Demo
The agent is live and functional. Test it with:

```bash
# Check agent status
curl https://svc-01k6k5fjyd9amzg26kz7n3hyrk.01k507j1ctjqm9r2t725jq93x1.lmapp.run/status

# Run a scan
curl -X POST https://svc-01k6k5fjyd9amzg26kz7n3hyrk.01k507j1ctjqm9r2t725jq93x1.lmapp.run/scan \
  -H "Content-Type: application/json" \
  -d '{"maxPerMarketplace": 5, "category": "electronics"}'
```

## Built With Raindrop MCP
This project showcases Raindrop MCP's capabilities:
- Service-to-service communication
- Stateful actors with persistent storage
- SmartBuckets for AI-powered data storage
- Type-safe environment bindings
- Seamless deployment and scaling
