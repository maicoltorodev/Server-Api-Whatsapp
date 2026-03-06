import supabase from '../config/database';
import logger from '../utils/logger';
import DateUtils from '../utils/DateUtils';

// --- INTERFACES DE DOMINIO ---
interface Lead {
    id: string;
    status: string;
    interest?: string;
    product_service?: string;
    created_at: string;
    medical_history?: {
        pets?: Array<{ breed?: string }>;
    };
}

interface Service {
    id: string;
    title: string;
    price: string | number;
}

interface Appointment {
    id: string;
    phone: string;
    service_id: string;
    appointment_date: string;
    status: string;
    created_at: string;
}

interface Chat {
    history: Array<{ role: string; parts: Array<{ text: string }> }>;
    updated_at: string;
    phone: string;
}

export class AnalyticsModel {
    /**
     * Helper para obtener los rangos de fechas simétricos
     * P1: Pasado (Últimos N días)
     * P0: Pasado Anterior (Tendencia)
     * F1: Futuro (Siguientes N días - Proyección)
     */
    private getDateRanges(days: number = 30) {
        const now = DateUtils.getNow();

        // --- PASADO (Historical) ---
        const p1Start = new Date(now.getTime());
        p1Start.setDate(now.getDate() - days);

        const p0Start = new Date(p1Start.getTime());
        p0Start.setDate(p1Start.getDate() - days);

        // --- FUTURO (Forward/Prospectiva) ---
        const f1End = new Date(now.getTime());
        f1End.setDate(now.getDate() + days);

        return {
            p1: { start: p1Start.toISOString(), end: now.toISOString() },
            p0: { start: p0Start.toISOString(), end: p1Start.toISOString() },
            f1: { start: now.toISOString(), end: f1End.toISOString() }
        };
    }

    /**
     * Obtiene el Dashboard principal con tendencias
     */
    public async getFullDashboard(days: number = 30) {
        try {
            const ranges = this.getDateRanges(Number(days));

            // 1. Datos Base del Periodo Actual (P1)
            const { data: services } = await supabase.from('services').select('id, title, price') as { data: Service[] };
            const { data: leadsP1 } = await supabase.from('leads').select('*').gte('created_at', ranges.p1.start) as { data: Lead[] };
            const { data: leadsP0 } = await supabase.from('leads').select('id').gte('created_at', ranges.p0.start).lt('created_at', ranges.p1.start) as { data: Lead[] };
            const { data: chats } = await supabase.from('chats').select('history, updated_at, phone') as { data: Chat[] };
            const { data: appts } = await supabase.from('appointments').select('*') as { data: Appointment[] };

            // --- CÁLCULOS DE KPIs ---

            // Conversión
            const convP1 = this.calculateConversion(leadsP1);
            const convP0 = this.calculateConversion(leadsP0);
            const convTrend = this.calculateTrend(convP1, convP0);

            // ROI (Ahorro de Tiempo)
            let totalBotMessages = 0;
            chats?.forEach(c => {
                const history = c.history || [];
                totalBotMessages += history.filter(m => m.role === 'model').length;
            });
            const hoursSaved = (totalBotMessages * 1.5) / 60;

            // Ingresos (Reales y Proyectados) - Ahora con rangos simétricos
            const revenue = this.calculateDetailedRevenue(appts, services, ranges);

            // Fidelización
            const loyalty = this.calculateLoyalty(appts);

            // --- GRÁFICOS Y DISTRIBUCIONES ---

            const serviceDist = this.getDynamicServiceDist(leadsP1, services);
            const heatmap = this.getHeatmap(chats, leadsP1, appts);
            const petData = this.getPetsDemographics(leadsP1);

            // --- INSIGHTS DE MIEL (PASADO Y FUTURO) ---
            const insights = this.generateInsights(serviceDist, heatmap, hoursSaved, convP1, revenue, days);

            return {
                stats: {
                    conversion: { value: convP1.toFixed(1), trend: convTrend },
                    revenue: {
                        realized: revenue.realized,
                        projected: revenue.projected,
                        value: revenue.realized + revenue.projected,
                        trend: "0" // Eliminada tendencia harcodeada
                    },
                    loyalty: { value: loyalty.toFixed(1), trend: "0" }, // Eliminada tendencia harcodeada
                    efficiency: { value: hoursSaved.toFixed(1), unit: 'hrs' }
                },
                charts: {
                    services: serviceDist,
                    heatmap: heatmap,
                    pets: petData
                },
                insights: insights
            };

        } catch (error) {
            logger.error('Error en AnalyticsModel.getFullDashboard', { error });
            throw error;
        }
    }

    private calculateConversion(leads: Lead[]) {
        if (!leads || leads.length === 0) return 0;
        const total = leads.length;
        const success = leads.filter(l => l.status === 'agendada' || l.status === 'cita_confirmada').length;
        return (success / total) * 100;
    }

    private calculateTrend(p1: number, p0: number) {
        if (p0 === 0) return "+0";
        const diff = ((p1 - p0) / p0) * 100;
        return (diff >= 0 ? "+" : "") + diff.toFixed(0);
    }

