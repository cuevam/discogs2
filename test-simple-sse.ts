import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/test-sse', (req, res) => {
  console.log('SSE connection started');
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  res.write(': connected\n\n');
  res.write(`data: ${JSON.stringify({ type: 'started' })}\n\n`);
  
  let count = 0;
  const interval = setInterval(() => {
    count++;
    console.log(`Sending message ${count}`);
    res.write(`data: ${JSON.stringify({ type: 'message', count })}\n\n`);
    
    if (count >= 10) {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
      console.log('Stream ended');
    }
  }, 100);
  
  req.on('close', () => {
    console.log('Client disconnected');
    clearInterval(interval);
  });
});

app.listen(3002, () => {
  console.log('Test SSE server on http://localhost:3002');
});
