import { botConfig } from '../../config/botConfig';

export class SystemPromptBuilder {
  private components: Record<string, string> = {};

  // Orden determinista: Protocolo -> Contexto de usuario -> Catálogo -> Multimedia
  private static readonly COMPONENT_ORDER = [
    'PROTO',  // 🧠 Protocolo maestro de Nexa (8 secciones)
    'LEAD',   // 👤 Contexto del cliente actual
    'CAT',    // 🛒 Catálogo de productos
    'MULTI',  // 📸 Instrucciones de visión/audio (solo si hay media)
  ];

  /**
   * Inyecta el protocolo maestro de Nexa (8 secciones).
   * isNewUser=true inyecta [HISTORIAL_VACIO=true] para que Nexa se presente.
   */
  public setProtocol(isNewUser: boolean): this {
    const historialFlag = isNewUser ? '[HISTORIAL_VACIO=true]' : '[HISTORIAL_VACIO=false]';
    this.components['PROTO'] = `${historialFlag}\n\n${botConfig.persona.protocol}`;
    return this;
  }

  /**
   * Contexto del cliente actual (dinámico, viene de la memoria).
   */
  public setUserContext(name: string, extraData: any = {}): this {
    const extraInfo = Object.entries(extraData)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
    this.components['LEAD'] = `### 👤 CONTEXTO DEL CLIENTE ACTUAL\n- Nombre: ${name || 'Desconocido'}\n${extraInfo}`;
    return this;
  }

  /**
   * Inyecta el catálogo de productos desde config.
   */
  public setCatalog(): this {
    this.components['CAT'] = `### 🛒 CATÁLOGO DE PRODUCTOS (ÚNICA FUENTE DE VERDAD)\n${botConfig.catalog}`;
    return this;
  }

  /**
   * Instrucciones de multimedia (solo activas si el mensaje tiene media).
   */
  public setMultimodalInstructions(hasMedia: boolean): this {
    if (!hasMedia) {
      delete this.components['MULTI'];
      return this;
    }
    this.components['MULTI'] = `### 📸 VISIÓN Y AUDIO ACTIVOS
Tienes visión y oído habilitados en este mensaje.
OBLIGATORIO: La PRIMERA LÍNEA de tu respuesta debe ser un resumen entre corchetes:
[RESUMEN: descripción breve de lo que viste/escuchaste]
Luego escribe tu respuesta normal. NO uses corchetes en el resto de la respuesta.`;
    return this;
  }

  /**
   * Retorna los componentes individuales para auditoría o conteo de tokens.
   */
  public getComponents(): Record<string, string> {
    return { ...this.components };
  }

  /**
   * Ensambla y retorna el prompt del sistema en orden determinista.
   */
  public build(): string {
    return SystemPromptBuilder.COMPONENT_ORDER
      .map(key => this.components[key])
      .filter(Boolean)
      .join('\n\n');
  }
}
