"""Main autonomous flipper agent logic."""
import logging
from typing import Dict, List, Set
from datetime import datetime

from scrapers import CraigslistScraper, EbayScraper, FacebookScraper
from heuristics import ValuationEngine
from storage import SmartBucketsClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FlipperAgent:
    """Autonomous agent for flipping marketplace items."""

    def __init__(self, api_key: str = None):
        """Initialize the flipper agent.

        Args:
            api_key: Raindrop API key for SmartBuckets
        """
        # Initialize components
        self.scrapers = [
            CraigslistScraper(city="sfbay", category="electronics"),
            EbayScraper(category="electronics"),
            FacebookScraper(location="san-francisco", category="electronics")
        ]

        self.valuation_engine = ValuationEngine()
        self.storage = SmartBucketsClient(api_key=api_key)

        # In-memory tracking to avoid duplicates
        self.purchased_ids: Set[str] = set()
        self.listed_ids: Set[str] = set()

        # Statistics
        self.stats = {
            'listings_scanned': 0,
            'items_purchased': 0,
            'items_listed': 0,
            'total_invested': 0.0,
            'potential_revenue': 0.0,
            'decisions': []
        }

        # Initialize buckets
        self._initialize_storage()

    def _initialize_storage(self):
        """Initialize SmartBuckets for storage."""
        logger.info("Initializing SmartBuckets storage...")
        self.storage.create_bucket('flipper-listings')
        self.storage.create_bucket('flipper-transactions')
        self.storage.create_bucket('flipper-inventory')

    def scan_marketplaces(self, max_per_marketplace: int = 20) -> List[Dict]:
        """Scan all marketplaces for new listings.

        Args:
            max_per_marketplace: Maximum listings to fetch per marketplace

        Returns:
            List of all scraped listings
        """
        logger.info("=" * 80)
        logger.info("SCANNING MARKETPLACES FOR NEW LISTINGS")
        logger.info("=" * 80)

        all_listings = []

        for scraper in self.scrapers:
            marketplace_name = scraper.__class__.__name__.replace('Scraper', '')
            logger.info(f"\n📡 Scanning {marketplace_name}...")

            try:
                listings = scraper.scrape_listings(max_results=max_per_marketplace)
                all_listings.extend(listings)

                # Store in SmartBuckets
                for listing in listings:
                    self.storage.store_item(
                        'flipper-listings',
                        listing['id'],
                        listing
                    )

                logger.info(f"✓ Found {len(listings)} listings from {marketplace_name}")

            except Exception as e:
                logger.error(f"✗ Error scraping {marketplace_name}: {e}")

        self.stats['listings_scanned'] = len(all_listings)
        logger.info(f"\n📊 Total listings found: {len(all_listings)}")

        return all_listings

    def evaluate_listings(self, listings: List[Dict]) -> List[Dict]:
        """Evaluate all listings for value.

        Args:
            listings: List of marketplace listings

        Returns:
            Sorted list of evaluated listings (best deals first)
        """
        logger.info("\n" + "=" * 80)
        logger.info("EVALUATING LISTINGS WITH HEURISTICS")
        logger.info("=" * 80)

        evaluated = self.valuation_engine.batch_evaluate(listings)

        logger.info(f"\n📊 Evaluated {len(evaluated)} listings")

        # Show top 5 opportunities
        logger.info("\n🎯 TOP 5 OPPORTUNITIES:")
        for i, item in enumerate(evaluated[:5], 1):
            logger.info(f"\n{i}. {item['title'][:50]}")
            logger.info(f"   Score: {item['score']}/100")
            logger.info(f"   Current Price: ${item['price']:.2f}")
            logger.info(f"   Est. Resale: ${item['estimated_resale']:.2f}")
            logger.info(f"   Profit: ${item['profit_potential']:.2f} ({item['profit_margin']:.1f}%)")
            logger.info(f"   Marketplace: {item['marketplace']}")
            logger.info(f"   Reasoning: {item['reasoning']}")

        return evaluated

    def make_purchase_decisions(self, evaluated_listings: List[Dict],
                                budget: float = 5000.0) -> List[Dict]:
        """Decide which items to purchase based on budget and filters.

        Args:
            evaluated_listings: Sorted list of evaluated items
            budget: Available budget for purchases

        Returns:
            List of items to purchase
        """
        logger.info("\n" + "=" * 80)
        logger.info("MAKING PURCHASE DECISIONS")
        logger.info("=" * 80)
        logger.info(f"💰 Available budget: ${budget:.2f}")

        to_purchase = []
        remaining_budget = budget

        for item in evaluated_listings:
            # Skip if already purchased
            if item['id'] in self.purchased_ids:
                continue

            # Skip if not undervalued
            if not item.get('is_undervalued', False):
                continue

            # Check budget
            price = item['price']
            if price > remaining_budget:
                logger.info(f"\n⚠️  Skipping {item['title'][:40]} - exceeds remaining budget")
                continue

            # Decision logging
            decision = {
                'action': 'BUY',
                'item_id': item['id'],
                'title': item['title'],
                'price': price,
                'score': item['score'],
                'profit_potential': item['profit_potential'],
                'reasoning': item['reasoning'],
                'timestamp': datetime.now().isoformat()
            }

            to_purchase.append(item)
            self.purchased_ids.add(item['id'])
            remaining_budget -= price

            self.stats['decisions'].append(decision)

            logger.info(f"\n✓ PURCHASE DECISION: {item['title'][:50]}")
            logger.info(f"  Price: ${price:.2f}")
            logger.info(f"  Expected Profit: ${item['profit_potential']:.2f}")
            logger.info(f"  Remaining Budget: ${remaining_budget:.2f}")

        logger.info(f"\n📦 Total items to purchase: {len(to_purchase)}")
        logger.info(f"💵 Total investment: ${budget - remaining_budget:.2f}")

        return to_purchase

    def execute_purchases(self, items: List[Dict]):
        """Simulate purchasing items and add to inventory.

        Args:
            items: List of items to purchase
        """
        logger.info("\n" + "=" * 80)
        logger.info("EXECUTING PURCHASES")
        logger.info("=" * 80)

        for item in items:
            logger.info(f"\n🛒 Purchasing: {item['title'][:50]}")

            # Store in inventory bucket
            inventory_item = {
                **item,
                'purchase_date': datetime.now().isoformat(),
                'status': 'purchased'
            }

            self.storage.store_item(
                'flipper-inventory',
                item['id'],
                inventory_item
            )

            # Record transaction
            transaction = {
                'type': 'purchase',
                'item_id': item['id'],
                'amount': item['price'],
                'timestamp': datetime.now().isoformat()
            }

            self.storage.store_item(
                'flipper-transactions',
                f"buy_{item['id']}_{int(datetime.now().timestamp())}",
                transaction
            )

            self.stats['items_purchased'] += 1
            self.stats['total_invested'] += item['price']

            logger.info(f"   ✓ Purchase complete - Added to inventory")

    def relist_items(self, items: List[Dict]):
        """Re-list purchased items at higher price.

        Args:
            items: List of items to re-list
        """
        logger.info("\n" + "=" * 80)
        logger.info("RE-LISTING ITEMS FOR SALE")
        logger.info("=" * 80)

        for item in items:
            if item['id'] in self.listed_ids:
                continue

            resale_price = item.get('estimated_resale', item['price'] * 1.3)

            logger.info(f"\n📤 Listing: {item['title'][:50]}")
            logger.info(f"   Original Price: ${item['price']:.2f}")
            logger.info(f"   New Price: ${resale_price:.2f}")
            logger.info(f"   Markup: ${resale_price - item['price']:.2f}")

            # Create listing
            listing = {
                **item,
                'resale_price': resale_price,
                'listed_date': datetime.now().isoformat(),
                'status': 'listed'
            }

            self.storage.store_item(
                'flipper-listings',
                f"resale_{item['id']}",
                listing
            )

            self.listed_ids.add(item['id'])
            self.stats['items_listed'] += 1
            self.stats['potential_revenue'] += resale_price

            logger.info(f"   ✓ Listed successfully")

    def run_cycle(self, budget: float = 5000.0, max_per_marketplace: int = 20):
        """Run a complete flip cycle: scan, evaluate, buy, relist.

        Args:
            budget: Available budget for purchases
            max_per_marketplace: Max listings to scan per marketplace
        """
        logger.info("\n" + "🤖" * 40)
        logger.info("AUTONOMOUS FLIPPER AGENT - STARTING NEW CYCLE")
        logger.info("🤖" * 40)

        # Step 1: Scan marketplaces
        listings = self.scan_marketplaces(max_per_marketplace)

        if not listings:
            logger.warning("No listings found. Ending cycle.")
            return

        # Step 2: Evaluate listings
        evaluated = self.evaluate_listings(listings)

        # Step 3: Make purchase decisions
        to_purchase = self.make_purchase_decisions(evaluated, budget)

        if not to_purchase:
            logger.info("\n⚠️  No undervalued items found within budget. Ending cycle.")
            return

        # Step 4: Execute purchases
        self.execute_purchases(to_purchase)

        # Step 5: Re-list items
        self.relist_items(to_purchase)

        # Step 6: Show final stats
        self.show_statistics()

    def show_statistics(self):
        """Display agent statistics and performance."""
        logger.info("\n" + "=" * 80)
        logger.info("AGENT STATISTICS & PERFORMANCE")
        logger.info("=" * 80)

        logger.info(f"\n📊 Listings Scanned: {self.stats['listings_scanned']}")
        logger.info(f"🛒 Items Purchased: {self.stats['items_purchased']}")
        logger.info(f"📤 Items Listed for Resale: {self.stats['items_listed']}")
        logger.info(f"💵 Total Invested: ${self.stats['total_invested']:.2f}")
        logger.info(f"💰 Potential Revenue: ${self.stats['potential_revenue']:.2f}")

        profit = self.stats['potential_revenue'] - self.stats['total_invested']
        roi = (profit / self.stats['total_invested'] * 100) if self.stats['total_invested'] > 0 else 0

        logger.info(f"📈 Expected Profit: ${profit:.2f}")
        logger.info(f"📊 Expected ROI: {roi:.1f}%")

        logger.info("\n" + "=" * 80)
