const supabase = require('../config/database');
const config = require('../config');

// --- CACHÉ DE CATÁLOGO (Servicios y Precios) ---
let catalogCache = "";
let lastCatalogFetch = 0;

async function getCatalog() {
    if (Date.now() - lastCatalogFetch > config.CACHE_TTL.CATALOG) {
        const { data } = await supabase.from('services').select('*');
        if (data && data.length > 0) {
            catalogCache = data.map(s => `- ${s.title}: (Duración: ${s.duration_minutes || 60} mins) - Precio: ${s.price || 'Por cotizar'}`).join('\n');
            lastCatalogFetch = Date.now();
        } else {
            catalogCache = "El catálogo está vacío. Asume duraciones de 60 mins.";
        }
    }
    return catalogCache;
}

// --- CACHÉ DE CONFIGURACIÓN DE AGENDA ---
let agendaConfigCache = null;
let lastAgendaConfigFetch = 0;

async function getAgendaConfig() {
    if (Date.now() - lastAgendaConfigFetch > config.CACHE_TTL.AGENDA_CONFIG || !agendaConfigCache) {
        const { data } = await supabase.from('site_content')
            .select('key, value')
            .in('key', ['agenda_open', 'agenda_close', 'agenda_buffer', 'agenda_concurrency', 'agenda_closed_days']);

        let configAgenda = { 
            open: config.BUSINESS_HOURS.OPEN, 
            close: config.BUSINESS_HOURS.CLOSE, 
            buffer: config.BUSINESS_HOURS.BUFFER, 
            concurrency: config.BUSINESS_HOURS.CONCURRENCY, 
            closedDays: config.BUSINESS_HOURS.CLOSED_DAYS 
        };

        if (data) {
            data.forEach(item => {
                if (item.key === 'agenda_open') configAgenda.open = item.value || config.BUSINESS_HOURS.OPEN;
                if (item.key === 'agenda_close') configAgenda.close = item.value || config.BUSINESS_HOURS.CLOSE;
                if (item.key === 'agenda_buffer') configAgenda.buffer = parseInt(item.value) || config.BUSINESS_HOURS.BUFFER;
                if (item.key === 'agenda_concurrency') configAgenda.concurrency = parseInt(item.value) || config.BUSINESS_HOURS.CONCURRENCY;
                if (item.key === 'agenda_closed_days') {
                    if (item.value && item.value.trim() !== "") {
                        configAgenda.closedDays = item.value.split(',').map(d => parseInt(d.trim()));
                    } else {
                        configAgenda.closedDays = [];
                    }
                }
            });
        }
        agendaConfigCache = configAgenda;
        lastAgendaConfigFetch = Date.now();
    }
    return agendaConfigCache;
}

module.exports = {
    getCatalog,
    getAgendaConfig
};
