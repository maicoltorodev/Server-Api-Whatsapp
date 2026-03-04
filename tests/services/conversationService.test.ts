const conversationService = require('@/services/conversationService');
const leadModel = require('@/models/leadModel');
const chatModel = require('@/models/chatModel');
const aiService = require('@/services/aiService');
const whatsappService = require('@/services/whatsappService');
const notificationService = require('@/services/notificationService');
const systemEvents = require('@/utils/eventEmitter');
const logger = require('@/utils/logger').default;

// Mockear todas las dependencias
jest.mock('@/models/leadModel');
jest.mock('@/models/chatModel');
jest.mock('@/services/aiService');
jest.mock('@/services/whatsappService');
jest.mock('@/services/notificationService');
jest.mock('@/utils/eventEmitter');
jest.mock('@/utils/logger');

describe('ConversationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleIncomingMessage', () => {
    it('debería crear un nuevo lead si no existe', async () => {
      const phone = '573001234567';
      const message = 'Hola, quiero información';
      
      leadModel.getByPhone.mockResolvedValue(null);
      leadModel.upsert.mockResolvedValue({
        phone,
        name: 'Nuevo Cliente',
        bot_active: true
      });
      chatModel.addMessage.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});
      
      const result = await conversationService.handleIncomingMessage(phone, message);

      expect(leadModel.getByPhone).toHaveBeenCalledWith(phone);
      expect(leadModel.upsert).toHaveBeenCalledWith({
        phone,
        name: 'Nuevo Cliente',
        bot_active: true
      });
      expect(chatModel.addMessage).toHaveBeenCalledWith(phone, {
        role: 'user',
        parts: [{ text: message }]
      });
      expect(systemEvents.emit).toHaveBeenCalledWith('lead_updated', {
        phone,
        type: 'new_message'
      });
    });

    it('debería usar lead existente si ya está registrado', async () => {
      const phone = '573001234567';
      const message = '¿Cuáles son sus servicios?';
      const existingLead = {
        phone,
        name: 'Juan Pérez',
        bot_active: true,
        current_step: 'inquiry'
      };

      leadModel.getByPhone.mockResolvedValue(existingLead);
      chatModel.addMessage.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});
      
      const result = await conversationService.handleIncomingMessage(phone, message);

      expect(leadModel.getByPhone).toHaveBeenCalledWith(phone);
      expect(leadModel.upsert).not.toHaveBeenCalled();
      expect(chatModel.addMessage).toHaveBeenCalledWith(phone, {
        role: 'user',
        parts: [{ text: message }]
      });
    });

    it('debería manejar intervención humana si el bot está inactivo', async () => {
      const phone = '573001234567';
      const message = 'Necesito ayuda';
      const inactiveLead = {
        phone,
        name: 'María García',
        bot_active: false,
        current_step: 'pending'
      };

      leadModel.getByPhone.mockResolvedValue(inactiveLead);
      chatModel.addMessage.mockResolvedValue();
      notificationService.notifyHumanRequired.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});

      const result = await conversationService.handleIncomingMessage(phone, message);

      expect(result).toEqual({ status: 'human_control' });
      expect(notificationService.notifyHumanRequired).toHaveBeenCalledWith(
        phone,
        'María García',
        message
      );
    });

    it('debería procesar con IA si el bot está activo', async () => {
      const phone = '573001234567';
      const message = 'Quiero agendar una cita';
      const activeLead = {
        phone,
        name: 'Carlos López',
        bot_active: true,
        current_step: 'booking'
      };

      leadModel.getByPhone.mockResolvedValue(activeLead);
      chatModel.addMessage.mockResolvedValue();
      chatModel.getHistory.mockResolvedValue([]);
      systemEvents.emit.mockImplementation(() => {});

      // Mock de respuestas de IA
      const mockModel = { chatSession: { getHistory: jest.fn().mockResolvedValue([]) } };
      const mockAIResponse = {
        functionCalls: null,
        text: 'Claro, puedo ayudarte a agendar una cita.',
        chatSession: mockModel.chatSession
      };

      aiService.prepareContext.mockResolvedValue(mockModel);
      aiService.generateResponse.mockResolvedValue(mockAIResponse);
      whatsappService.sendMessage.mockResolvedValue();
      chatModel.saveHistory.mockResolvedValue();

      const result = await conversationService.handleIncomingMessage(phone, message);

      expect(result).toEqual({
        status: 'ai_responded',
        text: 'Claro, puedo ayudarte a agendar una cita.'
      });
      expect(aiService.prepareContext).toHaveBeenCalledWith(activeLead);
      expect(aiService.generateResponse).toHaveBeenCalledWith(mockModel, message, []);
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(phone, mockAIResponse.text);
    });

    it('debería manejar function calls de la IA', async () => {
      const phone = '573001234567';
      const message = '¿Qué servicios ofrecen?';
      const activeLead = {
        phone,
        name: 'Ana Martínez',
        bot_active: true,
        current_step: 'services'
      };

      leadModel.getByPhone.mockResolvedValue(activeLead);
      chatModel.addMessage.mockResolvedValue();
      chatModel.getHistory.mockResolvedValue([]);
      systemEvents.emit.mockImplementation(() => {});

      const mockModel = { chatSession: { getHistory: jest.fn().mockResolvedValue([]) } };
      const mockFunctionCall = { name: 'getServices', args: {} };
      const mockAIResponse = {
        functionCalls: [mockFunctionCall],
        text: '',
        chatSession: mockModel.chatSession
      };

      const mockToolResult = {
        text: 'Ofrecemos grooming, veterinaria y hotel para mascotas.'
      };

      aiService.prepareContext.mockResolvedValue(mockModel);
      aiService.generateResponse.mockResolvedValue(mockAIResponse);
      aiService.processFunctionCalls.mockResolvedValue(mockToolResult);
      whatsappService.sendMessage.mockResolvedValue();
      chatModel.saveHistory.mockResolvedValue();

      const result = await conversationService.handleIncomingMessage(phone, message);

      expect(result).toEqual({
        status: 'ai_responded',
        text: 'Ofrecemos grooming, veterinaria y hotel para mascotas.'
      });
      expect(aiService.processFunctionCalls).toHaveBeenCalledWith(
        [mockFunctionCall],
        mockModel.chatSession,
        phone
      );
    });

    it('debería usar respuesta por defecto si la IA no devuelve texto', async () => {
      const phone = '573001234567';
      const message = 'Hola';
      const activeLead = {
        phone,
        name: 'Pedro Sánchez',
        bot_active: true,
        current_step: 'greeting'
      };

      leadModel.getByPhone.mockResolvedValue(activeLead);
      chatModel.addMessage.mockResolvedValue();
      chatModel.getHistory.mockResolvedValue([]);
      systemEvents.emit.mockImplementation(() => {});

      const mockModel = { chatSession: { getHistory: jest.fn().mockResolvedValue([]) } };
      const mockAIResponse = {
        functionCalls: null,
        text: '',
        chatSession: mockModel.chatSession
      };

      aiService.prepareContext.mockResolvedValue(mockModel);
      aiService.generateResponse.mockResolvedValue(mockAIResponse);
      whatsappService.sendMessage.mockResolvedValue();
      chatModel.saveHistory.mockResolvedValue();

      const result = await conversationService.handleIncomingMessage(phone, message);

      expect(result.text).toBe('¡Entendido! ¿En qué más puedo ayudarte con tu mascota? 🐾');
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(phone, result.text);
    });

    it('debería manejar errores en el flujo de IA', async () => {
      const phone = '573001234567';
      const message = 'Error test';
      const activeLead = {
        phone,
        name: 'Laura Torres',
        bot_active: true,
        current_step: 'error'
      };

      leadModel.getByPhone.mockResolvedValue(activeLead);
      chatModel.addMessage.mockResolvedValue();
      chatModel.getHistory.mockResolvedValue([]);
      systemEvents.emit.mockImplementation(() => {});

      const error = new Error('API Error');
      aiService.prepareContext.mockRejectedValue(error);
      whatsappService.sendMessage.mockResolvedValue();

      const result = await conversationService.handleIncomingMessage(phone, message);

      expect(result).toEqual({
        status: 'error',
        error: 'API Error'
      });
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        phone,
        'Disculpa, tuve un pequeño problema técnico. ¿Podrías repetirme eso?'
      );
    });
  });

  describe('handleHumanIntervention', () => {
    it('debería notificar al humano y retornar estado correcto', async () => {
      const phone = '573001234567';
      const message = 'Necesito ayuda urgente';
      const leadData = {
        phone,
        name: 'Roberto Díaz',
        bot_active: false,
        current_step: 'urgent'
      };

      notificationService.notifyHumanRequired.mockResolvedValue();

      const result = await conversationService.handleHumanIntervention(phone, leadData, message);

      expect(result).toEqual({ status: 'human_control' });
      expect(notificationService.notifyHumanRequired).toHaveBeenCalledWith(
        phone,
        'Roberto Díaz',
        message
      );
    });

    it('debería usar nombre por defecto si el lead no tiene nombre', async () => {
      const phone = '573001234567';
      const message = 'Ayuda';
      const leadData = {
        phone,
        name: null,
        bot_active: false,
        current_step: 'help'
      };

      notificationService.notifyHumanRequired.mockResolvedValue();

      const result = await conversationService.handleHumanIntervention(phone, leadData, message);

      expect(notificationService.notifyHumanRequired).toHaveBeenCalledWith(
        phone,
        'Cliente',
        message
      );
    });
  });

  describe('processWithAI', () => {
    it('debería procesar correctamente el flujo completo de IA', async () => {
      const phone = '573001234567';
      const message = '¿Cuál es el precio del grooming?';
      const leadData = {
        phone,
        name: 'Sofía Ramírez',
        bot_active: true,
        current_step: 'pricing'
      };

      const mockModel = { chatSession: { getHistory: jest.fn().mockResolvedValue([]) } };
      const mockAIResponse = {
        functionCalls: null,
        text: 'El grooming para perros pequeños es $25,000.',
        chatSession: mockModel.chatSession
      };

      aiService.prepareContext.mockResolvedValue(mockModel);
      chatModel.getHistory.mockResolvedValue([]);
      aiService.generateResponse.mockResolvedValue(mockAIResponse);
      whatsappService.sendMessage.mockResolvedValue();
      chatModel.saveHistory.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});

      const result = await conversationService.processWithAI(phone, message, leadData);

      expect(result).toEqual({
        status: 'ai_responded',
        text: 'El grooming para perros pequeños es $25,000.'
      });

      expect(aiService.prepareContext).toHaveBeenCalledWith(leadData);
      expect(chatModel.getHistory).toHaveBeenCalledWith(phone);
      expect(aiService.generateResponse).toHaveBeenCalledWith(mockModel, message, []);
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(phone, mockAIResponse.text);
      expect(chatModel.saveHistory).toHaveBeenCalledWith(phone, expect.any(Array));
      expect(systemEvents.emit).toHaveBeenCalledWith('lead_updated', {
        phone,
        type: 'ai_response'
      });
    });

    it('debería manejar function calls correctamente', async () => {
      const phone = '573001234567';
      const message = 'Quiero ver los servicios disponibles';
      const leadData = {
        phone,
        name: 'Diego Herrera',
        bot_active: true,
        current_step: 'services'
      };

      const mockModel = { chatSession: { getHistory: jest.fn().mockResolvedValue([]) } };
      const mockFunctionCall = { name: 'getServices', args: {} };
      const mockAIResponse = {
        functionCalls: [mockFunctionCall],
        text: '',
        chatSession: mockModel.chatSession
      };

      const mockToolResult = {
        text: 'Ofrecemos: grooming, veterinaria, hotel y tienda.'
      };

      aiService.prepareContext.mockResolvedValue(mockModel);
      chatModel.getHistory.mockResolvedValue([]);
      aiService.generateResponse.mockResolvedValue(mockAIResponse);
      aiService.processFunctionCalls.mockResolvedValue(mockToolResult);
      whatsappService.sendMessage.mockResolvedValue();
      chatModel.saveHistory.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});

      const result = await conversationService.processWithAI(phone, message, leadData);

      expect(result.text).toBe('Ofrecemos: grooming, veterinaria, hotel y tienda.');
      expect(aiService.processFunctionCalls).toHaveBeenCalledWith(
        [mockFunctionCall],
        mockModel.chatSession,
        phone
      );
    });

    it('debería manejar errores y enviar mensaje de error', async () => {
      const phone = '573001234567';
      const message = 'Test error';
      const leadData = {
        phone,
        name: 'Valentina Castro',
        bot_active: true,
        current_step: 'error'
      };

      const error = new Error('Network error');
      aiService.prepareContext.mockRejectedValue(error);
      whatsappService.sendMessage.mockResolvedValue();

      const result = await conversationService.processWithAI(phone, message, leadData);

      expect(result).toEqual({
        status: 'error',
        error: 'Network error'
      });
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        phone,
        'Disculpa, tuve un pequeño problema técnico. ¿Podrías repetirme eso?'
      );
    });
  });

  describe('sendManualMessage', () => {
    it('debería desactivar el bot y enviar mensaje manual', async () => {
      const phone = '573001234567';
      const message = 'Hola, soy el veterinario. ¿En qué puedo ayudarte?';

      leadModel.deactivateBot.mockResolvedValue();
      whatsappService.sendMessage.mockResolvedValue();
      chatModel.addMessage.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});

      const result = await conversationService.sendManualMessage(phone, message);

      expect(result).toEqual({
        status: 'success',
        bot_deactivated: true
      });

      expect(leadModel.deactivateBot).toHaveBeenCalledWith(phone);
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(phone, message);
      expect(chatModel.addMessage).toHaveBeenCalledWith(phone, {
        role: 'model',
        parts: [{
          text: `[NOTA DEL SISTEMA: UN AGENTE HUMANO INTERVINO Y LE ENVIÓ EL SIGUIENTE MENSAJE AL CLIENTE]: "${message}"`
        }]
      });
      expect(systemEvents.emit).toHaveBeenCalledWith('lead_updated', {
        phone,
        type: 'manual_message',
        bot_active: false
      });
    });
  });

  describe('toggleBot', () => {
    it('debería activar el bot y enviar mensaje de confirmación', async () => {
      const phone = '573001234567';

      leadModel.activateBot.mockResolvedValue();
      whatsappService.sendMessage.mockResolvedValue();
      chatModel.addMessage.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});

      const result = await conversationService.toggleBot(phone, true);

      expect(result).toEqual({
        status: 'success',
        bot_active: true
      });

      expect(leadModel.activateBot).toHaveBeenCalledWith(phone);
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        phone,
        '¡Listo! El asistente virtual está de nuevo a tu disposición. 🤖'
      );
      expect(chatModel.addMessage).toHaveBeenCalledWith(phone, {
        role: 'model',
        parts: [{
          text: '[NOTA DEL SISTEMA: SE REACTIVÓ A LA IA. EL SISTEMA ENVIÓ ESTE MENSAJE]: "¡Listo! El asistente virtual está de nuevo a tu disposición. 🤖"'
        }]
      });
      expect(systemEvents.emit).toHaveBeenCalledWith('lead_updated', {
        phone,
        type: 'bot_toggle',
        bot_active: true
      });
    });

    it('debería desactivar el bot sin enviar mensaje', async () => {
      const phone = '573001234567';

      leadModel.deactivateBot.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});

      const result = await conversationService.toggleBot(phone, false);

      expect(result).toEqual({
        status: 'success',
        bot_active: false
      });

      expect(leadModel.deactivateBot).toHaveBeenCalledWith(phone);
      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
      expect(systemEvents.emit).toHaveBeenCalledWith('lead_updated', {
        phone,
        type: 'bot_toggle',
        bot_active: false
      });
    });
  });

  describe('edge cases y validación', () => {
    it('debería manejar leads con datos incompletos', async () => {
      const phone = '573001234567';
      const message = 'Test';
      const incompleteLead = {
        phone,
        name: undefined,
        bot_active: true,
        current_step: undefined
      };

      leadModel.getByPhone.mockResolvedValue(incompleteLead);
      chatModel.addMessage.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});

      const mockModel = { chatSession: { getHistory: jest.fn().mockResolvedValue([]) } };
      const mockAIResponse = {
        functionCalls: null,
        text: 'Respuesta para lead incompleto',
        chatSession: mockModel.chatSession
      };

      aiService.prepareContext.mockResolvedValue(mockModel);
      chatModel.getHistory.mockResolvedValue([]);
      aiService.generateResponse.mockResolvedValue(mockAIResponse);
      whatsappService.sendMessage.mockResolvedValue();
      chatModel.saveHistory.mockResolvedValue();

      const result = await conversationService.handleIncomingMessage(phone, message);

      expect(result.status).toBe('ai_responded');
      expect(result.text).toBe('Respuesta para lead incompleto');
    });

    it('debería manejar mensajes vacíos', async () => {
      const phone = '573001234567';
      const message = '';
      const activeLead = {
        phone,
        name: 'Test User',
        bot_active: true,
        current_step: 'test'
      };

      leadModel.getByPhone.mockResolvedValue(activeLead);
      chatModel.addMessage.mockResolvedValue();
      systemEvents.emit.mockImplementation(() => {});

      const mockModel = { chatSession: { getHistory: jest.fn().mockResolvedValue([]) } };
      const mockAIResponse = {
        functionCalls: null,
        text: 'Mensaje vacío recibido',
        chatSession: mockModel.chatSession
      };

      aiService.prepareContext.mockResolvedValue(mockModel);
      chatModel.getHistory.mockResolvedValue([]);
      aiService.generateResponse.mockResolvedValue(mockAIResponse);
      whatsappService.sendMessage.mockResolvedValue();
      chatModel.saveHistory.mockResolvedValue();

      const result = await conversationService.handleIncomingMessage(phone, message);

      expect(result.status).toBe('ai_responded');
      expect(chatModel.addMessage).toHaveBeenCalledWith(phone, {
        role: 'user',
        parts: [{ text: message }]
      });
    });

    it('debería manejar errores de base de datos', async () => {
      const phone = '573001234567';
      const message = 'Test DB error';
      const dbError = new Error('Database connection failed');

      leadModel.getByPhone.mockRejectedValue(dbError);

      await expect(conversationService.handleIncomingMessage(phone, message)).rejects.toThrow(dbError);
    });
  });
});
