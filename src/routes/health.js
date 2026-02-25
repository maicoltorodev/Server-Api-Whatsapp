const express = require('express');
const healthController = require('../controllers/healthController');

const router = express.Router();

// Endpoint básico de salud
router.get('/', (req, res) => healthController.checkHealth(req, res));

// Endpoint detallado de salud
router.get('/detailed', (req, res) => healthController.checkDetailedHealth(req, res));

module.exports = router;