    /**
     * Calcula ingresos reales y proyectados dentro de las ventanas de tiempo
     */
    private calculateDetailedRevenue(appts: Appointment[], services: Service[], ranges: any) {
        if (!appts || !services) return { realized: 0, projected: 0 };

        const todayStr = DateUtils.getTodayBogotaStr();
        const p1Start = ranges.p1.start.split('T')[0];
        const f1End = ranges.f1.end.split('T')[0];

        let realized = 0;
        let projected = 0;

        appts.forEach(a => {
            // Ignorar citas canceladas o sin fecha válida
            if (a.status === 'cancelada' || !a.appointment_date) return;

            const service = services.find(s => s.id === a.service_id);
            const price = service ? Number(service.price || 0) : 0; // Fallback a 0 en lugar de 50.000 hardcoded
            const apptDate = a.appointment_date;

            // Dinero en Caja: Citas pasadas DENTRO del periodo P1
            if (apptDate < todayStr && apptDate >= p1Start) {
                realized += price;
            }
            // Dinero en Agenda: Citas futuras DENTRO del periodo F1
            else if (apptDate >= todayStr && apptDate <= f1End) {
                projected += price;
            }
        });

        return { realized, projected };
    }

    private calculateLoyalty(appts: Appointment[]) {
        if (!appts || appts.length === 0) return 0;
        const counts: Record<string, number> = {};
        appts.forEach(a => { counts[a.phone] = (counts[a.phone] || 0) + 1; });
        const totalUsers = Object.keys(counts).length;
        const repeatUsers = Object.values(counts).filter(c => c > 1).length;
        return totalUsers > 0 ? (repeatUsers / totalUsers) * 100 : 0;
    }

    private getDynamicServiceDist(leads: Lead[], services: Service[]) {
        const dist: Record<string, number> = {};
        // Inicializar con servicios actuales para que salgan aunque tengan 0
        services?.forEach(s => dist[s.title] = 0);

        leads?.forEach(l => {
            const serviceName = l.product_service || l.interest;
            if (serviceName && serviceName !== 'SALUDO' && serviceName !== 'inicio') {
                // Intentar match con catálogo
                const match = services?.find(s =>
                    s.title.toLowerCase().includes(serviceName.toLowerCase()) ||
                    serviceName.toLowerCase().includes(s.title.toLowerCase())
                );

                const finalName = match ? match.title : "Otros / Inactivos";
                dist[finalName] = (dist[finalName] || 0) + 1;
            }
        });

        return Object.entries(dist)
            .map(([name, value]) => ({ name, value }))
            .filter(item => item.value > 0 || services?.some(s => s.title === item.name))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }

    private getHeatmap(chats: Chat[], leads: Lead[], appts: Appointment[]) {
        const hours = Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, mjes: 0 }));

        const processDate = (dateStr?: string) => {
            if (!dateStr) return;
            try {
                const date = new Date(dateStr);
                const bogota = DateUtils.getBogotaFakeUTC(date);
                const h = bogota.getUTCHours() % 24;
                hours[h].mjes++;
            } catch (e) { /* ignore safe */ }
        };

        chats?.forEach(c => processDate(c.updated_at));
        leads?.forEach(l => processDate(l.created_at));
        appts?.forEach(a => processDate(a.created_at));

        return hours;
    }

    private getPetsDemographics(leads: Lead[]) {
        const breeds: Record<string, number> = {};
        leads?.forEach(l => {
            const pets = l.medical_history?.pets || [];
            pets.forEach(p => {
                const b = p.breed || 'Mestizo/Otro';
                breeds[b] = (breeds[b] || 0) + 1;
            });
        });
        return Object.entries(breeds)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }

    private generateInsights(services: any[], heatmap: any[], savings: number, conversion: number, revenue: any, period: number) {
        const hasServices = services && services.length > 0 && services.some(s => s.value > 0);
        const bestService = hasServices ? services[0]?.name : null;
        const projected = revenue.projected || 0;
        const totalActivity = heatmap.reduce((acc: number, h: any) => acc + h.mjes, 0);

        const insights = [];

        // 1. Insight de Eficiencia (Miel)
        if (savings > 0) {
            insights.push({
                title: "Ahorro Estratégico",
                text: `Miel ha gestionado la atención de forma autónoma, ahorrándote aproximadamente ${savings.toFixed(1)} horas de trabajo manual en este ciclo.`,
                type: "positive"
            });
        } else {
            insights.push({
                title: "Optimización de Inicio",
                text: "Aún no hay mensajes procesados por la IA. Una vez que los clientes empiecen a interactuar, mediré el tiempo de respuesta ahorrado.",
                type: "strategic"
            });
        }

        // 2. Insight de Ventas / Servicios
        if (bestService) {
            insights.push({
                title: "Oportunidad de Oro",
                text: `"${bestService}" es tu servicio más solicitado. Podrías aumentar el ticket promedio ofreciendo un complemento exclusivo para este servicio.`,
                type: "strategic"
            });
        } else {
            insights.push({
                title: "Catálogo Silencioso",
                text: "No detecto demanda de servicios específicos. Asegúrate de que los nombres de los servicios en el catálogo coincidan con lo que los clientes preguntan.",
                type: "strategic"
            });
        }

        // 3. Insight Prospectivo o de Actividad
        if (projected > 0) {
            insights.push({
                title: "Previsión de Ingresos",
                text: `Tienes $${projected.toLocaleString()} en ingresos proyectados para los próximos días. Un recordatorio automático podría asegurar estas citas.`,
                type: "info"
            });
        } else if (totalActivity > 0) {
            const peakHour = [...heatmap].sort((a, b) => b.mjes - a.mjes)[0]?.hour || "10:00";
            insights.push({
                title: "Pico de Tráfico",
                text: `Tu mayor volumen de consultas ocurre cerca de las ${peakHour}. Es el momento ideal para estar atento a cierres manuales si es necesario.`,
                type: "info"
            });
        } else {
            insights.push({
                title: "Esperando Tracción",
                text: "El sistema está listo y sincronizado. En cuanto entre el primer lead, empezaré a proyectar tendencias y proyecciones de caja.",
                type: "info"
            });
        }

        return insights.slice(0, 3);
    }
}

export default new AnalyticsModel();

