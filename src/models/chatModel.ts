import supabase from '../config/database';
import logger from '../utils/logger';

export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'audio'
  }>;
}

export interface Chat {
  phone: string;
  history: ChatMessage[];
  updated_at: string;
}

export class ChatModel {
  /**
   * Obtiene el historial de chat de un número de teléfono
   */
  public async getHistory(phone: string): Promise<ChatMessage[]> {
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
  public async saveHistory(phone: string, history: ChatMessage[]): Promise<Chat> {
    const { data, error } = await supabase
      .from('chats')
      .upsert(
        {
          phone: phone,
          history: history,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone' }
      )
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
  public async addMessage(phone: string, message: ChatMessage): Promise<Chat> {
    const history = await this.getHistory(phone);
    history.push(message);

    // Limitamos el historial a los últimos 30 mensajes para no sobrecargar el CRM ni la BD
    const limitedHistory = history.slice(-30);

    return await this.saveHistory(phone, limitedHistory);
  }

  /**
   * Limpia el historial de chat de un número
   */
  public async clearHistory(phone: string): Promise<any> {
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
  public async getAllChats(): Promise<any[]> {
    const { data, error } = await supabase
      .from('chats')
      .select('phone, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error(`BD Error (chatModel.getAllChats)`, { error });
      throw error;
    }

    return data || [];
  }
}

export default new ChatModel();

