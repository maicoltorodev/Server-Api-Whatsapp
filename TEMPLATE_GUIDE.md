# 📖 Guía de la Plantilla: AI Bot Framework para WhatsApp

Esta plantilla es un punto de partida **agnóstico, liviano y escalable** para construir asistentes conversacionales con Inteligencia Artificial (Google Gemini) y WhatsApp Cloud API.

---

## 🏗️ Arquitectura del Proyecto

Toda la lógica compleja ha sido removida para que te enfoques en el flujo. La estructura es:

```text
src/
├── config/
│   └── botConfig.ts       <-- 🧠 ¡EL CEREBRO! Configura todo aquí.
├── controllers/
│   ├── webhookController.ts <-- Recibe los mensajes de WhatsApp.
│   └── healthController.ts  <-- Monitorea el estado de la API.
├── core/
│   ├── ai/PromptBuilder.ts  <-- Construye el sistema de prompts modulado.
│   └── memoryAdapter.ts     <-- 💾 Base de datos en memoria (Mock). 
├── middleware/
│   └── verifyMetaSignature.ts <-- Seguridad de Webhook de Meta.
├── services/
│   ├── aiService.ts         <-- Coordina la comunicación con Gemini.
│   ├── conversationService.ts <-- Orquesta el hilo de la charla y guardados.
│   ├── whatsappService.ts   <-- Envía los mensajes de vuelta a WhatsApp.
│   └── toolService.ts       <-- 🛠️ Ejecuta "Acciones" que la IA pide (Function Calling).
└── server.ts                <-- Inicio del servidor Express.
```

---

## 🧠 ¿Cómo personalizar tu Bot? (botConfig.ts)

Abre `src/config/botConfig.ts`. Encontrarás secciones altamente comentadas para ajustar:

1. **Identidad (`persona`):** Cambia el nombre del bot, su estilo de habla y las reglas estrictas de oro.
2. **Conocimiento (`catalog`):** Una cadena de texto simple que la IA leerá como "Base de Datos estática" para responder preguntas frecuentes.
3. **Poderes (`tools`):** Declara qué funciones dinámicas puede ejecutar la IA (ej: `transfer_to_human`).

---

## 💾 ¿Cómo conectar tu Base de Datos real?

Por defecto, esta plantilla guarda la sesión (historial de chat) y los usuarios **en la memoria RAM** usando `src/core/memoryAdapter.ts`.

Para conectar Postgres, Mongo, MySQL o Supabase:
1. Abre `src/core/memoryAdapter.ts`.
2. Verás métodos claros como `getUser`, `saveMessage`, `getHistory`.
3. Reemplaza los `this.users.get(...)` o `this.chatHistories.get(...)` por tus `db.users.find()` o llamadas SQL correspondientes.

---

## 🛠️ Cómo crear una nueva Herramienta (Function Calling)

Si quieres que tu I.A. "Haga algo" (ej: Consultar un stock, actualizar un CRM):

1. **Declárala en `botConfig.ts`:**
   ```typescript
   {
     name: 'consultar_stock',
     description: 'Consulta cuántas unidades quedan de un producto.',
     parameters: {
       type: 'OBJECT',
       properties: { producto: { type: 'STRING' } },
       required: ['producto']
     }
   }
   ```
2. **Impleméntala en `src/services/toolService.ts`:**
   ```typescript
   public async consultar_stock(args: { producto: string }, phone: string) {
       // Tu consulta a tu inventario/API real
       const stock = await api.getStock(args.producto); 
       return { status: 'ok', stock: stock };
   }
   ```
La inteligencia de `aiService.ts` la llamará automáticamente si el usuario pregunta por el stock.
