# 📝 Arquitectura de Handoff (IA a Humano) - Fase Dashboard

El sistema original mediante el cual el dueño tomaba el control escribiendo comandos (`#intervenir_`, `#bot`) a través de la cuenta central de WhatsApp ha sido desactivado y removido de la base base de código comercial por presentar problemas de UX, escalabilidad y cuellos de botella en la atención multi-cliente.

En su lugar, hemos limpiado los Controladores (`webhookController.js`), y Servicios (`whatsappService.js` / `notificationService.js`) para preparar el terreno a un enfoque de **Customer Success** profesional. 

## 🏗️ Propuesta de la Nueva Arquitectura (Live Dashboard)

El nuevo Handoff funcionará a través de un Panel Web Independiente, similar a un CRM omnicanal (ej. Intercom o Sirena).

### 1. Sistema de Notificaciones Real-Time (Server-Sent Events / WebSockets)
Cuando la IA lanza la función `transfer_to_human` o detecta un usuario inactivo:
1. El backend actualiza la base de datos (Supabase) con `bot_active: false`.
2. El sistema llama a `notificationService.notifyHumanRequired`, en el cual instalaremos un servidor WebSocket (`Socket.io`) o un trigger de la base de datos (Realtime de Supabase).
3. En el Frontend del Panel Administrativo de la tienda, escuchará el evento instantáneamente, mostrando un Badge en rojo `1` indicando que un cliente está "En Espera".

### 2. Panel Administrativo (Frontend UI)
Esta App web servirá a tres propósitos durante un Handoff:
- **Vista de Buzón (Inbox):** Una columna a la izquierda mostrará la lista de leads filtrada donde `bot_active = false`.
- **Vista de Contexto (Context UI):** Al seleccionar un cliente, se debe descargar a la derecha TODO el histórico (`chatModel.js`) que tuvo con el Bot previamente. Así el humano NO empieza desde cero.
- **Vista de Envío Directo:** Una caja de texto para responderle. El botón de enviar hará ping a un endpoint seguro de nuestro propio servidor `POST /api/chat/send-manual`, este validará el token del empleado (JWT) y mandará el mensaje usando nuestro `whatsappService.sendMessage()`.

### 3. Devolución Elegante a la IA
El panel administrativo contará con un botón gigante: **"✅ Marcar Resuelto y Devolver a la IA"**.
Al clickearlo, el dashboard enviará un request a `POST /api/chat/return-bot`, el cual ejecutará:
- `leadModel.activateBot(phone)` activando al bot.
- Notificará por WhatsApp al cliente indicándole: *"El humano ha regresado al trabajo, he vuelto yo, la IA, para seguirte ayudando."*

### 4. Cronjob de Cierre por Abandono Híbrido (Auto-Timeout)
Ya no dependeremos del `sessionModel.js`. En la nueva etapa implementaremos un CRON que verifique clientes donde `bot_active === false`. Si el humano lleva más de 24 horas sin intervenir en un Handoff o no ha devuelto el Bot, el Backend activará la IA de golpe por seguridad para no desperdiciar ventanas de 24 horas en la API de Meta.

## 🛠 Entregables Próximos
1. Integración de Endpoint `/api/dashboard/chats` y autenticación (JWT) para dueños/empleados.
2. Servidor Socket.io en `server.js` anclado a peticiones push.
3. Repositorio frontend separado (React / Next.js) que se conecte con las credenciales maestras y permita leer la Base de Datos.
