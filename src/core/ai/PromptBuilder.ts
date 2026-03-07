import { IAppConfig } from '../../types';

export class SystemPromptBuilder {
  private components: Record<string, string> = {};

  // Orden estricto de ensamblado para evitar variaciones de comportamiento de la IA
  private static readonly COMPONENT_ORDER = [
    'LEAD',      // 👤 Contexto del cliente
    'INFO',      // 🦴 Historial médico
    'CAT',       // 🛒 Catálogo
    'OPS',       // ⚙️ Operaciones y Horarios
    'APPTS',     // 📅 Citas activas
    'MULTI',     // 📸 Instrucciones Multimedia
    'INST'       // 📋 Instrucciones Maestras (ADN)
  ];

  /**
   * Contexto del cliente y etapa de ventas actual.
   */
  public setLeadContext(name: string, currentStage: string): this {
    this.components['LEAD'] = `👤 CLIENTE: [Nombre: ${name || '?'}, Estatus: ${currentStage || 'SALUDO'}]`;
    return this;
  }

  /**
   * Inyecta el historial médico de las mascotas.
   */
  public setMedicalHistory(medicalHistory: any): this {
    const history = JSON.stringify(medicalHistory || {});
    this.components['INFO'] = `🦴 HISTORIAL MÉDICO (Contexto mascotas): ${history}`;
    return this;
  }

  /**
   * Inyecta el catálogo de servicios en formato comprimido.
   */
  public setCatalog(catalog: any[]): this {
    if (!catalog || catalog.length === 0) return this;

    const lines = catalog.map(s => `* ${s.title}: ${s.duration_minutes}min ($${s.price})`);
    this.components['CAT'] = `🛒 CATÁLOGO:\n${lines.join('\n')}`;
    return this;
  }

  /**
   * Define operaciones logísticas de tiempo y lugar.
   */
  public setOperations(config: IAppConfig): this {
    const now = new Date();
    const dateText = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    this.components['OPS'] = `⚙️ OPS: ${config.siteName} | ${dateText} | Horario: ${config.hours.open}-${config.hours.close} | Off: ${config.hours.closedDays?.join(',') || 'N/A'}`;
    return this;
  }

  /**
   * Inyecta las citas activas del cliente para que sepa qué puede cancelar o cambiar.
   */
  public setActiveAppointments(appointments: any[]): this {
    if (!appointments || appointments.length === 0) {
      delete this.components['APPTS'];
      return this;
    }
    const compactAppts = appointments.map(a => ({
      id: a.id,
      p: a.pet_name,
      t: a.start_at
    }));
    this.components['APPTS'] = `📅 CITAS ACTIVAS (Source of truth): ${JSON.stringify(compactAppts)}\n⚠️ REGLA CAMBIOS: Para cancelar o reagendar, usa EXACTAMENTE la fecha y hora de esta lista.`;
    return this;
  }

  /**
   * Las directrices supremas definidas por el dueño en el CMS
   */
  public setMasterInstructions(config: IAppConfig): this {
    this.components['INST'] = `📋 ADN E INSTRUCCIONES MAESTRAS:\n${config.agent.systemInstructions}`;
    return this;
  }

  /**
   * Instrucciones específicas para el manejo de archivos multimedia.
   */
  public setMultimodalInstructions(hasMedia: boolean): this {
    if (!hasMedia) {
      delete this.components['MULTI'];
      return this;
    }
    this.components['MULTI'] = `📸 MULTIMEDIA: Escuchas audios y ves fotos. Si es borroso o ruidoso, pide repetir. Usa lo visual para agendar.`;
    return this;
  }

  /**
   * Ensambla y retorna el sistema de instrucciones final en orden determinista
   */
  public build(): string {
    return SystemPromptBuilder.COMPONENT_ORDER
      .map(key => this.components[key])
      .filter(Boolean)
      .join('\n\n');
  }
}
