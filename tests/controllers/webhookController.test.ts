const webhookController = require('@/controllers/webhookController');
const whatsappService = require('@/services/whatsappService');
const conversationService = require('@/services/conversationService');
const leadModel = require('@/models/leadModel');
const notificationService = require('@/services/notificationService');
const rateLimiter = require('@/middleware/rateLimit');
const config = require('@/config');
const messageQueue = require('@/utils/messageQueue');
const logger = require('@/utils/logger');

// Mockear todas las dependencias
jest.mock('@/services/whatsappService');
jest.mock('@/services/conversationService');
jest.mock('@/models/leadModel');
jest.mock('@/services/notificationService');
jest.mock('@/middleware/rateLimit');
jest.mock('@/config');
jest.mock('@/utils/messageQueue');
jest.mock('@/utils/logger');

describe('WebhookController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock de req y res
    mockReq = {
      body: {},
      query: {}
    };
    
    mockRes = {
      sendStatus: jest.fn(),
      send: jest.fn()
    };

    // Configuración por defecto de mocks
    config.VERIFY_TOKEN = 'test_verify_token';
    config.RATE_LIMIT = {
      MAX_MESSAGES: 5
    };

    rateLimiter.isMessageProcessed = jest.fn().mockReturnValue(false);
    rateLimiter.isUserSpamming = jest.fn().mockReturnValue(false);
    rateLimiter.userMessageCount = new Map();

    whatsappService.extractMessageFromWebhook = jest.fn();
    whatsappService.markAsRead = jest.fn().mockResolvedValue(true);
    whatsappService.sendMessage = jest.fn().mockResolvedValue(true);

    messageQueue.enqueueMessage = jest.fn();

    notificationService.notifyOwner = jest.fn().mockResolvedValue(true);
    notificationService.notifyCriticalError = jest.fn().mockResolvedValue(true);

    leadModel.deactivateBot = jest.fn().mockResolvedValue(true);
  });

  describe('handleWebhook', () => {
    it('debería responder 200 inmediatamente', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'Hola' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
    });

    it('debería procesar mensaje de texto válido', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'Hola, quiero información' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: 'Hola, quiero información',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.info).toHaveBeenCalledWith('--- 📥 NUEVO WEBHOOK DE WHATSAPP ---');
      expect(whatsappService.extractMessageFromWebhook).toHaveBeenCalledWith(validWebhook);
      expect(whatsappService.markAsRead).toHaveBeenCalledWith('msg_123');
      expect(messageQueue.enqueueMessage).toHaveBeenCalledWith('573001234567', 'Hola, quiero información');
    });

    it('debería ignorar webhook sin mensaje procesable', async () => {
      const webhookWithoutMessage = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              statuses: [{ status: 'read' }] // Estado, no mensaje
            }
          }]
        }]
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(null);

      mockReq.body = webhookWithoutMessage;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.info).toHaveBeenCalledWith('Webhook sin mensaje procesable (bloque de estado o lectura).');
      expect(whatsappService.markAsRead).not.toHaveBeenCalled();
      expect(messageQueue.enqueueMessage).not.toHaveBeenCalled();
    });

    it('debería ignorar mensajes duplicados', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'Hola' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: 'Hola',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);
      rateLimiter.isMessageProcessed.mockReturnValue(true);

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.warn).toHaveBeenCalledWith('Mensaje duplicado detectado (ID: msg_123). Ignorando.');
      expect(whatsappService.markAsRead).not.toHaveBeenCalled();
      expect(messageQueue.enqueueMessage).not.toHaveBeenCalled();
    });

    it('debería manejar mensajes no textuales', async () => {
      const webhookWithImage = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                type: 'image'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: null,
        isText: false
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);

      mockReq.body = webhookWithImage;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.warn).toHaveBeenCalledWith('Contenido no es texto. Enviando mensaje de aviso.');
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        '573001234567',
        '¡Hola! 🐾 Por ahora solo puedo procesar mensajes de texto. Si necesitas enviar fotos o audios, pide hablar con un humano.'
      );
      expect(messageQueue.enqueueMessage).not.toHaveBeenCalled();
    });

    it('debería manejar spam y desactivar bot en primer exceso', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'spam message' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: 'spam message',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);
      rateLimiter.isUserSpamming.mockReturnValue(true);
      
      // Simular que es el primer mensaje que excede el límite
      rateLimiter.userMessageCount.set('573001234567', [1, 2, 3, 4, 5, 6]); // 6 mensajes (límite 5 + 1)

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.warn).toHaveBeenCalledWith('SPAM DETECTADO: 573001234567.');
      expect(leadModel.deactivateBot).toHaveBeenCalledWith('573001234567');
      expect(notificationService.notifyOwner).toHaveBeenCalledWith(
        '573001234567',
        'Alerta Sistema',
        '🚨 IA desactivada automáticamente por spam detectado.'
      );
      expect(logger.warn).toHaveBeenCalledWith('IA Desactivada preventivamente por spam.');
      expect(messageQueue.enqueueMessage).not.toHaveBeenCalled();
    });

    it('debería manejar spam sin desactivar si no es primer exceso', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'spam message' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: 'spam message',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);
      rateLimiter.isUserSpamming.mockReturnValue(true);
      
      // Simular que ya excedió el límite anteriormente
      rateLimiter.userMessageCount.set('573001234567', [1, 2, 3, 4, 5, 6, 7]); // 7 mensajes

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.warn).toHaveBeenCalledWith('SPAM DETECTADO: 573001234567.');
      expect(leadModel.deactivateBot).not.toHaveBeenCalled();
      expect(notificationService.notifyOwner).not.toHaveBeenCalled();
      expect(messageQueue.enqueueMessage).not.toHaveBeenCalled();
    });

    it('debería manejar errores críticos y notificar', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'Hola' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const error = new Error('Critical error');
      whatsappService.extractMessageFromWebhook.mockImplementation(() => {
        throw error;
      });

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error crítico en WebhookController', { error });
      expect(notificationService.notifyCriticalError).toHaveBeenCalledWith('573001234567', 'Critical error');
    });

    it('debería manejar errores en la notificación de errores críticos', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'Hola' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const error = new Error('Critical error');
      const innerError = new Error('Notification failed');
      
      whatsappService.extractMessageFromWebhook.mockImplementation(() => {
        throw error;
      });
      notificationService.notifyCriticalError.mockRejectedValue(innerError);

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error crítico en WebhookController', { error });
      expect(logger.error).toHaveBeenCalledWith('No se pudo notificar la falla', { error: innerError });
    });

    it('debería manejar webhook sin número de teléfono en error crítico', async () => {
      const webhookWithoutPhone = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              // Sin mensajes
            }
          }]
        }]
      };

      const error = new Error('Critical error');
      whatsappService.extractMessageFromWebhook.mockImplementation(() => {
        throw error;
      });

      mockReq.body = webhookWithoutPhone;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error crítico en WebhookController', { error });
      expect(notificationService.notifyCriticalError).not.toHaveBeenCalled();
    });

    it('debería procesar múltiples cambios en el webhook', async () => {
      const webhookWithMultipleChanges = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'entry_1',
          changes: [
            {
              value: {
                messages: [{
                  from: '573001234567',
                  id: 'msg_123',
                  text: { body: 'Hola' },
                  type: 'text'
                }]
              }
            },
            {
              value: {
                statuses: [{ status: 'read' }]
              }
            }
          ]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: 'Hola',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);

      mockReq.body = webhookWithMultipleChanges;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(whatsappService.extractMessageFromWebhook).toHaveBeenCalledWith(webhookWithMultipleChanges);
      expect(messageQueue.enqueueMessage).toHaveBeenCalledWith('573001234567', 'Hola');
    });

    it('debería manejar mensaje de texto vacío', async () => {
      const webhookWithEmptyText = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: '' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: '',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);

      mockReq.body = webhookWithEmptyText;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.info).toHaveBeenCalledWith('Texto recibido: ""');
      expect(messageQueue.enqueueMessage).toHaveBeenCalledWith('573001234567', '');
    });

    it('debería manejar fallo al marcar mensaje como leído', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'Hola' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: 'Hola',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);
      whatsappService.markAsRead.mockRejectedValue(new Error('Failed to mark as read'));

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(whatsappService.markAsRead).toHaveBeenCalledWith('msg_123');
      expect(logger.error).toHaveBeenCalledWith('Error crítico en WebhookController', { error: expect.any(Error) });
    });
  });

  describe('handleCriticalError', () => {
    it('debería notificar error crítico con número de teléfono', async () => {
      const body = {
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567'
              }]
            }
          }]
        }]
      };

      const error = new Error('Test error');

      await webhookController.handleCriticalError(body, error);

      expect(notificationService.notifyCriticalError).toHaveBeenCalledWith('573001234567', 'Test error');
    });

    it('debería manejar body sin estructura de mensaje', async () => {
      const body = {};
      const error = new Error('Test error');

      await webhookController.handleCriticalError(body, error);

      expect(notificationService.notifyCriticalError).not.toHaveBeenCalled();
    });

    it('debería manejar error en notificación crítica', async () => {
      const body = {
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567'
              }]
            }
          }]
        }]
      };

      const error = new Error('Test error');
      const notificationError = new Error('Notification failed');
      
      notificationService.notifyCriticalError.mockRejectedValue(notificationError);

      await webhookController.handleCriticalError(body, error);

      expect(logger.error).toHaveBeenCalledWith('No se pudo notificar la falla', { error: notificationError });
    });
  });

  describe('verifyWebhook', () => {
    it('debería verificar webhook con token correcto', () => {
      mockReq.query = {
        'hub.verify_token': 'test_verify_token',
        'hub.challenge': 'test_challenge'
      };

      webhookController.verifyWebhook(mockReq, mockRes);

      expect(mockRes.send).toHaveBeenCalledWith('test_challenge');
    });

    it('debería rechazar webhook con token incorrecto', () => {
      mockReq.query = {
        'hub.verify_token': 'wrong_token',
        'hub.challenge': 'test_challenge'
      };

      webhookController.verifyWebhook(mockReq, mockRes);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(403);
    });

    it('debería rechazar webhook sin verify_token', () => {
      mockReq.query = {
        'hub.challenge': 'test_challenge'
      };

      webhookController.verifyWebhook(mockReq, mockRes);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(403);
    });

    it('debería manejar verify_token undefined', () => {
      mockReq.query = {};

      webhookController.verifyWebhook(mockReq, mockRes);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(403);
    });

    it('debería manejar challenge undefined', () => {
      mockReq.query = {
        'hub.verify_token': 'test_verify_token'
      };

      webhookController.verifyWebhook(mockReq, mockRes);

      expect(mockRes.send).toHaveBeenCalledWith(undefined);
    });
  });

  describe('integración y edge cases', () => {
    it('debería manejar webhook completo con todos los pasos', async () => {
      const completeWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '573001234567',
                phone_number_id: 'phone_id_123'
              },
              contacts: [{
                wa_id: '573001234567',
                profile: {
                  name: 'Juan Pérez'
                }
              }],
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                timestamp: '1640995200000',
                text: {
                  body: 'Hola, quiero agendar una cita'
                },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: 'Hola, quiero agendar una cita',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);

      mockReq.body = completeWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
      expect(whatsappService.extractMessageFromWebhook).toHaveBeenCalledWith(completeWebhook);
      expect(whatsappService.markAsRead).toHaveBeenCalledWith('msg_123');
      expect(messageQueue.enqueueMessage).toHaveBeenCalledWith('573001234567', 'Hola, quiero agendar una cita');
    });

    it('debería manejar body vacío en handleWebhook', async () => {
      mockReq.body = {};

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
      expect(whatsappService.extractMessageFromWebhook).toHaveBeenCalledWith({});
    });

    it('debería manejar body null en handleWebhook', async () => {
      mockReq.body = null;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
      expect(whatsappService.extractMessageFromWebhook).toHaveBeenCalledWith(null);
    });

    it('debería manejar error en markAsRead', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'Hola' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: 'Hola',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);
      whatsappService.markAsRead.mockRejectedValue(new Error('Mark as read failed'));

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error crítico en WebhookController', { error: expect.any(Error) });
    });

    it('debería manejar error en enqueueMessage', async () => {
      const validWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                text: { body: 'Hola' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const mockMessage = {
        id: 'msg_123',
        from: '573001234567',
        text: 'Hola',
        isText: true
      };

      whatsappService.extractMessageFromWebhook.mockReturnValue(mockMessage);
      messageQueue.enqueueMessage.mockRejectedValue(new Error('Queue failed'));

      mockReq.body = validWebhook;

      await webhookController.handleWebhook(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error crítico en WebhookController', { error: expect.any(Error) });
    });
  });
});
