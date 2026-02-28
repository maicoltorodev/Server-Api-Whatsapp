"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = require('../config');
// Middleware para validar el acceso al Dashboard Administrativo
function adminAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey || apiKey !== config.ADMIN_API_KEY) {
        return res.status(401).json({
            status: 'error',
            message: 'No autorizado. Se requiere un API_KEY válido de Administrador.',
        });
    }
    next();
}
module.exports = adminAuth;
