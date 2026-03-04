// Mockear módulos ANTES de cualquier importación
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(function() {
      return mockLogger;
    }),
    level: 'info'
  };
  
  const mockPino = jest.fn(() => mockLogger) as any;
  mockPino.transport = jest.fn();
  (mockPino as any).stdTimeFunctions = {
    isoTime: jest.fn()
  };
  
  return mockPino;
});

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn()
}));

// Ahora sí importamos después de los mocks
const logger = require('@/utils/logger').default;
const { performanceLogger, securityLogger, auditLogger } = require('@/utils/logger');

describe('Logger Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('debería exportar el logger principal', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('debería exportar loggers especializados', () => {
      expect(performanceLogger).toBeDefined();
      expect(securityLogger).toBeDefined();
      expect(auditLogger).toBeDefined();
      
      expect(typeof performanceLogger.info).toBe('function');
      expect(typeof securityLogger.warn).toBe('function');
      expect(typeof auditLogger.info).toBe('function');
    });
  });

  describe('logger levels', () => {
    it('securityLogger debería tener nivel warn', () => {
      // El nivel se establece después de la creación del child logger
      expect(securityLogger.level).toBe('warn');
    });

    it('auditLogger debería tener nivel info', () => {
      expect(auditLogger.level).toBe('info');
    });
  });

  describe('child loggers creation', () => {
    it('debería crear child loggers con componentes específicos', () => {
      const pino = require('pino');
      
      // Los child loggers se crean durante la inicialización del módulo
      expect(pino().child).toHaveBeenCalledWith({ component: 'performance' });
      expect(pino().child).toHaveBeenCalledWith({ component: 'security' });
      expect(pino().child).toHaveBeenCalledWith({ component: 'audit' });
    });
  });

  describe('logger functionality', () => {
    it('debería poder llamar a los métodos del logger principal', () => {
      logger.info('test info');
      logger.warn('test warn');
      logger.error('test error');
      logger.debug('test debug');
      
      expect(logger.info).toHaveBeenCalledWith('test info');
      expect(logger.warn).toHaveBeenCalledWith('test warn');
      expect(logger.error).toHaveBeenCalledWith('test error');
      expect(logger.debug).toHaveBeenCalledWith('test debug');
    });

    it('debería poder llamar a los métodos de los loggers especializados', () => {
      performanceLogger.info('performance test');
      securityLogger.warn('security test');
      auditLogger.info('audit test');
      
      expect(performanceLogger.info).toHaveBeenCalledWith('performance test');
      expect(securityLogger.warn).toHaveBeenCalledWith('security test');
      expect(auditLogger.info).toHaveBeenCalledWith('audit test');
    });
  });

  describe('pino configuration verification', () => {
    it('debería haber llamado a pino durante la inicialización', () => {
      const pino = require('pino');
      expect(pino).toHaveBeenCalled();
    });

    it('debería haber configurado transport', () => {
      const pino = require('pino');
      expect(pino.transport).toHaveBeenCalled();
    });

    it('debería haber verificado el directorio de logs', () => {
      const fs = require('fs');
      expect(fs.existsSync).toHaveBeenCalled();
    });
  });
});
