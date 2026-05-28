import 'dotenv/config';
import express    from 'express';
import http       from 'http';
import cors       from 'cors';
import mongoose   from 'mongoose';
import { Server } from 'socket.io';
import quizRoutes from './routes/quiz.js';
import gameRoutes from './routes/game.js';
import historyRoutes from './routes/history.js';
import initSocket from './socket/gameSocket.js';

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

app.use(cors());
app.use(express.json());
app.use('/api/quiz', quizRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/history', historyRoutes);
app.get('/health', (_, res) => res.json({ ok: true, message: "CI/CD is live and working!" }));
initSocket(io);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(process.env.PORT || 3000, '0.0.0.0', () =>
      console.log(`🚀 Server on port ${process.env.PORT || 3000}`)
    );
  })
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });