"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webhookController_1 = __importDefault(require("../controllers/webhookController"));
const verifyMetaSignature_1 = __importDefault(require("../middleware/verifyMetaSignature"));
const router = express_1.default.Router();
// Middleware para capturar el body raw (necesario para la verificación de firma)
router.use(express_1.default.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    },
}));
// Ruta de verificación del webhook (GET)
router.get('/', (req, res) => webhookController_1.default.verifyWebhook(req, res));
// Ruta principal del webhook (POST) con verificación de firma
router.post('/', verifyMetaSignature_1.default, (req, res) => webhookController_1.default.handleWebhook(req, res));
exports.default = router;
