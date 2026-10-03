/**
 * Express API server for Discogs marketplace search
 */

import express from 'express';
import cors from 'cors';
import { searchListings, estimateSearch } from './lib/exporter';
import { resolveSellerCountry } from './lib/countryFilter';
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
  
  // Input validation
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a valid object' });
  }
  
  const body = req.body;
  
  // Validate individual fields
  if (body.styles !== undefined) {
    if (!Array.isArray(body.styles) || !body.styles.every((s: any) => typeof s === 'string')) {
      return res.status(400).json({ error: 'styles must be an array of strings' });
    }
  }
  
  if (body.genre !== undefined && typeof body.genre !== 'string') {
    return res.status(400).json({ error: 'genre must be a string' });
  }
  
  if (body.format !== undefined && typeof body.format !== 'string') {
    return res.status(400).json({ error: 'format must be a string' });
  }
  
  if (body.fromCountry !== undefined) {
    if (typeof body.fromCountry !== 'string') {
      return res.status(400).json({ error: 'fromCountry must be a string' });
    }
    if (body.fromCountry.trim()) {
      // Resolve to the canonical ISO code now, so an unrecognised country is a
      // clean 400 rather than a silently-dropped filter that returns every
      // country. Normalise so downstream always sees a valid code.
      const code = resolveSellerCountry(body.fromCountry);
      if (!code) {
        return res.status(400).json({
          error: `Unknown seller country "${body.fromCountry}". Use a country name (e.g. "United States") or its ISO code (e.g. "US").`,
        });
      }
      body.fromCountry = code;
    }
  }
  
  if (body.artist !== undefined && typeof body.artist !== 'string') {
    return res.status(400).json({ error: 'artist must be a string' });
  }

  if (body.seller !== undefined && typeof body.seller !== 'string') {
    return res.status(400).json({ error: 'seller must be a string' });
  }
  
  if (body.minYear !== undefined) {
    if (typeof body.minYear !== 'number' || body.minYear < 1900 || body.minYear > 2100) {
      return res.status(400).json({ error: 'minYear must be a number between 1900 and 2100' });
    }
  }
  
  if (body.maxYear !== undefined) {
    if (typeof body.maxYear !== 'number' || body.maxYear < 1900 || body.maxYear > 2100) {
      return res.status(400).json({ error: 'maxYear must be a number between 1900 and 2100' });
    }
  }
  
  if (body.currency !== undefined) {
    if (typeof body.currency !== 'string' || body.currency.length !== 3) {
      return res.status(400).json({ error: 'currency must be a 3-letter string' });
    }
  }
  
  if (body.condition !== undefined && typeof body.condition !== 'string') {
    return res.status(400).json({ error: 'condition must be a string' });
  }

  if (body.maxItems !== undefined) {
    if (typeof body.maxItems !== 'number' || body.maxItems < 1) {
      return res.status(400).json({ error: 'maxItems must be a positive number' });
    }
  }

  for (const idField of ['labelId', 'masterId', 'releaseId', 'artistId'] as const) {
    if (body[idField] !== undefined) {
      if (typeof body[idField] !== 'number' || body[idField] < 1 || !Number.isInteger(body[idField])) {
        return res.status(400).json({ error: `${idField} must be a positive integer` });
      }
    }
  }
  
  if (body.pageDelayMs !== undefined) {
    if (typeof body.pageDelayMs !== 'number' || body.pageDelayMs < 100 || body.pageDelayMs > 10000) {
      return res.status(400).json({ error: 'pageDelayMs must be a number between 100 and 10000' });
    }
    // Clamp to minimum 500ms to prevent hammering
    body.pageDelayMs = Math.max(500, body.pageDelayMs);
  }
  
  // Disable automatic response timeout
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);
  
  const searchOptions: SearchOptions = body;
  
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

  // Track if client disconnects. NOTE: listen on `res`, not `req` — for a POST,
  // req 'close' fires when the request body finishes uploading (immediately),
  // which is not a disconnect. res 'close' fires when the connection actually ends.
  res.on('close', () => {
    if (res.writableFinished) return; // normal completion, not a disconnect
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

  // Set 10-minute timeout for the search
  const timeoutHandle = setTimeout(() => {
    if (!res.writableEnded) {
      console.warn('[TIMEOUT] Search exceeded 10 minutes, terminating');
      const errorEvent = `data: ${JSON.stringify({ 
        type: 'error', 
        message: 'Search timed out after 10 minutes' 
      })}\n\n`;
      res.write(errorEvent);
      clearInterval(heartbeatInterval);
      res.end();
    }
  }, 10 * 60 * 1000); // 10 minutes

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
      if (error instanceof Error && error.stack) {
        console.error('[ERROR] Stack trace:', error.stack);
      }
      if (!res.writableEnded) {
        const errorEvent = `data: ${JSON.stringify({ 
          type: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        })}\n\n`;
        res.write(errorEvent);
      }
    } finally {
      clearTimeout(timeoutHandle);
      clearInterval(heartbeatInterval);
      if (!res.writableEnded) {
        res.end();
      }
      console.log('[END] Response ended');
    }
  })(); // IIFE ends here, route handler returns immediately
});

/**
 * POST /api/estimate
 * Cheap probe: fetches only page 1 to report exact totals and how much a full
 * fetch would cost (requests + time) under the shared rate limiter. Returns the
 * first page of items too, so the probe request is reused by the client.
 */
app.post('/api/estimate', (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a valid object' });
  }

  const searchOptions: SearchOptions = req.body;
  console.log('\n=== Estimate Request ===');
  console.log('Filters:', JSON.stringify(searchOptions));

  estimateSearch(searchOptions)
    .then((estimate) => {
      console.log(`[ESTIMATE] ${estimate.totalItems} items, ${estimate.cappedPages} pages, ~${Math.round(estimate.estimatedTimeMsAll / 1000)}s`);
      res.json(estimate);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ESTIMATE] Failed:', message);
      const rateLimited = message.includes('403') || message.includes('429');
      res.status(rateLimited ? 429 : 500).json({ error: message, rateLimited });
    });
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
