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
    this.components['CAT'] = `🛒 CATÁLOGO DE SERVICIOS: ${compactCatalog}`;
    return this;
  }

  /**
   * Define operaciones logísticas de tiempo y lugar.
   */
  public setOperations(config: IAppConfig): this {
    const now = new Date();
    // Formato ultra-claro para evitar confusión entre DD/MM y MM/DD en la IA
    const dateText = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    const ops = {
      n: config.siteName || 'Pet Care Studio',
      t: dateText,
      h: `${config.hours.open}-${config.hours.close}`,
      off: config.hours.closedDays || [],
      cap: config.hours.concurrency || 1,
      m: config.hours.defaultDuration || 60
    };

    this.components['OPS'] = `⚙️ LOGÍSTICA OPS: ${JSON.stringify(ops)}\n⚠️ CMD: Agenda cada mascota por SEPARADO (1 cita x animal).`;
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
   * Instrucciones específicas para el manejo de archivos multimedia (Voz e Imagen)
   */
  public setMultimodalInstructions(): this {
    this.components['MULTI'] = `📸 PROTOCOLO MULTIMEDIA:
1. IMÁGENES: Eres capaz de ver fotos. Si te envían una con texto ilegible, papel arrugado o borrosa, menciona qué alcanzas a distinguir y pide una foto más clara si es vital.
2. AUDIOS: Escuchas notas de voz. Si hay mucho ruido de fondo o no entiendes, pide amablemente que lo repitan.
3. RECUERDA: La visión se vuelve conocimiento; una vez procesada la imagen, úsala para los agendamientos.`;
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
