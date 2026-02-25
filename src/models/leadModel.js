const supabase = require('../config/database');

class LeadModel {
  /**
   * Obtiene un lead por su número de teléfono
   */
  async getByPhone(phone) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error(`🔥 BD Error (leadModel.getByPhone) [${phone}]:`, error.message);
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
      console.error(`🔥 BD Error (leadModel.upsert) [${leadData?.phone}]:`, error.message);
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
      console.error(`🔥 BD Error (leadModel.updateStatus) [${phone}]:`, error.message);
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
   * Actualiza el resumen del lead
   */
  async updateSummary(phone, summary) {
    const lead = await this.getByPhone(phone);
    const previousSummary = lead?.summary || '';
    const finalSummary = previousSummary && summary && !previousSummary.includes(summary)
      ? `${previousSummary} | ${summary}`
      : (summary || previousSummary);

    return await this.updateStatus(phone, { summary: finalSummary });
  }
}

module.exports = new LeadModel();
