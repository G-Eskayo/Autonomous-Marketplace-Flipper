"""Facebook Marketplace scraper (mock implementation)."""
from typing import List, Dict
from datetime import datetime
import logging
import random
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class FacebookScraper(BaseScraper):
    """Scraper for Facebook Marketplace listings.

    Note: Facebook Marketplace requires authentication and has anti-bot measures.
    This is a mock implementation that generates sample data for demo purposes.
    In production, you would need Facebook's official API or Selenium with login.
    """

    def __init__(self, location: str = "san-francisco", category: str = "electronics"):
        super().__init__(category)
        self.location = location

    def scrape_listings(self, max_results: int = 50) -> List[Dict]:
        """Generate mock Facebook Marketplace listings."""
        logger.info("Facebook Marketplace scraping (MOCK MODE - generating sample data)")

        # Sample product names for realistic mock data
        products = [
            "iPhone 12 Pro Max 128GB",
            "Sony PS5 Console",
            "MacBook Air M1",
            "Samsung 55\" 4K TV",
            "iPad Pro 11 inch",
            "Dell XPS 13 Laptop",
            "Canon EOS Camera",
            "Nintendo Switch OLED",
            "AirPods Pro 2nd Gen",
            "Samsung Galaxy S23",
            "HP Gaming Laptop",
            "Bose QuietComfort Headphones",
            "Apple Watch Series 8",
            "Fitbit Charge 5",
            "Ring Video Doorbell"
        ]

        listings = []

        for i in range(min(max_results, 30)):
            product_name = random.choice(products)

            # Generate realistic price variations
            base_prices = {
                "iPhone": (400, 900),
                "MacBook": (600, 1200),
                "PS5": (350, 550),
                "TV": (200, 600),
                "iPad": (300, 800),
                "Dell": (400, 900),
                "Canon": (300, 700),
                "Switch": (200, 350),
                "AirPods": (100, 200),
                "Galaxy": (400, 800),
                "HP": (500, 1000),
                "Bose": (150, 300),
                "Watch": (250, 450),
                "Fitbit": (80, 150),
                "Ring": (80, 150)
            }

            price_range = (100, 500)  # default
            for key, val in base_prices.items():
                if key in product_name:
                    price_range = val
                    break

            price = random.uniform(price_range[0], price_range[1])

            listings.append({
                'id': f"fb_{self.location}_{i}_{random.randint(1000, 9999)}",
                'title': f"{product_name} - Great Condition",
                'price': round(price, 2),
                'url': f"https://facebook.com/marketplace/item/{random.randint(100000000, 999999999)}",
                'marketplace': 'facebook',
                'category': self.category,
                'timestamp': datetime.now().isoformat()
            })

        logger.info(f"Generated {len(listings)} mock Facebook Marketplace listings")
        return listings
