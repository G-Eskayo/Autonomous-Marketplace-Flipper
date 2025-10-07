"""Base scraper class for marketplace scrapers."""
from abc import ABC, abstractmethod
from typing import List, Dict
import requests
from bs4 import BeautifulSoup
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """Abstract base class for marketplace scrapers."""

    def __init__(self, category: str = "electronics"):
        self.category = category
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

    @abstractmethod
    def scrape_listings(self, max_results: int = 50) -> List[Dict]:
        """Scrape listings from the marketplace.

        Returns:
            List of listing dictionaries with keys:
            - id: unique identifier
            - title: item title
            - price: current price
            - url: listing URL
            - marketplace: source marketplace
            - category: item category
            - timestamp: when scraped
        """
        pass

    def _make_request(self, url: str, delay: float = 1.0) -> BeautifulSoup:
        """Make a rate-limited request and return parsed HTML."""
        time.sleep(delay)
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            return BeautifulSoup(response.content, 'lxml')
        except Exception as e:
            logger.error(f"Request failed for {url}: {e}")
            return None

    def _extract_price(self, price_str: str) -> float:
        """Extract numeric price from string."""
        if not price_str:
            return 0.0
        # Remove currency symbols and commas
        cleaned = ''.join(c for c in price_str if c.isdigit() or c == '.')
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
