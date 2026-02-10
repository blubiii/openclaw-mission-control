#!/bin/bash
# LaboratoryOS Startup Script

echo "🧪 Starting LaboratoryOS..."
cd "$(dirname "$0")"

# Kill any existing process on port 3005
lsof -ti:3005 | xargs kill -9 2>/dev/null || true

# Start server
PORT=3005 node server.js

