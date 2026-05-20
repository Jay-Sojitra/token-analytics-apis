require('dotenv').config();
const express = require('express');
const cors = require('cors');
const insightRoutes = require('./routes/insightRoutes');
const hyperliquidRoutes = require('./routes/hyperliquidRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', insightRoutes);
app.use('/api', hyperliquidRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
