"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.get('/test-sse', function (req, res) {
    console.log('SSE connection started');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(': connected\n\n');
    res.write("data: ".concat(JSON.stringify({ type: 'started' }), "\n\n"));
    var count = 0;
    var interval = setInterval(function () {
        count++;
        console.log("Sending message ".concat(count));
        res.write("data: ".concat(JSON.stringify({ type: 'message', count: count }), "\n\n"));
        if (count >= 10) {
            clearInterval(interval);
            res.write("data: ".concat(JSON.stringify({ type: 'complete' }), "\n\n"));
            res.end();
            console.log('Stream ended');
        }
    }, 100);
    req.on('close', function () {
        console.log('Client disconnected');
        clearInterval(interval);
    });
});
app.listen(3002, function () {
    console.log('Test SSE server on http://localhost:3002');
});
