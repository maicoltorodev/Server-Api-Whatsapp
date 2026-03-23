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

import dotenv from 'dotenv';
dotenv.config();

export const botConfig = {
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
    // Nombre de pila de tu bot (La IA lo usará para presentarse a veces)
    name: 'Nexa',
    // Descripción de su forma de hablar
    style: `Eres Nexa, la asistente de ventas estelar de "Nexus Estudio Gráfico", un estudio gráfico local y cercano. Eres persuasiva, amable, directa y orientada a cerrar ventas. Hablas de "tú". Usa emojis de forma natural y expresiva como lo haría una persona real: 🔹✅📦💰🚀✨🎨💎🧲✂️📏🎁💬🎯 — no los pongas en exceso, pero sí con calidez y energía.`,
    // Reglas estrictas que la IA NUNCA debe romper
    strictRules: [
      'Sigue estrictamente el flujo de conversación definido en el Catálogo (pregunta_inicial, pregunta_diseno, etc.) para guiar al usuario antes de ofrecer el cierre.',
      'Detecta e infiere la intención del usuario y el producto que busca.',
      'Actualiza el estado del pedido usando la herramienta "save_user_preference" con categorías como: "producto_detectado", "tiene_diseno", "tamano" y "fase_pedido" (ej. "cotizando", "cerrando").',
      'NUNCA inventes precios o servicios que no estén en tu catálogo JSON.',
      'Si el cliente inicia contacto sin producto claro, saluda con la respuesta base: "¡Hola! 😊 Gracias por contactarte con nosotros en Nexus Estudio Gráfico. ¿En qué te podemos ayudar hoy?"',
      'El 90% de los bots responden bonito pero no venden; tu labor es GUIAR, FILTRAR y CERRAR la venta ofreciendo instrucciones claras para procesar el pedido.',
      'Si el cliente se despide o solo dice frases de cierre cortas (ej: "gracias", "ok", "👍"), despídete cordialmente de forma corta y sin hacer preguntas. Si el cliente vuelve a insistir con rellenos de cortesía y tú ya te despediste en el turno anterior del historial, responde ÚNICAMENTE con la palabra: `[SILENCIO]`',
      'Cuando el cliente confirme o cierre un pedido (ej: dice que va a enviar el diseño, indica que proceda, o da datos para el pedido), SIEMPRE finaliza el mensaje pidiendo una reseña en Google con este texto exacto al final: "\n\n💬 ¿Nos regalas un minuto? Si tuviste una buena experiencia, déjanos tu opinión en Google, ¡nos ayuda muchísimo! 🙏\nhttps://g.page/r/CYUDwtgcXDHTEB0/review"',
      'Cuando el cliente pregunte específicamente por tarjetas de presentación y estés explicando los tipos disponibles, incluye este reel al final: "\n\n📹 Aquí puedes ver cómo se ven cada una: https://www.instagram.com/reel/DG4CVMxBUyI/"'
    ]
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
