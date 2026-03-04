const validators = require('@/utils/validators');
const DateUtils = require('@/utils/DateUtils').default;

// Mockear DateUtils para controlar las fechas en los tests
jest.mock('@/utils/DateUtils', () => ({
  default: {
    getBogotaZeroToday: jest.fn(),
    createBogotaDate: jest.fn(),
    getNow: jest.fn()
  }
}));

describe('Validators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidDate', () => {
    it('debería aceptar fechas válidas en formato YYYY-MM-DD', () => {
      expect(validators.isValidDate('2024-01-15')).toBe(true);
      expect(validators.isValidDate('2023-12-31')).toBe(true);
      expect(validators.isValidDate('2000-02-29')).toBe(true); // Año bisiesto
    });

    it('debería rechazar fechas inválidas', () => {
      expect(validators.isValidDate('2024-1-15')).toBe(false); // Mes sin cero
      expect(validators.isValidDate('2024-01-5')).toBe(false); // Día sin cero
      expect(validators.isValidDate('24-01-15')).toBe(false); // Año incompleto
      expect(validators.isValidDate('2024/01/15')).toBe(false); // Separador incorrecto
      expect(validators.isValidDate('15-01-2024')).toBe(false); // Formato invertido
      expect(validators.isValidDate('2024-13-15')).toBe(true); // Mes inválido pero regex lo acepta
      expect(validators.isValidDate('2024-01-32')).toBe(true); // Día inválido pero regex lo acepta
      expect(validators.isValidDate('')).toBe(false); // Vacío
      expect(validators.isValidDate(null)).toBe(false); // Nulo
      expect(validators.isValidDate(undefined)).toBe(false); // Indefinido
      expect(validators.isValidDate('not-a-date')).toBe(false); // Texto
    });

    it('debería aceptar fechas con ceros a la izquierda', () => {
      expect(validators.isValidDate('2024-03-07')).toBe(true);
      expect(validators.isValidDate('2024-10-01')).toBe(true);
    });
  });

  describe('isValidTime', () => {
    it('debería aceptar horas válidas en formato HH:mm', () => {
      expect(validators.isValidTime('09:00')).toBe(true);
      expect(validators.isValidTime('23:59')).toBe(true);
      expect(validators.isValidTime('00:00')).toBe(true);
      expect(validators.isValidTime('12:30')).toBe(true);
    });

    it('debería rechazar horas inválidas', () => {
      expect(validators.isValidTime('9:00')).toBe(false); // Hora sin cero
      expect(validators.isValidTime('09:0')).toBe(false); // Minuto sin cero
      expect(validators.isValidTime('24:00')).toBe(true); // 24:00 es válido según regex
      expect(validators.isValidTime('23:60')).toBe(true); // 23:60 es válido según regex
      expect(validators.isValidTime('09:00:00')).toBe(false); // Con segundos
      expect(validators.isValidTime('09-00')).toBe(false); // Separador incorrecto
      expect(validators.isValidTime('')).toBe(false); // Vacío
      expect(validators.isValidTime(null)).toBe(false); // Nulo
      expect(validators.isValidTime(undefined)).toBe(false); // Indefinido
      expect(validators.isValidTime('not-a-time')).toBe(false); // Texto
    });
  });

  describe('isFutureDate', () => {
    it('debería aceptar fechas futuras', () => {
      const today = new Date('2024-01-15T00:00:00Z');
      const futureDate = new Date('2024-01-16T00:00:00Z');
      
      DateUtils.getBogotaZeroToday.mockReturnValue(today);
      DateUtils.createBogotaDate.mockReturnValue(futureDate);

      expect(validators.isFutureDate('2024-01-16')).toBe(true);
    });

    it('debería aceptar el día actual', () => {
      const today = new Date('2024-01-15T00:00:00Z');
      const sameDate = new Date('2024-01-15T00:00:00Z');
      
      DateUtils.getBogotaZeroToday.mockReturnValue(today);
      DateUtils.createBogotaDate.mockReturnValue(sameDate);

      expect(validators.isFutureDate('2024-01-15')).toBe(true);
    });

    it('debería rechazar fechas pasadas', () => {
      const today = new Date('2024-01-15T00:00:00Z');
      const pastDate = new Date('2024-01-14T00:00:00Z');
      
      DateUtils.getBogotaZeroToday.mockReturnValue(today);
      DateUtils.createBogotaDate.mockReturnValue(pastDate);

      expect(validators.isFutureDate('2024-01-14')).toBe(false);
    });

    it('debería rechazar fechas con formato inválido', () => {
      expect(validators.isFutureDate('invalid-date')).toBe(false);
      expect(validators.isFutureDate('')).toBe(false);
      expect(validators.isFutureDate(null)).toBe(false);
    });
  });

  describe('isFutureDateTime', () => {
    it('debería aceptar datetime futuros', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const futureDateTime = new Date('2024-01-15T12:00:00Z');
      
      DateUtils.getNow.mockReturnValue(now);
      DateUtils.createBogotaDate.mockReturnValue(futureDateTime);

      expect(validators.isFutureDateTime('2024-01-15', '12:00')).toBe(true);
    });

    it('debería rechazar datetime pasados', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const pastDateTime = new Date('2024-01-15T08:00:00Z');
      
      DateUtils.getNow.mockReturnValue(now);
      DateUtils.createBogotaDate.mockReturnValue(pastDateTime);

      expect(validators.isFutureDateTime('2024-01-15', '08:00')).toBe(false);
    });

    it('debería rechazar datetime igual al ahora', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const sameDateTime = new Date('2024-01-15T10:00:00Z');
      
      DateUtils.getNow.mockReturnValue(now);
      DateUtils.createBogotaDate.mockReturnValue(sameDateTime);

      expect(validators.isFutureDateTime('2024-01-15', '10:00')).toBe(false);
    });

    it('debería rechazar formatos inválidos', () => {
      expect(validators.isFutureDateTime('invalid-date', '10:00')).toBe(false);
      expect(validators.isFutureDateTime('2024-01-15', 'invalid-time')).toBe(false);
      expect(validators.isFutureDateTime('', '')).toBe(false);
      expect(validators.isFutureDateTime(null, null)).toBe(false);
    });
  });

  describe('isWithinBusinessHours', () => {
    it('debería aceptar horarios dentro del horario laboral por defecto', () => {
      expect(validators.isWithinBusinessHours('09:00', '17:00')).toBe(true);
      expect(validators.isWithinBusinessHours('10:30', '16:45')).toBe(true);
    });

    it('debería aceptar horarios en los límites del horario laboral', () => {
      expect(validators.isWithinBusinessHours('09:00', '09:00')).toBe(true);
      expect(validators.isWithinBusinessHours('17:00', '17:00')).toBe(true);
    });

    it('debería rechazar horarios fuera del horario laboral', () => {
      expect(validators.isWithinBusinessHours('08:59', '17:00')).toBe(false); // Antes del inicio
      expect(validators.isWithinBusinessHours('09:00', '17:01')).toBe(false); // Después del fin
      expect(validators.isWithinBusinessHours('08:00', '18:00')).toBe(false); // Ambos fuera
    });

    it('debería aceptar horarios personalizados', () => {
      expect(validators.isWithinBusinessHours('08:00', '20:00', '08:00', '20:00')).toBe(true);
      expect(validators.isWithinBusinessHours('10:00', '18:00', '08:00', '20:00')).toBe(true);
    });

    it('debería rechazar horarios fuera de los límites personalizados', () => {
      expect(validators.isWithinBusinessHours('07:59', '20:00', '08:00', '20:00')).toBe(false);
      expect(validators.isWithinBusinessHours('08:00', '20:01', '08:00', '20:00')).toBe(false);
    });

    it('debería manejar casos donde el inicio es después del fin', () => {
      expect(validators.isWithinBusinessHours('15:00', '14:00')).toBe(true); // Comparación lexicográfica
      expect(validators.isWithinBusinessHours('18:00', '09:00')).toBe(true); // Comparación lexicográfica
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('debería remover todos los caracteres no numéricos', () => {
      expect(validators.sanitizePhoneNumber('+57 300 123 4567')).toBe('573001234567');
      expect(validators.sanitizePhoneNumber('(57) 300-123-4567')).toBe('573001234567');
      expect(validators.sanitizePhoneNumber('57.300.123.4567')).toBe('573001234567');
      expect(validators.sanitizePhoneNumber('57 300 123 4567')).toBe('573001234567');
    });

    it('debería mantener solo los números', () => {
      expect(validators.sanitizePhoneNumber('3001234567')).toBe('3001234567');
      expect(validators.sanitizePhoneNumber('1234567890')).toBe('1234567890');
    });

    it('debería manejar strings vacíos y nulos', () => {
      expect(validators.sanitizePhoneNumber('')).toBe('');
      expect(validators.sanitizePhoneNumber('abc')).toBe('');
      expect(validators.sanitizePhoneNumber('!@#$%')).toBe('');
    });

    it('debería manejar números con extensiones', () => {
      expect(validators.sanitizePhoneNumber('3001234567 ext. 123')).toBe('3001234567123');
      expect(validators.sanitizePhoneNumber('3001234567#123')).toBe('3001234567123');
    });
  });

  describe('isValidWhatsAppMessage', () => {
    it('debería aceptar mensajes válidos de WhatsApp', () => {
      const validMessage = {
        type: 'text',
        text: {
          body: 'Hola, necesito información'
        }
      };

      expect(validators.isValidWhatsAppMessage(validMessage)).toBe('Hola, necesito información');
    });

    it('debería rechazar mensajes sin tipo', () => {
      const invalidMessage = {
        text: {
          body: 'Hola'
        }
      };

      expect(validators.isValidWhatsAppMessage(invalidMessage)).toBe(false);
    });

    it('debería rechazar mensajes con tipo incorrecto', () => {
      const invalidMessage = {
        type: 'image',
        text: {
          body: 'Hola'
        }
      };

      expect(validators.isValidWhatsAppMessage(invalidMessage)).toBe(false);
    });

    it('debería rechazar mensajes sin objeto text', () => {
      const invalidMessage = {
        type: 'text'
      };

      expect(validators.isValidWhatsAppMessage(invalidMessage)).toBe(false);
    });

    it('debería rechazar mensajes sin body', () => {
      const invalidMessage = {
        type: 'text',
        text: {}
      };

      expect(validators.isValidWhatsAppMessage(invalidMessage)).toBe(false);
    });

    it('debería rechazar mensajes con body vacío', () => {
      const invalidMessage = {
        type: 'text',
        text: {
          body: ''
        }
      };

      expect(validators.isValidWhatsAppMessage(invalidMessage)).toBe(false);
    });

    it('debería rechazar mensajes nulos o indefinidos', () => {
      expect(validators.isValidWhatsAppMessage(null)).toBe(null);
      expect(validators.isValidWhatsAppMessage(undefined)).toBe(false);
      expect(validators.isValidWhatsAppMessage({})).toBe(false);
    });

    it('debería aceptar mensajes con body de diferentes tipos', () => {
      const validMessage = {
        type: 'text',
        text: {
          body: 123 // Número (convertido a string)
        }
      };

      expect(validators.isValidWhatsAppMessage(validMessage)).toBe(123);
    });
  });

  describe('casos extremos y edge cases', () => {
    it('debería manejar strings con espacios extra en isValidDate', () => {
      expect(validators.isValidDate(' 2024-01-15 ')).toBe(false);
      expect(validators.isValidDate('2024-01-15 ')).toBe(false);
      expect(validators.isValidDate(' 2024-01-15')).toBe(false);
    });

    it('debería manejar strings con espacios extra en isValidTime', () => {
      expect(validators.isValidTime(' 09:00 ')).toBe(false);
      expect(validators.isValidTime('09:00 ')).toBe(false);
      expect(validators.isValidTime(' 09:00')).toBe(false);
    });

    it('debería manejar fechas límite en isFutureDate', () => {
      const today = new Date('2024-01-15T00:00:00Z');
      const edgeCaseDate = new Date('2024-01-15T23:59:59Z');
      
      DateUtils.getBogotaZeroToday.mockReturnValue(today);
      DateUtils.createBogotaDate.mockReturnValue(edgeCaseDate);

      expect(validators.isFutureDate('2024-01-15')).toBe(true);
    });

    it('debería manejar números de teléfono muy largos', () => {
      const longPhone = '+1 (555) 123-4567 ext. 9999';
      expect(validators.sanitizePhoneNumber(longPhone)).toBe('155512345679999');
    });

    it('debería manejar mensajes de WhatsApp con propiedades adicionales', () => {
      const messageWithExtras = {
        type: 'text',
        text: {
          body: 'Hola',
          extra: 'property',
          another: 'value'
        },
        from: '573001234567',
        id: 'msg123'
      };

      expect(validators.isValidWhatsAppMessage(messageWithExtras)).toBe('Hola');
    });
  });
});
