import { IAppConfig } from '../../types';

export class SystemPromptBuilder {
    private parts: string[] = [];

    /**
     * Define la identidad base de la IA.
     */
    public setIdentity(config: IAppConfig): this {
        this.parts.push(`Eres "${config.agent.agentName}", la asistente virtual de "${config.siteName}".
PERSONALIDAD: ${config.agent.agentPersonality}`);
        return this;
    }

    /**
     * Inyecta la hora actual para ubicación temporal.
     */
    public setTimeContext(timezone: string = 'America/Bogota'): this {
        const currentTime = new Date().toLocaleString("es-CO", { timeZone: timezone });
        this.parts.push(`🗓️ HORA ACTUAL: ${currentTime}`);
        return this;
    }

    /**
     * Contexto de la etapa de ventas actual.
     */
    public setLeadContext(currentStage: string, summary: string): this {
        this.parts.push(`ESTADO CLIENTE: ${currentStage || 'SALUDO'}.
RESUMEN RECIENTE (Chat Corto Plazo): ${summary || 'Nuevo cliente.'}.`);
        return this;
    }

    /**
     * Formatea e inyecta la memoria a largo plazo (Ficha clínica)
     */
    public setMedicalHistory(historyObj: any): this {
        let historyText = 'Ninguno registrado aún.';
        if (historyObj && historyObj.pets && Array.isArray(historyObj.pets)) {
            historyText = historyObj.pets.map((p: any) =>
                `🐾 MASCOTA: ${p.name || 'Sin nombre'}
- Alergias: ${p.allergies?.join(', ') || 'Ninguna'}
- Conducta: ${p.behavior || 'N/A'}
- Preferencias (Dueño): ${p.preferences?.join(', ') || 'N/A'}`
            ).join('\n\n');
        } else if (historyObj && Object.keys(historyObj).length > 0) {
            historyText = JSON.stringify(historyObj, null, 2);
        }

        this.parts.push(`🧠 FICHAS CLÍNICAS (Memoria a Largo Plazo):
En este apartado verás la información de las mascotas del cliente. Un cliente puede tener varias mascotas.
${historyText}
(Usa OBLIGATORIAMENTE esta información clínica antes de ofrecer servicios para cada mascota específica).`);

        return this;
    }

    /**
     * Inyecta el catálogo pre-parseado a string
     */
    public setCatalog(catalogString: string): this {
        this.parts.push(`SERVICIOS DISPONIBLES:
${catalogString}`);
        return this;
    }

    /**
     * Define operaciones logísticas de tiempo y lugar.
     */
    public setOperations(config: IAppConfig): this {
        const hoursText = config.hours.business_hours_text || `- Lunes a Sábado: ${config.hours.open} a ${config.hours.close}.`;
        const closedText = config.hours.closed_days_text ? `\nDÍAS CERRADOS:\n${config.hours.closed_days_text}` : '\n- Domingos: Cerrado.';

        this.parts.push(`HORARIOS DE ATENCIÓN:
${hoursText}${closedText}`);

        if (config.agent.businessRules) {
            this.parts.push(`REGLAS DE NEGOCIO EN EL ESTUDIO:
${config.agent.businessRules}`);
        }

        return this;
    }

    /**
     * Las directrices supremas definidas por el dueño en el CMS
     */
    public setMasterInstructions(config: IAppConfig): this {
        if (config.agent.masterPrompt) {
            this.parts.push(`INSTRUCCIONES MAESTRAS (OVERRIDE):
${config.agent.masterPrompt}`);
        }
        return this;
    }

    /**
     * Restricciones de seguridad hardcodeadas de diseño (No editables)
     */
    public setHardcodedRules(): this {
        this.parts.push(`REGLAS DE ORO (OBLIGATORIAS):
1. PROHIBIDO decir "Déjame revisar", "Dame un momento", "Ya te confirmo" o similares. Tienes acceso instantáneo a la agenda.
2. Si necesitas verificar algo (como disponibilidad), ejecuta 'check_availability' DE INMEDIATO y responde directamente con el resultado que recibas.
3. Nunca des una respuesta de texto que prometa una acción futura; realiza la acción AHORA usando las herramientas.
4. Sé concisa y amable. Usa Emojis 🐾.
5. Citas -> Usa 'check_availability' para ver huecos y 'book_appointment' SOLO cuando el cliente acepte un horario específico.
6. Traspaso humano -> Solo si el cliente lo pide o está frustrado, usa 'transfer_to_human'.`);
        return this;
    }

    /**
     * Ensambla y retorna el gran volumen de texto 
     */
    public build(): string {
        return this.parts.join('\n\n');
    }
}
