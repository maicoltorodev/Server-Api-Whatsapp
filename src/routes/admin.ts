import express from 'express';
import adminController from '../controllers/adminController';
import adminAuth from '../middleware/adminAuth';

const router = express.Router();

// Protege todas las rutas posteriores
router.use(adminAuth);

// Dashboard endpoints
router.get('/leads', adminController.getLeads); // Trae listas de perfiles
router.get('/chats/:phone', adminController.getChatHistory); // Trae info de un cliente en particular
router.post('/messages/send', adminController.sendManualMessage); // Para que el humano mande mensaje (apaga IA por detrás)
router.post('/leads/:phone/bot', adminController.toggleBot); // Reactivar o apagar el bot manualmente
router.post('/leads/:phone/reviewed', (req, res) => adminController.markLeadAsReviewed(req, res)); // Limpiar alerta de pendiente
router.get('/analytics', (req, res) => adminController.getAnalyticsData(req, res));
router.get('/leads/cold', (req, res) => adminController.getColdLeads(req, res));
router.get('/leads/:phone/hook', (req, res) => adminController.generateProactiveMessage(req, res));
router.post('/leads/:phone/reengage', (req, res) => adminController.recordReengagement(req, res));
router.post('/config/refresh', adminController.refreshConfig); // Invalida cache de IA/Agenda
router.post('/reset-all', adminController.resetData); // Danger Zone - Borrado total de leads/chats
router.get('/events', adminController.streamEvents); // Server-Sent Events (Notificaciones en Vivo)

export default router;

