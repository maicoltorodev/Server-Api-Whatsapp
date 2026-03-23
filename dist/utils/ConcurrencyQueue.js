"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyQueue = void 0;
const logger_1 = __importDefault(require("./logger"));
class ConcurrencyQueue {
    concurrency;
    running;
    queue;
    constructor(concurrency = 5) {
        // Límite de conexiones simultáneas (ej. cuántos procesos de IA pueden correr al mismo tiempo)
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }
    /**
     * Encola una tarea asíncrona para ser ejecutada cuando haya capacidad.
     */
    enqueue(task) {
        this.queue.push(task);
        logger_1.default.debug(`[QUEUE] +1 Tarea encolada. Total en espera: ${this.queue.length}`);
        this.processNext();
    }
    /**
     * Motor interno de la cola.
     */
    async processNext() {
        // Bloqueo estricto: Si ya estamos al máximo, no hacer nada hasta que se libere un hilo.
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }
        const task = this.queue.shift();
        if (!task)
            return;
        this.running++;
        logger_1.default.info(`[QUEUE] 🚦 Ejecutando tarea (Acelerador: ${this.running}/${this.concurrency} | Fila de espera: ${this.queue.length})`);
        try {
            await task();
        }
        catch (error) {
            logger_1.default.error(`[QUEUE] 💥 Error en la ejecución de la tarea encolada`, { error });
        }
        finally {
            this.running--;
            logger_1.default.debug(`[QUEUE] ✅ Tarea terminada. (Acelerador: ${this.running}/${this.concurrency})`);
            // Inmediatamente jalar la siguiente tarea en la fila
            this.processNext();
        }
    }
    /**
     * Espera a que la cola esté vacía (Para apagar el servidor sin perder datos)
     */
    async waitForEmpty() {
        if (this.running === 0 && this.queue.length === 0)
            return;
        return new Promise((resolve) => {
            const check = () => {
                if (this.running === 0 && this.queue.length === 0) {
                    resolve(undefined);
                }
                else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
}
exports.ConcurrencyQueue = ConcurrencyQueue;
exports.default = new ConcurrencyQueue(3); // Solo permitimos 3 chats con IA procesándose al mismo tiempo
