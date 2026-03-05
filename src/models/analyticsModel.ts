const supabase = require('../config/database');
const logger = require('../utils/logger').default;

class AnalyticsModel {
    /**
     * Obtiene estadísticas de conversión y KPIs globales
     */
    async getGlobalStats() {
        try {
            // 1. Total de leads con intención
            const { data: leads, error: leadsError } = await supabase.from('leads').select('status, phone');
            if (leadsError) throw leadsError;

            const totalLeads = leads?.length || 0;
            const convertedLeads = leads?.filter(l => l.status === 'agendada').length || 0;
            const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

            // 2. Fidelización: Leads con más de una cita
            const { data: appts, error: apptError } = await supabase.from('appointments').select('phone');
            if (apptError) throw apptError;

            const userApptCount = {};
            (appts || []).forEach(a => {
                userApptCount[a.phone] = (userApptCount[a.phone] || 0) + 1;
            });

            const totalUniqueCustomers = Object.keys(userApptCount).length;
            const loyalCustomers = Object.values(userApptCount).filter((c) => (c as number) > 1).length;
            const loyaltyIndex = totalUniqueCustomers > 0 ? (loyalCustomers / totalUniqueCustomers) * 100 : 0;

            return {
                totalLeads,
                convertedLeads,
                conversionRate: conversionRate.toFixed(1),
                totalAppointments: appts?.length || 0,
                loyalCustomers,
                loyaltyIndex: loyaltyIndex.toFixed(1)
            };
        } catch (error) {
            logger.error('Error en AnalyticsModel.getGlobalStats', { error });
            throw error;
        }
    }

    /**
     * Obtiene la distribución de servicios
     */
    async getServiceDistribution() {
        try {
            const { data, error } = await supabase.from('leads').select('current_step');
            if (error) throw error;

            const distribution = {};
            (data || []).forEach(l => {
                if (l.current_step && l.current_step !== 'inicio') {
                    distribution[l.current_step] = (distribution[l.current_step] || 0) + 1;
                }
            });

            return Object.entries(distribution).map(([name, value]) => ({ name, value }));
        } catch (error) {
            logger.error('Error en AnalyticsModel.getServiceDistribution', { error });
            throw error;
        }
    }

    /**
     * Obtiene el mapa de calor horario basado en la última actividad de los chats
     */
    async getHeatmapData() {
        try {
            // Usamos updated_at ya que la tabla chats no tiene created_at (es un log de actividad reciente)
            const { data, error } = await supabase
                .from('chats')
                .select('updated_at')
                .order('updated_at', { ascending: false })
                .limit(1000);

            if (error) throw error;

            const hours = Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, mjes: 0 }));
            (data || []).forEach(c => {
                if (c.updated_at) {
                    const hour = new Date(c.updated_at).getHours();
                    hours[hour].mjes++;
                }
            });

            return hours;
        } catch (error) {
            logger.error('Error en AnalyticsModel.getHeatmapData', { error });
            throw error;
        }
    }

    /**
     * Obtiene demografía de mascotas (Razas y Tipos)
     */
    async getPetDemographics() {
        try {
            const { data, error } = await supabase.from('leads').select('medical_history');
            if (error) throw error;

            const breeds = {};
            (data || []).forEach(l => {
                const history = l.medical_history || {};
                const pets = history.pets || [];
                pets.forEach(p => {
                    const breed = p.breed || 'Desconocida';
                    breeds[breed] = (breeds[breed] || 0) + 1;
                });
            });

            return Object.entries(breeds)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => (b.value as number) - (a.value as number))
                .slice(0, 5);
        } catch (error) {
            logger.error('Error en AnalyticsModel.getPetDemographics', { error });
            throw error;
        }
    }

    /**
     * Obtiene eficiencia de la IA analizando el historial JSONB
     */
    async getIAEfficiency() {
        try {
            const { data, error } = await supabase
                .from('chats')
                .select('history');

            if (error) throw error;

            let botMessages = 0;
            let totalMessages = 0;

            (data || []).forEach(chat => {
                const history = chat.history || [];
                history.forEach(msg => {
                    totalMessages++;
                    if (msg.role === 'model') botMessages++;
                });
            });

            const automationRatio = totalMessages > 0 ? (botMessages / totalMessages) * 100 : 0;

            return {
                automationRatio: automationRatio.toFixed(1),
                totalProcessed: totalMessages
            };
        } catch (error) {
            logger.error('Error en AnalyticsModel.getIAEfficiency', { error });
            throw error;
        }
    }
}

module.exports = new AnalyticsModel();
