
import conversationService from './services/conversationService';
import ConfigProvider from './core/config/ConfigProvider';
import whatsappService from './services/whatsappService';

// Mock WhatsApp
(whatsappService as any).sendMessage = async (to: string, text: string) => {
    console.log(`\n--- [SALIDA WHATSAPP A ${to}] ---`);
    console.log(text);
    console.log('-----------------------------------\n');
};

async function runTest() {
    console.log("🚀 INICIANDO TEST DE FUEGO - MIEL 🐾");

    try {
        await ConfigProvider.init();
        const testPhone = "573000000000";

        const scenarios = [
            {
                name: "SALUDO Y MULTI-MASCOTA",
                messages: [
                    "Hola! Quisiera info de precios para mis dos mascotas, una se llama Luna y el otro Sol.",
                ]
            }
        ];

        for (const scenario of scenarios) {
            console.log(`\n\n=== 🧪 ESCENARIO: ${scenario.name} ===`);
            for (const msg of scenario.messages) {
                console.log(`\n[CLIENTE]: ${msg}`);
                await conversationService.handleIncomingMessage(testPhone, msg);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        console.log("\n✅ TEST FINALIZADO.");
        process.exit(0);

    } catch (error) {
        console.error("❌ ERROR EN EL TEST:", error);
        process.exit(1);
    }
}

runTest();
