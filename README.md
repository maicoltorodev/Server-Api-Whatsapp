# 🤖 AI Bot Template - WhatsApp + Gemini AI

Este proyecto es una **plantilla Boilerplate/Framework** para construir asistentes conversacionales con Inteligencia Artificial utilizando la tecnología de **Google Gemini** conectados a **WhatsApp Cloud API (Meta)**.

Ha sido diseñado para ser **liviano, agnóstico de base de datos y altamente modular**, controlado por un archivo de configuración monolítico.

---

## 📁 Estructura Principal

```text
src/
├── config/
│   └── botConfig.ts       <-- 🧠 TODA la configuración: Reglas, Catalog, Tools, Identidad.
├── controllers/
│   ├── webhookController.ts <-- Recepción de Webhooks (Meta).
│   └── healthController.ts  <-- Diagnósticos.
├── core/
│   ├── ai/PromptBuilder.ts  <-- Ensambla el Prompt dinámico.
│   └── memoryAdapter.ts     <-- 💾 Base de datos en memoria (Fácil de reemplazar).
├── services/
│   ├── aiService.ts         <-- Motor de Gemini Conversacional.
│   ├── whatsappService.ts   <-- Consumo de API de Meta.
│   └── toolService.ts       <-- 🛠️ Herramientas ejecutables (Function Calling).
└── server.ts                <-- Express Server de la plantilla.
```

---

## 🚀 Inicio Rápido

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Copiar y configurar `.env`:**
   Crea un archivo `.env` en la raíz (puedes basarte en `.env.example` si existe):
   ```env
   PORT=3000
   GEMINI_API_KEY=tu_api_key_de_gemini
   WHATSAPP_PHONE_ID=tu_numero_id_de_meta
   WHATSAPP_TOKEN=tu_token_de_meta
   WHATSAPP_VERIFY_TOKEN=tu_verify_token_elegido
   ```

3. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

---

## 📖 Guías para el desarrollador

Para aprender a:
- Conectar una **Base de Datos real** (Supabase, Postgres, MongoDB).
- Cambiar la **Identidad y Respuestas** de tu Bot.
- Crear nuevas **Functions / Tools** para la IA.

Consulta la guía completa: [**TEMPLATE_GUIDE.md**](./TEMPLATE_GUIDE.md)

---

## 🧪 Diagnóstico

Puedes probar que el servidor esté activo navegando o haciendo un curl a:
`http://localhost:3000/health`
O el diagnóstico detallado:
`http://localhost:3000/health/detailed`

---

## 📈 Próximos Pasos Sugeridos

- **Implementar persistencia:** Reemplazar el `MemoryAdapter` por tu ORM o Cliente de base de datos favorito.
- **Multimodalidad:** Se ha preparado el pipeline en `conversationService.ts` para capturar imágenes y audios si el webhook de Meta los envía.
