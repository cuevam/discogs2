#!/bin/bash
# Stop Discogs app

echo "🛑 Stopping Discogs app..."

pkill -f "node dist/api.js" && echo "✓ Backend stopped"
pkill -f "vite" && echo "✓ Frontend stopped"

echo "✅ All processes stopped"
