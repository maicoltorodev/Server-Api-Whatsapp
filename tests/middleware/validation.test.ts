const {
  WhatsAppWebhookSchema,
  AdminAuthSchema,
  LeadUpdateSchema,
  AppointmentBookingSchema,
  validateInput,
  ValidationError,
  sanitizePhoneNumber,
  sanitizeString,
  validateWhatsAppMessage,
  checkRateLimit
} = require('@/middleware/validation');
const logger = require('@/utils/logger');

// Mockear las dependencias
jest.mock('@/utils/logger');

describe('Validation Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Limpiar el store de rate limiting
    if (typeof global !== 'undefined' && global.rateLimitStore) {
      global.rateLimitStore.clear();
    }
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('WhatsAppWebhookSchema', () => {
    it('debería validar un webhook de WhatsApp válido', () => {
      const validWebhook = {
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
                  body: 'Hola, quiero información'
                },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const result = WhatsAppWebhookSchema.parse(validWebhook);
      
      expect(result).toEqual(validWebhook);
    });

    it('debería rechazar webhook con object inválido', () => {
      const invalidWebhook = {
        object: 'invalid_object',
        entry: []
      };

      expect(() => {
        WhatsAppWebhookSchema.parse(invalidWebhook);
      }).toThrow();
    });

    it('debería rechazar webhook sin entry', () => {
      const invalidWebhook = {
        object: 'whatsapp_business_account'
      };

      expect(() => {
        WhatsAppWebhookSchema.parse(invalidWebhook);
      }).toThrow();
    });

    it('debería rechazar mensaje con tipo inválido', () => {
      const invalidWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                timestamp: '1640995200000',
                text: {
                  body: 'Hola'
                },
                type: 'invalid_type'
              }]
            }
          }]
        }]
      };

      expect(() => {
        WhatsAppWebhookSchema.parse(invalidWebhook);
      }).toThrow();
    });

    it('debería rechazar número de teléfono inválido', () => {
      const invalidWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              contacts: [{
                wa_id: 'invalid_phone',
                profile: {
                  name: 'Juan'
                }
              }]
            }
          }]
        }]
      };

      expect(() => {
        WhatsAppWebhookSchema.parse(invalidWebhook);
      }).toThrow();
    });

    it('debería rechazar nombre demasiado largo', () => {
      const invalidWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              contacts: [{
                wa_id: '573001234567',
                profile: {
                  name: 'a'.repeat(51) // 51 caracteres (límite 50)
                }
              }]
            }
          }]
        }]
      };

      expect(() => {
        WhatsAppWebhookSchema.parse(invalidWebhook);
      }).toThrow();
    });

    it('debería rechazar mensaje de texto demasiado largo', () => {
      const invalidWebhook = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              messages: [{
                from: '573001234567',
                id: 'msg_123',
                timestamp: '1640995200000',
                text: {
                  body: 'a'.repeat(2001) // 2001 caracteres (límite 2000)
                },
                type: 'text'
              }]
            }
          }]
        }]
      };

      expect(() => {
        WhatsAppWebhookSchema.parse(invalidWebhook);
      }).toThrow();
    });
  });

  describe('AdminAuthSchema', () => {
    it('debería validar API key válida', () => {
      const validAuth = {
        'x-api-key': 'valid_api_key_12345'
      };

      const result = AdminAuthSchema.parse(validAuth);
      
      expect(result).toEqual(validAuth);
    });

    it('debería rechazar API key muy corta', () => {
      const invalidAuth = {
        'x-api-key': 'short' // 5 caracteres (límite 10)
      };

      expect(() => {
        AdminAuthSchema.parse(invalidAuth);
      }).toThrow();
    });

    it('debería rechazar API key muy larga', () => {
      const invalidAuth = {
        'x-api-key': 'a'.repeat(101) // 101 caracteres (límite 100)
      };

      expect(() => {
        AdminAuthSchema.parse(invalidAuth);
      }).toThrow();
    });

    it('debería requerir API key', () => {
      const invalidAuth = {};

      expect(() => {
        AdminAuthSchema.parse(invalidAuth);
      }).toThrow();
    });
  });

  describe('LeadUpdateSchema', () => {
    it('debería validar actualización de lead válida', () => {
      const validUpdate = {
        name: 'Juan Pérez',
        current_step: 'AGENDA',
        summary: 'Cliente interesado en grooming',
        bot_active: true
      };

      const result = LeadUpdateSchema.parse(validUpdate);
      
      expect(result).toEqual(validUpdate);
    });

    it('debería rechazar step inválido', () => {
      const invalidUpdate = {
        current_step: 'INVALID_STEP'
      };

      expect(() => {
        LeadUpdateSchema.parse(invalidUpdate);
      }).toThrow();
    });

    it('debería rechazar nombre vacío', () => {
      const invalidUpdate = {
        name: ''
      };

      expect(() => {
        LeadUpdateSchema.parse(invalidUpdate);
      }).toThrow();
    });

    it('debería rechazar summary muy largo', () => {
      const invalidUpdate = {
        summary: 'a'.repeat(501) // 501 caracteres (límite 500)
      };

      expect(() => {
        LeadUpdateSchema.parse(invalidUpdate);
      }).toThrow();
    });
  });

  describe('AppointmentBookingSchema', () => {
    it('debería validar reserva de cita válida', () => {
      const validBooking = {
        service_id: 'grooming_basic',
        date: '2024-03-15',
        time: '10:30',
        notes: 'Cliente prefiere mañana'
      };

      const result = AppointmentBookingSchema.parse(validBooking);
      
      expect(result).toEqual(validBooking);
    });

    it('debería rechazar fecha inválida', () => {
      const invalidBooking = {
        service_id: 'grooming_basic',
        date: '15/03/2024', // Formato inválido
        time: '10:30'
      };

      expect(() => {
        AppointmentBookingSchema.parse(invalidBooking);
      }).toThrow();
    });

    it('debería rechazar hora inválida', () => {
      const invalidBooking = {
        service_id: 'grooming_basic',
        date: '2024-03-15',
        time: '10:30:00' // Formato inválido
      };

      expect(() => {
        AppointmentBookingSchema.parse(invalidBooking);
      }).toThrow();
    });

    it('debería rechazar notes muy largo', () => {
      const invalidBooking = {
        service_id: 'grooming_basic',
        date: '2024-03-15',
        time: '10:30',
        notes: 'a'.repeat(301) // 301 caracteres (límite 300)
      };

      expect(() => {
        AppointmentBookingSchema.parse(invalidBooking);
      }).toThrow();
    });

    it('debería requerir service_id', () => {
      const invalidBooking = {
        date: '2024-03-15',
        time: '10:30'
      };

      expect(() => {
        AppointmentBookingSchema.parse(invalidBooking);
      }).toThrow();
    });
  });

  describe('validateInput', () => {
    it('debería retornar datos válidos sin cambios', () => {
      const schema = WhatsAppWebhookSchema;
      const validData = {
        object: 'whatsapp_business_account',
        entry: []
      };

      const result = validateInput(schema, validData);
      
      expect(result).toEqual(validData);
    });

    it('debería lanzar ValidationError para datos inválidos', () => {
      const schema = WhatsAppWebhookSchema;
      const invalidData = {
        object: 'invalid'
      };

      expect(() => {
        validateInput(schema, invalidData);
      }).toThrow(ValidationError);
    });

    it('debería loggear errores de validación', () => {
      const schema = WhatsAppWebhookSchema;
      const invalidData = {
        object: 'invalid'
      };

      try {
        validateInput(schema, invalidData);
      } catch (error) {
        expect(logger.securityLogger.warn).toHaveBeenCalledWith(
          'Input validation failed',
          expect.objectContaining({
            errors: expect.any(Array),
            input: invalidData
          })
        );
      }
    });

    it('debería incluir detalles del error en ValidationError', () => {
      const schema = WhatsAppWebhookSchema;
      const invalidData = {
        object: 'invalid'
      };

      try {
        validateInput(schema, invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.details).toEqual(expect.any(Array));
        expect(error.details[0]).toEqual(
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String),
            code: expect.any(String)
          })
        );
      }
    });
  });

  describe('ValidationError', () => {
    it('debería crear error con mensaje y detalles', () => {
      const details = [{
        field: 'object',
        message: 'Invalid literal',
        code: 'invalid_literal'
      }];

      const error = new ValidationError('Invalid input data', details);

      expect(error.message).toBe('Invalid input data');
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual(details);
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('debería remover caracteres no numéricos', () => {
      const phone = '+57 (300) 123-4567';
      const result = sanitizePhoneNumber(phone);

      expect(result).toBe('573001234567');
    });

    it('debería manejar teléfono sin caracteres especiales', () => {
      const phone = '573001234567';
      const result = sanitizePhoneNumber(phone);

      expect(result).toBe('573001234567');
    });

    it('debería manejar teléfono vacío', () => {
      const phone = '';
      const result = sanitizePhoneNumber(phone);

      expect(result).toBe('');
    });

    it('debería manejar teléfono con múltiples caracteres especiales', () => {
      const phone = '+1 (555) 123-4567 ext. 123';
      const result = sanitizePhoneNumber(phone);

      expect(result).toBe('15551234567');
    });
  });

  describe('sanitizeString', () => {
    it('debería remover scripts y caracteres peligrosos', () => {
      const input = '<script>alert("xss")</script>hello<>world';
      const result = sanitizeString(input);

      expect(result).toBe('helloworld');
    });

    it('debería limitar longitud por defecto', () => {
      const input = 'a'.repeat(1500);
      const result = sanitizeString(input);

      expect(result).toBe('a'.repeat(1000));
      expect(result.length).toBe(1000);
    });

    it('debería limitar longitud personalizada', () => {
      const input = 'a'.repeat(1500);
      const result = sanitizeString(input, 500);

      expect(result).toBe('a'.repeat(500));
      expect(result.length).toBe(500);
    });

    it('debería manejar string vacío', () => {
      const input = '';
      const result = sanitizeString(input);

      expect(result).toBe('');
    });

    it('debería remover espacios en blanco', () => {
      const input = '  hello world  ';
      const result = sanitizeString(input);

      expect(result).toBe('hello world');
    });

    it('debería manejar scripts complejos', () => {
      const input = '<script src="evil.js"></script><SCRIPT>alert("xss")</SCRIPT>';
      const result = sanitizeString(input);

      expect(result).toBe('alert("xss")');
    });
  });

  describe('validateWhatsAppMessage', () => {
    it('debería aceptar mensaje válido', () => {
      const message = 'Hola, quiero información sobre sus servicios';
      const result = validateWhatsAppMessage(message);

      expect(result).toBe(message);
    });

    it('debería lanzar error para mensaje vacío', () => {
      const message = '';

      expect(() => {
        validateWhatsAppMessage(message);
      }).toThrow('Message cannot be empty');
    });

    it('debería lanzar error para mensaje demasiado largo', () => {
      const message = 'a'.repeat(2001);

      expect(() => {
        validateWhatsAppMessage(message);
      }).toThrow('Message too long');
    });

    it('debería sanitizar mensaje con caracteres peligrosos', () => {
      const message = '<script>alert("xss")</script>hola';
      const result = validateWhatsAppMessage(message);

      expect(result).toBe('alert("xss")hola');
    });

    it('debería limitar longitud después de sanitización', () => {
      const message = '<script>'.repeat(100) + 'a'.repeat(1900); // Después de sanitizar, excede 2000
      const result = validateWhatsAppMessage(message);

      expect(result.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Limpiar el store antes de cada test
      if (typeof global !== 'undefined' && global.rateLimitStore) {
        global.rateLimitStore.clear();
      }
    });

    it('debería permitir primera solicitud', () => {
      const result = checkRateLimit('user_123', 5, 60000);

      expect(result).toBe(true);
    });

    it('debería permitir solicitudes dentro del límite', () => {
      // Hacer 3 solicitudes (límite 5)
      for (let i = 0; i < 3; i++) {
        const result = checkRateLimit('user_123', 5, 60000);
        expect(result).toBe(true);
      }
    });

    it('debería rechazar cuando se excede el límite', () => {
      // Hacer 5 solicitudes (límite exacto)
      for (let i = 0; i < 5; i++) {
        checkRateLimit('user_123', 5, 60000);
      }

      // La sexta solicitud debería ser rechazada
      const result = checkRateLimit('user_123', 5, 60000);
      expect(result).toBe(false);
    });

    it('debería resetear después de la ventana de tiempo', () => {
      // Hacer 5 solicitudes (al límite)
      for (let i = 0; i < 5; i++) {
        checkRateLimit('user_123', 5, 60000);
      }
      expect(checkRateLimit('user_123', 5, 60000)).toBe(false);

      // Avanzar el tiempo más allá de la ventana
      jest.advanceTimersByTime(70000); // 70 segundos (ventana de 60)

      // Debería permitir nuevamente
      const result = checkRateLimit('user_123', 5, 60000);
      expect(result).toBe(true);
    });

    it('debería manejar múltiples usuarios independientemente', () => {
      // Usuario 1 hace 3 solicitudes
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user_1', 5, 60000);
      }

      // Usuario 2 hace 3 solicitudes
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user_2', 5, 60000);
      }

      // Ambos deberían poder continuar
      expect(checkRateLimit('user_1', 5, 60000)).toBe(true);
      expect(checkRateLimit('user_2', 5, 60000)).toBe(true);
    });

    it('debería usar valores por defecto', () => {
      const result = checkRateLimit('user_123');

      expect(result).toBe(true);
      // Verificar que se usaron los valores por defecto
      const secondResult = checkRateLimit('user_123');
      expect(secondResult).toBe(true);
    });

    it('debería loggear cuando se excede el límite', () => {
      // Hacer 6 solicitudes (excede límite de 5)
      for (let i = 0; i < 6; i++) {
        checkRateLimit('user_123', 5, 60000);
      }

      expect(logger.securityLogger.warn).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({
          identifier: 'user_123',
          count: 6,
          maxRequests: 5,
          windowMs: 60000
        })
      );
    });

    it('debería limpiar entradas expiradas periódicamente', () => {
      // Hacer una solicitud
      checkRateLimit('user_123', 5, 60000);

      // Avanzar tiempo para activar limpieza
      jest.advanceTimersByTime(300000); // 5 minutos

      // La entrada debería ser eliminada y poder hacer nueva solicitud
      const result = checkRateLimit('user_123', 5, 60000);
      expect(result).toBe(true);
    });
  });

  describe('integración y edge cases', () => {
    it('debería manejar validación completa de webhook', () => {
      const webhookData = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              messages: [{
                from: '+57 (300) 123-4567', // Número con formato
                id: 'msg_123',
                timestamp: '1640995200000',
                text: {
                  body: '<script>alert("test")</script>Hola'
                },
                type: 'text'
              }]
            }
          }]
        }]
      };

      // Validar estructura
      const result = validateInput(WhatsAppWebhookSchema, webhookData);
      
      expect(result).toBeDefined();
      expect(result.entry[0].changes[0].value.messages[0].from).toBe('573001234567');
      expect(result.entry[0].changes[0].value.messages[0].text.body).toBe('alert("test")Hola');
    });

    it('debería manejar validación de cita con datos sanitizados', () => {
      const bookingData = {
        service_id: 'grooming_basic',
        date: '2024-03-15',
        time: '10:30',
        notes: '<script>alert("xss")</script>Cliente con notas especiales'
      };

      const result = validateInput(AppointmentBookingSchema, bookingData);
      
      expect(result.notes).toBe('alert("xss")Cliente con notas especiales');
    });

    it('debería manejar rate limiting con validación', () => {
      const userId = 'user_123';
      const requestData = {
        'x-api-key': 'valid_key_12345'
      };

      // Primera solicitud - debería pasar
      expect(checkRateLimit(userId, 10, 60000)).toBe(true);
      expect(() => {
        validateInput(AdminAuthSchema, requestData);
      }).not.toThrow();

      // Hacer muchas solicitudes para alcanzar límite
      for (let i = 0; i < 9; i++) {
        checkRateLimit(userId, 10, 60000);
      }

      // Décima solicitud - debería ser bloqueada por rate limit
      expect(checkRateLimit(userId, 10, 60000)).toBe(false);
    });

    it('debería manejar errores no Zod en validateInput', () => {
      const schema = WhatsAppWebhookSchema;
      const invalidData = null;

      expect(() => {
        validateInput(schema, invalidData);
      }).toThrow();
    });

    it('debería manejar strings con caracteres Unicode', () => {
      const message = 'Hola señor Pérez ¿cómo está? 🐕';
      const result = validateWhatsAppMessage(message);

      expect(result).toBe(message);
    });

    it('debería manejar números internacionales', () => {
      const phone = '+1 (555) 123-4567';
      const result = sanitizePhoneNumber(phone);

      expect(result).toBe('15551234567');
    });
  });
});
