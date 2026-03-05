const supabase = require('../config/database');
const leadModel = require('../models/leadModel');
const conversationService = require('../services/conversationService');
const systemEvents = require('../utils/eventEmitter');
const logger = require('../utils/logger').default;

class AdminController {
  /**
   * Obtiene la lista de Leads (Inbox)
   * Filtros aplicables vía query: bot_active (1, 0), current_step, etc.
   */
  async getLeads(req, res) {
    try {
      let query = supabase.from('leads').select('*').order('last_customer_message_at', { ascending: false });

      if (req.query.bot_active !== undefined) {
        query = query.eq('bot_active', req.query.bot_active === 'true');
      }

      if (req.query.limit) {
        query = query.limit(parseInt(req.query.limit));
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json({ status: 'success', data });
    } catch (error: any) {
      logger.error('Dashboard Error (getLeads)', { error });
      res.status(500).json({ status: 'error', message: 'Error obteniendo leads' });
    }
  }

  /**
   * Trae el contexto e historial del chat de un cliente dado
   */
  async getChatHistory(req, res) {
    try {
      const { phone } = req.params;
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', phone)
        .single();
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('phone', phone)
        .single();

      res.json({
        status: 'success',
        data: {
          lead: leadData || null,
          history: chatData ? chatData.history : [],
          last_interaction: chatData ? chatData.updated_at : null,
        },
      });
    } catch (error: any) {
      logger.error('Dashboard Error (getChatHistory)', { error });
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
    } catch (error: any) {
      logger.error('Dashboard Error (sendManualMessage)', { error });
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
        return res
          .status(400)
          .json({ status: 'error', message: '"active" boolean true/false requerido' });
      }

      const result = await conversationService.toggleBot(phone, active);
      res.json(result);
    } catch (error: any) {
      logger.error('Dashboard Error (toggleBot)', { error });
      res.status(500).json({ status: 'error', message: 'Fallo al cambiar estatus del bot' });
    }
  }

  /**
   * Marca un lead como revisado (Limpia el circulo rojo de pendiente)
   */
  async markLeadAsReviewed(req, res) {
    try {
      const { phone } = req.params;
      const result = await leadModel.clearReviewPending(phone);

      // Notificar al Dashboard para que desaparezca el circulo en tiempo real
      systemEvents.emit('lead_updated', { phone, type: 'reviewed' });

      res.json({ status: 'success', data: result });
    } catch (error: any) {
      logger.error('Dashboard Error (markLeadAsReviewed)', { error });
      res.status(500).json({ status: 'error', message: 'Error marcando como revisado' });
    }
  }

