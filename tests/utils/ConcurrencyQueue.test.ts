const { ConcurrencyQueue } = require('@/utils/ConcurrencyQueue');
const logger = require('@/utils/logger').default;

// Mock del logger para evitar logs en tests
jest.mock('@/utils/logger', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ConcurrencyQueue', () => {
  let queue: any;
  let mockTask1: jest.Mock;
  let mockTask2: jest.Mock;
  let mockTask3: jest.Mock;

  beforeEach(() => {
    // Resetear mocks
    jest.clearAllMocks();
    
    // Crear instancia con concurrencia de 2 para tests
    queue = new (ConcurrencyQueue as any)(2);
    
    // Crear tareas mock
    mockTask1 = jest.fn().mockResolvedValue(undefined);
    mockTask2 = jest.fn().mockResolvedValue(undefined);
    mockTask3 = jest.fn().mockResolvedValue(undefined);
  });

  describe('enqueue', () => {
    it('debería encolar una tarea y ejecutarla inmediatamente si hay capacidad', async () => {
      queue.enqueue(mockTask1);
      
      // Esperar un tick para que se procese
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockTask1).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('🚦 Ejecutando tarea')
      );
    });

    it('debería respetar el límite de concurrencia', async () => {
      let runningCount = 0;
      let maxRunning = 0;
      
      const countingTask = jest.fn().mockImplementation(async () => {
        runningCount++;
        maxRunning = Math.max(maxRunning, runningCount);
        await new Promise(resolve => setTimeout(resolve, 100));
        runningCount--;
      });
      
      // Encolar 4 tareas (límite es 2)
      queue.enqueue(countingTask);
      queue.enqueue(countingTask);
      queue.enqueue(countingTask);
      queue.enqueue(countingTask);
      
      // Esperar a que todas terminen
      await queue.waitForEmpty();
      
      // Verificar que nunca se ejecutaron más de 2 simultáneamente
      expect(maxRunning).toBeLessThanOrEqual(2);
      expect(countingTask).toHaveBeenCalledTimes(4);
    });

    it('debería manejar errores en las tareas sin detener la cola', async () => {
      const failingTask = jest.fn().mockRejectedValue(new Error('Test error'));
      
      queue.enqueue(failingTask);
      queue.enqueue(mockTask2);
      
      // Esperar a que se procesen ambas
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(failingTask).toHaveBeenCalledTimes(1);
      expect(mockTask2).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('💥 Error'),
        expect.any(Object)
      );
    });
  });

  describe('waitForEmpty', () => {
    it('debería resolver inmediatamente si la cola está vacía', async () => {
      const result = queue.waitForEmpty();
      expect(result).resolves.toBeUndefined();
    });

    it('debería esperar hasta que todas las tareas terminen', async () => {
      const slowTask = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      queue.enqueue(slowTask);
      
      const startTime = Date.now();
      await queue.waitForEmpty();
      const endTime = Date.now();
      
      // Debe esperar al menos 100ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
      expect(slowTask).toHaveBeenCalledTimes(1);
    });

    it('debería esperar tanto tareas corriendo como en cola', async () => {
      const slowTask = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      queue.enqueue(slowTask);
      queue.enqueue(mockTask2); // Esta quedará en cola inicialmente
      queue.enqueue(mockTask3); // Esta también
      
      const startTime = Date.now();
      await queue.waitForEmpty();
      const endTime = Date.now();
      
      // Debe esperar a que todas terminen
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
      expect(slowTask).toHaveBeenCalledTimes(1);
      expect(mockTask2).toHaveBeenCalledTimes(1);
      expect(mockTask3).toHaveBeenCalledTimes(1);
    });
  });

  describe('control de concurrencia', () => {
    it('no debería ejecutar más tareas que el límite de concurrencia', async () => {
      const tasks = Array(5).fill(null).map(() => 
        jest.fn().mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 50))
        )
      );
      
      // Encolar todas las tareas
      tasks.forEach(task => queue.enqueue(task));
      
      // Esperar un tick para que empiecen
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Solo 2 deberían estar corriendo simultáneamente
      const runningTasks = tasks.filter(task => task.mock.calls.length > 0);
      expect(runningTasks.length).toBeLessThanOrEqual(2);
      
      // Esperar a que todas terminen
      await queue.waitForEmpty();
      
      // Todas deberían haberse ejecutado
      tasks.forEach(task => expect(task).toHaveBeenCalledTimes(1));
    });
  });

  describe('logging', () => {
    it('debería registrar cuando una tarea se encola', () => {
      queue.enqueue(mockTask1);
      
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('+1 Tarea encolada')
      );
    });

    it('debería registrar cuando una tarea termina', async () => {
      queue.enqueue(mockTask1);
      
      // Esperar a que termine
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('✅ Tarea terminada')
      );
    });
  });
});
