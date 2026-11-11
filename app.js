const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { sequelize } = require('./models');
const { getEnvironment } = require('./config/environment');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const settingRoutes = require('./routes/settingRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { formatDatabaseError } = require('./utils/databaseErrors');

const app = express();
const { corsOrigins, trustProxyHops } = getEnvironment();

app.disable('x-powered-by');
app.set('trust proxy', trustProxyHops);
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || corsOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  }),
);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res, next) => {
  try {
    await sequelize.authenticate();
    return res.json({ data: { status: 'ok', database: 'connected' } });
  } catch (error) {
    console.error('Database health check failed:', formatDatabaseError(error));
    return res.status(503).json({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable' },
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
