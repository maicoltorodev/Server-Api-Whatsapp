import { botConfig } from '../config/botConfig';

// Interfaz Básica de Usuario/Lead
export interface User {
  phone: string;
  name: string;
  stage: string;       // Ej: 'NUEVO', 'HABLANDO', 'DERIVADO_A_HUMANO'
  preferences: any;    // Para guardar datos recolectados por IA
  lastInteraction: Date;
}

// Simulador en memoria de una Base de Datos (MOCK)
class MemoryAdapter {
  private users: Map<string, User> = new Map();
  private chatHistories: Map<string, any[]> = new Map();

  // --------------------------------------------------------------------------
  // USUARIOS (CRM Básico)
  // --------------------------------------------------------------------------
  
  public async getUser(phone: string): Promise<User | null> {
    // Aquí conectarías a Postgres/Mongo: `return await db.users.findOne({ phone })`
    return this.users.get(phone) || null;
  }

  public async createUser(phone: string, name: string = 'Usuario'): Promise<User> {
    const newUser: User = {
      phone,
      name,
      stage: 'NUEVO',
      preferences: {},
      lastInteraction: new Date()
    };
    this.users.set(phone, newUser);
    return newUser;
  }

  public async updateUser(phone: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.getUser(phone);
    if (!user) return null;

    const merged = { ...user, ...updates, lastInteraction: new Date() };
    this.users.set(phone, merged);
    return merged;
  }

  public async savePreference(phone: string, key: string, value: string): Promise<void> {
    const user = await this.getUser(phone);
    if (user) {
      user.preferences[key] = value;
      this.users.set(phone, user);
    }
  }

  // --------------------------------------------------------------------------
  // HISTORIAL DE CHAT (Para que Gemini tenga memoria contextual)
  // --------------------------------------------------------------------------

  public async getHistory(phone: string): Promise<any[]> {
    // Aquí consultarías tu DB: `return await db.messages.find({ phone }).limit(10)`
    return this.chatHistories.get(phone) || [];
  }

  public async saveMessage(phone: string, role: 'user' | 'model', text: string): Promise<void> {
    if (!this.chatHistories.has(phone)) {
      this.chatHistories.set(phone, []);
    }

    const history = this.chatHistories.get(phone)!;
    history.push({
      role,
      parts: [{ text }]
    });

    // Poda: Mantener solo los últimos mensajes configurados
    if (history.length > botConfig.ai.maxHistoryMessages) {
      // Borrar antiguos manteniendo paridad user/model si es posible
      history.splice(0, history.length - botConfig.ai.maxHistoryMessages);
    }
  }

  public async clearHistory(phone: string): Promise<void> {
    this.chatHistories.delete(phone);
  }
}

// Exportamos un Singleton para usarlo globalmente en este proyecto de prueba.
export default new MemoryAdapter();
