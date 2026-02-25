const supabase = require('../config/database');
const conversationService = require('../services/conversationService');
const systemEvents = require('../utils/eventEmitter');

class AdminController {

    /**
     * Obtiene la lista de Leads (Inbox)
     * Filtros aplicables vía query: bot_active (1, 0), current_step, etc.
     */
    async getLeads(req, res) {
        try {
            let query = supabase.from('leads').select('*').order('updated_at', { ascending: false });

            if (req.query.bot_active !== undefined) {
                query = query.eq('bot_active', req.query.bot_active === 'true');
            }

            if (req.query.limit) {
                query = query.limit(parseInt(req.query.limit));
            }

            const { data, error } = await query;
            if (error) throw error;

            res.json({ status: 'success', data });
        } catch (error) {
            console.error("Dashboard Error (getLeads):", error.message);
            res.status(500).json({ status: 'error', message: 'Error obteniendo leads' });
        }
    }

    /**
     * Trae el contexto e historial del chat de un cliente dado
     */
    async getChatHistory(req, res) {
        try {
            const { phone } = req.params;
            const { data: leadData, error: leadError } = await supabase.from('leads').select('*').eq('phone', phone).single();
            const { data: chatData, error: chatError } = await supabase.from('chats').select('*').eq('phone', phone).single();

            res.json({
                status: 'success',
                data: {
                    lead: leadData || null,
                    history: chatData ? chatData.history : [],
                    last_interaction: chatData ? chatData.updated_at : null
                }
            });
        } catch (error) {
            console.error("Dashboard Error (getChatHistory):", error.message);
            res.status(500).json({ status: 'error', message: 'Error consultando historial' });
        }
    }

    /**
     * Método que permite al DashBoard humano responder y por lo tanto bloquear la IA automáticamente
     */
    async sendManualMessage(req, res) {
        try {
            const { phone, message } = req.body;
            if (!phone || !message) {
                return res.status(400).json({ status: 'error', message: 'phone y message son requeridos' });
            }

            const result = await conversationService.sendManualMessage(phone, message);
            res.json(result);
        } catch (error) {
            console.error("Dashboard Error (sendManualMessage):", error.message);
            res.status(500).json({ status: 'error', message: 'Error enviando mensaje manual' });
        }
    }

    /**
     * Alternar estado de la IA para un lead (El botón de reactivar IA)
     */
    async toggleBot(req, res) {
        try {
            const { phone } = req.params;
            const { active } = req.body;

            if (typeof active !== 'boolean') {
                return res.status(400).json({ status: 'error', message: '"active" boolean true/false requerido' });
            }

            const result = await conversationService.toggleBot(phone, active);
            res.json(result);
        } catch (error) {
            console.error("Dashboard Error (toggleBot):", error.message);
            res.status(500).json({ status: 'error', message: 'Fallo al cambiar estatus del bot' });
        }
    }

    /**
     * SSE Endpoint (Server-Sent Events para el Dashboard React/Vue)
     */
    streamEvents(req, res) {
        // Configura headers mandatorios de SSE Stream
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        res.write("data: {'message': 'Dashboard Sockets Connected'}\n\n"); // Conexión Inicial

        const alertListener = (payload) => {
            res.write(`event: notification\ndata: ${payload}\n\n`);
        };

        const leadListener = (data) => {
            res.write(`event: lead_updated\ndata: ${JSON.stringify(data)}\n\n`);
        };

        // Suscripción al Event_Emitter del backend Global
        systemEvents.on('human_required', alertListener);
        systemEvents.on('lead_updated', leadListener);

        // Si el frontend Web se desconecta, liberamos la RAM
        req.on('close', () => {
            systemEvents.removeListener('human_required', alertListener);
            systemEvents.removeListener('lead_updated', leadListener);
        });
    }
}

module.exports = new AdminController();
