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
            const { data } = await supabase.from('site_content')
              .select('key, value')
              .in('key', ['agenda_open', 'agenda_close', 'agenda_buffer', 'agenda_concurrency', 'agenda_closed_days']);

            let configData = { ...config.BUSINESS_HOURS };

            if (data && data.length > 0) {
              data.forEach(item => {
                if (item.key === 'agenda_open') configData.open = item.value || configData.open;
                if (item.key === 'agenda_close') configData.close = item.value || configData.close;
                if (item.key === 'agenda_buffer') configData.buffer = parseInt(item.value) || configData.buffer;
                if (item.key === 'agenda_concurrency') configData.concurrency = parseInt(item.value) || configData.concurrency;
                if (item.key === 'agenda_closed_days') {
                  if (item.value && item.value.trim() !== "") {
                    configData.closedDays = item.value.split(',').map(d => parseInt(d.trim()));
                  } else {
                    configData.closedDays = [];
                  }
                }
              });
            }
            this.agendaConfigCache = configData;
            this.lastAgendaConfigFetch = Date.now();
          } catch (error) {
            console.error("Error fetching agenda config:", error);
            // Si hay error, devolvemos la configuración por defecto
            if (!this.agendaConfigCache) {
              this.agendaConfigCache = { ...config.BUSINESS_HOURS };
            }
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
}

module.exports = new CacheManager();
