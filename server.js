// --- IMPORTACIÓN DE LIBRERÍAS ---
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURACIÓN DEL SERVIDOR ---
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Variables críticas del Dueño y el Bot
const OWNER_NUMBER = process.env.OWNER_NUMBER;
const BOT_NUMBER = process.env.BOT_NUMBER;

// --- CONFIGURACIÓN DE SUPABASE ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- CONFIGURACIÓN DE HERRAMIENTAS DE IA ---
const tools = {
    functionDeclarations: [
        {
            name: "update_lead_info",
            description: "Actualiza la información del cliente y el estado del embudo de ventas.",
            parameters: {
                type: "OBJECT",
                properties: {
                    name: { type: "STRING" },
                    product_service: { type: "STRING" },
                    appointment_date: { type: "STRING" },
                    budget: { type: "STRING" },
                    current_step: { type: "STRING", enum: ["SALUDO", "CALIFICACION", "AGENDA", "CIERRE"] },
                    summary: { type: "STRING", description: "Resumen ejecutivo actualizado." }
                }
            }
        },
        {
            name: "transfer_to_human",
            description: "Detiene la IA y solicita intervención humana porque el cliente está frustrado o pide un agente.",
            parameters: {
                type: "OBJECT",
                properties: {
                    reason: { type: "STRING", description: "Breve motivo de la transferencia." }
                }
            }
        }
    ]
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- LÓGICA DE WEBHOOK ---
app.post('/webhook', async (req, res) => {
    const body = req.body;
    res.sendStatus(200);

    try {
        if (body.object === 'whatsapp_business_account') {
            const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            if (!message || !message.text) return;

            const from = message.from;
            const msgBody = message.text.body;
            const msgId = message.id;

            // --- 1. ¿ES EL DUEÑO INTERVINIENDO? ---
            if (from === OWNER_NUMBER) {
                console.log(`\n--- 👨‍💼 ACCIÓN DEL DUEÑO ---`);

                // A. Limpieza de sesiones viejas (TTL de 2 horas)
                const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
                await supabase.from('active_sessions').delete().lt('created_at', twoHoursAgo);

                // A. Comando para iniciar intervención: #intervenir_573...
                if (msgBody.startsWith('#intervenir_')) {
                    const clientPhone = msgBody.replace('#intervenir_', '').trim();
                    await supabase.from('leads').update({ bot_active: false }).eq('phone', clientPhone);
                    await supabase.from('active_sessions').upsert({ owner_phone: from, client_phone: clientPhone });

                    console.log(`🤝 Dueño conectado con cliente: ${clientPhone}`);
                    await sendWhatsAppMessage(from, `🤝 Estás en control de ${clientPhone}. Escribe normal para hablarle. Usa *#bot* para devolver el control a la IA.`);
                    return;
                }

                // B. Comando para devolver el control al bot: #bot
                if (msgBody.toLowerCase() === '#bot') {
                    const { data: session } = await supabase.from('active_sessions').select('client_phone').eq('owner_phone', from).single();
                    if (session) {
                        await supabase.from('leads').update({ bot_active: true }).eq('phone', session.client_phone);
                        await supabase.from('active_sessions').delete().eq('owner_phone', from);

                        console.log(`🤖 IA Reactivada para cliente: ${session.client_phone}`);
                        await sendWhatsAppMessage(from, `🤖 Control devuelto a la IA.`);
                        await sendWhatsAppMessage(session.client_phone, `Mi asistente virtual ha vuelto para ayudarte si lo necesitas.`);
                    }
                    return;
                }

                // C. Si no es comando pero el dueño tiene sesión activa, REENVIAR AL CLIENTE
                const { data: activeSession } = await supabase.from('active_sessions').select('client_phone').eq('owner_phone', from).single();
                if (activeSession) {
                    console.log(`📤 Reenviando respuesta del dueño -> Cliente: ${activeSession.client_phone}`);
                    await sendWhatsAppMessage(activeSession.client_phone, msgBody);
                    return;
                }
            }

            // --- 2. LÓGICA PARA EL CLIENTE ---
            console.log(`\n--- 📥 MENSAJE CLIENTE: ${from} ---`);
            await markMessageAsRead(msgId);

            // Consultar estado del lead
            let { data: leadData } = await supabase.from('leads').select('*').eq('phone', from).single();

            // Si el bot está desactivado para este cliente
            if (leadData && leadData.bot_active === false) {
                const { data: session } = await supabase.from('active_sessions').select('owner_phone').eq('client_phone', from).single();

                if (session) {
                    // Si el dueño ya inició la sesión, le mandamos el mensaje
                    console.log(`📲 Reenviando mensaje Cliente -> Dueño`);
                    await sendWhatsAppMessage(OWNER_NUMBER, `💬 [${leadData.name || from}]: ${msgBody}`);
                } else {
                    // Si el bot está en pausa pero el dueño aún no ha dado click al link
                    console.log(`⚠️ Bot pausado. Recordando intervención al dueño...`);
                    await notifyOwnerBySMS(from, leadData.name || "Cliente", msgBody);
                }
                return;
            }

            // --- 3. PROCESAMIENTO NORMAL CON IA ---
            let { data: chatData } = await supabase.from('chats').select('history').eq('phone_number', from).single();
            let history = chatData ? chatData.history.slice(-10) : [];

            // System Instruction Dinámico
            const currentStage = leadData?.current_step || 'SALUDO';
            const userSummary = leadData?.summary || 'Nuevo cliente.';

            const model = genAI.getGenerativeModel({
                model: "gemini-flash-latest",
                tools: [tools],
                systemInstruction: `Eres un asistente inteligente. 
                ESTADO: ${currentStage}. 
                RESUMEN ACTUAL: ${userSummary}.
                Si el cliente pide hablar con alguien humano o está muy frustrado, usa 'transfer_to_human'.`
            });

            const chatSession = model.startChat({ history });
            const result = await chatSession.sendMessage(msgBody);

            const call = result.response.functionCalls()?.[0];
            if (call) {
                if (call.name === "update_lead_info") {
                    await supabase.from('leads').upsert({ phone: from, ...call.args }, { onConflict: 'phone' });
                    const finalRes = await chatSession.sendMessage([{ functionResponse: { name: "update_lead_info", response: { status: "ok" } } }]);
                    var responseText = finalRes.response.text();
                }
                else if (call.name === "transfer_to_human") {
                    console.log(`🚨 IA SOLICITA TRASPASO HUMANO`);
                    // Usamos upsert en lugar de update para asegurar que el registro exista
                    await supabase.from('leads').upsert({
                        phone: from,
                        bot_active: false
                    }, { onConflict: 'phone' });

                    await notifyOwnerBySMS(from, leadData?.name || "Cliente", msgBody);
                    var responseText = "Entiendo perfectamente. He pasado tu solicitud a un agente humano para que te atienda personalmente. Recibirás respuesta por aquí muy pronto.";
                }
            } else {
                var responseText = result.response.text();
            }

            // Guardar historial y responder
            const newHistory = await chatSession.getHistory();
            await supabase.from('chats').upsert({ phone_number: from, history: newHistory, updated_at: new Date() });
            await sendWhatsAppMessage(from, responseText);
            console.log(`✅ Respuesta enviada.`);
        }
    } catch (e) {
        console.error("🔥 Error:", e.message);
    }
});

// --- FUNCIONES AUXILIARES ---

async function notifyOwnerBySMS(clientPhone, name, text) {
    // Limpiamos el número del bot de cualquier símbolo extra (+ o espacios)
    const cleanBotNum = BOT_NUMBER.replace(/\D/g, '');
    const link = `https://wa.me/${cleanBotNum}?text=%23intervenir_${clientPhone}`;
    const smsContent = `⚠️ AVISO: El cliente ${name} (${clientPhone}) necesita atención humana.\n\nMensaje: "${text}"\n\nToca aquí para hablar con él: ${link}`;

    // Aquí es donde iría Twilio o tu API de SMS
    console.log(`\n---------- 📱 SMS ENVIADO AL DUEÑO ----------`);
    console.log(smsContent);
    console.log(`----------------------------------------------\n`);
}

async function sendWhatsAppMessage(to, text) {
    const url = `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`;
    try {
        await axios.post(url, {
            messaging_product: "whatsapp", to, type: "text", text: { body: text }
        }, {
            headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
        });
    } catch (e) { console.error("Error API Meta:", e.response?.data || e.message); }
}

async function markMessageAsRead(messageId) {
    const url = `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`;
    try {
        await axios.post(url, { messaging_product: "whatsapp", status: "read", message_id: messageId }, {
            headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` }
        });
    } catch (e) { }
}

app.get('/webhook', (req, res) => {
    if (req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) res.send(req.query['hub.challenge']);
    else res.sendStatus(403);
});

app.listen(PORT, () => console.log(`🚀 SERVIDOR HÍBRIDO SEGURO (WA.ME) ACTIVO EN PUERTO ${PORT}`));
