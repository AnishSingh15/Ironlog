import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import aiRoutes from './routes/ai';
import authRoutes from './routes/auth';
import exerciseRoutes from './routes/exercises';
import setRecordRoutes from './routes/setRecords';
import workoutRoutes from './routes/workouts';

const app = express();

// Security middleware
app.use(helmet());

// Matches any ironlog-web Vercel deployment (production + preview URLs,
// e.g. ironlog-web-iota.vercel.app). The `cors` package matches array
// entries by exact string, so a literal "*" wildcard never matches anything -
// this needs a real RegExp.
const VERCEL_ORIGIN_PATTERN = /^https:\/\/ironlog-web(-[a-z0-9-]+)?\.vercel\.app$/;

app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? (origin, callback) => {
            if (
              !origin ||
              VERCEL_ORIGIN_PATTERN.test(origin) ||
              origin === process.env.FRONTEND_URL
            ) {
              return callback(null, true);
            }
            callback(new Error(`Origin ${origin} not allowed by CORS`));
          }
        : ['http://localhost:3000'],
    credentials: true,
  })
);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workouts', workoutRoutes);
app.use('/api/v1/exercises', exerciseRoutes);
app.use('/api/v1/set-records', setRecordRoutes);
app.use('/api/v1/ai', aiRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

const port = config.port;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
  });
}

export default app;
