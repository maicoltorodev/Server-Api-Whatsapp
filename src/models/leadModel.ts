const supabase = require('../config/database');
const logger = require('../utils/logger').default;

class LeadModel {
  /**
   * Obtiene un lead por su número de teléfono
   */
  async getByPhone(phone) {
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
  async upsert(leadData) {
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
  async updateStatus(phone, updates) {
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
  async deactivateBot(phone) {
    return await this.updateStatus(phone, { bot_active: false, human_review_pending: true });
  }

  /**
   * Limpia el estado de pendiente de revisión
   */
  async clearReviewPending(phone) {
    return await this.updateStatus(phone, { human_review_pending: false });
  }

  /**
   * Activa el bot para un lead
   */
  async activateBot(phone) {
    return await this.updateStatus(phone, { bot_active: true });
  }

  /**
   * Actualiza el paso actual del embudo
   */
  async updateStep(phone, step) {
    return await this.updateStatus(phone, { current_step: step });
  }


  /**
   * Actualiza un fragmento específico del Historial Médico (Largo plazo)
   * Soporta múltiples mascotas por lead usando un arreglo de mascotas.
   */
  async updateMedicalHistory(phone, category, value, petName) {
    const lead = await this.getByPhone(phone);
    let history = lead?.medical_history || { pets: [] };

    // Asegurar estructura de array de mascotas
    if (!history.pets) history.pets = [];

    // Buscar la mascota por nombre (mactheo case insensitive)
    let pet = history.pets.find((p) => p.name?.toLowerCase() === petName?.toLowerCase());

    if (!pet) {
      pet = { name: petName, breed: '', medical: [], behavior: '', preferences: [], notes: '' };
      history.pets.push(pet);
    }

    // Si la categoría contiene un arreglo (ej: medical, preferences)
    if (['medical', 'preferences'].includes(category)) {
      if (!pet[category]) pet[category] = [];
      // Agregar sin duplicar
      if (!pet[category].includes(value)) {
        pet[category].push(value);
      }
    } else {
      // Modificar directamente (behavior, notes)
      pet[category] = value;
    }

    return await this.updateStatus(phone, { medical_history: history });
  }

  /**
   * Obtiene la lista de "Leads Fríos"
   * Criterios: Silencio > 4h y < 22h, sin cita agendada, no re-contactado hoy.
   */
  async getColdLeads() {
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

    return data;
  }
}

module.exports = new LeadModel();
