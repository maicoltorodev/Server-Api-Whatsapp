"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase = require('../config/database');
const logger = require('../utils/logger').default;
class ChatModel {
    /**
     * Obtiene el historial de chat de un número de teléfono
     */
    async getHistory(phone) {
        const { data, error } = await supabase
            .from('chats')
            .select('history')
            .eq('phone', phone)
            .single();
        if (error && error.code !== 'PGRST116') {
            // PGRST116 = not found
            logger.error(`BD Error (chatModel.getHistory) [${phone}]`, { error });
            throw error;
        }
        return data?.history || [];
    }
    /**
     * Guarda el historial de chat
     */
    async saveHistory(phone, history) {
        const { data, error } = await supabase
            .from('chats')
            .upsert({
            phone: phone,
            history: history,
            updated_at: new Date(),
        }, { onConflict: 'phone' })
            .select()
            .single();
        if (error) {
            logger.error(`BD Error (chatModel.saveHistory) [${phone}]`, { error });
            throw error;
        }
        return data;
    }
    /**
     * Agrega un mensaje al historial
     */
    async addMessage(phone, message) {
        const history = await this.getHistory(phone);
        history.push(message);
        // Limitamos el historial a los últimos 20 mensajes para no sobrecargar
        const limitedHistory = history.slice(-20);
        return await this.saveHistory(phone, limitedHistory);
    }
    /**
     * Limpia el historial de chat de un número
     */
    async clearHistory(phone) {
        const { data, error } = await supabase.from('chats').delete().eq('phone', phone);
        if (error) {
            logger.error(`BD Error (chatModel.clearHistory) [${phone}]`, { error });
            throw error;
        }
        return data;
    }
    /**
     * Obtiene todos los chats (para administración)
     */
    async getAllChats() {
        const { data, error } = await supabase
            .from('chats')
            .select('phone, updated_at')
            .order('updated_at', { ascending: false });
        if (error) {
            logger.error(`BD Error (chatModel.getAllChats)`, { error });
            throw error;
        }
        return data;
    }
}
module.exports = new ChatModel();
