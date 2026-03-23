"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const botConfig_1 = require("../config/botConfig");
// Simulador en memoria de una Base de Datos (MOCK)
class MemoryAdapter {
    users = new Map();
    chatHistories = new Map();
    // --------------------------------------------------------------------------
    // USUARIOS (CRM Básico)
    // --------------------------------------------------------------------------
    async getUser(phone) {
        // Aquí conectarías a Postgres/Mongo: `return await db.users.findOne({ phone })`
        return this.users.get(phone) || null;
    }
    async createUser(phone, name = 'Usuario') {
        const newUser = {
            phone,
            name,
            stage: 'NUEVO',
            preferences: {},
            lastInteraction: new Date()
        };
        this.users.set(phone, newUser);
        return newUser;
    }
    async updateUser(phone, updates) {
        const user = await this.getUser(phone);
        if (!user)
            return null;
        const merged = { ...user, ...updates, lastInteraction: new Date() };
        this.users.set(phone, merged);
        return merged;
    }
    async savePreference(phone, key, value) {
        const user = await this.getUser(phone);
        if (user) {
            user.preferences[key] = value;
            this.users.set(phone, user);
        }
    }
    // --------------------------------------------------------------------------
    // HISTORIAL DE CHAT (Para que Gemini tenga memoria contextual)
    // --------------------------------------------------------------------------
    async getHistory(phone) {
        // Aquí consultarías tu DB: `return await db.messages.find({ phone }).limit(10)`
        return this.chatHistories.get(phone) || [];
    }
    async saveMessage(phone, role, text) {
        if (!this.chatHistories.has(phone)) {
            this.chatHistories.set(phone, []);
        }
        const history = this.chatHistories.get(phone);
        history.push({
            role,
            parts: [{ text }]
        });
        // Poda: Mantener solo los últimos mensajes configurados
        if (history.length > botConfig_1.botConfig.ai.maxHistoryMessages) {
            // Borrar antiguos manteniendo paridad user/model si es posible
            history.splice(0, history.length - botConfig_1.botConfig.ai.maxHistoryMessages);
        }
    }
    async clearHistory(phone) {
        this.chatHistories.delete(phone);
    }
}
// Exportamos un Singleton para usarlo globalmente en este proyecto de prueba.
exports.default = new MemoryAdapter();
