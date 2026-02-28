
import 'dotenv/config';
import conversationService from './services/conversationService';
import ConfigProvider from './core/config/ConfigProvider';
import whatsappService from './services/whatsappService';
import logger from './utils/logger';

// Mock WhatsApp para ver la respuesta aquí
(whatsappService as any).sendMessage = async (to: string, text: string) => {
    console.log(`\n🤖 [MIEL RESPONDE]:\n"${text}"\n`);
};

async function startSimulation() {
    console.log("🏁 INICIANDO SIMULACIÓN DE CONVERSACIÓN...\n");

    try {
        await ConfigProvider.init();
        const testPhone = "573143855079";

        const messages = [
            "Hola, quiero bañar a mis perritos Lucas y Tobi mañana a las 10.",
            "Ay, qué pena. Son dos perritos. ¿Puedo agendar a los dos para esa misma hora?",
            "Okey, entonces agenda a Lucas para las 10 mañana y a Tobi para las 11.",
            "Muchas gracias! Eres la mejor. ¿Me das la bienvenida al estudio?"
        ];

        for (const msg of messages) {
            console.log(`👤 [CLIENTE]: "${msg}"`);
            await conversationService.handleIncomingMessage(testPhone, msg);
            // El embudo tiene un delay de 3s, esperamos 6s para estar seguros de la respuesta
            await new Promise(resolve => setTimeout(resolve, 6000));
        }

    } catch (error) {
        console.error("❌ ERROR SIMULACIÓN:", error);
    }
}

startSimulation();
