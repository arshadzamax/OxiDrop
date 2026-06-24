import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { PORT } from './config.js';
import { connectDB } from './db.js';
import { router } from './routes.js';
import { initWebSocketServer } from './socket.js';

const app = express();
const httpServer = createServer(app);

// CORS Policy Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Initialize Database connection
connectDB();

// Bind HTTP routes
app.use('/api', router);

// Bind WebSocket server
initWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Modular Signaling Node listening on port ${PORT}`);
});
