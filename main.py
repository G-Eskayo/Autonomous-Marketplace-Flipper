"""Main entry point for the autonomous flipper agent."""
import os
import sys
from dotenv import load_dotenv

from agent import FlipperAgent


def main():
    """Run the autonomous flipper agent."""
    # Load environment variables
    load_dotenv()

    # Get API key
    api_key = os.getenv('RAINDROP_API_KEY')

    if not api_key:
        print("ERROR: RAINDROP_API_KEY not found in environment")
        print("Please set it with: export RAINDROP_API_KEY='your_key_here'")
        sys.exit(1)

    # Initialize agent
    print("Initializing Autonomous Flipper Agent...")
    agent = FlipperAgent(api_key=api_key)

    # Run a complete cycle
    # Parameters:
    # - budget: How much money to spend on purchases
    # - max_per_marketplace: How many listings to scan per marketplace
    agent.run_cycle(budget=5000.0, max_per_marketplace=30)

    print("\n✨ Agent cycle complete!")


if __name__ == "__main__":
    main()
