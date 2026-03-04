const messageQueue = require('@/utils/messageQueue');
const conversationService = require('@/services/conversationService');
const concurrencyQueue = require('@/utils/ConcurrencyQueue').default;
const logger = require('@/utils/logger').default;

// Mockear dependencias
jest.mock('@/services/conversationService', () => ({
  handleIncomingMessage: jest.fn()
}));

jest.mock('@/utils/ConcurrencyQueue', () => ({
  default: {
    enqueue: jest.fn()
  }
}));

jest.mock('@/utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

jest.useFakeTimers();

describe('MessageQueue (Embudo Antispam)', () => {
  beforeEach(() => {
    messageQueue.queues.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('agrupación de mensajes', () => {
    it('debe juntar múltiples mensajes del mismo número en uno solo', async () => {
      const telefono = '573001234567';

      // Cliente escribe 3 mensajes rápidos
      messageQueue.enqueueMessage(telefono, 'Hola');
      messageQueue.enqueueMessage(telefono, 'Tengo una urgencia');
      messageQueue.enqueueMessage(telefono, 'mi perro esta mal');

      // Adelantar el tiempo 3 segundos exactos
      jest.advanceTimersByTime(3000);

      // Dar tiempo a los Promises de resolverse
      await Promise.resolve();

      // Verificaciones
      expect(concurrencyQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(concurrencyQueue.enqueue).toHaveBeenCalledWith(
        expect.any(Function)
      );
      
      // Ejecutar la función que se encoló
      const enqueuedTask = (concurrencyQueue.enqueue as jest.Mock).mock.calls[0][0];
      await enqueuedTask();

      expect(conversationService.handleIncomingMessage).toHaveBeenCalledTimes(1);
      expect(conversationService.handleIncomingMessage).toHaveBeenCalledWith(
        telefono,
        'Hola. Tengo una urgencia. mi perro esta mal'
      );
      expect(messageQueue.queues.size).toBe(0); // Cola limpia
    });

    it('debe procesar mensajes de diferentes usuarios por separado', async () => {
      const userA = '111111';
      const userB = '222222';

      messageQueue.enqueueMessage(userA, 'hola bot');
      messageQueue.enqueueMessage(userB, 'precio?');

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      expect(concurrencyQueue.enqueue).toHaveBeenCalledTimes(2);
      
      // Ejecutar ambas tareas encoladas
      const tasks = (concurrencyQueue.enqueue as jest.Mock).mock.calls.map(call => call[0]);
      await Promise.all(tasks.map(task => task()));

      expect(conversationService.handleIncomingMessage).toHaveBeenCalledTimes(2);
      expect(conversationService.handleIncomingMessage).toHaveBeenCalledWith(userA, 'hola bot');
      expect(conversationService.handleIncomingMessage).toHaveBeenCalledWith(userB, 'precio?');
    });

    it('debe procesar un mensaje único correctamente', async () => {
      const telefono = '573001234567';
      const mensaje = 'Hola, necesito información';

      messageQueue.enqueueMessage(telefono, mensaje);

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      const enqueuedTask = (concurrencyQueue.enqueue as jest.Mock).mock.calls[0][0];
      await enqueuedTask();

      expect(conversationService.handleIncomingMessage).toHaveBeenCalledTimes(1);
      expect(conversationService.handleIncomingMessage).toHaveBeenCalledWith(
        telefono,
        mensaje
      );
    });
  });

  describe('control de tiempo (debounce)', () => {
    it('debe reiniciar el timer si llegan mensajes antes del timeout', async () => {
      const telefono = '573001234567';

      messageQueue.enqueueMessage(telefono, 'Primer mensaje');
      
      // Avanzar 2 segundos (menos que el timeout)
      jest.advanceTimersByTime(2000);
      
      // Llega otro mensaje, debe reiniciar el timer
      messageQueue.enqueueMessage(telefono, 'Segundo mensaje');
      
      // Avanzar otros 2 segundos (total 4, pero timer se reinició)
      jest.advanceTimersByTime(2000);
      
      // No debe haber procesado aún
      expect(concurrencyQueue.enqueue).not.toHaveBeenCalled();
      
      // Avanzar 1 segundo más para completar el timeout
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(concurrencyQueue.enqueue).toHaveBeenCalledTimes(1);
    });

    it('debe procesar después del tiempo exacto de espera', async () => {
      const telefono = '573001234567';

      messageQueue.enqueueMessage(telefono, 'Mensaje único');

      // No debe procesar antes de 3 segundos
      jest.advanceTimersByTime(2999);
      expect(concurrencyQueue.enqueue).not.toHaveBeenCalled();

      // Debe procesar exactamente a los 3 segundos
      jest.advanceTimersByTime(1);
      await Promise.resolve();

      expect(concurrencyQueue.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('manejo de errores', () => {
    it('debe manejar errores en el procesamiento de mensajes', async () => {
      const telefono = '573001234567';
      const error = new Error('Error en conversación');
      
      conversationService.handleIncomingMessage.mockRejectedValue(error);

      messageQueue.enqueueMessage(telefono, 'Mensaje que fallará');

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      const enqueuedTask = (concurrencyQueue.enqueue as jest.Mock).mock.calls[0][0];
      
      // No debe lanzar error
      await expect(enqueuedTask()).resolves.toBeUndefined();
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error crítico procesando mensaje desde la cola de concurrencia',
        { error }
      );
    });
  });

  describe('logging', () => {
    it('debe registrar cuando se recibe el primer mensaje', () => {
      const telefono = '573001234567';

      messageQueue.enqueueMessage(telefono, 'Hola');

      expect(logger.info).toHaveBeenCalledWith(
        '[EMBUDO] Recibiendo mensaje de 573001234567... Esperando 3s por si manda más.'
      );
    });

    it('debe registrar cuando hay una ráfaga de mensajes', () => {
      const telefono = '573001234567';

      messageQueue.enqueueMessage(telefono, 'Hola');
      messageQueue.enqueueMessage(telefono, 'Otro mensaje');

      // El segundo llamado debería ser el de ráfaga
      expect(logger.info).toHaveBeenNthCalledWith(2,
        '[EMBUDO] Ráfaga activa (2 msgs) para 573001234567. Reloj reiniciado a 3s.'
      );
    });

    it('debe registrar cuando se combina el bloque de mensajes', async () => {
      const telefono = '573001234567';

      messageQueue.enqueueMessage(telefono, 'Hola');
      messageQueue.enqueueMessage(telefono, 'Adiós');

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      const enqueuedTask = (concurrencyQueue.enqueue as jest.Mock).mock.calls[0][0];
      await enqueuedTask();

      // El tercer llamado debería ser el de bloque combinado
      expect(logger.info).toHaveBeenNthCalledWith(3,
        '[BLOQUE COMBINADO LISTO] -> Enviando a IA\nUsuario: 573001234567\nUnificado (2 envíos en 1): "Hola. Adiós"'
      );
    });
  });
});
