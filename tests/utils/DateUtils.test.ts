const DateUtils = require('@/utils/DateUtils').default;

describe('DateUtils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getNow', () => {
    it('debería devolver la fecha actual', () => {
      const now = new Date('2024-01-15T10:30:00Z');
      jest.setSystemTime(now);

      const result = DateUtils.getNow();

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(now.getTime());
    });
  });

  describe('getBogotaFakeUTC', () => {
    it('debería ajustar la fecha al offset de Bogotá (-5 horas)', () => {
      const utcDate = new Date('2024-01-15T15:00:00Z'); // 15:00 UTC
      const result = DateUtils.getBogotaFakeUTC(utcDate);

      // En Bogotá serían las 10:00 (15:00 - 5 horas)
      expect(result.getUTCHours()).toBe(10);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('debería usar la fecha actual si no se proporciona ninguna', () => {
      const now = new Date('2024-01-15T20:00:00Z');
      jest.setSystemTime(now);

      const result = DateUtils.getBogotaFakeUTC();

      // 20:00 UTC - 5 horas = 15:00 Bogotá
      expect(result.getUTCHours()).toBe(15);
    });

    it('debería manejar correctamente el cambio de día', () => {
      const utcDate = new Date('2024-01-15T03:00:00Z'); // 3:00 UTC
      const result = DateUtils.getBogotaFakeUTC(utcDate);

      // En Bogotá sería el día anterior a las 22:00 (3:00 - 5 horas)
      expect(result.getUTCDate()).toBe(14); // Día anterior
      expect(result.getUTCHours()).toBe(22);
    });
  });

  describe('getTodayBogotaStr', () => {
    it('debería devolver la fecha actual en formato YYYY-MM-DD para Bogotá', () => {
      // Establecer tiempo: 2024-01-15 02:00 UTC = 2024-01-14 21:00 Bogotá (día anterior)
      jest.setSystemTime(new Date('2024-01-15T02:00:00Z'));

      const result = DateUtils.getTodayBogotaStr();

      expect(result).toBe('2024-01-14'); // Día anterior en Bogotá
    });

    it('debería devolver el día correcto cuando es tarde en Bogotá', () => {
      // Establecer tiempo: 2024-01-15 10:00 UTC = 2024-01-15 05:00 Bogotá
      jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));

      const result = DateUtils.getTodayBogotaStr();

      expect(result).toBe('2024-01-15'); // Mismo día en Bogotá
    });

    it('debería formatear correctamente con ceros a la izquierda', () => {
      // Mes y día con un solo dígito: 2024-03-07
      jest.setSystemTime(new Date('2024-03-07T10:00:00Z'));

      const result = DateUtils.getTodayBogotaStr();

      expect(result).toBe('2024-03-07');
    });
  });

  describe('createBogotaDate', () => {
    it('debería crear una fecha con hora por defecto (00:00:00)', () => {
      const result = DateUtils.createBogotaDate('2024-01-15');

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toContain('2024-01-15T05:00:00.000Z'); // 00:00 Bogotá = 05:00 UTC
    });

    it('debería crear una fecha con hora específica (HH:mm)', () => {
      const result = DateUtils.createBogotaDate('2024-01-15', '14:30');

      expect(result.toISOString()).toContain('2024-01-15T19:30:00.000Z'); // 14:30 Bogotá = 19:30 UTC
    });

    it('debería crear una fecha con hora específica (HH:mm:ss)', () => {
      const result = DateUtils.createBogotaDate('2024-01-15', '14:30:45');

      expect(result.toISOString()).toContain('2024-01-15T19:30:45.000Z'); // 14:30:45 Bogotá = 19:30:45 UTC
    });

    it('debería truncar segundos si se proporcionan más de 6 caracteres', () => {
      const result = DateUtils.createBogotaDate('2024-01-15', '14:30:45extra');

      expect(result.toISOString()).toContain('2024-01-15T19:30:45.000Z');
    });

    it('debería manejar fechas válidas', () => {
      const result = DateUtils.createBogotaDate('2024-12-31', '23:59');

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // Diciembre (0-indexed)
      expect(result.getDate()).toBe(31);
    });
  });

  describe('getBogotaZeroToday', () => {
    it('debería devolver el inicio del día de hoy en Bogotá', () => {
      // 2024-01-15 10:00 UTC = 2024-01-15 05:00 Bogotá
      jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));

      const result = DateUtils.getBogotaZeroToday();

      // Debería ser 00:00 Bogotá = 05:00 UTC
      expect(result.getUTCHours()).toBe(5);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });

    it('debería devolver el inicio del día correcto cuando cambia de día', () => {
      // 2024-01-15 02:00 UTC = 2024-01-14 21:00 Bogotá
      jest.setSystemTime(new Date('2024-01-15T02:00:00Z'));

      const result = DateUtils.getBogotaZeroToday();

      // Debería ser 00:00 del día 14 en Bogotá = 05:00 UTC del día 14
      expect(result.getUTCDate()).toBe(14);
      expect(result.getUTCHours()).toBe(5);
    });
  });

  describe('addMinutes', () => {
    it('debería sumar minutos correctamente', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = DateUtils.addMinutes(date, 30);

      expect(result.getTime()).toBe(date.getTime() + 30 * 60 * 1000);
      expect(result.toISOString()).toContain('2024-01-15T10:30:00.000Z');
    });

    it('debería restar minutos si el valor es negativo', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = DateUtils.addMinutes(date, -15);

      expect(result.getTime()).toBe(date.getTime() - 15 * 60 * 1000);
      expect(result.toISOString()).toContain('2024-01-15T09:45:00.000Z');
    });

    it('debería manejar cambios de día al sumar minutos', () => {
      const date = new Date('2024-01-15T23:45:00Z');
      const result = DateUtils.addMinutes(date, 30);

      expect(result.toISOString()).toContain('2024-01-16T00:15:00.000Z'); // Siguiente día
    });

    it('debería manejar cero minutos', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = DateUtils.addMinutes(date, 0);

      expect(result.getTime()).toBe(date.getTime());
    });
  });

  describe('getBogotaTimeString', () => {
    it('debería devolver la hora en formato HH:mm para Bogotá', () => {
      const utcDate = new Date('2024-01-15T19:30:00Z'); // 19:30 UTC = 14:30 Bogotá
      const result = DateUtils.getBogotaTimeString(utcDate);

      expect(result).toBe('14:30');
    });

    it('debería formatear con ceros a la izquierda', () => {
      const utcDate = new Date('2024-01-15T05:09:00Z'); // 05:09 UTC = 00:09 Bogotá
      const result = DateUtils.getBogotaTimeString(utcDate);

      expect(result).toBe('00:09');
    });

    it('debería manejar medianoche correctamente', () => {
      const utcDate = new Date('2024-01-15T05:00:00Z'); // 05:00 UTC = 00:00 Bogotá
      const result = DateUtils.getBogotaTimeString(utcDate);

      expect(result).toBe('00:00');
    });

    it('debería manejar las 11 PM correctamente', () => {
      const utcDate = new Date('2024-01-16T04:00:00Z'); // 04:00 UTC del día siguiente = 23:00 Bogotá
      const result = DateUtils.getBogotaTimeString(utcDate);

      expect(result).toBe('23:00');
    });
  });

  describe('constante BOGOTA_OFFSET_MS', () => {
    it('debería tener el valor correcto para GMT-5', () => {
      expect(DateUtils.BOGOTA_OFFSET_MS).toBe(-5 * 60 * 60 * 1000);
      expect(DateUtils.BOGOTA_OFFSET_MS).toBe(-18000000); // -5 horas en milisegundos
    });
  });

  describe('casos extremos y edge cases', () => {
    it('debería manejar fechas muy antiguas', () => {
      const oldDate = new Date('1900-01-01T00:00:00Z');
      const result = DateUtils.getBogotaTimeString(oldDate);

      expect(result).toBe('19:00'); // 00:00 UTC - 5 horas = 19:00 día anterior en Bogotá
    });

    it('debería manejar fechas muy futuras', () => {
      const futureDate = new Date('2100-12-31T23:59:59Z');
      const result = DateUtils.getBogotaTimeString(futureDate);

      expect(result).toBe('18:59'); // 23:59 UTC - 5 horas = 18:59 Bogotá
    });

    it('debería manejar años bisiestos correctamente', () => {
      const leapYearDate = new Date('2024-02-29T12:00:00Z'); // 2024 es año bisiesto
      const result = DateUtils.getBogotaTimeString(leapYearDate);

      expect(result).toBe('07:00'); // 12:00 UTC - 5 horas = 07:00 Bogotá
    });

    it('debería manejar el cambio de año', () => {
      const newYearEve = new Date('2024-01-01T03:30:00Z'); // 3:30 UTC del 1 de enero
      const result = DateUtils.getBogotaTimeString(newYearEve);

      expect(result).toBe('22:30'); // 3:30 UTC - 5 horas = 22:30 del 31 de diciembre en Bogotá
    });
  });
});
