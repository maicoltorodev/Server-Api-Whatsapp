const AIService = require('@/services/aiService');
const logger = require('@/utils/logger').default;
const toolService = require('@/services/toolService');

// Mockear dependencias externas
jest.mock('@/config/ai', () => ({
  genAI: {
    getGenerativeModel: jest.fn()
  },
  tools: []
}));

jest.mock('@google/generative-ai', () => ({
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'harassment',
    HARM_CATEGORY_HATE_SPEECH: 'hate_speech',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'sexually_explicit',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'dangerous_content'
  },
  HarmBlockThreshold: {
    BLOCK_NONE: 'block_none'
  }
}));

jest.mock('@/config', () => ({
  TIMEZONE: 'America/Bogota'
}));

jest.mock('@/services/toolService', () => ({
  someTool: jest.fn(),
  anotherTool: jest.fn()
}));

jest.mock('@/utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('@/core/config/ConfigProvider', () => ({
  default: {
    getConfig: jest.fn(() => ({
      ai_model: 'gemini-flash-latest',
      max_tokens: 1000,
      temperature: 0.7
    })),
    getCatalogString: jest.fn(() => 'CATALOG_STRING')
  }
}));

jest.mock('@/core/ai/PromptBuilder', () => ({
  SystemPromptBuilder: jest.fn().mockImplementation(() => ({
    setTimeContext: jest.fn().mockReturnThis(),
    setLeadContext: jest.fn().mockReturnThis(),
    setMedicalHistory: jest.fn().mockReturnThis(),
    setCatalog: jest.fn().mockReturnThis(),
    setOperations: jest.fn().mockReturnThis(),
    setMasterInstructions: jest.fn().mockReturnThis(),
    setHardcodedRules: jest.fn().mockReturnThis(),
    build: jest.fn(() => 'SYSTEM_INSTRUCTION')
  }))
}));

