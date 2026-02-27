const rateLimiter = require('../../src/middleware/rateLimit');
const config = require('../../src/config');

describe('RateLimiter', () => {
    beforeEach(() => {
        rateLimiter.processedMessages.clear();
        rateLimiter.userMessageCount.clear();
    });

    it('debe identificar un mensaje como ya procesado (duplicado webhook)', () => {
        const msgId = 'wamid12345';

        // Primera vez no esta procesado
        expect(rateLimiter.isMessageProcessed(msgId)).toBe(false);

        // Segunda vez ya esta en set
        expect(rateLimiter.isMessageProcessed(msgId)).toBe(true);
    });

    it('debe detectar spam si un usuario manda mas del maximo en la ventana de tiempo', () => {
        const phone = '9999999999';
        const max = config.RATE_LIMIT.MAX_MESSAGES; // 10

        // Mandar maximos mensajes permitidos
        for (let i = 0; i < max; i++) {
            expect(rateLimiter.isUserSpamming(phone)).toBe(false);
        }

        // El mesaje max + 1 debe saltar spam
        expect(rateLimiter.isUserSpamming(phone)).toBe(true);
    });
});
