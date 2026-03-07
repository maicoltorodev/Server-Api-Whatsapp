import { IAppConfig } from '../../types';

export class SystemPromptBuilder {
  private components: Record<string, string> = {};

  // Orden jerárquico optimizado: Identidad -> Contexto -> Datos -> Logística -> Instrucciones Finales
  private static readonly COMPONENT_ORDER = [
    'PER',       // 🎭 Persona e Identidad (Quién soy)
    'LEAD',      // 👤 El Cliente (A quién le hablo)
    'INFO',      // 🦴 Historial (Qué sé de sus mascotas)
    'CAT',       // 🛒 Catálogo (Qué ofrezco)
    'OPS',       // ⚙️ Logística (Cuándo y Dónde)
    'APPTS',     // 📅 Estado Actual (Citas activas)
    'MULTI',     // 📸 Capacidades Visuales
    'INST'       // 📋 ADN Maestros y Restricciones (Cómo debo actuar)
  ];

  /**
   * Define la personalidad base del agente.
   */
  public setPersona(): this {
    this.components['PER'] = `### 🎭 IDENTIDAD\nEres Miel, la asistente estrella de Pet Care Studio. Tono: Empático, profesional y amante de los animales, Siempre tutear.`;
    return this;
  }

  /**
   * Contexto del cliente y etapa de ventas actual.
   */
  public setLeadContext(name: string, currentStage: string): this {
    this.components['LEAD'] = `### 👤 CLIENTE\n- Nombre: ${name || 'Desconocido'}\n- Etapa: ${currentStage || 'SALUDO'}`;
    return this;
  }

  /**
   * Inyecta el historial médico de las mascotas.
   */
  public setMedicalHistory(medicalHistory: any): this {
    const history = medicalHistory?.pets?.length > 0
      ? medicalHistory.pets.map((p: any) => `- ${p.name}: ${p.breed || 'Raza N/A'}, ${p.notes || 'Sin notas'}`).join('\n')
      : 'Sin datos previos.';
    this.components['INFO'] = `### 🦴 EXPEDIENTE MASCOTAS\n${history}`;
    return this;
  }

  /**
   * Inyecta el catálogo de servicios en formato comprimido.
   */
  public setCatalog(catalog: any[]): this {
    if (!catalog || catalog.length === 0) return this;
    const lines = catalog.map(s => `- ${s.title}: $${s.price} (${s.duration_minutes} min)`);
    this.components['CAT'] = `### 🛒 SERVICIOS Y PRECIOS\n${lines.join('\n')}`;
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    this.components['OPS'] = `### ⚙️ LOGÍSTICA\n- Centro: ${config.siteName}\n- Tiempo Real: ${dateText}\n- Horarios: ${config.hours.open} a ${config.hours.close}\n- Días Libres: ${config.hours.closedDays?.join(',') || 'Ninguno'}`;
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
    const lines = appointments.map(a => `- ID: ${a.id} | Mascota: ${a.pet_name} | Fecha: ${a.start_at}`);
    this.components['APPTS'] = `### 📅 CITAS PRÓXIMAS\n${lines.join('\n')}\n⚠️ REGLA: Para cambios, usa la información exacta de arriba.`;
    return this;
  }

  /**
   * Las directrices supremas (Hardcoded para evitar desconfiguraciones).
   */
  public setMasterInstructions(): this {
    this.components['INST'] = `### 📋 REGLAS DE ORO
- Respuesta Máxima: 3 líneas.
- Estilo: 1 idea por línea, frases cortas, sin comas excesivas.
- Si el historial está vacío: Preséntate brevemente.

### 💡 LÓGICA DE NEGOCIO
- Servicio: Exclusivo de Grooming (Peluquería y Baño).
- Precios: Da el precio base del catálogo y pide raza/edad para confirmar el valor final.
- Género: Solo úsalo si el cliente lo especifica.
- Reprogramación: Primero se debe cancelar la cita actual y luego agendar la nueva.

### 🛠️ PROTOCOLO TÉCNICO
- Silencio: Si la charla terminó y no hay nada más que decir, responde solo "[SILENCIO]".
- Humor: Termina cada mensaje con [MOOD: FELIZ|NEUTRAL|MOLESTO|URGENTE] según el contexto.
- Registro: Guarda nombres de humanos y mascotas con 'update_lead_info' o 'save_pet_preference' apenas los mencionen.
- Disponibilidad: NUNCA ofrezcas horas sin antes usar 'check_availability'.`;
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
    this.components['MULTI'] = `### 📸 VISIÓN Y AUDIO
Tienes visión y oído activo. Analiza las fotos de mascotas o audios para asistir mejor en el agendamiento y entender necesidades específicas.`;
    return this;
  }

  /**
   * Retorna los componentes individuales para auditoría o conteo de tokens.
   */
  public getComponents(): Record<string, string> {
    return { ...this.components };
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
