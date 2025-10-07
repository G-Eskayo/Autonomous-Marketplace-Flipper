"""eBay marketplace scraper."""
from typing import List, Dict
from datetime import datetime
import logging
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class EbayScraper(BaseScraper):
    """Scraper for eBay listings."""

    def __init__(self, category: str = "electronics"):
        super().__init__(category)
        self.base_url = "https://www.ebay.com"

    def scrape_listings(self, max_results: int = 50) -> List[Dict]:
        """Scrape eBay listings."""
        listings = []

        # Category mapping (simplified category IDs)
        category_map = {
            "electronics": "293",  # Consumer Electronics
            "computers": "58058",   # PC Laptops & Netbooks
            "phones": "9355"        # Cell Phones & Smartphones
        }

        category_id = category_map.get(self.category, "293")
        url = f"{self.base_url}/sch/i.html?_nkw=&_sacat={category_id}&_sop=10"

        logger.info(f"Scraping eBay: {url}")

        soup = self._make_request(url)
        if not soup:
            logger.warning("Failed to fetch eBay listings")
            return []

        # Find all listing items
        items = soup.find_all('div', class_='s-item__info', limit=max_results)

        for idx, item in enumerate(items):
            try:
                # Extract title
                title_elem = item.find('div', class_='s-item__title')
                title = title_elem.get_text(strip=True) if title_elem else "Unknown"

                # Skip sponsored items
                if "Shop on eBay" in title or title == "Unknown":
                    continue

                # Extract price
                price_elem = item.find('span', class_='s-item__price')
                price_str = price_elem.get_text(strip=True) if price_elem else "$0"
                price = self._extract_price(price_str)

                # Extract URL
                link_elem = item.find('a', class_='s-item__link')
                listing_url = link_elem['href'] if link_elem and 'href' in link_elem.attrs else ""

                # Generate ID from URL or index
                listing_id = f"ebay_{idx}_{hash(listing_url) % 10000}"

                listings.append({
                    'id': listing_id,
                    'title': title,
                    'price': price,
                    'url': listing_url,
                    'marketplace': 'ebay',
                    'category': self.category,
                    'timestamp': datetime.now().isoformat()
                })

            except Exception as e:
                logger.error(f"Error parsing eBay listing: {e}")
                continue

        logger.info(f"Scraped {len(listings)} eBay listings")
        return listings
