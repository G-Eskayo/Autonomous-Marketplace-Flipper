"""Craigslist marketplace scraper."""
from typing import List, Dict
from datetime import datetime
import logging
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class CraigslistScraper(BaseScraper):
    """Scraper for Craigslist listings."""

    def __init__(self, city: str = "sfbay", category: str = "electronics"):
        super().__init__(category)
        self.city = city
        self.base_url = f"https://{city}.craigslist.org"

    def scrape_listings(self, max_results: int = 50) -> List[Dict]:
        """Scrape Craigslist listings."""
        listings = []

        # Category mapping
        category_map = {
            "electronics": "/d/electronics/search/ela",
            "furniture": "/d/furniture/search/fua",
            "appliances": "/d/appliances/search/ppa"
        }

        category_path = category_map.get(self.category, "/d/electronics/search/ela")
        url = f"{self.base_url}{category_path}"

        logger.info(f"Scraping Craigslist: {url}")

        soup = self._make_request(url)
        if not soup:
            logger.warning("Failed to fetch Craigslist listings")
            return []

        # Find all listing items
        items = soup.find_all('li', class_='cl-static-search-result', limit=max_results)

        for idx, item in enumerate(items):
            try:
                # Extract title
                title_elem = item.find('div', class_='title')
                title = title_elem.get_text(strip=True) if title_elem else "Unknown"

                # Extract price
                price_elem = item.find('div', class_='price')
                price_str = price_elem.get_text(strip=True) if price_elem else "$0"
                price = self._extract_price(price_str)

                # Extract URL
                link_elem = item.find('a')
                listing_url = link_elem['href'] if link_elem and 'href' in link_elem.attrs else ""

                # Generate ID from URL or index
                listing_id = f"cl_{self.city}_{idx}_{hash(listing_url) % 10000}"

                listings.append({
                    'id': listing_id,
                    'title': title,
                    'price': price,
                    'url': listing_url,
                    'marketplace': 'craigslist',
                    'category': self.category,
                    'timestamp': datetime.now().isoformat()
                })

            except Exception as e:
                logger.error(f"Error parsing Craigslist listing: {e}")
                continue

        logger.info(f"Scraped {len(listings)} Craigslist listings")
        return listings
