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
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [
            'https://ironlog-web.vercel.app',
            'https://ironlog-web-*.vercel.app', // For preview deployments
            process.env.FRONTEND_URL || 'https://ironlog-web.vercel.app',
          ]
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
