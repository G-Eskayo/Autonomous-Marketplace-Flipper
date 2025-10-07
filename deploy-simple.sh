#!/bin/bash

# Simple deployment script for Autonomous Flipper Agent
# Runs directly with Python (no Docker required)

set -e

echo "🚀 Deploying Autonomous Flipper Agent"

# Check for API key
if [ -z "$RAINDROP_API_KEY" ]; then
    echo "❌ Error: RAINDROP_API_KEY not set"
    echo "Please set it with: export RAINDROP_API_KEY='your_key_here'"
    exit 1
fi

# Check dependencies
echo "📦 Checking dependencies..."
python3 -m pip install -r requirements.txt --quiet

# Run the agent
echo "🤖 Starting Autonomous Flipper Agent..."
echo "================================================"
python3 main.py

echo ""
echo "✅ Agent cycle complete!"
