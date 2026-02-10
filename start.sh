#!/bin/bash
# Start Discogs app

cd "$(dirname "$0")"

echo "🚀 Starting Discogs app..."
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
