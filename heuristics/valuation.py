"""Valuation heuristics for identifying undervalued items."""
from typing import Dict, List
import logging
import statistics

logger = logging.getLogger(__name__)


class ValuationEngine:
    """Engine for evaluating if an item is undervalued."""

    def __init__(self):
        # Historical price database (mock data for demo)
        self.historical_prices = {
            "iphone": {"avg": 650, "min": 400, "max": 1200, "msrp": 999},
            "macbook": {"avg": 900, "min": 600, "max": 1500, "msrp": 1299},
            "ps5": {"avg": 450, "min": 350, "max": 600, "msrp": 499},
            "xbox": {"avg": 400, "min": 300, "max": 550, "msrp": 499},
            "ipad": {"avg": 550, "min": 300, "max": 900, "msrp": 799},
            "laptop": {"avg": 700, "min": 400, "max": 1200, "msrp": 999},
            "tv": {"avg": 400, "min": 200, "max": 800, "msrp": 599},
            "camera": {"avg": 500, "min": 300, "max": 900, "msrp": 799},
            "switch": {"avg": 275, "min": 200, "max": 350, "msrp": 299},
            "airpods": {"avg": 150, "min": 100, "max": 200, "msrp": 179},
            "watch": {"avg": 350, "min": 250, "max": 500, "msrp": 429},
            "headphones": {"avg": 225, "min": 150, "max": 350, "msrp": 299}
        }

        # Profit margin threshold
        self.min_profit_margin = 0.20  # 20% minimum profit margin

    def evaluate_listing(self, listing: Dict) -> Dict:
        """Evaluate a listing and return valuation score.

        Returns:
            Dict with keys:
            - is_undervalued: bool
            - score: float (0-100)
            - estimated_resale: float
            - profit_potential: float
            - reasoning: str
        """
        title = listing.get('title', '').lower()
        current_price = listing.get('price', 0)

        if current_price <= 0:
            return self._no_value_result("Invalid price")

        # Find matching product category
        historical_data = self._find_historical_data(title)

        if not historical_data:
            return self._no_value_result("No historical data available")

        # Calculate heuristic scores
        scores = {}

        # 1. Historical Price Comparison (40% weight)
        scores['historical'] = self._historical_price_score(
            current_price, historical_data
        )

        # 2. MSRP Anchoring (25% weight)
        scores['msrp'] = self._msrp_anchor_score(
            current_price, historical_data.get('msrp', 0)
        )

        # 3. Scarcity/Demand Heuristic (20% weight)
        scores['scarcity'] = self._scarcity_score(title, historical_data)

        # 4. Price-to-Average Ratio (15% weight)
        scores['ratio'] = self._price_ratio_score(
            current_price, historical_data.get('avg', 0)
        )

        # Weighted total score
        total_score = (
            scores['historical'] * 0.40 +
            scores['msrp'] * 0.25 +
            scores['scarcity'] * 0.20 +
            scores['ratio'] * 0.15
        )

        # Estimate resale price (conservative: use avg historical price)
        estimated_resale = historical_data.get('avg', current_price * 1.3)

        # Calculate profit potential
        profit = estimated_resale - current_price
        profit_margin = (profit / current_price) if current_price > 0 else 0

        # Determine if undervalued
        is_undervalued = (
            total_score >= 60 and
            profit_margin >= self.min_profit_margin and
            profit > 50  # Minimum $50 profit
        )

        reasoning = self._generate_reasoning(
            scores, current_price, estimated_resale, profit_margin
        )

        return {
            'is_undervalued': is_undervalued,
            'score': round(total_score, 2),
            'estimated_resale': round(estimated_resale, 2),
            'profit_potential': round(profit, 2),
            'profit_margin': round(profit_margin * 100, 2),
            'reasoning': reasoning,
            'scores_breakdown': scores
        }

    def _find_historical_data(self, title: str) -> Dict:
        """Find matching historical price data."""
        for product_key, data in self.historical_prices.items():
            if product_key in title:
                return data
        return None

    def _historical_price_score(self, current: float, historical: Dict) -> float:
        """Score based on how far below historical average."""
        avg = historical.get('avg', current)
        if current >= avg:
            return 0

        # Score increases as price goes below average
        discount_pct = (avg - current) / avg
        return min(100, discount_pct * 200)  # 50% below avg = 100 points

    def _msrp_anchor_score(self, current: float, msrp: float) -> float:
        """Score based on discount from MSRP."""
        if msrp <= 0 or current >= msrp:
            return 0

        discount_pct = (msrp - current) / msrp
        return min(100, discount_pct * 150)  # 67% below MSRP = 100 points

    def _scarcity_score(self, title: str, historical: Dict) -> float:
        """Score based on scarcity indicators."""
        scarcity_keywords = ['limited', 'rare', 'discontinued', 'collectors']
        demand_keywords = ['pro', 'max', 'ultra', 'premium']

        score = 50  # baseline

        for keyword in scarcity_keywords:
            if keyword in title:
                score += 20

        for keyword in demand_keywords:
            if keyword in title:
                score += 10

        return min(100, score)

    def _price_ratio_score(self, current: float, avg: float) -> float:
        """Score based on price-to-average ratio."""
        if avg <= 0:
            return 0

        ratio = current / avg

        if ratio >= 1.0:
            return 0
        elif ratio <= 0.5:
            return 100
        else:
            # Linear scale: 0.5 ratio = 100, 1.0 ratio = 0
            return (1.0 - ratio) * 200

    def _generate_reasoning(self, scores: Dict, current: float,
                           resale: float, margin: float) -> str:
        """Generate human-readable reasoning."""
        reasons = []

        if scores['historical'] > 60:
            reasons.append(f"Price is significantly below historical average")

        if scores['msrp'] > 60:
            reasons.append(f"Deep discount from MSRP")

        if scores['scarcity'] > 70:
            reasons.append(f"High demand or scarcity indicators")

        if margin >= 0.30:
            reasons.append(f"Excellent profit margin ({margin*100:.0f}%)")

        if not reasons:
            reasons.append("Price is close to market average")

        return "; ".join(reasons)

    def _no_value_result(self, reason: str) -> Dict:
        """Return a no-value result."""
        return {
            'is_undervalued': False,
            'score': 0,
            'estimated_resale': 0,
            'profit_potential': 0,
            'profit_margin': 0,
            'reasoning': reason,
            'scores_breakdown': {}
        }

    def batch_evaluate(self, listings: List[Dict]) -> List[Dict]:
        """Evaluate multiple listings and return sorted by score."""
        results = []

        for listing in listings:
            evaluation = self.evaluate_listing(listing)
            result = {**listing, **evaluation}
            results.append(result)

        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)

        return results
