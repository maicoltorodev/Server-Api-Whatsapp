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
router.post('/leads/:phone/reviewed', adminAuth, (req, res) => adminController.markLeadAsReviewed(req, res)); // Limpiar alerta de pendiente
router.get('/analytics', adminAuth, (req, res) => adminController.getAnalyticsData(req, res));
router.get('/leads/cold', adminAuth, (req, res) => adminController.getColdLeads(req, res));
router.get('/leads/:phone/hook', adminAuth, (req, res) => adminController.generateProactiveMessage(req, res));
router.post('/leads/:phone/reengage', adminAuth, (req, res) => adminController.recordReengagement(req, res));
router.post('/config/refresh', adminController.refreshConfig); // Invalida cache de IA/Agenda
router.post('/reset-all', adminController.resetData); // Danger Zone - Borrado total de leads/chats
router.get('/events', adminController.streamEvents); // Server-Sent Events (Notificaciones en Vivo)

module.exports = router;
