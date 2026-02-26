const config = require('../config');
const supabase = require('../config/database');

class CacheManager {
  constructor() {
    this.catalogString = "";
    this.catalogArray = [];
    this.lastCatalogFetch = 0;
    this.fetchCatalogPromise = null; // Control Cache Stampede

    this.agendaConfigCache = null;
    this.lastAgendaConfigFetch = 0;
    this.fetchAgendaPromise = null; // Control Cache Stampede
  }

  /**
   * Obtiene y actualiza los datos del catálogo en caché
   */
  async fetchCatalogIfNeeded() {
    if (Date.now() - this.lastCatalogFetch > config.CACHE_TTL.CATALOG) {
      if (!this.fetchCatalogPromise) {
        this.fetchCatalogPromise = (async () => {
          try {
            const { data } = await supabase.from('services').select('*');
            if (data && data.length > 0) {
              this.catalogArray = data;
              this.catalogString = data.map(s =>
                `- ${s.title}: (Duración: ${s.duration_minutes || 60} mins) - Precio: ${s.price || 'Por cotizar'}`
              ).join('\n');
            } else {
              this.catalogArray = [];
              this.catalogString = "El catálogo está vacío. Asume duraciones de 60 mins.";
            }
            this.lastCatalogFetch = Date.now();
          } catch (error) {
            console.error("Error fetching catalog:", error);
            if (!this.catalogString) {
              this.catalogArray = [];
              this.catalogString = "El catálogo temporalmente no disponible. Asume duraciones de 60 mins.";
            }
          } finally {
            this.fetchCatalogPromise = null; // Liberar lock promise
          }
        })();
      }
      // Si hay una request en vuelo u original, la esperamos
      await this.fetchCatalogPromise;
    }
  }

  /**
   * Obtiene el catálogo de servicios en formato String (Para la IA)
   */
  async getCatalog() {
    await this.fetchCatalogIfNeeded();
    return this.catalogString;
  }

  /**
   * Obtiene el catálogo de servicios en formato Array crudo (Para validación interna)
   */
  async getCatalogArray() {
    await this.fetchCatalogIfNeeded();
    return this.catalogArray;
  }

  /**
   * Obtiene la configuración de la agenda con caché
   */
  async getAgendaConfig() {
    if (Date.now() - this.lastAgendaConfigFetch > config.CACHE_TTL.AGENDA_CONFIG || !this.agendaConfigCache) {
      if (!this.fetchAgendaPromise) {
        this.fetchAgendaPromise = (async () => {
          try {
            // Buscamos en site_content y ai_settings para cobertura total
            const [siteRes, aiRes] = await Promise.all([
              supabase.from('site_content').select('key, value').in('key', ['site_name', 'agenda_open', 'agenda_close', 'agenda_buffer', 'agenda_concurrency', 'agenda_closed_days']),
              supabase.from('ai_settings').select('key, value')
            ]);

            let configData = {
              siteName: "Pet Care Studio",
              open: config.BUSINESS_HOURS.open || "09:00",
              close: config.BUSINESS_HOURS.close || "17:00",
              buffer: config.BUSINESS_HOURS.buffer || 0,
              concurrency: config.BUSINESS_HOURS.concurrency || 1,
              closedDays: config.BUSINESS_HOURS.closedDays || [0],
              business_hours_text: "",
              closed_days_text: "",
              defaultDuration: 60,
              agentName: "Miel",
              agentPersonality: "Amigable y profesional",
              businessRules: "",
              masterPrompt: ""
            };

            // 1. Procesar site_content
            if (siteRes.data) {
              siteRes.data.forEach(item => {
                const key = item.key.toLowerCase();
                if (key === 'site_name') configData.siteName = item.value || configData.siteName;
                if (key === 'agenda_open') configData.open = item.value || configData.open;
                if (key === 'agenda_close') configData.close = item.value || configData.close;
                if (key === 'agenda_buffer') configData.buffer = parseInt(item.value) || configData.buffer;
                if (key === 'agenda_concurrency') configData.concurrency = parseInt(item.value) || configData.concurrency;
                if (key === 'agenda_closed_days') {
                  if (item.value && item.value.trim() !== "") {
                    configData.closedDays = item.value.split(',').map(d => parseInt(d.trim()));
                  }
                }
              });
            }

            // 2. Procesar ai_settings
            if (aiRes.data) {
              aiRes.data.forEach(item => {
                const key = item.key.toLowerCase();
                if (key === 'business_hours') configData.business_hours_text = item.value;
                if (key === 'closed_days') configData.closed_days_text = item.value;
                if (key === 'agent_name') configData.agentName = item.value;
                if (key === 'agent_personality') configData.agentPersonality = item.value;
                if (key === 'business_rules') configData.businessRules = item.value;
                if (key === 'bot_system_prompt') configData.masterPrompt = item.value;

                // Lógica prioritaria
                if (key === 'agenda_open') configData.open = item.value || configData.open;
                if (key === 'agenda_close') configData.close = item.value || configData.close;
                if (key === 'simultaneous_appointments') configData.concurrency = parseInt(item.value) || configData.concurrency;
                if (key === 'agenda_buffer') configData.buffer = parseInt(item.value) || configData.buffer;
                if (key === 'appointment_duration_minutes') configData.defaultDuration = parseInt(item.value) || configData.defaultDuration;
                if (key === 'max_daily_appointments') configData.maxDaily = parseInt(item.value) || 8;
                if (key === 'agenda_closed_days') {
                  if (item.value && item.value.trim() !== "") {
                    configData.closedDays = item.value.split(',').map(d => parseInt(d.trim()));
                  }
                }
              });
            }

            this.agendaConfigCache = configData;
            this.lastAgendaConfigFetch = Date.now();
          } catch (error) {
            console.error("Error fetching agenda config:", error);
            if (!this.agendaConfigCache) this.agendaConfigCache = { ...config.BUSINESS_HOURS };
          } finally {
            this.fetchAgendaPromise = null;
          }
        })();
      }
      await this.fetchAgendaPromise;
    }
    return this.agendaConfigCache;
  }

  /**
   * Invalida el caché del catálogo
   */
  invalidateCatalogCache() {
    this.lastCatalogFetch = 0;
  }

  /**
   * Invalida el caché de la configuración de agenda
   */
  invalidateAgendaConfigCache() {
    this.lastAgendaConfigFetch = 0;
  }
  /**
   * Invalida los caches para forzar una nueva lectura de la BD
   */
  invalidateConfig() {
    this.catalogCache = null;
    this.agendaConfigCache = null;
    this.lastCatalogFetch = 0;
    this.lastAgendaConfigFetch = 0;
    console.log("♻️ Cache de configuración invalidado.");
  }
}

module.exports = new CacheManager();
