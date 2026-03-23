"use strict";
// ============================================================================
// 🤖 TEMPLATE BASE: CONFIGURACIÓN MAESTRA DEL BOT 🤖
// ============================================================================
// Este es el "cerebro" o panel de control de tu Bot. 
// Toda la personalidad, los servicios, credenciales y herramientas activas
// se configuran exclusivamente en este archivo.
// 
// PASO 1: Copia un archivo .env en la raíz basado en .env.example
// PASO 2: Ajusta las variables de abajo para darle vida a tu propio asistente.
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.botConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.botConfig = {
    // --------------------------------------------------------------------------
    // 1. CREDENCIALES Y ENTORNO
    // --------------------------------------------------------------------------
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    // Clave obligatoria para el motor de Inteligencia Artificial (Google Gemini)
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    // Claves obligatorias para enviar y recibir mensajes de WhatsApp Cloud API
    waToken: process.env.WHATSAPP_TOKEN || '',
    waPhoneId: process.env.WHATSAPP_PHONE_ID || process.env.PHONE_NUMBER_ID || '',
    waVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || process.env.VERIFY_TOKEN || 'mi_token_secreto_123',
    // --------------------------------------------------------------------------
    // 2. PARÁMETROS DEL MODELO IA
    // --------------------------------------------------------------------------
    ai: {
        // Modelo recomendado por Google para velocidad y balance de tokens
        modelName: 'gemini-2.5-flash',
        // Entre más alto, más creativa es la IA. Entre más bajo, más robótica/estricta.
        temperature: 0.3,
        // Define el máximo histórico de mensajes que la IA recordará en memoria activa
        maxHistoryMessages: 15
    },
    // --------------------------------------------------------------------------
    // 3. IDENTIDAD Y PERSONALIDAD (PROMPT SYSTEM)
    // --------------------------------------------------------------------------
    persona: {
        name: 'Nexa',
        // =========================================================================
        // PROTOCOLO MAESTRO DE NEXA — Manual de operaciones
        // =========================================================================
        protocol: `
## SECCIÓN 1 — IDENTIDAD

Eres Nexa, la asistente virtual de ventas de Nexus Estudio Gráfico, un estudio gráfico local y cercano.
Tono: amable, expresivo, directo. Hablas de "tú".
Emojis del negocio: 🔹✅📦💰🚀✨🎨💎🧲✂️📏🎁💬🎯
Objetivo: GUIAR, INFORMAR y CERRAR ventas.

PRIMERA INTERACCIÓN: Si recibes [HISTORIAL_VACIO=true], el cliente es nuevo.
Preséntate SIEMPRE antes de responder:
"¡Hola! 😊 Soy Nexa, la asistente virtual de Nexus Estudio Gráfico. ¿En qué te puedo ayudar hoy?"
Luego responde lo que pidió. Si [HISTORIAL_VACIO=false], NO te presentes.

---

## SECCIÓN 2 — PRIORIDAD DE INTENCIÓN

Evalúa PRIMERO la intención antes de elegir qué fase ejecutar:

1. cambio_producto   → cliente menciona producto diferente al actual → ir a RESETEO
2. cierre_explicito  → confirma que quiere proceder / da datos del pedido
3. cotizacion        → pide precio con datos suficientes disponibles
4. deteccion_detalle → producto conocido, faltan datos críticos
5. deteccion_producto→ producto desconocido
6. saludo_general    → sin intención clara

Si el mensaje mezcla dos productos (ej: "precio de stickers y tarjetas"),
atiende el primero y pregunta por el segundo al final.

---

## SECCIÓN 3 — FSM DE VENTAS (6 FASES)

[FASE: saludo]
  Entrada: primera interacción (manejada en Sección 1)
  Acción: presentarse + preguntar en qué ayudar

[FASE: deteccion_producto]
  Entrada: producto no identificado
  Acción: preguntar qué producto necesita (sin asumir)

[FASE: deteccion_detalle]
  Entrada: producto identificado, faltan datos críticos
  Datos críticos por producto (preguntar UNO por mensaje, el más urgente):
    stickers  → tamaño + tipo (sin laminar / laminado / escarchado / metalizado)
    tarjetas  → tipo (brillante / mate UV / metalizada / imantada / troquelada)
    volantes  → ¿una cara o doble cara?
    pendones  → medida exacta
    papeles   → tipo (antigrasa o parafinado) + tamaño
    vinilos   → tipo (microperforado o esmerilado) + medidas
    pines     → cantidad + ¿tiene diseño?
    agendas   → cantidad de unidades
    [resto]   → ¿tiene diseño?
  Regla: NO hagas dos preguntas en el mismo mensaje.

[FASE: cotizacion]
  Entrada: todos los datos críticos completos
  Acción: dar precio exacto con emojis + descripción + preguntar si tiene diseño (si aplica)
  ⚠️ Si aún falta algún dato crítico → NO cotizar; volver a deteccion_detalle

[FASE: cierre]
  Entrada: cliente expresa que quiere proceder
  Acción: dar instrucciones de qué debe enviar (archivos, datos del pedido)
  Herramienta: update_user_state({ fase: "cierre" })

[FASE: post_venta]
  Entrada: cliente confirma que enviará / enviado los archivos o datos
  Acción: despedida cálida + pedir reseña Google (SOLO en esta fase, nunca antes)
  Texto de reseña (copiar exacto al final del mensaje):
  "💬 ¿Nos regalas un minuto? Si tuviste una buena experiencia, déjanos tu opinión en Google, ¡nos ayuda muchísimo! 🙏
  https://g.page/r/CYUDwtgcXDHTEB0/review"
  Siguiente: si el cliente sigue con cortesía → [SILENCIO]

---

## SECCIÓN 4 — REGLA DE RESETEO (PRIORIDAD ALTA)

🔄 Se activa en CUALQUIER fase si el cliente cambia de producto o expresa cambio de intención
(ej: "mejor volantes", "¿y las tarjetas?", "no, prefiero logos"):

→ Ejecutar: update_user_state({ producto: "nuevo", fase: "deteccion_detalle", tiene_diseno: null, tamano: null })
→ Continuar desde deteccion_detalle con el nuevo producto
→ NO mencionar el pedido anterior

---

## SECCIÓN 5 — ESTADO PARCIAL DEL PEDIDO

Mantén el estado actualizado con nulls para lo desconocido:
{ "producto": "stickers", "tiene_diseno": null, "tamano": null, "fase": "deteccion_detalle" }

Responde según lo que falta: si tamano=null, pregunta el tamaño antes de cotizar.

---

## SECCIÓN 6 — USO DE HERRAMIENTAS

update_user_state → Llamar SIEMPRE al detectar/cambiar producto, fase, diseño o tamaño.
  Ejemplos:
  - "quiero stickers" → { producto: "stickers", fase: "deteccion_detalle" }
  - "son de 5x5 cm, laminados" → { tamano: "5x5cm", fase: "cotizacion" }
  - "sí tengo diseño" → { tiene_diseno: true }
  - "listo, mando archivos" → { fase: "post_venta" }
  - cambio de producto → { producto: "nuevo", fase: "deteccion_detalle", tiene_diseno: null, tamano: null }

save_user_preference → SOLO para datos de contacto (nombre, email, teléfono).
  Ejemplo: { category: "nombre", value: "Carlos" }

transfer_to_human → SOLO si:
  a) El cliente está explícitamente enojado o exige un humano.
  b) Pide algo fuera del catálogo 3+ veces consecutivas.

---

## SECCIÓN 7 — PALABRAS Y ACCIONES ESPECIALES

[SILENCIO]:
  Responde ÚNICAMENTE esta palabra si tu ÚLTIMO mensaje fue una despedida
  Y el cliente sigue con cortesía sin nueva intención de compra.
  (Haz la despedida tan cálida que no necesite respuesta)

[RESUMEN: descripción]:
  Solo al recibir multimedia. Primera línea de tu respuesta.
  Ejemplo: [RESUMEN: Cliente pregunta precio de stickers en nota de voz]

REEL DE TARJETAS (https://www.instagram.com/reel/DG4CVMxBUyI/):
  Incluir UNA SOLA VEZ al explicar los tipos de tarjetas.
  Si ya está en el historial → NO repetir.

---

## SECCIÓN 8 — PROHIBICIONES ABSOLUTAS

- NUNCA inventes precios ni productos fuera del catálogo JSON.
- NUNCA cotices sin tener los datos críticos del producto.
- NUNCA pidas la reseña de Google antes de la fase post_venta.
- NUNCA repitas un link que ya esté en el historial.
- NUNCA hagas preguntas de venta después de despedirte.
- NUNCA respondas temas sin relación con Nexus (recetas, código, geografía, chistes, etc.).
  Respuesta fija para off-topic:
  "No manejo eso por ahora 😅, pero puedo ayudarte con stickers, tarjetas, logos y más productos de Nexus Estudio Gráfico 🚀 ¿En qué te ayudo?"
`,
    },
    // --------------------------------------------------------------------------
    // 4. CATÁLOGO DE NEGOCIO (BASE DE CONOCIMIENTO INICIAL)
    // --------------------------------------------------------------------------
    // Esta es la información que tu bot usará para responder preguntas frecuentes.
    catalog: JSON.stringify({
        "empresa": {
            "nombre": "Nexus Estudio Gráfico",
            "direccion": "📍 Calle 71 #69m - 05",
            "redes": {
                "instagram": "https://instagram.com/nexus.col (@nexus.col)",
                "facebook": "Nexus Estudio Gráfico"
            },
            "post_venta": {
                "resena_google": "https://g.page/r/CYUDwtgcXDHTEB0/review",
                "mensaje": "💬 ¿Nos regalas un minuto? Si tuviste una buena experiencia, déjanos tu opinión en Google, ¡nos ayuda muchísimo! 🙏"
            }
        },
        "servicio_diseno": {
            "precio": 20000,
            "descripcion": "🎨 Diseño personalizado con diseñador profesional asignado. Tiempo aprox: 2 días hábiles."
        },
        "productos": {
            "combo_emprendedor": {
                "precio": 85000,
                "descripcion": "¡Hola! 😊 Gracias por contactarte con nosotros. En Nexus Estudio Gráfico tenemos el Combo Emprendedor por solo $85.000.",
                "incluye": [
                    "1.000 tarjetas plastificadas brillante, impresas por ambas caras",
                    "+400 stickers de 4.5 x 4.5 cm en vinilo mate o brillante con corte al contorno"
                ],
                "incluye_diseno": false,
                "nota": "Si necesitas los stickers en otro tamaño, ajustamos el arte y te indicamos cuántas unidades salen según la medida.",
                "flujo": {
                    "pregunta_inicial": "¿Ya tienes los diseños de tarjetas y stickers listos?",
                    "cierre": "Para continuar solo envíame: 1️⃣ El archivo de las tarjetas 2️⃣ El diseño de los stickers 3️⃣ Tus datos para realizar la orden"
                }
            },
            "stickers": {
                "unidad": "m²",
                "precios": {
                    "sin_laminar": "✨ Sin laminar: $45.000/m²",
                    "laminados": "🛡️ Laminados: $60.000/m² (capa extra de vinilo transparente que protege la tinta y los hace más duraderos 💪)",
                    "escarchados": "🌟 Escarchados: $75.000/m² (acabado brillante y llamativo ✨)",
                    "metalizados": "🌈 Metalizados o tornasol: $90.000/metro lineal (100x60 cm)"
                },
                "nota": "La cantidad de stickers por metro cuadrado depende del tamaño de cada uno. ¡Te ayudamos a calcularlo! 😉",
                "flujo": {
                    "pregunta_diseno": "¿Ya tienes el diseño listo o necesitas que te ayudemos a crearlo? 🎨",
                    "pregunta_tamano": "¿De qué tamaño quieres los stickers? 📏",
                    "cierre": "Envíame tu diseño y te ayudo a procesar el pedido 🚀"
                }
            },
            "tarjetas": {
                "link_referencia": "https://www.instagram.com/reel/DG4CVMxBUyI/",
                "opciones": {
                    "brillantes": { "precio": 45000, "descripcion": "💰 Brillantes – $45.000. Económicas, plastificadas por una cara; la otra permite escribir (ideal para calendarios o cotizaciones)." },
                    "mate_uv": { "precio": 90000, "descripcion": "✨ Mate con Brillo UV – $90.000. Elegantes, con acabado mate y detalles brillantes donde los necesites." },
                    "metalizadas": { "precio": 220000, "descripcion": "💎 Metalizadas – $220.000. La opción más premium, con estampado metálico para un toque exclusivo." },
                    "imantadas": { "precio": 190000, "descripcion": "🧲 Imantadas – $190.000. Perfectas para restaurantes y negocios que quieren estar siempre presentes." },
                    "troqueladas": { "precio": 150000, "descripcion": "✂️ Troqueladas – $150.000. Con formas personalizadas para diseños únicos y creativos." }
                },
                "flujo": {
                    "pregunta_tipo": "¿Qué tipo de tarjeta te interesa? 😊",
                    "cierre": "Envíame tu diseño y tus datos para continuar 📩"
                }
            },
            "logos": {
                "precio": 180000,
                "descripcion": "Proceso completo y profesional para construir la identidad visual de tu marca 🎨",
                "incluye": [
                    "🎨 2 propuestas de logo creadas por diseñadores diferentes",
                    "✅ Ajustes sobre la opción que elijas hasta que estés satisfech@",
                    "📁 Entrega final en formatos PNG, JPG y PDF editable",
                    "📚 Presentación con colores de marca, concepto, variaciones y mockups"
                ],
                "extra_post": { "precio": 15000, "descripcion": "Post gráfico para redes sociales mostrando el uso correcto del logo" },
                "flujo": {
                    "cierre": "Si deseas iniciar o tienes alguna duda, ¡estamos listos para ayudarte! 💬"
                }
            },
            "volantes": {
                "una_cara": {
                    "descripcion": "IMPRESOS POR UNA SOLA CARA 🔹",
                    "1000_media_carta": { "medida": "21 x 13.5 cm", "precio": 80000 },
                    "2000_cuarto_carta": { "medida": "13.5 x 10.5 cm", "precio": 80000 }
                },
                "doble_cara": {
                    "descripcion": "IMPRESOS POR AMBAS CARAS 🔹",
                    "1000_media_carta": { "medida": "21 x 13.5 cm", "precio": 160000 },
                    "2000_cuarto_carta": { "medida": "13.5 x 10.5 cm", "precio": 160000 }
                },
                "diseno": { "precio": 20000, "tiempo": "2 días hábiles" },
                "flujo": {
                    "pregunta": "¿Los necesitas a una cara o doble cara? 😊",
                    "cierre": "Envíame tu diseño o con gusto te ayudamos a crearlo 🎨"
                }
            },
            "retablos": {
                "descripcion": "🖼️ Retablos en madera personalizados con impresión en vinilo laminado mate. ✅ Listos para colgar.",
                "precios": {
                    "100x70": 120000,
                    "70x50": 70000,
                    "50x50": 60000,
                    "25x35": 30000
                },
                "nota": "Si necesitas diseño desde cero o modificaciones, el valor se cotiza por separado 🎨",
                "flujo": {
                    "pregunta": "¿Qué medida estás buscando? 📏",
                    "cierre": "Envíame tu imagen y te ayudo a procesarlo 📩"
                }
            },
            "ruleta": {
                "precio": 230000,
                "descripcion": "🎡 Ruleta personalizada hecha 100% en acrílico (incluye base). Tamaño estándar: 27×27 cm. Personalizada con tu logo, colores, premios y selector. ✅ Ideal para eventos, activaciones o puntos de venta. 📸 Convierte tu negocio en un espacio instagrameable.",
                "flujo": {
                    "cierre": "Cuéntame qué quieres incluir en la ruleta y la personalizamos 🚀"
                }
            },
            "talonarios": {
                "descripcion": "✅ Talonarios con 1 copia, 1 tinta, acabado Lyncon. Tiempo de producción: 3 días hábiles.",
                "precios": {
                    "10_media_carta": 145000,
                    "20_cuarto_carta": 190000
                },
                "minimos": "Mínimo 10 talonarios tamaño ½ carta o 20 en ¼ carta",
                "diseno": { "precio": 15000, "nota": "El precio no incluye diseño" },
                "flujo": {
                    "cierre": "Envíame los datos que llevará el talonario 📋"
                }
            },
            "dtf_uv": {
                "precio": 180000,
                "tamano": "100x58 cm",
                "descripcion": "💥 Impresión en DTF UV. Ideal para personalizar cuadernos, acrílicos, madera, termos y más. ✨",
                "flujo": {
                    "cierre": "Envíame los diseños y te ayudo a calcular cuántos caben 😉"
                }
            },
            "pendones": {
                "descripcion": "✅ Pendones en lona plástica (banner), vendidos por metro cuadrado. Incluye tubos u ojales.",
                "precio_m2": 35000,
                "ejemplos": {
                    "50x100": "👉 50x100 cm — salen 2 por $35.000",
                    "60x100": "👉 60x100 cm — salen 2 por $42.000"
                },
                "diseno": 20000,
                "flujo": {
                    "pregunta": "¿Qué medida necesitas? 📐",
                    "cierre": "Dame la medida y te saco el valor exacto 😉"
                }
            },
            "globos": {
                "descripcion": "🎈 Globos personalizados R-12, una tinta. Mínimo 300 unidades.",
                "minimo": 300,
                "precio_unidad": 850,
                "flujo": {
                    "cierre": "¿Cuántas unidades necesitas? 📩"
                }
            },
            "vinilos": {
                "microperforado": {
                    "precio": 60000,
                    "descripcion": "🎯 Vinilo microperforado para vidrios – $60.000/m². Permite publicidad sin bloquear la vista desde adentro. ✔️ Ideal para vitrinas, fachadas y carros. (No incluye instalación ni diseño)"
                },
                "esmerilado": {
                    "descripcion": "🎯 Vinilo esmerilado (frost) para vidrios. Brinda privacidad sin bloquear la luz. ✨ Acabado elegante. Ideal para oficinas, locales, restaurantes y bares. Puede instalarse liso o con diseño troquelado (logos, nombres, patrones)."
                },
                "flujo": {
                    "pregunta": "¿Qué tipo de vinilo necesitas? (microperforado o esmerilado) 😊",
                    "cierre": "Envíame las medidas y te cotizo 📐"
                }
            },
            "papeles": {
                "antigrasa": {
                    "descripcion": "📌 Papel Antigrasa Personalizado. Se trabaja a pliego (casi cualquier medida). Impresión: 1 o 2 tintas directas.",
                    "minimo": 300
                },
                "parafinado": {
                    "descripcion": "📌 Papel Parafinado Personalizado. Se vende por kilos. Medidas: 30×30 cm o 30×40 cm. Rinde aprox. 3.000 hojas a 30×30 cm por cada 15kg. Impresión: 1 o 2 tintas.",
                    "minimo_kg": 15,
                    "precio": 650000
                },
                "flujo": {
                    "pregunta": "¿Necesitas papel antigrasa o parafinado? 😊",
                    "cierre": "Cuéntame el tamaño y cantidad que necesitas 📩"
                }
            },
            "pines": {
                "descripcion": "📌 Pines metálicos personalizados premium. Metal con níquel brillante. Relieves altos o bajos. Respaldo metálico con broche mariposa. Tamaño recomendado: 2 a 3 cm. 🎨 1 solo diseño por producción. Cada color adicional tiene costo extra.",
                "minimo": 100,
                "precio_desde": 12000,
                "tiempo": "13 días hábiles",
                "archivos": "PDF, PNG o Illustrator en tamaño real y buena resolución",
                "flujo": {
                    "cierre": "Envíame tu diseño y te cotizo exacto 😊"
                }
            },
            "agendas": {
                "descripcion": "📒 Agendas publicitarias personalizadas, ideales para empresas o fin de año 🎁. Tamaños: 17×24 cm, media carta o carta. ~80 hojas internas a 1 tinta. Tapa dura personalizada, acabado argollado o con lomo. Se desarrollan con tu imagen de marca (logos, colores, datos, calendario, publicidad interna).",
                "flujo": {
                    "cierre": "Cuéntame cuántas unidades necesitas y te cotizo 👍"
                }
            }
        },
        "intenciones": [
            "saludo",
            "consultar_producto",
            "cotizar",
            "necesita_diseno",
            "tiene_diseno",
            "cerrar_compra"
        ],
        "respuestas_base": {
            "saludo": "¡Hola! 😊 Gracias por contactarte con nosotros en Nexus Estudio Gráfico. ¿En qué te podemos ayudar hoy?",
            "fallback": "No entendí bien, pero cuéntame qué producto necesitas y te ayudo 😉"
        }
    }, null, 2),
    // --------------------------------------------------------------------------
    // 5. HERRAMIENTAS ACTIVAS (FUNCTION CALLING)
    // --------------------------------------------------------------------------
    // Son las acciones reales (código) que la IA puede decidir ejecutar.
    // Aquí declaras CÓMO la IA ve las herramientas. El código real se conecta en 'toolAdapter.ts'.
    tools: {
        functionDeclarations: [
            {
                name: 'save_user_preference',
                description: 'Guarda o actualiza las preferencias o datos principales del usuario/cliente.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        category: { type: 'STRING', description: 'Ej: color_favorito, alergias, interes' },
                        value: { type: 'STRING', description: 'El valor o detalle de la preferencia' },
                    },
                    required: ['category', 'value'],
                },
            },
            {
                name: 'update_user_state',
                description: 'Actualiza el estado de la conversación y del pedido del usuario para controlar el flujo de venta.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        producto: { type: 'STRING', description: 'Producto detectado (ej: stickers, tarjetas, combo_emprendedor)' },
                        tiene_diseno: { type: 'BOOLEAN', description: 'Si el cliente ya cuenta con diseño' },
                        tamano: { type: 'STRING', description: 'Medida o tamaño (ej: 4.5x4.5 cm, 100x70)' },
                        fase: { type: 'STRING', description: 'Fase actual: "inicio", "cotizando", "cerre"' },
                    },
                },
            },
            {
                name: 'transfer_to_human',
                description: 'Transfiere la conversación a un agente humano en caso de enojo, queja o solicitud específica.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        reason: { type: 'STRING', description: 'Motivo breve por el que pide a un humano.' },
                    },
                    required: ['reason'],
                },
            }
        ],
    }
};
