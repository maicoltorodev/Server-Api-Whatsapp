const adminController = require('@/controllers/adminController');
const supabase = require('@/config/database');
const conversationService = require('@/services/conversationService');
const systemEvents = require('@/utils/eventEmitter');
const logger = require('@/utils/logger');
const ConfigProvider = require('@/core/config/ConfigProvider').default;

// Mockear todas las dependencias
jest.mock('@/config/database');
jest.mock('@/services/conversationService');
jest.mock('@/utils/eventEmitter');
jest.mock('@/utils/logger');
jest.mock('@/core/config/ConfigProvider');

describe('AdminController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock de req y res
    mockReq = {
      body: {},
      params: {},
      query: {},
      on: jest.fn()
    };
    
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      write: jest.fn()
    };

    // Configuración por defecto de mocks
    supabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        }),
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        }),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        }),
        not: jest.fn().mockReturnValue({
          delete: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      }),
      limit: jest.fn().mockResolvedValue({
        data: [],
        error: null
      })
    });

    conversationService.sendManualMessage = jest.fn().mockResolvedValue({
      status: 'success',
      message: 'Mensaje enviado'
    });

    conversationService.toggleBot = jest.fn().mockResolvedValue({
      status: 'success',
      message: 'Bot toggled'
    });

    ConfigProvider.reload = jest.fn().mockResolvedValue(true);

    // Mock de systemEvents
    systemEvents.on = jest.fn();
    systemEvents.removeListener = jest.fn();
  });

  describe('getLeads', () => {
    it('debería obtener leads exitosamente sin filtros', async () => {
      const mockLeads = [
        { id: 1, phone: '573001234567', name: 'Juan', bot_active: true },
        { id: 2, phone: '573001234568', name: 'Maria', bot_active: false }
      ];

      supabase.from().select().order().mockResolvedValue({
        data: mockLeads,
        error: null
      });

      await adminController.getLeads(mockReq, mockRes);

      expect(supabase.from).toHaveBeenCalledWith('leads');
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockLeads
      });
    });

    it('debería filtrar leads por bot_active=true', async () => {
      mockReq.query = { bot_active: 'true' };

      const mockLeads = [
        { id: 1, phone: '573001234567', name: 'Juan', bot_active: true }
      ];

      const mockQuery = {
        eq: jest.fn().mockResolvedValue({
          data: mockLeads,
          error: null
        })
      };

      supabase.from().select().order.mockReturnValue(mockQuery);

      await adminController.getLeads(mockReq, mockRes);

      expect(mockQuery.eq).toHaveBeenCalledWith('bot_active', true);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockLeads
      });
    });

    it('debería filtrar leads por bot_active=false', async () => {
      mockReq.query = { bot_active: 'false' };

      const mockLeads = [
        { id: 2, phone: '573001234568', name: 'Maria', bot_active: false }
      ];

      const mockQuery = {
        eq: jest.fn().mockResolvedValue({
          data: mockLeads,
          error: null
        })
      };

      supabase.from().select().order.mockReturnValue(mockQuery);

      await adminController.getLeads(mockReq, mockRes);

      expect(mockQuery.eq).toHaveBeenCalledWith('bot_active', false);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockLeads
      });
    });

    it('debería aplicar límite de resultados', async () => {
      mockReq.query = { limit: '5' };

      const mockLeads = [
        { id: 1, phone: '573001234567', name: 'Juan' }
      ];

      const mockQuery = {
        limit: jest.fn().mockResolvedValue({
          data: mockLeads,
          error: null
        })
      };

      supabase.from().select().order.mockReturnValue(mockQuery);

      await adminController.getLeads(mockReq, mockRes);

      expect(mockQuery.limit).toHaveBeenCalledWith(5);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockLeads
      });
    });

    it('debería combinar filtros de bot_active y limit', async () => {
      mockReq.query = { bot_active: 'true', limit: '3' };

      const mockLeads = [
        { id: 1, phone: '573001234567', name: 'Juan', bot_active: true }
      ];

      const mockEqQuery = {
        limit: jest.fn().mockResolvedValue({
          data: mockLeads,
          error: null
        })
      };

      const mockQuery = {
        eq: jest.fn().mockReturnValue(mockEqQuery)
      };

      supabase.from().select().order.mockReturnValue(mockQuery);

      await adminController.getLeads(mockReq, mockRes);

      expect(mockQuery.eq).toHaveBeenCalledWith('bot_active', true);
      expect(mockEqQuery.limit).toHaveBeenCalledWith(3);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockLeads
      });
    });

    it('debería manejar error de base de datos', async () => {
      const dbError = new Error('Database connection failed');
      
      supabase.from().select().order().mockResolvedValue({
        data: null,
        error: dbError
      });

      await adminController.getLeads(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Dashboard Error (getLeads)', { error: dbError });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error obteniendo leads'
      });
    });

    it('debería manejar error inesperado', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await adminController.getLeads(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Dashboard Error (getLeads)', { error: expect.any(Error) });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error obteniendo leads'
      });
    });
  });

  describe('getChatHistory', () => {
    it('debería obtener historial de chat exitosamente', async () => {
      mockReq.params = { phone: '573001234567' };

      const mockLeadData = {
        id: 1,
        phone: '573001234567',
        name: 'Juan',
        current_step: 'AGENDA'
      };

      const mockChatData = {
        phone: '573001234567',
        history: [
          { role: 'user', parts: [{ text: 'Hola' }] },
          { role: 'model', parts: [{ text: '¿En qué puedo ayudarte?' }] }
        ],
        updated_at: '2024-03-15T10:30:00Z'
      };

      // Mock para lead data
      const leadQuery = supabase.from().select().eq().single();
      leadQuery.mockResolvedValue({
        data: mockLeadData,
        error: null
      });

      // Mock para chat data
      const chatQuery = supabase.from().select().eq().single();
      chatQuery.mockResolvedValue({
        data: mockChatData,
        error: null
      });

      await adminController.getChatHistory(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          lead: mockLeadData,
          history: mockChatData.history,
          last_interaction: mockChatData.updated_at
        }
      });
    });

    it('debería manejar lead no encontrado', async () => {
      mockReq.params = { phone: '573001234567' };

      const leadQuery = supabase.from().select().eq().single();
      leadQuery.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      const chatQuery = supabase.from().select().eq().single();
      chatQuery.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      await adminController.getChatHistory(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          lead: null,
          history: [],
          last_interaction: null
        }
      });
    });

    it('debería manejar error en consulta de lead', async () => {
      mockReq.params = { phone: '573001234567' };

      const leadError = new Error('Lead query failed');
      const leadQuery = supabase.from().select().eq().single();
      leadQuery.mockResolvedValue({
        data: null,
        error: leadError
      });

      await adminController.getChatHistory(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Dashboard Error (getChatHistory)', { error: leadError });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error consultando historial'
      });
    });

    it('debería manejar error en consulta de chat', async () => {
      mockReq.params = { phone: '573001234567' };

      const leadQuery = supabase.from().select().eq().single();
      leadQuery.mockResolvedValue({
        data: { id: 1, phone: '573001234567' },
        error: null
      });

      const chatError = new Error('Chat query failed');
      const chatQuery = supabase.from().select().eq().single();
      chatQuery.mockResolvedValue({
        data: null,
        error: chatError
      });

      await adminController.getChatHistory(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Dashboard Error (getChatHistory)', { error: chatError });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error consultando historial'
      });
    });
  });

  describe('sendManualMessage', () => {
    it('debería enviar mensaje manual exitosamente', async () => {
      mockReq.body = {
        phone: '573001234567',
        message: 'Hola, soy un humano'
      };

      const result = {
        status: 'success',
        message: 'Mensaje enviado manualmente'
      };

      conversationService.sendManualMessage.mockResolvedValue(result);

      await adminController.sendManualMessage(mockReq, mockRes);

      expect(conversationService.sendManualMessage).toHaveBeenCalledWith('573001234567', 'Hola, soy un humano');
      expect(mockRes.json).toHaveBeenCalledWith(result);
    });

    it('debería rechazar solicitud sin phone', async () => {
      mockReq.body = {
        message: 'Hola, soy un humano'
      };

      await adminController.sendManualMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'phone y message son requeridos'
      });
      expect(conversationService.sendManualMessage).not.toHaveBeenCalled();
    });

    it('debería rechazar solicitud sin message', async () => {
      mockReq.body = {
        phone: '573001234567'
      };

      await adminController.sendManualMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'phone y message son requeridos'
      });
      expect(conversationService.sendManualMessage).not.toHaveBeenCalled();
    });

    it('debería rechazar solicitud con body vacío', async () => {
      mockReq.body = {};

      await adminController.sendManualMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'phone y message son requeridos'
      });
      expect(conversationService.sendManualMessage).not.toHaveBeenCalled();
    });

    it('debería manejar error en envío de mensaje', async () => {
      mockReq.body = {
        phone: '573001234567',
        message: 'Hola, soy un humano'
      };

      const error = new Error('Failed to send message');
      conversationService.sendManualMessage.mockRejectedValue(error);

      await adminController.sendManualMessage(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Dashboard Error (sendManualMessage)', { error });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error enviando mensaje manual'
      });
    });
  });

  describe('toggleBot', () => {
    it('debería activar bot exitosamente', async () => {
      mockReq.params = { phone: '573001234567' };
      mockReq.body = { active: true };

      const result = {
        status: 'success',
        message: 'Bot activado'
      };

      conversationService.toggleBot.mockResolvedValue(result);

      await adminController.toggleBot(mockReq, mockRes);

      expect(conversationService.toggleBot).toHaveBeenCalledWith('573001234567', true);
      expect(mockRes.json).toHaveBeenCalledWith(result);
    });

    it('debería desactivar bot exitosamente', async () => {
      mockReq.params = { phone: '573001234567' };
      mockReq.body = { active: false };

      const result = {
        status: 'success',
        message: 'Bot desactivado'
      };

      conversationService.toggleBot.mockResolvedValue(result);

      await adminController.toggleBot(mockReq, mockRes);

      expect(conversationService.toggleBot).toHaveBeenCalledWith('573001234567', false);
      expect(mockRes.json).toHaveBeenCalledWith(result);
    });

    it('debería rechazar active no booleano (string)', async () => {
      mockReq.params = { phone: '573001234567' };
      mockReq.body = { active: 'true' };

      await adminController.toggleBot(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: '"active" boolean true/false requerido'
      });
      expect(conversationService.toggleBot).not.toHaveBeenCalled();
    });

    it('debería rechazar active no booleano (number)', async () => {
      mockReq.params = { phone: '573001234567' };
      mockReq.body = { active: 1 };

      await adminController.toggleBot(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: '"active" boolean true/false requerido'
      });
      expect(conversationService.toggleBot).not.toHaveBeenCalled();
    });

    it('debería rechazar active no booleano (null)', async () => {
      mockReq.params = { phone: '573001234567' };
      mockReq.body = { active: null };

      await adminController.toggleBot(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: '"active" boolean true/false requerido'
      });
      expect(conversationService.toggleBot).not.toHaveBeenCalled();
    });

    it('debería manejar error en toggle bot', async () => {
      mockReq.params = { phone: '573001234567' };
      mockReq.body = { active: true };

      const error = new Error('Failed to toggle bot');
      conversationService.toggleBot.mockRejectedValue(error);

      await adminController.toggleBot(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Dashboard Error (toggleBot)', { error });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Fallo al cambiar estatus del bot'
      });
    });
  });

  describe('refreshConfig', () => {
    it('debería recargar configuración exitosamente', async () => {
      await adminController.refreshConfig(mockReq, mockRes);

      expect(ConfigProvider.reload).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Configuración recargada exitosamente en RAM.'
      });
    });

    it('debería manejar error en recarga de configuración', async () => {
      const error = new Error('Failed to reload config');
      ConfigProvider.reload.mockRejectedValue(error);

      await adminController.refreshConfig(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Dashboard Error (refreshConfig)', { error });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error recargando la configuración'
      });
    });
  });

  describe('streamEvents', () => {
    it('debería configurar headers SSE correctamente', () => {
      adminController.streamEvents(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockRes.write).toHaveBeenCalledWith("data: {'message': 'Dashboard Sockets Connected'}\n\n");
    });

    it('debería suscribirse a eventos del sistema', () => {
      adminController.streamEvents(mockReq, mockRes);

      expect(systemEvents.on).toHaveBeenCalledWith('human_required', expect.any(Function));
      expect(systemEvents.on).toHaveBeenCalledWith('lead_updated', expect.any(Function));
    });

    it('debería configurar cleanup en desconexión', () => {
      const mockCloseCallback = jest.fn();
      mockReq.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          mockCloseCallback.mockImplementation(callback);
        }
      });

      adminController.streamEvents(mockReq, mockRes);

      // Simular desconexión
      mockCloseCallback();

      expect(systemEvents.removeListener).toHaveBeenCalledWith('human_required', expect.any(Function));
      expect(systemEvents.removeListener).toHaveBeenCalledWith('lead_updated', expect.any(Function));
    });

    it('debería manejar eventos human_required', () => {
      let alertListener;
      systemEvents.on.mockImplementation((event, listener) => {
        if (event === 'human_required') {
          alertListener = listener;
        }
      });

      adminController.streamEvents(mockReq, mockRes);

      const payload = '{"type": "alert", "message": "Human required"}';
      alertListener(payload);

      expect(mockRes.write).toHaveBeenCalledWith(`event: notification\ndata: ${payload}\n\n`);
    });

    it('debería manejar eventos lead_updated', () => {
      let leadListener;
      systemEvents.on.mockImplementation((event, listener) => {
        if (event === 'lead_updated') {
          leadListener = listener;
        }
      });

      adminController.streamEvents(mockReq, mockRes);

      const data = { phone: '573001234567', status: 'updated' };
      leadListener(data);

      expect(mockRes.write).toHaveBeenCalledWith(`event: lead_updated\ndata: ${JSON.stringify(data)}\n\n`);
    });
  });

  describe('resetData', () => {
    it('debería resetear datos exitosamente', async () => {
      // Mock de las eliminaciones secuenciales
      const mockDeleteQuery = {
        not: jest.fn().mockReturnValue({
          delete: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      };

      supabase.from.mockReturnValue(mockDeleteQuery);

      await adminController.resetData(mockReq, mockRes);

      expect(logger.warn).toHaveBeenCalledWith('INICIANDO RESET TOTAL DE DATOS SOLICITADO POR ADMIN');
      expect(supabase.from).toHaveBeenCalledWith('appointments');
      expect(supabase.from).toHaveBeenCalledWith('user_memories');
      expect(supabase.from).toHaveBeenCalledWith('chats');
      expect(supabase.from).toHaveBeenCalledWith('leads');
      expect(ConfigProvider.reload).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Sistema reseteado a cero (Leads, Chats, Citas y Memorias).'
      });
    });

    it('debería manejar error en eliminación de leads', async () => {
      const mockDeleteQuery = {
        not: jest.fn().mockReturnValue({
          delete: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Failed to delete leads')
          })
        })
      };

      supabase.from.mockReturnValue(mockDeleteQuery);

      await adminController.resetData(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error borrando LEADS:', expect.any(Error));
      expect(logger.error).toHaveBeenCalledWith('Error CRÍTICO en ResetData:', expect.any(Error));
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error crítico al intentar resetear datos. Verifica los logs del servidor.'
      });
    });

    it('debería manejar error en ConfigProvider.reload', async () => {
      const mockDeleteQuery = {
        not: jest.fn().mockReturnValue({
          delete: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      };

      supabase.from.mockReturnValue(mockDeleteQuery);
      ConfigProvider.reload.mockRejectedValue(new Error('Failed to reload config'));

      await adminController.resetData(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error CRÍTICO en ResetData:', expect.any(Error));
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error crítico al intentar resetear datos. Verifica los logs del servidor.'
      });
    });

    it('debería manejar error inesperado durante reset', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected error during reset');
      });

      await adminController.resetData(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error CRÍTICO en ResetData:', expect.any(Error));
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error crítico al intentar resetear datos. Verifica los logs del servidor.'
      });
    });
  });

  describe('integración y edge cases', () => {
    it('debería manejar req.body undefined en sendManualMessage', async () => {
      mockReq.body = undefined;

      await adminController.sendManualMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'phone y message son requeridos'
      });
    });

    it('debería manejar req.params undefined en getChatHistory', async () => {
      mockReq.params = undefined;

      await adminController.getChatHistory(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Dashboard Error (getChatHistory)', { error: expect.any(Error) });
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('debería manejar req.params undefined en toggleBot', async () => {
      mockReq.params = undefined;
      mockReq.body = { active: true };

      await adminController.toggleBot(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Dashboard Error (toggleBot)', { error: expect.any(Error) });
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('debería manejar valores string en limit', async () => {
      mockReq.query = { limit: 'abc' }; // No es un número válido

      const mockQuery = {
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      };

      supabase.from().select().order.mockReturnValue(mockQuery);

      await adminController.getLeads(mockReq, mockRes);

      expect(mockQuery.limit).toHaveBeenCalledWith(NaN); // parseInt('abc') = NaN
    });

    it('debería manejar phone vacío en getChatHistory', async () => {
      mockReq.params = { phone: '' };

      const leadQuery = supabase.from().select().eq().single();
      leadQuery.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      await adminController.getChatHistory(mockReq, mockRes);

      expect(supabase.from).toHaveBeenCalledWith('leads');
    });

    it('debería manejar mensaje vacío en sendManualMessage', async () => {
      mockReq.body = {
        phone: '573001234567',
        message: ''
      };

      await adminController.sendManualMessage(mockReq, mockRes);

      expect(conversationService.sendManualMessage).toHaveBeenCalledWith('573001234567', '');
    });
  });
});
