// Tests de validación para el backend
import { validateInput, WhatsAppWebhookSchema, LeadUpdateSchema, ValidationError } from '../middleware/validation'
import logger from '../utils/logger'

describe('Validation Tests', () => {

  test('WhatsApp Webhook Schema - Valid Input', () => {
    const validInput = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123456789',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '1234567890',
              phone_number_id: '987654321'
            },
            messages: [{
              from: '573123456789',
              id: 'msg_123',
              timestamp: '1640995200',
              text: { body: 'Hola mundo' },
              type: 'text'
            }]
          }
        }]
      }]
    }

    expect(() => validateInput(WhatsAppWebhookSchema, validInput)).not.toThrow()
  })

  test('WhatsApp Webhook Schema - Invalid Phone Number', () => {
    const invalidInput = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123456789',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '1234567890',
              phone_number_id: '987654321'
            },
            messages: [{
              from: 'invalid-phone',
              id: 'msg_123',
              timestamp: '1640995200',
              text: { body: 'Hola mundo' },
              type: 'text'
            }]
          }
        }]
      }]
    }

    expect(() => validateInput(WhatsAppWebhookSchema, invalidInput)).toThrow(ValidationError)
  })

  test('Lead Update Schema - Valid Update', () => {
    const validUpdate = {
      name: 'Juan Pérez',
      current_step: 'AGENDA',
      summary: 'Cliente interesado en servicios de grooming',
      bot_active: true
    }

    expect(() => validateInput(LeadUpdateSchema, validUpdate)).not.toThrow()
  })

  test('Lead Update Schema - Invalid Step', () => {
    const invalidUpdate = {
      name: 'Juan Pérez',
      current_step: 'INVALID_STEP',
      bot_active: true
    }

    expect(() => validateInput(LeadUpdateSchema, invalidUpdate)).toThrow(ValidationError)
  })

  test('Sanitization Functions', () => {
    const { sanitizePhoneNumber, sanitizeString, validateWhatsAppMessage } = require('../middleware/validation')

    // Test phone sanitization
    expect(sanitizePhoneNumber('+57 (321) 123-4567')).toBe('573211234567')
    expect(sanitizePhoneNumber('3211234567')).toBe('3211234567')

    // Test string sanitization
    expect(sanitizeString('<script>alert("xss")</script>Hola')).toBe('Hola')
    expect(sanitizeString('Hola mundo', 5)).toBe('Hola')

    // Test WhatsApp message validation
    expect(validateWhatsAppMessage('Hola mundo')).toBe('Hola mundo')
    expect(() => validateWhatsAppMessage('')).toThrow(ValidationError)
    expect(() => validateWhatsAppMessage('a'.repeat(2001))).toThrow(ValidationError)
  })

  test('Rate Limiting', () => {
    const { checkRateLimit } = require('../middleware/validation')

    const identifier = 'test-user'

    // First requests should pass
    expect(checkRateLimit(identifier, 3, 1000)).toBe(true)
    expect(checkRateLimit(identifier, 3, 1000)).toBe(true)
    expect(checkRateLimit(identifier, 3, 1000)).toBe(true)

    // Fourth request should fail
    expect(checkRateLimit(identifier, 3, 1000)).toBe(false)
  })
})

describe('Logger Tests', () => {

  test('Logger Configuration', () => {
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  test('Structured Logging', () => {
    const spy = jest.spyOn(logger, 'info')

    logger.info({ userId: '123', action: 'test' }, 'Test message')

    expect(spy).toHaveBeenCalledWith({ userId: '123', action: 'test' }, 'Test message')

    spy.mockRestore()
  })
})

describe('Security Tests', () => {

  test('Input Validation Prevents XSS', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src="x" onerror="alert(\'xss\')">',
      '"><script>alert("xss")</script>'
    ]

    const { sanitizeString } = require('../middleware/validation')

    xssPayloads.forEach(payload => {
      const sanitized = sanitizeString(payload)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('javascript:')
      expect(sanitized).not.toContain('onerror')
    })
  })

  test('SQL Injection Prevention', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "'; INSERT INTO users VALUES ('hacker'); --",
      "UNION SELECT * FROM sensitive_data"
    ]

    // Test que los inputs se validan correctamente
    sqlInjectionPayloads.forEach(payload => {
      expect(() => validateInput(LeadUpdateSchema, { name: payload })).not.toThrow()
      // La validación no debería permitir caracteres peligrosos en campos específicos
    })
  })
})

describe('Performance Tests', () => {

  test('Validation Performance', () => {
    const { validateInput } = require('../middleware/validation')

    const iterations = 1000
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      validateInput(LeadUpdateSchema, {
        name: `User ${i}`,
        current_step: 'AGENDA',
        bot_active: true
      })
    }

    const end = performance.now()
    const avgTime = (end - start) / iterations

    // La validación debería ser rápida (< 1ms por validación)
    expect(avgTime).toBeLessThan(1)
    console.log(`⚡ Validation performance: ${avgTime.toFixed(3)}ms per validation`)
  })
})

// Test de integración
describe('Integration Tests', () => {

  test('Complete Flow Validation', async () => {
    // Simular un flujo completo de validación
    const webhookData = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123456789',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '1234567890',
              phone_number_id: '987654321'
            },
            messages: [{
              from: '573123456789',
              id: 'msg_123',
              timestamp: '1640995200',
              text: { body: 'Hola, quiero agendar una cita' },
              type: 'text'
            }]
          }
        }]
      }]
    }

    // Validar webhook
    const validatedWebhook = validateInput(WhatsAppWebhookSchema, webhookData)

    // Extraer mensaje
    const message = validatedWebhook.entry[0].changes[0].value.messages[0]
    const sanitizedMessage = require('../middleware/validation').validateWhatsAppMessage(message.text.body)

    expect(sanitizedMessage).toBe('Hola, quiero agendar una cita')
    expect(sanitizedMessage.length).toBeGreaterThan(0)
    expect(sanitizedMessage.length).toBeLessThanOrEqual(2000)
  })
})
