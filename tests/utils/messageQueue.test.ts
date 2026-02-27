const messageQueue = require('../../src/utils/messageQueue');
const conversationService = require('../../src/services/conversationService');

// Mockear el servicio de conversación para no hacer llamadas reales a BD/IA
jest.mock('../../src/services/conversationService', () => ({
    handleIncomingMessage: jest.fn()
}));

jest.useFakeTimers();

describe('MessageQueue (Embudo Antispam)', () => {
    beforeEach(() => {
        messageQueue.queues.clear();
        jest.clearAllMocks();
    });

    it('debe juntar multiples mensajes del mismo numero en uno solo', async () => {
        const telefono = '573001234567';

        // Cliente escribe 3 mensajes rapidos
        messageQueue.enqueueMessage(telefono, 'Hola');
        messageQueue.enqueueMessage(telefono, 'Tengo una urgencia');
        messageQueue.enqueueMessage(telefono, 'mi perro esta mal');

        // Adelantar el tiempo 3 segundos exactos
        jest.advanceTimersByTime(3000);

        // Dar tiempo a los Promises de resolverse
        await Promise.resolve();

        // Verificaciones
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

        expect(conversationService.handleIncomingMessage).toHaveBeenCalledTimes(2);
        expect(conversationService.handleIncomingMessage).toHaveBeenCalledWith(userA, 'hola bot');
        expect(conversationService.handleIncomingMessage).toHaveBeenCalledWith(userB, 'precio?');
    });
});
