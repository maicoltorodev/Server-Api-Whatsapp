import supabase from '../config/database';
import logger from '../utils/logger';

// --- INTERFACES ---
export interface PetInfo {
  name: string;
  breed?: string;
  medical?: string[];
  behavior?: string;
  preferences?: string[];
  notes?: string;
}

export interface LeadHistory {
  pets: PetInfo[];
}

export interface Lead {
  id: string;
  phone: string;
  name?: string;
  status: string;
  current_step: string;
  summary?: string;
  bot_active: boolean;
  medical_history?: LeadHistory;
  last_customer_message_at?: string;
  last_reengagement_at?: string;
  reengagement_count: number;
  human_review_pending: boolean;
  customer_mood?: string;
  recent_media?: {
    images: string[];
    audios: string[];
  };
  created_at: string;
  updated_at: string;
}


export class LeadModel {
  /**
   * Obtiene un lead por su número de teléfono
   */
  public async getByPhone(phone: string): Promise<Lead | null> {
    const { data, error } = await supabase.from('leads').select('*').eq('phone', phone).single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      logger.error(`BD Error (leadModel.getByPhone) [${phone}]`, { error });
      throw error;
    }

    return data;
  }

  /**
   * Crea o actualiza un lead
   */
  public async upsert(leadData: Partial<Lead>): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .upsert(leadData, { onConflict: 'phone' })
      .select()
      .single();

    if (error) {
      logger.error(`BD Error (leadModel.upsert) [${leadData?.phone}]`, { error });
      throw error;
    }

    return data;
  }

  /**
   * Actualiza el estado de un lead
   */
  public async updateStatus(phone: string, updates: Partial<Lead>): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('phone', phone)
      .select()
      .single();

    if (error) {
      logger.error(`BD Error (leadModel.updateStatus) [${phone}]`, { error });
      throw error;
    }

    return data;
  }

  /**
   * Desactiva el bot para un lead
   */
  public async deactivateBot(phone: string): Promise<Lead> {
    return await this.updateStatus(phone, { bot_active: false, human_review_pending: true });
  }

  /**
   * Limpia el estado de pendiente de revisión
   */
  public async clearReviewPending(phone: string): Promise<Lead> {
    return await this.updateStatus(phone, { human_review_pending: false });
  }

  /**
   * Activa el bot para un lead
   */
  public async activateBot(phone: string): Promise<Lead> {
    return await this.updateStatus(phone, { bot_active: true });
  }

  /**
   * Actualiza el paso actual del embudo
   */
  public async updateStep(phone: string, step: string): Promise<Lead> {
    return await this.updateStatus(phone, { current_step: step });
  }


  /**
   * Actualiza un fragmento específico del Historial Médico (Largo plazo)
   * Soporta múltiples mascotas por lead usando un arreglo de mascotas.
   */
  public async updateMedicalHistory(phone: string, category: string, value: any, petName: string): Promise<Lead> {
    const lead = await this.getByPhone(phone);
    let history: LeadHistory = lead?.medical_history || { pets: [] };

    // Asegurar estructura de array de mascotas
    if (!history.pets) history.pets = [];

    // Buscar la mascota por nombre (match case insensitive)
    let pet = history.pets.find((p) => p.name?.toLowerCase() === petName?.toLowerCase());

    if (!pet) {
      pet = { name: petName, breed: '', medical: [], behavior: '', preferences: [], notes: '' };
      history.pets.push(pet);
    }

    // Si la categoría contiene un arreglo (ej: medical, preferences)
    if (['medical', 'preferences'].includes(category)) {
      if (!(pet as any)[category]) (pet as any)[category] = [];
      // Agregar sin duplicar
      if (!(pet as any)[category].includes(value)) {
        (pet as any)[category].push(value);
      }
    } else {
      // Modificar directamente (behavior, notes)
      (pet as any)[category] = value;
    }

    return await this.updateStatus(phone, { medical_history: history });
  }

  /**
   * Obtiene la lista de "Leads Fríos"
   * Criterios: Silencio > 4h y < 22h, sin cita agendada, no re-contactado hoy.
   */
  public async getColdLeads(): Promise<Lead[]> {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const twentyTwoHoursAgo = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .lt('last_customer_message_at', fourHoursAgo)
      .gt('last_customer_message_at', twentyTwoHoursAgo)
      .neq('status', 'agendada')
      // No re-contactado en las últimas 24h (para evitar spam)
      .or(`last_reengagement_at.is.null,last_reengagement_at.lt.${twentyFourHoursAgo}`)
      .order('last_customer_message_at', { ascending: true }); // Los más viejos primero

    if (error) {
      logger.error('BD Error (leadModel.getColdLeads)', { error });
      throw error;
    }

    return data || [];
  }
}

export default new LeadModel();

