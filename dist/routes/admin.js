"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
// Protege todas las rutas posteriores
router.use(adminAuth);
// Dashboard endpoints
router.get('/leads', adminController.getLeads); // Trae listas de perfiles
router.get('/chats/:phone', adminController.getChatHistory); // Trae info de un cliente en particular
router.post('/messages/send', adminController.sendManualMessage); // Para que el humano mande mensaje (apaga IA por detrás)
router.post('/leads/:phone/bot', adminController.toggleBot); // Reactivar o apagar el bot manualmente
router.post('/config/refresh', adminController.refreshConfig); // Invalida cache de IA/Agenda
router.post('/reset-all', adminController.resetData); // Danger Zone - Borrado total de leads/chats
router.get('/events', adminController.streamEvents); // Server-Sent Events (Notificaciones en Vivo)
module.exports = router;
