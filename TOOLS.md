# Catálogo de Herramientas (Function Calling) 🛠️

Este documento describe las herramientas habilitadas para **Google Gemini 1.5 Flash** en el entorno de "Pet Care Studio". 
Las IAs que asistan en el desarrollo y mantenimiento del código deben leer este archivo para entender el espectro de acciones que la IA conversacional puede ejecutar.

## 1. `check_availability` (Consultar Disponibilidad)
- **Propósito:** Es la herramienta **obligatoria** de bandera roja. Obliga al modelo a nunca especular sobre horarios.
- **Payload esperado:** `{ date: "YYYY-MM-DD", time: "mañana/tarde/string", duration_minutes: 60 }`
- **Regla de Desarrollo:** El servicio que atiende esto (`appointmentService.js/ts`) debe devolver una respuesta clara al modelo en lenguaje natural. Ej: `¡Buenas noticias! Sí hay disponibilidad a las 09:00 AM para el servicio. Dile al cliente que te confirme si quiere que le guardes el turno.`

## 2. `book_appointment` (Agendar Cita)
- **Propósito:** Separar el espacio en la base de datos solo tras la confirmación explícita del cliente.
- **Payload esperado:** `{ service: "Baño", pet_name: "Firulais", date: "YYYY-MM-DD", start_time: "HH:MM", duration_minutes: 60 }`
- **Regla de Desarrollo:** No se puede ejecutar `book_appointment` sin parámetros de fecha y hora confirmados.

## 3. `update_lead_info` (Actualizar Embudos y Datos)
- **Propósito:** Es una herramienta de "back-channel" que le permite a Gemini actualizar silenciosamente la base de datos de prospectos (ej. actualizar que el usuario está en la fase de `CIERRE` o que el presupuesto es `$50.00`).
- **Comportamiento Anómalo Esperado:** A veces Gemini lanza este "Function Call" al mismo tiempo que envía texto de respuesta al usuario final (Parallel Tools).

## 4. `cancel_appointment` (Cancelar Turno)
- **Propósito:** Remueve una cita previamente acordada.
- **Acción Relacionada:** Cuando se llama a esto, se debe notificar por lo general al dueño del negocio para posibles reagendamientos manuales.

## 5. `transfer_to_human` (Escape Handler)
- **Propósito:** Cambia el status `bot_active` a `false` en la DB, desencadenando el evento SSE `human_required` para alertar al panel visual del Dashboard Front-End.
- **Regla:** Ningún modelo posterior debe encender el bot si un cliente fue escalado por aquí, solo el usuario Admin (humano) puede volver a encenderlo.

## 6. `save_pet_preference` (Historial Médico)
- **Propósito:** Almacén persistente (Long-Term Memory). Permite recordar permanentemente condiciones de salud, historial o exigencias de los dueños. 
- **Payload esperado:** `{ category: "allergies", value: "Alergia a shampoo de fresa" }`
- **Comportamiento:** Modifica silenciosamente el JSONB en la base de datos para que la próxima cita de esta mascota inyecte este contexto.
