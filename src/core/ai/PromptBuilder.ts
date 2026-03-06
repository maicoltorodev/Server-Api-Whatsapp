import { IAppConfig } from '../../types';

export class SystemPromptBuilder {
  private parts: string[] = [];

  /**
   * Contexto del cliente y etapa de ventas actual.
   */
  public setLeadContext(name: string, currentStage: string): this {
    this.parts.push(`👤 C-[Nom: ${name || '?'}, Est: ${currentStage || 'SALUDO'}]`);
    return this;
  }

  /**
   * Inyecta el historial médico de las mascotas.
   */
  public setMedicalHistory(medicalHistory: any): this {
    const history = JSON.stringify(medicalHistory || {});
    this.parts.push(`🦴 INFO: ${history}`);
    return this;
  }

  /**
   * Inyecta el catálogo de servicios en formato comprimido (JSON).
   */
  public setCatalog(catalog: any[]): this {
    const compactCatalog = JSON.stringify(
      catalog.map((s) => ({
        svc: s.title,
        min: s.duration_minutes,
        $: s.price,
      }))
    );
    this.parts.push(`🛒 CAT: ${compactCatalog}`);
    return this;
  }

  /**
   * Define operaciones logísticas de tiempo y lugar.
   */
  public setOperations(config: IAppConfig): this {
    const dateText = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    const ops = {
      n: config.siteName || 'Pet Care Studio',
      t: dateText,
      h: `${config.hours.open}-${config.hours.close}`,
      off: config.hours.closedDays || [],
      cap: config.hours.concurrency || 1,
      m: config.hours.defaultDuration || 60
    };

    this.parts.push(`⚙️ OPS: ${JSON.stringify(ops)}
⚠️ CMD: Agenda cada mascota por SEPARADO (1 cita x animal).`);
    return this;
  }

  /**
   * Inyecta las citas activas del cliente para que sepa qué puede cancelar o cambiar.
   */
  public setActiveAppointments(appointments: any[]): this {
    if (!appointments || appointments.length === 0) return this;
    const compactAppts = appointments.map(a => ({
      id: a.id,
      p: a.pet_name,
      t: a.start_at
    }));
    this.parts.push(`📅 APPTS (Source of truth): ${JSON.stringify(compactAppts)}
⚠️ REGLA CAMBIOS: Para cancelar o reagendar, usa EXACTAMENTE la fecha y hora de esta lista.`);
    return this;
  }

  /**
   * Las directrices supremas definidas por el dueño en el CMS
   */
  public setMasterInstructions(config: IAppConfig): this {
    this.parts.push(`📋 INST: ${config.agent.systemInstructions}`);
    return this;
  }

  /**
   * Instrucciones específicas para el manejo de archivos multimedia (Voz e Imagen)
   */
  public setMultimodalInstructions(): this {
    this.parts.push(`📸 MULTIMEDIA:
1. IMÁGENES: Eres capaz de ver fotos. Si te envían una con texto ilegible, papel arrugado o borrosa, menciona qué alcanzas a distinguir y pide una foto más clara si es vital.
2. AUDIOS: Escuchas notas de voz. Si hay mucho ruido de fondo o no entiendes, pide amablemente que lo repitan.
3. RECUERDA: La visión se vuelve conocimiento; una vez procesada la imagen, úsala para los agendamientos.`);
    return this;
  }

  /**
   * Ensambla y retorna el sistema de instrucciones final
   */
  public build(): string {
    return this.parts.join('\n\n');
  }
}
