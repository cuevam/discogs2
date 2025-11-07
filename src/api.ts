/**
 * Express API server for Discogs marketplace search
 */

import express from 'express';
import cors from 'cors';
import { searchListings } from './lib/exporter';
import { SearchOptions, ListingData, ProgressUpdate } from './lib/types';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * POST /api/search
 * Streams search results as Server-Sent Events
 * FIXED: Non-async handler with IIFE pattern to prevent early connection close
 */
app.post('/api/search', (req, res) => {
  const startTime = Date.now();
  let totalItemsSent = 0;
  let clientDisconnected = false;
  
  // Disable automatic response timeout
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);
  
  const searchOptions: SearchOptions = req.body;
  
  // Log search request
  console.log('\n=== New Search Request ===');
  console.log('Time:', new Date().toISOString());
  console.log('Filters:', JSON.stringify(searchOptions, null, 2));

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // CRITICAL: Flush headers immediately to establish connection
  res.flushHeaders();
  
  // Send initial comment to keep connection alive
  res.write(': connected\n\n');
  
  // Send a starting event immediately
  res.write(`data: ${JSON.stringify({ type: 'started' })}\n\n`);

  // Track if client disconnects
  req.on('close', () => {
    clientDisconnected = true;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[DISCONNECT] Client disconnected after ${duration}s (${totalItemsSent} items sent)`);
  });
  
  console.log('[SETUP] SSE connection established, client connected');

  // Send heartbeat every 15s to keep connection alive
  const heartbeatInterval = setInterval(() => {
    if (!clientDisconnected && !res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 15000);

  // Fire-and-forget async IIFE - route handler returns immediately, keeping connection open
  (async () => {
    try {
      console.log('[START] Beginning search stream...');
      console.log('[STREAM] Client connected:', !clientDisconnected);
      
      let itemCount = 0;
      
      console.log('[STREAM] About to enter for-await loop...');
      
      // Stream listings as they arrive
      for await (const listing of searchListings(searchOptions, (progress) => {
        if (res.writableEnded) return;
        const event = `data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`;
        res.write(event);
      })) {
        if (res.writableEnded) {
          console.log('[STREAM] Response ended, stopping search');
          break;
        }

        itemCount++;
        if (itemCount === 1) {
          console.log(`[STREAM] Got first item, client still writable: ${!res.writableEnded}`);
        }

        const event = `data: ${JSON.stringify({ type: 'data', listing })}\n\n`;
        res.write(event);
        totalItemsSent++;
        
        if (totalItemsSent % 50 === 0) {
          console.log(`Streamed ${totalItemsSent} items so far...`);
        }
      }
      
      console.log(`[STREAM] Loop finished, sent ${totalItemsSent} items`);

      // Send completion event
      if (!res.writableEnded) {
        const event = `data: ${JSON.stringify({ type: 'complete' })}\n\n`;
        res.write(event);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Search completed: ${totalItemsSent} items in ${duration}s`);
        console.log('========================\n');
      }
    } catch (error) {
      console.error('[ERROR] Error during search:', error);
      if (!res.writableEnded) {
        const errorEvent = `data: ${JSON.stringify({ 
          type: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        })}\n\n`;
        res.write(errorEvent);
      }
    } finally {
      clearInterval(heartbeatInterval);
      if (!res.writableEnded) {
        res.end();
      }
      console.log('[END] Response ended');
    }
  })(); // IIFE ends here, route handler returns immediately
});

/**
 * GET /api/health
 * Simple health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
