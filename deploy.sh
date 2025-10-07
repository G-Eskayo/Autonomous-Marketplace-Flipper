#!/bin/bash

# Deployment script for Autonomous Flipper Agent
# Deploys to Raindrop MCP / LiquidMetal platform

set -e

echo "🚀 Deploying Autonomous Flipper Agent to Raindrop MCP"

# Check for API key
if [ -z "$RAINDROP_API_KEY" ]; then
    echo "❌ Error: RAINDROP_API_KEY not set"
    echo "Please set it with: export RAINDROP_API_KEY='your_key_here'"
    exit 1
fi

# Build Docker image
echo "📦 Building Docker image..."
docker build -t autonomous-flipper:latest .

# Tag image
echo "🏷️  Tagging image..."
docker tag autonomous-flipper:latest autonomous-flipper:$(date +%Y%m%d-%H%M%S)

# Deploy to Raindrop MCP
echo "☁️  Deploying to Raindrop MCP..."

# Note: Replace with actual Raindrop MCP deployment commands
# This is a placeholder for the deployment process

# For now, run locally with Docker
echo "🐳 Running agent in Docker container..."
docker run -e RAINDROP_API_KEY="$RAINDROP_API_KEY" autonomous-flipper:latest

echo "✅ Deployment complete!"