describe('AIService', () => {
  let aiService;
  let mockModel;
  let mockChatSession;

  beforeEach(() => {
    jest.clearAllMocks();
    aiService = require('@/services/aiService');
    
    // Mock del modelo y chat session
    mockModel = {
      startChat: jest.fn(),
      systemInstruction: 'SYSTEM_INSTRUCTION',
      safetySettings: []
    };
    
    mockChatSession = {
      sendMessage: jest.fn()
    };
    
    const { genAI } = require('@/config/ai');
    genAI.getGenerativeModel.mockReturnValue(mockModel);
    mockModel.startChat.mockReturnValue(mockChatSession);
  });

  describe('initializeModel', () => {
    it('debería inicializar el modelo con configuración correcta', async () => {
      const leadData = {
        phone: '573001234567',
        current_step: 'initial',
        summary: 'Test summary',
        medical_history: 'Test history'
      };

      const result = await aiService.initializeModel(leadData);

      expect(result).toBe(mockModel);
      expect(require('@/core/config/ConfigProvider').default.getConfig).toHaveBeenCalled();
      expect(require('@/core/config/ConfigProvider').default.getCatalogString).toHaveBeenCalled();
      expect(require('../core/ai/PromptBuilder').SystemPromptBuilder).toHaveBeenCalled();
      
      // Verificar que se construyó el prompt correctamente
      const SystemPromptBuilder = require('@/core/ai/PromptBuilder').SystemPromptBuilder;
      expect(SystemPromptBuilder.setTimeContext).toHaveBeenCalledWith('America/Bogota');
      expect(SystemPromptBuilder.setLeadContext).toHaveBeenCalledWith('initial', 'Test summary');
      expect(SystemPromptBuilder.setMedicalHistory).toHaveBeenCalledWith('Test history');
      expect(SystemPromptBuilder.setCatalog).toHaveBeenCalledWith('CATALOG_STRING');
      
      const { genAI } = require('@/config/ai');
      expect(genAI.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-flash-latest',
        tools: [],
        systemInstruction: 'SYSTEM_INSTRUCTION',
        safetySettings: expect.arrayContaining([
          expect.objectContaining({
            category: 'harassment',
            threshold: 'block_none'
          }),
          expect.objectContaining({
            category: 'hate_speech',
            threshold: 'block_none'
          }),
          expect.objectContaining({
            category: 'sexually_explicit',
            threshold: 'block_none'
          }),
          expect.objectContaining({
            category: 'dangerous_content',
            threshold: 'block_none'
          })
        ])
      });
    });

    it('debería funcionar sin leadData', async () => {
      const result = await aiService.initializeModel();

      expect(result).toBe(mockModel);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Inicializando instancia de modelo para undefined')
      );
    });

    it('debería loggear el sistema de instrucciones', async () => {
      await aiService.initializeModel();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Pre-Prompt Ensamblado')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('SYSTEM_INSTRUCTION')
      );
    });
  });

  describe('prepareContext', () => {
    it('debería ser un alias de initializeModel', async () => {
      const leadData = { phone: '573001234567' };

      const result1 = await aiService.initializeModel(leadData);
      const result2 = await aiService.prepareContext(leadData);

      expect(result1).toBe(result2);
      expect(require('@/core/config/ConfigProvider').default.getConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('_filterSafetyFalsePositives', () => {
    it('debería filtrar palabras sensibles', () => {
      const result = aiService._filterSafetyFalsePositives('Esta es una loli');
      expect(result).toBe('Esta es una Loly');
    });

    it('debería manejar mayúsculas y minúsculas', () => {
      const result1 = aiService._filterSafetyFalsePositives('Esta es una Loli');
      const result2 = aiService._filterSafetyFalsePositives('Esta es una loli');
      
      expect(result1).toBe('Esta es una Loly');
      expect(result2).toBe('Esta es una Loly');
    });

    it('debería manejar texto nulo o indefinido', () => {
      expect(aiService._filterSafetyFalsePositives(null)).toBe(null);
      expect(aiService._filterSafetyFalsePositives(undefined)).toBe(undefined);
      expect(aiService._filterSafetyFalsePositives('')).toBe('');
    });

    it('debería dejar pasar texto normal', () => {
      const result = aiService._filterSafetyFalsePositives('Hola, ¿cómo estás?');
      expect(result).toBe('Hola, ¿cómo estás?');
    });
  });

  describe('generateResponse', () => {
    it('debería generar respuesta exitosamente', async () => {
      const leadData = { phone: '573001234567' };
      await aiService.initializeModel(leadData);

      const mockResponse = {
        response: {
          text: 'Respuesta generada',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 15,
            totalTokenCount: 25
          },
          functionCalls: jest.fn().mockReturnValue([])
        }
      };

      mockChatSession.sendMessage.mockResolvedValue(mockResponse);

      const result = await aiService.generateResponse(mockModel, 'Hola', []);

      expect(result).toEqual({
        functionCalls: [],
        text: 'Respuesta generada',
        chatSession: mockChatSession
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Tokens: Prompt=10')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Gemini respondió con TEXTO directamente')
      );
    });

    it('debería manejar function calls', async () => {
      const leadData = { phone: '573001234567' };
      await aiService.initializeModel(leadData);

      const mockFunctionCall = { name: 'someTool', args: { param: 'value' } };
      const mockResponse = {
        response: {
          text: 'Respuesta con tool',
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 8,
            totalTokenCount: 20
          },
          functionCalls: jest.fn().mockReturnValue([mockFunctionCall])
        }
      };

      mockChatSession.sendMessage.mockResolvedValue(mockResponse);

      const result = await aiService.generateResponse(mockModel, 'Usa una herramienta', []);

      expect(result.functionCalls).toEqual([mockFunctionCall]);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Gemini respondió con CALL: someTool')
      );
    });

    it('debería lanzar error si el modelo no está inicializado', async () => {
      await expect(aiService.generateResponse(null, 'Hola')).rejects.toThrow('IA no inicializada.');
    });

    it('debería sanitizar el mensaje y el historial', async () => {
      const leadData = { phone: '573001234567' };
      await aiService.initializeModel(leadData);

      const mockResponse = {
        response: { text: 'Respuesta', functionCalls: jest.fn().mockReturnValue([]) }
      };
      mockChatSession.sendMessage.mockResolvedValue(mockResponse);

      await aiService.generateResponse(mockModel, 'Esta es una loli', []);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Enviando prompt del usuario')
      );
      // El mensaje debe ser filtrado
      expect(logger.info.mock.calls[2][0]).toContain('Esta es una Loly');
    });

    it('debería manejar historial vacío', async () => {
      const leadData = { phone: '573001234567' };
      await aiService.initializeModel(leadData);

      const mockResponse = {
        response: { text: 'Respuesta', functionCalls: jest.fn().mockReturnValue([]) }
      };
      mockChatSession.sendMessage.mockResolvedValue(mockResponse);

      await aiService.generateResponse(mockModel, 'Hola', []);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('con historial sanitizado (0 msgs)')
      );
    });
  });

  describe('processFunctionCalls', () => {
    it('debería procesar function calls exitosamente', async () => {
      const leadData = { phone: '573001234567' };
      await aiService.initializeModel(leadData);

      const calls = [
        { name: 'someTool', args: { param: 'value' } },
        { name: 'anotherTool', args: { param2: 'value2' } }
      ];

      toolService.someTool.mockResolvedValue('Tool result 1');
      toolService.anotherTool.mockResolvedValue('Tool result 2');

      const mockToolResponse = {
        response: {
          text: 'Respuesta después de herramientas',
          functionCalls: jest.fn().mockReturnValue([]),
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 3,
            totalTokenCount: 8
          }
        }
      };

      mockChatSession.sendMessage.mockResolvedValue(mockToolResponse);

      const result = await aiService.processFunctionCalls(calls, mockChatSession, '573001234567');

      expect(result.text).toBe('Respuesta después de herramientas');
      expect(toolService.someTool).toHaveBeenCalledWith({ param: 'value' }, '573001234567');
      expect(toolService.anotherTool).toHaveBeenCalledWith({ param2: 'value2' }, '573001234567');
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Tokens (Herramienta): Prompt=5')
      );
    });

    it('debería manejar errores en herramientas', async () => {
      const leadData = { phone: '573001234567' };
      await aiService.initializeModel(leadData);

      const calls = [{ name: 'errorTool', args: {} }];
      const error = new Error('Tool error');
      toolService.errorTool.mockRejectedValue(error);

      const mockToolResponse = {
        response: {
          text: 'Respuesta con error',
          functionCalls: jest.fn().mockReturnValue([]),
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 3,
            totalTokenCount: 8
          }
        }
      };

      mockChatSession.sendMessage.mockResolvedValue(mockToolResponse);

      const result = await aiService.processFunctionCalls(calls, mockChatSession, '573001234567');

      expect(result.text).toBe('Respuesta con error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error fatal en errorTool'),
        { error }
      );
    });

    it('debería manejar llamadas anidadas', async () => {
      const leadData = { phone: '573001234567' };
      await aiService.initializeModel(leadData);

      // Primera llamada
      const firstCalls = [{ name: 'tool1', args: {} }];
      toolService.tool1.mockResolvedValue('Result 1');

      const mockFirstResponse = {
        response: {
          text: '',
          functionCalls: jest.fn().mockReturnValue([{ name: 'tool2', args: {} }]),
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 }
        }
      };

      // Segunda llamada
      const mockSecondResponse = {
        response: {
          text: 'Respuesta final',
          functionCalls: jest.fn().mockReturnValue([]),
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 }
        }
      };

      mockChatSession.sendMessage
        .mockResolvedValueOnce(mockFirstResponse)
        .mockResolvedValueOnce(mockSecondResponse);

      const result = await aiService.processFunctionCalls(firstCalls, mockChatSession, '573001234567');

      expect(result.text).toBe('Respuesta final');
      expect(toolService.tool1).toHaveBeenCalled();
      expect(toolService.tool2).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Gemini pidió más llamadas: tool2')
      );
    });

    it('debería manejar caso sin llamadas', async () => {
      const leadData = { phone: '573001234567' };
      await aiService.initializeModel(leadData);

      const result = await aiService.processFunctionCalls([], mockChatSession, '573001234567');

      expect(result.text).toBe('');
      expect(result.chatSession).toBe(mockChatSession);
    });
  });

  describe('_sanitizeHistory', () => {
    it('debería manejar historial vacío', () => {
      const result = aiService._sanitizeHistory([]);
      expect(result).toEqual([]);
    });

    it('debería remover último mensaje si es del usuario', () => {
      const history = [
        { role: 'model', parts: [{ text: 'Respuesta 1' }] },
        { role: 'user', parts: [{ text: 'Pregunta 1' }] }
      ];

      const result = aiService._sanitizeHistory(history);

      expect(result).toEqual([
        { role: 'model', parts: [{ text: 'Respuesta 1' }] }
      ]);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('quitando último mensaje')
      );
    });

    it('debería limitar tamaño del historial', () => {
      const longHistory = Array(10).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'model',
        parts: [{ text: `Mensaje ${i}` }]
      }));

      const result = aiService._sanitizeHistory(longHistory);

      expect(result.length).toBeLessThanOrEqual(6);
    });

    it('debería asegurar que el primer mensaje sea del usuario', () => {
      const history = [
        { role: 'model', parts: [{ text: 'Respuesta 1' }] },
        { role: 'model', parts: [{ text: 'Respuesta 2' }] },
        { role: 'user', parts: [{ text: 'Pregunta 1' }] }
      ];

      const result = aiService._sanitizeHistory(history);

      expect(result[0].role).toBe('user');
      expect(result).toEqual([
        { role: 'user', parts: [{ text: 'Pregunta 1' }] }
      ]);
    });

    it('debería filtrar falsos positivos en el historial', () => {
      const history = [
        { role: 'user', parts: [{ text: 'Esta es una loli' }] },
        { role: 'model', parts: [{ text: 'Respuesta' }] }
      ];

      const result = aiService._sanitizeHistory(history);

      expect(result[0].parts[0].text).toBe('Esta es una Loly');
    });

    it('debería combinar mensajes consecutivos del mismo rol', () => {
      const history = [
        { role: 'user', parts: [{ text: 'Primera parte' }] },
        { role: 'user', parts: [{ text: 'Segunda parte' }] },
        { role: 'model', parts: [{ text: 'Respuesta' }] }
      ];

      const result = aiService._sanitizeHistory(history);

      expect(result).toEqual([
        { role: 'user', parts: [{ text: 'Primera parte Segunda parte' }] },
        { role: 'model', parts: [{ text: 'Respuesta' }] }
      ]);
    });

    it('debería preservar function calls', () => {
      const history = [
        { role: 'user', parts: [{ text: 'Pregunta' }] },
        { 
          role: 'model', 
          parts: [{ text: 'Respuesta' }],
          functionCall: { name: 'tool', args: {} }
        }
      ];

      const result = aiService._sanitizeHistory(history);

      expect(result[1].functionCall).toEqual({ name: 'tool', args: {} });
    });
  });

  describe('_withRetry', () => {
    it('debería tener éxito en el primer intento', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      
      const result = await aiService._withRetry(successFn);

      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    it('debería reintentar en caso de timeout', async () => {
      const timeoutFn = jest.fn()
        .mockRejectedValueOnce(new Error('Timeout de 20s en Gemini API'))
        .mockResolvedValueOnce('success');

      const result = await aiService._withRetry(timeoutFn);

      expect(result).toBe('success');
      expect(timeoutFn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Intento 1 fallido')
      );
    });

    it('debería reintentar en caso de error de red', async () => {
      const networkErrorFn = jest.fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce('success');

      const result = await aiService._withRetry(networkErrorFn);

      expect(result).toBe('success');
      expect(networkErrorFn).toHaveBeenCalledTimes(2);
    });

    it('debería reintentar en caso de error 503', async () => {
      const error503Fn = jest.fn()
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValueOnce('success');

      const result = await aiService._withRetry(error503Fn);

      expect(result).toBe('success');
      expect(error503Fn).toHaveBeenCalledTimes(2);
    });

    it('debería reintentar en caso de error 429', async () => {
      const error429Fn = jest.fn()
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockResolvedValueOnce('success');

      const result = await aiService._withRetry(error429Fn);

      expect(result).toBe('success');
      expect(error429Fn).toHaveBeenCalledTimes(2);
    });

    it('debería lanzar error después de agotar reintentos', async () => {
      const persistentErrorFn = jest.fn()
        .mockRejectedValue(new Error('Persistent error'));

      await expect(aiService._withRetry(persistentErrorFn, 2)).rejects.toThrow('Persistent error');
      expect(persistentErrorFn).toHaveBeenCalledTimes(2);
    });

    it('debería usar delays exponenciales', async () => {
      jest.useFakeTimers();
      const errorFn = jest.fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      aiService._withRetry(errorFn, 2);
      
      // Avanzar tiempo para simular los delays
      jest.advanceTimersByTime(1000); // 1s
      jest.advanceTimersByTime(2000); // 2s total

      expect(errorFn).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('no debería reintentar errores no recuperables', async () => {
      const validationErrorFn = jest.fn()
        .mockRejectedValue(new Error('Validation failed'));

      await expect(aiService._withRetry(validationErrorFn)).rejects.toThrow('Validation failed');
      expect(validationErrorFn).toHaveBeenCalledTimes(1);
    });
  });
});
