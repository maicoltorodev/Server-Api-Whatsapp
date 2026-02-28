"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const config = require('./config');
const webhookRoutes = require('./routes/webhook');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin'); // Rutas del panel
const reminderJob = require('./jobs/reminderJob');
const cors = require('cors');
const logger = require('./utils/logger').default;
const app = express();
// Middleware básico
app.use(cors()); // Habilita peticiones cruzadas para el Dashboard (React/Vue/Angular)
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
// Rutas
app.use('/', healthRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);
// Iniciar servidor
app.listen(config.PORT, () => {
    logger.info(`SERVIDOR REFACTORIZADO ACTIVO - Puerto: ${config.PORT}`);
    // Iniciar job de recordatorios
    reminderJob.start();
});
module.exports = app;