  /**
   * Invalida el cache del servidor para que la IA lea la nueva config de Supabase
   */
  async refreshConfig(req, res) {
    try {
      const ConfigProvider = require('../core/config/ConfigProvider').default;
      await ConfigProvider.reload();
      res.json({ status: 'success', message: 'Configuración recargada exitosamente en RAM.' });
    } catch (error: any) {
      logger.error('Dashboard Error (refreshConfig)', { error });
      res.status(500).json({ status: 'error', message: 'Error recargando la configuración' });
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

  /**
   * Obtiene la lista de leads que necesitan re-engagement
   */
  async getColdLeads(req, res) {
    try {
      const data = await leadModel.getColdLeads();
      res.json({ status: 'success', data });
    } catch (error: any) {
      logger.error('Dashboard Error (getColdLeads)', { error });
      res.status(500).json({ status: 'error', message: 'Error obteniendo leads fríos' });
    }
  }

  /**
   * Genera un mensaje proactivo usando IA para un lead específico
   */
  async generateProactiveMessage(req, res) {
    try {
      const { phone } = req.params;
      const lead = await leadModel.getByPhone(phone);

      if (!lead) {
        return res.status(404).json({ status: 'error', message: 'Lead no encontrado' });
      }

      const aiService = require('../services/aiService');
      const hook = await aiService.generateProactiveHook(lead);

      res.json({ status: 'success', data: { hook } });
    } catch (error: any) {
      logger.error('Dashboard Error (generateProactiveMessage)', { error });
      res.status(500).json({ status: 'error', message: 'Error generando mensaje proactivo' });
    }
  }

  /**
   * Registra que se ha enviado un mensaje de re-engagement y actualiza la trazabilidad
   */
  async recordReengagement(req, res) {
    try {
      const { phone } = req.params;
      const lead = await leadModel.getByPhone(phone);

      if (!lead) {
        return res.status(404).json({ status: 'error', message: 'Lead no encontrado' });
      }

      const updates = {
        last_reengagement_at: new Date().toISOString(),
        reengagement_count: (lead.reengagement_count || 0) + 1,
        bot_active: false // Desactivamos el bot para que el humano siga la conversación
      };

      await leadModel.updateStatus(phone, updates);

      // Notificar al dashboard
      systemEvents.emit('lead_updated', { phone, type: 'reengagement_sent' });

      res.json({ status: 'success', message: 'Re-engagement registrado correctamente' });
    } catch (error: any) {
      logger.error('Dashboard Error (recordReengagement)', { error });
      res.status(500).json({ status: 'error', message: 'Error registrando re-engagement' });
    }
  }

  /**
   * Obtiene toda la data para el dashboard de Business Intelligence
   */
  async getAnalyticsData(req, res) {
    logger.info('[BI] Petición de analíticas recibida');
    const startTime = Date.now();
    try {
      const analyticsModel = require('../models/analyticsModel');

      const [globalStats, serviceDistribution, heatmapData, petDemographics, iaEfficiency] = await Promise.all([
        analyticsModel.getGlobalStats(),
        analyticsModel.getServiceDistribution(),
        analyticsModel.getHeatmapData(),
        analyticsModel.getPetDemographics(),
        analyticsModel.getIAEfficiency()
      ]);

      logger.info(`[BI] Analíticas generadas en ${Date.now() - startTime}ms`);
      res.json({
        status: 'success',
        data: {
          globalStats,
          serviceDistribution,
          heatmapData,
          petDemographics,
          iaEfficiency
        }
      });
    } catch (error: any) {
      logger.error('[BI] Error obteniendo datos analíticos:', { error: error.stack || error });
      res.status(500).json({ status: 'error', message: 'Error obteniendo datos analíticos' });
    }
  }

  /**
   * RESET TOTAL DE DATOS DE PRUEBA (Danger Zone)
   * Borra Leads, Chats, Citas y Memorias de IA.
   */
  async resetData(req, res) {
    try {
      logger.warn('INICIANDO RESET TOTAL DE DATOS SOLICITADO POR ADMIN');

      // Ejecutamos eliminaciones secuenciales para evitar bloqueos y problemas de FK
      logger.info('Borrando Appointments...');
      await supabase.from('appointments').delete().not('id', 'is', null);

      logger.info('Borrando User Memories...');
      await supabase.from('user_memories').delete().not('id', 'is', null);

      logger.info('Borrando Chats...');
      await supabase.from('chats').delete().not('phone', 'is', null);

      logger.info('Borrando Leads...');
      const { error: leadsError } = await supabase.from('leads').delete().not('id', 'is', null);

      if (leadsError) {
        logger.error('Error borrando LEADS:', leadsError);
        throw leadsError;
      }

      // IMPORTANTE: Refrescar el cache de la IA para que olvide los contextos borrados
      logger.info('Refrescando caché de IA post-reset');
      const ConfigProvider = require('../core/config/ConfigProvider').default;
      await ConfigProvider.reload();

      logger.info('Reset de datos completado exitosamente');
      res.json({ status: 'success', message: 'Sistema reseteado a cero (Leads, Chats, Citas y Memorias).' });
    } catch (error: any) {
      logger.error('Error CRÍTICO en ResetData:', error);
      res.status(500).json({ status: 'error', message: 'Error crítico al intentar resetear datos. Verifica los logs del servidor.' });
    }
  }
}

module.exports = new AdminController();
