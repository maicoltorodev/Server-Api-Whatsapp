# Pet Care Studio - Backend AI & Booking System

## 🏗️ Arquitectura Modular y Segura

Este proyecto es un backend robusto diseñado para gestionar reservas automáticas mediante una Inteligencia Artificial (Gemini) conectada a WhatsApp. Ha sido refactorizado desde una arquitectura monolítica hacia una estructura modular, implementando principios SOLID, y cuenta con un **fuerte endurecimiento comercial e infraestructura transaccional**.

## 📁 Estructura del Proyecto

```text
src/
├── config/                 # Configuración centralizada
│   ├── index.js           # Variables de entorno y constantes de negocio
│   ├── database.js        # Configuración de cliente Supabase
│   └── ai.js              # Inicialización de Gemini AI y Tools
├── middleware/            # Middlewares de Express
│   ├── verifyMetaSignature.js # Verificación estricta (anti-spoofing) HMAC SHA-256
│   └── rateLimit.js       # Anti-spam y limitadores
├── services/              # Lógica de negocio dura
│   ├── whatsappService.js # Intermediario Meta API
│   ├── aiService.js       # Manejo conversacional y function-calling
│   ├── appointmentService.js # Orquestador de agenda, algoritmos y disponibilidad
│   └── notificationService.js # Alertas al dueño
├── controllers/           # Controladores HTTP
│   ├── webhookController.js # Recepción y ruteo de Webhooks (Meta)
│   └── healthController.js # Endpoints de diagnóstico
├── models/               # Interfaz con la Base de datos (Supabase)
│   ├── leadModel.js      # Operaciones con leads y funnels
│   ├── chatModel.js      # Historial conversacional
│   └── sessionModel.js   # Intervención humana (handoff)
├── utils/                # Utilidades
│   ├── validators.js     # Validaciones de fecha y hora (Timezone: Bogotá)
│   └── cache.js          # In-memory caching (Catálogo y Configuración)
├── routes/               # Rutas HTTP
│   └── webhook.js        # ...
└── server.js             # Punto de entrada
database/
└── 01_rpc_book_appointment.sql # Script SQL para Race Conditions (Locks transaccionales)
```

## 🚀 Iniciar el Proyecto

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno en `.env`:
```env
PORT=3000
PHONE_NUMBER_ID=tu_phone_id
WHATSAPP_TOKEN=tu_token
META_APP_SECRET=tu_app_secret
VERIFY_TOKEN=tu_verify_token

GEMINI_API_KEY=tu_gemini_key
SUPABASE_URL=tu_supabase_url
SUPABASE_KEY=tu_supabase_key
```

3. Iniciar servidor:
```bash
npm start
```

## 📋 Características Principales y Endurecimiento

### 🔐 Seguridad y Prevención de Spoofing
- Verificación estricta de firma de Meta mediante `crypto.timingSafeEqual` para evadir ataques de timing.
- Logs estructurados en JSON en caso de alertas de seguridad y firmas no coincidentes.
- Rate limiting anti-spam que detecta abusos (ej. bombardeo de mensajes) y auto-desactiva la atención al cliente abusador.

### 🤖 Inteligencia Artificial "Grounded" (Anti-Alucinaciones)
- Integración dinámica con **Gemini 2.5 Pro**, con acceso a contexto de ventas y recordatorio.
- **Herramientas (Function Calling):** La IA puede agendar citas, actualizar logs y enviar casos delicados a agentes humanos (`transfer_to_human`).
- **Pared Anti-Alucinaciones:** Si la IA intenta reservar un servicio inventado o "alucina" el tiempo de duración, el sistema lo bloquea forzando la contrastación estricta con el Catálogo de la Base de Datos. La IA debe pedir confirmación con un servicio real.

### 📅 Agenda Transaccional y Sin Race Conditions
- Agendamiento delegando consistencia a **Procedimientos Almacenados (RPC) en Postgres/Supabase**.
- Uso de **Advisory Locks** (`pg_advisory_xact_lock`) a nivel de base de datos para manejar la alta concurrencia: si 100 usuarios intentan agendar a las 3:00 PM simultáneamente, el sistema atiende uno por uno y previene agendar superando el límite del local.
- Evaluación **dinámica** de disponibilidad tomando en cuenta los horarios de cierre, y la duración real (en minutos) de cada servicio consultado.

### 📊 Observabilidad y Métricas Comerciales
- Captura de excepciones con logs tipificados (json) indicando el "embudo de base de datos" donde ocurrió una falla.
- Registro en `console.info` en formato JSON para herramientas de analítica (ej. Datadog / CloudWatch) reportando eventos como:
  - `cita_creada`
  - `cita_cancelada`
  - `conversion_ia_cita`
  - `transferencia_humano`

## �️ Tecnologías

- **Node.js + Express** - Backend framework
- **Supabase (Postgres)** - Sistema de DB y Ejecución SQL aislada
- **Gemini AI SDK** - Inteligencia Artificial central
- **Meta WhatsApp Graph API** - Puerta de enlace B2C

## 🧪 Pruebas y Diagnóstico

Para consultar la salud del sistema o crear un monitor de uptime:
```bash
curl http://localhost:3000/health/detailed
```

## 📈 Próximos Pasos Recomendados (Fase SaaS Escalar)

- Implementación Multi-tenant (para vender a distintos locales/pet-shops).
- Panel administrativo (Frontend Dashboard) para consumir las citas.
- Redis distribuido para caché en clúster.
