**Autonomous Flipper Agent --- "Agents That Buy & Sell"**

**1st Place Winner -- AI Tinkerers SF Hackathon**

An intelligent agent that scans marketplace listings, identifies undervalued items using heuristics, and automatically buys and re-lists them for profit.

This project **won 1st place** at the **AI Tinkerers San Francisco Mini-Hack** on **October 1, 2025**, sponsored by **LiquidMetal AI** and **Vercel**, under the theme *Agents That Buy & Sell*.

**Features**

- Multi-marketplace scraping -- eBay, Craigslist, Facebook Marketplace
- Smart heuristics -- historical price analysis, demand detection, scarcity scoring
- SmartBuckets integration -- persistent storage for listings and trades via LiquidMetal Raindrop
- In-memory tracking -- prevents duplicate purchases and relists
- Decision logging -- tracks reasoning behind each buy/sell action
- Autonomous broker logic -- scans, values, negotiates, settles, and relists for profit
- Safety rails -- budget caps, cooldowns, and loss limits

**Architecture**

autonomous-flipper/  
├── main.py -- entry point  
├── agent.py -- core agent orchestration  
├── scrapers/ -- marketplace scraping modules  
├── heuristics/ -- valuation and scoring logic  
├── storage/ -- SmartBuckets integration  
├── requirements.txt -- dependencies  
├── Dockerfile -- containerized runner  
├── .env.example -- RAINDROP_API_KEY placeholder  
├── .buckets/  
│   ├── flipper-listings/ -- scraped data  
│   ├── flipper-transactions/ -- buy/sell history  
│   └── flipper-trades/ -- closed deals & P&L  
└── market-flipper-agent/ -- optional Vercel UI  
  ├── package.json  
  ├── src/  
  └── public/

**SmartBuckets Setup**

1. Listings bucket -- flipper-listings  
   Stores all scraped marketplace data (title, price, condition, timestamps).

2. Transactions bucket -- flipper-transactions  
   Stores buy/sell history and realized profit.

3. Optional trades bucket -- flipper-trades  
   Tracks settled deals and cumulative P&L.

**Setup**

1. Install dependencies with `pip install -r requirements.txt`

2. Set the RAINDROP_API_KEY environment variable or copy .env.example to .env and add your key.

3. Run the agent using `python main.py`  
   The agent scrapes listings, scores items, executes buy/sell actions, and logs reasoning.

**Run with Docker**

Navigate to the project folder, build the container, and run it with your .env file.  
The agent loads seed listings, evaluates value, negotiates, settles, and updates P&L in SmartBuckets.

**Optional Demo UI (Vercel)**

Navigate to the market-flipper-agent folder, install dependencies, and start the development server.  
Then open the displayed localhost URL to view live deals, agent logs, and profit metrics.

**Configuration Parameters**

MAX_EXPOSURE -- total capital allowed in open trades  
MAX_LOSS_PER_TRADE -- cutoff for failed deals  
COOLDOWN_SEC -- delay before retrying after a failed negotiation

**Outputs**

- Real-time log of agent decisions with heuristic scores
- Transaction and trade history in SmartBuckets
- Profit/loss summary per session

**Skills Demonstrated**

- Autonomous agent architecture
- Machine-driven negotiation and valuation
- SmartBuckets API integration (LiquidMetal Raindrop)
- Marketplace scraping and data ingestion
- Heuristic modeling for demand and scarcity
- Event-driven automation and adaptive memory

**Notes**

- Seeded .buckets/ data ensures reliable demo behavior.
- Replace with live marketplace scrapers for production runs.
