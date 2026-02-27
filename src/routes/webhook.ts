const express = require('express');
const webhookController = require('../controllers/webhookController');
const verifyMetaSignature = require('../middleware/verifyMetaSignature');

const router = express.Router();

// Middleware para capturar el body raw (necesario para la verificación de firma)
router.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Ruta de verificación del webhook (GET)
router.get('/', (req, res) => webhookController.verifyWebhook(req, res));

// Ruta principal del webhook (POST) con verificación de firma
router.post('/', verifyMetaSignature, (req, res) => webhookController.handleWebhook(req, res));

module.exports = router;
