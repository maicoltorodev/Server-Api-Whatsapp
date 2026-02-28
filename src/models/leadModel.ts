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
    return await this.updateStatus(phone, { bot_active: false });
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
   * Actualiza el resumen del lead (Corto plazo)
   */
  async updateSummary(phone, summary) {
    const lead = await this.getByPhone(phone);
    const previousSummary = lead?.summary || '';
    const finalSummary =
      previousSummary && summary && !previousSummary.includes(summary)
        ? `${previousSummary} | ${summary}`
        : summary || previousSummary;

    return await this.updateStatus(phone, { summary: finalSummary });
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
      pet = { name: petName, allergies: [], behavior: '', preferences: [], notes: '' };
      history.pets.push(pet);
    }

    // Si la categoría contiene un arreglo (ej: allergies)
    if (['allergies', 'preferences'].includes(category)) {
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
}

module.exports = new LeadModel();
