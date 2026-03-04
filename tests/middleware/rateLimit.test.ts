const rateLimiter = require('@/middleware/rateLimit');
const config = require('@/config');

// Mockear las dependencias
jest.mock('@/config');

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Resetear el estado del rateLimiter
    rateLimiter.processedMessages.clear();
    rateLimiter.userMessageCount.clear();
    
    // Configurar valores por defecto
    config.RATE_LIMIT = {
      WINDOW_MS: 60000, // 1 minuto
      MAX_MESSAGES: 5
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isMessageProcessed', () => {
    it('debería retornar false para un mensaje nuevo', () => {
      const msgId = 'msg_123';
      
      const result = rateLimiter.isMessageProcessed(msgId);
      
      expect(result).toBe(false);
      expect(rateLimiter.processedMessages.has(msgId)).toBe(true);
    });

    it('debería retornar true para un mensaje ya procesado', () => {
      const msgId = 'msg_456';
      
      // Primera vez
      expect(rateLimiter.isMessageProcessed(msgId)).toBe(false);
      
      // Segunda vez
      expect(rateLimiter.isMessageProcessed(msgId)).toBe(true);
    });

    it('debería manejar múltiples mensajes diferentes', () => {
      const msgIds = ['msg_1', 'msg_2', 'msg_3'];
      
      msgIds.forEach(msgId => {
        expect(rateLimiter.isMessageProcessed(msgId)).toBe(false);
      });
      
      // Verificar que todos están registrados
      msgIds.forEach(msgId => {
        expect(rateLimiter.processedMessages.has(msgId)).toBe(true);
      });
    });

    it('debería manejar diferentes tipos de IDs', () => {
      const stringId = 'string_msg';
      const numberId = 123;
      const objectId = { id: 'object_msg' };
      
      expect(rateLimiter.isMessageProcessed(stringId)).toBe(false);
      expect(rateLimiter.isMessageProcessed(numberId)).toBe(false);
      expect(rateLimiter.isMessageProcessed(objectId)).toBe(false);
      
      expect(rateLimiter.processedMessages.has(stringId)).toBe(true);
      expect(rateLimiter.processedMessages.has(numberId)).toBe(true);
      expect(rateLimiter.processedMessages.has(objectId)).toBe(true);
    });
  });

  describe('isUserSpamming', () => {
    it('debería permitir mensajes dentro del límite', () => {
      const userPhone = '573001234567';
      
      // Enviar 3 mensajes (menos que el límite de 5)
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.isUserSpamming(userPhone);
        expect(result).toBe(false);
      }
      
      // Verificar que se guardaron los timestamps
      const timestamps = rateLimiter.userMessageCount.get(userPhone);
      expect(timestamps).toHaveLength(3);
    });

    it('debería detectar spam cuando se excede el límite', () => {
      const userPhone = '573001234568';
      
      // Enviar 5 mensajes (límite exacto)
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.isUserSpamming(userPhone);
        expect(result).toBe(false);
      }
      
      // El sexto mensaje debería ser detectado como spam
      const spamResult = rateLimiter.isUserSpamming(userPhone);
      expect(spamResult).toBe(true);
    });

    it('debería manejar múltiples usuarios independientemente', () => {
      const user1 = '573001234567';
      const user2 = '573001234568';
      
      // Usuario 1 envía 3 mensajes
      for (let i = 0; i < 3; i++) {
        rateLimiter.isUserSpamming(user1);
      }
      
      // Usuario 2 envía 3 mensajes
      for (let i = 0; i < 3; i++) {
        rateLimiter.isUserSpamming(user2);
      }
      
      // Ninguno debería ser spam
      expect(rateLimiter.userMessageCount.get(user1)).toHaveLength(3);
      expect(rateLimiter.userMessageCount.get(user2)).toHaveLength(3);
    });

    it('debería limpiar timestamps antiguos', () => {
      const userPhone = '573001234569';
      const now = Date.now();
      
      // Simular timestamps antiguos
      const oldTimestamps = [
        now - 70000, // 70 segundos atrás (fuera de ventana)
        now - 65000, // 65 segundos atrás (fuera de ventana)
        now - 5000   // 5 segundos atrás (dentro de ventana)
      ];
      
      // Establecer timestamps antiguos manualmente
      rateLimiter.userMessageCount.set(userPhone, oldTimestamps);
      
      // Verificar comportamiento
      const result = rateLimiter.isUserSpamming(userPhone);
      expect(result).toBe(false);
      
      // Debería mantener solo el timestamp reciente
      const currentTimestamps = rateLimiter.userMessageCount.get(userPhone);
      expect(currentTimestamps).toHaveLength(2); // El antiguo se eliminó + el nuevo
      expect(currentTimestamps.every(ts => now - ts < 60000)).toBe(true);
    });

    it('debería eliminar usuarios sin mensajes recientes', () => {
      const userPhone = '573001234570';
      const now = Date.now();
      
      // Establecer timestamps muy antiguos
      rateLimiter.userMessageCount.set(userPhone, [
        now - 120000, // 2 minutos atrás
        now - 90000   // 1.5 minutos atrás
      ]);
      
      // Ejecutar limpieza automática
      jest.advanceTimersByTime(60000); // Avanzar 1 minuto
      
      // Verificar que el usuario fue eliminado
      expect(rateLimiter.userMessageCount.has(userPhone)).toBe(false);
    });
  });

  describe('limpieza automática', () => {
    it('debería limpiar processedMessages cuando excede el límite', () => {
      // Llenar el Set con más de 10000 mensajes
      for (let i = 0; i < 10001; i++) {
        rateLimiter.processedMessages.add(`msg_${i}`);
      }
      
      expect(rateLimiter.processedMessages.size).toBe(10001);
      
      // Ejecutar limpieza automática
      jest.advanceTimersByTime(60000); // Avanzar 1 minuto
      
      // El Set debería estar vacío
      expect(rateLimiter.processedMessages.size).toBe(0);
    });

    it('debería ejecutar limpieza cada minuto', () => {
      const userPhone = '573001234571';
      const now = Date.now();
      
      // Establecer timestamps que serán limpiados
      rateLimiter.userMessageCount.set(userPhone, [now - 70000]);
      
      // Antes de la limpieza, el usuario debería existir
      expect(rateLimiter.userMessageCount.has(userPhone)).toBe(true);
      
      // Ejecutar limpieza automática
      jest.advanceTimersByTime(60000); // Avanzar 1 minuto
      
      // Después de la limpieza, el usuario debería ser eliminado
      expect(rateLimiter.userMessageCount.has(userPhone)).toBe(false);
    });

    it('debería preservar mensajes recientes durante la limpieza', () => {
      const userPhone = '573001234572';
      const now = Date.now();
      
      // Establecer timestamps mixtos
      rateLimiter.userMessageCount.set(userPhone, [
        now - 70000, // Se eliminará
        now - 5000   // Se preservará
      ]);
      
      // Ejecutar limpieza automática
      jest.advanceTimersByTime(60000); // Avanzar 1 minuto
      
      // Verificar que solo queda el timestamp reciente
      const remainingTimestamps = rateLimiter.userMessageCount.get(userPhone);
      expect(remainingTimestamps).toHaveLength(1);
      expect(remainingTimestamps[0]).toBe(now - 5000);
    });

    it('debería manejar múltiples ciclos de limpieza', () => {
      const userPhone = '573001234573';
      const now = Date.now();
      
      // Primer ciclo: agregar timestamps que se limpiarán
      rateLimiter.userMessageCount.set(userPhone, [now - 70000]);
      
      // Ejecutar primera limpieza
      jest.advanceTimersByTime(60000);
      expect(rateLimiter.userMessageCount.has(userPhone)).toBe(false);
      
      // Segundo ciclo: agregar nuevos timestamps
      rateLimiter.isUserSpamming(userPhone); // Agrega timestamp actual
      
      // Ejecutar segunda limpieza (no debería eliminar nada)
      jest.advanceTimersByTime(30000); // 30 segundos después
      
      // El usuario debería seguir existiendo
      expect(rateLimiter.userMessageCount.has(userPhone)).toBe(true);
    });
  });

  describe('configuración dinámica', () => {
    it('debería usar configuración personalizada', () => {
      config.RATE_LIMIT = {
        WINDOW_MS: 30000, // 30 segundos
        MAX_MESSAGES: 3
      };
      
      const userPhone = '573001234574';
      
      // Enviar 2 mensajes (debajo del límite)
      for (let i = 0; i < 2; i++) {
        expect(rateLimiter.isUserSpamming(userPhone)).toBe(false);
      }
      
      // El tercer mensaje debería ser spam
      expect(rateLimiter.isUserSpamming(userPhone)).toBe(true);
    });

    it('debería respetar la ventana de tiempo configurada', () => {
      config.RATE_LIMIT = {
        WINDOW_MS: 120000, // 2 minutos
        MAX_MESSAGES: 5
      };
      
      const userPhone = '573001234575';
      const now = Date.now();
      
      // Establecer timestamp antiguo pero dentro de la ventana
      rateLimiter.userMessageCount.set(userPhone, [now - 100000]);
      
      // Debería contar como mensaje válido
      const result = rateLimiter.isUserSpamming(userPhone);
      expect(result).toBe(false);
      
      // Debería tener 2 timestamps (el antiguo + el nuevo)
      const timestamps = rateLimiter.userMessageCount.get(userPhone);
      expect(timestamps).toHaveLength(2);
    });
  });

  describe('edge cases y validación', () => {
    it('debería manejar usuarios que nunca han enviado mensajes', () => {
      const userPhone = '573001234576';
      
      const result = rateLimiter.isUserSpamming(userPhone);
      
      expect(result).toBe(false);
      expect(rateLimiter.userMessageCount.has(userPhone)).toBe(true);
      expect(rateLimiter.userMessageCount.get(userPhone)).toHaveLength(1);
    });

    it('debería manejar mensajes con ID nulo o undefined', () => {
      expect(() => {
        rateLimiter.isMessageProcessed(null);
      }).not.toThrow();
      
      expect(() => {
        rateLimiter.isMessageProcessed(undefined);
      }).not.toThrow();
      
      expect(() => {
        rateLimiter.isMessageProcessed('');
      }).not.toThrow();
    });

    it('debería manejar teléfonos vacíos o nulos', () => {
      expect(() => {
        rateLimiter.isUserSpamming('');
      }).not.toThrow();
      
      expect(() => {
        rateLimiter.isUserSpamming(null);
      }).not.toThrow();
      
      expect(() => {
        rateLimiter.isUserSpamming(undefined);
      }).not.toThrow();
    });

    it('debería manejar configuración faltante', () => {
      // Simular configuración faltante
      const originalConfig = config.RATE_LIMIT;
      delete config.RATE_LIMIT;
      
      const userPhone = '573001234577';
      
      expect(() => {
        rateLimiter.isUserSpamming(userPhone);
      }).toThrow();
      
      // Restaurar configuración
      config.RATE_LIMIT = originalConfig;
    });

    it('debería manejar timestamps muy grandes', () => {
      const userPhone = '573001234578';
      const largeTimestamp = Number.MAX_SAFE_INTEGER;
      
      rateLimiter.userMessageCount.set(userPhone, [largeTimestamp]);
      
      const result = rateLimiter.isUserSpamming(userPhone);
      
      expect(result).toBe(false);
      expect(rateLimiter.userMessageCount.get(userPhone)).toHaveLength(2);
    });

    it('debería manejar timestamps negativos', () => {
      const userPhone = '573001234579';
      const negativeTimestamp = -1000;
      
      rateLimiter.userMessageCount.set(userPhone, [negativeTimestamp]);
      
      const result = rateLimiter.isUserSpamming(userPhone);
      
      expect(result).toBe(false);
      // El timestamp negativo debería ser filtrado (es muy antiguo)
      const timestamps = rateLimiter.userMessageCount.get(userPhone);
      expect(timestamps.every(ts => ts >= 0)).toBe(true);
    });

    it('debería mantener consistencia con operaciones concurrentes', () => {
      const userPhone = '573001234580';
      const promises = [];
      
      // Simular múltiples operaciones concurrentes
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve().then(() => rateLimiter.isUserSpamming(userPhone)));
      }
      
      return Promise.all(promises).then(results => {
        // Todos deberían completar sin errores
        expect(results.every(result => typeof result === 'boolean')).toBe(true);
        
        // Debería haber exactamente 10 timestamps
        const timestamps = rateLimiter.userMessageCount.get(userPhone);
        expect(timestamps).toHaveLength(10);
      });
    });
  });

  describe('memoria y rendimiento', () => {
    it('debería limitar el crecimiento del Set de processedMessages', () => {
      // Simular muchos mensajes
      for (let i = 0; i < 15000; i++) {
        rateLimiter.isMessageProcessed(`msg_${i}`);
      }
      
      expect(rateLimiter.processedMessages.size).toBe(15000);
      
      // Ejecutar limpieza
      jest.advanceTimersByTime(60000);
      
      // Debería estar vacío por el límite de 10000
      expect(rateLimiter.processedMessages.size).toBe(0);
    });

    it('debería liberar memoria de usuarios inactivos', () => {
      const users = [];
      
      // Crear muchos usuarios con timestamps antiguos
      for (let i = 0; i < 1000; i++) {
        const userPhone = `57300123${i.toString().padStart(6, '0')}`;
        users.push(userPhone);
        rateLimiter.userMessageCount.set(userPhone, [Date.now() - 120000]);
      }
      
      expect(rateLimiter.userMessageCount.size).toBe(1000);
      
      // Ejecutar limpieza
      jest.advanceTimersByTime(60000);
      
      // Todos los usuarios deberían ser eliminados
      expect(rateLimiter.userMessageCount.size).toBe(0);
    });

    it('debería manejar eficientemente la limpieza de timestamps', () => {
      const userPhone = '573001234581';
      const now = Date.now();
      
      // Crear muchos timestamps antiguos y algunos recientes
      const timestamps = [];
      for (let i = 0; i < 1000; i++) {
        if (i % 100 === 0) {
          timestamps.push(now - 1000); // Reciente
        } else {
          timestamps.push(now - 120000); // Antiguo
        }
      }
      
      rateLimiter.userMessageCount.set(userPhone, timestamps);
      
      // Ejecutar limpieza
      jest.advanceTimersByTime(60000);
      
      // Deberían quedar solo los timestamps recientes
      const remainingTimestamps = rateLimiter.userMessageCount.get(userPhone);
      expect(remainingTimestamps.length).toBeLessThan(50); // Solo los recientes + el nuevo
      expect(remainingTimestamps.every(ts => now - ts < 60000)).toBe(true);
    });
  });
});
