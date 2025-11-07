#!/bin/bash
# Start script for development

echo "Cleaning up ports 3001 and 5173..."
lsof -ti :3001 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null
sleep 1

echo "Building TypeScript..."
npm run build

echo ""
echo "Starting services..."
echo "  - API Server will be at http://localhost:3001"
echo "  - Web UI will be at http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Run both services
npm run api & 
API_PID=$!

cd web && npm run dev &
WEB_PID=$!

# Wait for both processes
wait $API_PID $WEB_PID
