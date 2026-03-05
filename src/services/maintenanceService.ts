const supabase = require('../config/database');
const logger = require('../utils/logger').default;
const DateUtils = require('../utils/DateUtils').default;

class MaintenanceService {
    /**
     * Ejecuta tareas de limpieza y actualización de estados
     */
    async runDailyMaintenance() {
        logger.info('--- 🧹 INICIANDO MANTENIMIENTO DIARIO DEL SISTEMA ---');
        try {
            const today = DateUtils.getTodayBogotaStr();

            // Calculamos fechas límite
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const limitValidation = yesterdayDate.toISOString().split('T')[0];

            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            const limitPurge = oneMonthAgo.toISOString().split('T')[0];

            // 1. VALIDACIÓN DE MÉTRICAS (1 día después de la fecha de la cita)
            // Solo procesamos las que NO han sido validadas y cuya fecha ya pasó (al menos 1 día)
            const { data: toValidate, error: fetchError } = await supabase
                .from('appointments')
                .select('id, phone, status')
                .lt('appointment_date', today) // Ya pasó el día de la cita
                .lte('appointment_date', limitValidation) // Ya pasó el margen de 1 día
                .eq('is_validated', false)
                .in('status', ['agendada', 'completada']); // Solo cuentan las exitosas

            if (fetchError) {
                logger.error('Error obteniendo citas para validación:', fetchError);
            } else if (toValidate && toValidate.length > 0) {
                logger.info(`Validando métricas para ${toValidate.length} citas de hace >24h...`);

                for (const appt of toValidate) {
                    try {
                        // Incrementar contador atómicamente
                        await supabase.rpc('increment_lead_appointments', {
                            p_phone: appt.phone
                        });

                        // Marcar como validada para bloqueos y no repetir conteo
                        await supabase
                            .from('appointments')
                            .update({ is_validated: true })
                            .eq('id', appt.id);

                    } catch (err) {
                        logger.error(`Error validando cita ${appt.id}:`, err);
                    }
                }
                logger.info(`Validación de métricas finalizada.`);
            }

            // 2. PURGA DEFINITIVA (Citas > 1 mes de antigüedad)
            // Aquí es donde realmente limpiamos la DB para que coincida con lo que el Admin verá
            // Borramos citas (validadas o canceladas) que ya tengan más de 1 mes de viejas
            const { error: purgeError } = await supabase
                .from('appointments')
                .delete()
                .lt('appointment_date', limitPurge);

            if (purgeError) {
                logger.error('Error purgando citas antiguas del mes pasado:', purgeError);
            } else {
                logger.info(`Limpieza profunda: Citas de hace más de 1 mes eliminadas de la DB.`);
            }

            logger.info('--- ✅ MANTENIMIENTO COMPLETADO ---');
        } catch (error) {
            logger.error('Error crítico en el servicio de mantenimiento:', error);
        }
    }

    /**
     * Motor de Programación: Calcula el tiempo hasta la próxima medianoche
     * para ejecutar el mantenimiento exactamente al inicio del nuevo día.
     */
    init() {
        // 1. Ejecución inmediata al arrancar (Catch-up)
        logger.info('Motor de mantenimiento iniciado. Ejecutando catch-up inicial...');
        this.runDailyMaintenance();

        // 2. Programar la ejecución recurrente a la medianoche (00:00:01)
        this.scheduleNextRun();
    }

    private scheduleNextRun() {
        const now = new Date();

        // Obtenemos la hora exacta en Bogotá de forma nativa e infalible
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Bogota',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false, // Forzar 24hs
        });

        // formatter.format() retorna "14:16:51" o similar. Dependiendo de NodeJS, podría imprimir "24:xx" 
        const timeStr = formatter.format(now);
        // Si Node retorna PM/AM a la fuerza (por en-US error en ciertas versiones), obligamos los 2 dígitos
        const timeParts = timeStr.match(/\d+/g);
        if (!timeParts || timeParts.length < 3) {
            logger.error("Error analizando huso horario. Programando fallback en 1 hora.");
            setTimeout(() => this.scheduleNextRun(), 3600000);
            return;
        }

        let bHour = parseInt(timeParts[0], 10);
        if (bHour === 24) bHour = 0; // Algunas versiones de Node retornan 24 para medianoche
        if (timeStr.toLowerCase().includes('pm') && bHour < 12) bHour += 12;
        if (timeStr.toLowerCase().includes('am') && bHour === 12) bHour = 0;

        const bMinute = parseInt(timeParts[1], 10);
        const bSecond = parseInt(timeParts[2], 10);

        // Milisegundos que han pasado hoy en Bogotá desde su medianoche
        const msSinceMidnight = (bHour * 3600000) + (bMinute * 60000) + (bSecond * 1000);

        // Milisegundos que faltan para llegar a la próxima medianoche en Bogotá (sumamos 1 segundo extra)
        const msUntilMidnight = (24 * 3600000) - msSinceMidnight + 1000;

        const hours = Math.floor(msUntilMidnight / 3600000);
        const minutes = Math.floor((msUntilMidnight % 3600000) / 60000);

        logger.info(`Próximo mantenimiento programado en ${hours}h ${minutes}m (Medianoche Bogotá)`);

        setTimeout(() => {
            this.runDailyMaintenance();
            // Una vez ejecutado, re-programamos para el día siguiente
            this.scheduleNextRun();
        }, msUntilMidnight);
    }
}

module.exports = new MaintenanceService();
