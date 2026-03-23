import { botConfig } from '../../config/botConfig';

export class SystemPromptBuilder {
  private components: Record<string, string> = {};

  // Orden jerárquico optimizado: Identidad -> Contexto -> Catálogo -> Instrucciones Finales
  private static readonly COMPONENT_ORDER = [
    'PER',       // 🎭 Persona e Identidad (Quién soy)
    'LEAD',      // 👤 Contexto del Usuario (A quién le hablo)
    'CAT',       // 🛒 Catálogo (Qué ofrezco/Sé)
    'MULTI',     // 📸 Capacidades Visuales
    'INST'       // 📋 ADN Maestros y Restricciones (Cómo debo actuar)
  ];

  /**
   * Define la personalidad base del agente desde la configuración maestra.
   */
  public setPersona(): this {
    this.components['PER'] = `### 🎭 IDENTIDAD\nNombre: ${botConfig.persona.name}\nEstilo: ${botConfig.persona.style}`;
    return this;
  }

  /**
   * Contexto del cliente (Dinámico, viene de la memoria).
   */
  public setUserContext(name: string, extraData: any = {}): this {
    const extraInfo = Object.entries(extraData).map(([k, v]) => `- ${k}: ${v}`).join('\n');
    this.components['LEAD'] = `### 👤 CONTEXTO DEL USUARIO\n- Nombre: ${name || 'Desconocido'}\n${extraInfo}`;
    return this;
  }

  /**
   * Inyecta el catálogo de conocimiento/servicios de config.
   */
  public setCatalog(): this {
    this.components['CAT'] = `### 🛒 BASE DE CONOCIMIENTO (CATÁLOGO)\n${botConfig.catalog}`;
    return this;
  }

  /**
   * Las directrices supremas cargadas desde config.
   */
  public setMasterInstructions(): this {
    const rulesList = botConfig.persona.strictRules.map(r => `- ${r}`).join('\n');
    this.components['INST'] = `### 📋 REGLAS DE ORO (ESTRICTAS)\n${rulesList}`;
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
    this.components['MULTI'] = `### 📸 VISIÓN Y AUDIO ACTIVOS\nTienes visión y oído habilitados en este mensaje. Analiza la imagen o nota de voz adjunta para responder con precisión.`;
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
