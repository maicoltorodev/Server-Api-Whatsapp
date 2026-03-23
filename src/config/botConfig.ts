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
    modelName: 'gemini-2.0-flash',
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
    style: `Eres Nexa, la asistente de ventas estelar de "Nexus Estudio Gráfico". Eres ultra-persuasiva, amable, directa y orientada a cerrar ventas rápidamente. Hablas de "tú". Usa emojis con moderación.`,
    // Reglas estrictas que la IA NUNCA debe romper
    strictRules: [
      'Sigue estrictamente el flujo de conversación definido en el Catálogo (pregunta_inicial, pregunta_diseno, etc.) para guiar al usuario antes de ofrecer el cierre.',
      'Detecta e infiere la intención del usuario y el producto que busca.',
      'Actualiza el estado del pedido usando la herramienta "save_user_preference" con categorías como: "producto_detectado", "tiene_diseno", "tamano" y "fase_pedido" (ej. "cotizando", "cerrando").',
      'NUNCA inventes precios o servicios que no estén en tu catálogo JSON.',
      'Si el cliente inicia contacto sin producto claro, saluda con la respuesta base: "¡Hola! Soy Nexa 😊, la asistente virtual de Nexus Estudio Gráfico. ¿En que te puedo ayudar?"',
      'El 90% de los bots responden bonito pero no venden; tu labor es GUIAR, FILTRAR y CERRAR la venta ofreciendo instrucciones claras para procesar el pedido.'
    ]
  },

  // --------------------------------------------------------------------------
  // 4. CATÁLOGO DE NEGOCIO (BASE DE CONOCIMIENTO INICIAL)
  // --------------------------------------------------------------------------
  // Esta es la información que tu bot usará para responder preguntas frecuentes.
  catalog: JSON.stringify({
    "empresa": {
      "nombre": "Nexus Estudio Gráfico",
      "direccion": "Calle 71 #69m - 05",
      "redes": {
        "instagram": "@nexus.col",
        "facebook": "Nexus Estudio Gráfico"
      }
    },
    "servicio_diseno": {
      "precio": 20000,
      "descripcion": "Diseño personalizado con diseñador asignado"
    },
    "productos": {
      "combo_emprendedor": {
        "precio": 85000,
        "incluye": [
          "1000 tarjetas plastificadas doble cara",
          "+400 stickers 4.5x4.5 cm en vinilo"
        ],
        "incluye_diseno": false,
        "flujo": {
          "pregunta_inicial": "¿Ya tienes los diseños de tarjetas y stickers?",
          "siguiente_paso": "Solicitar archivos y datos"
        }
      },
      "stickers": {
        "unidad": "m2",
        "precios": {
          "sin_laminar": 45000,
          "laminados": 60000,
          "escarchados": 75000,
          "metalizados": 90000
        },
        "flujo": {
          "pregunta_diseno": "¿Ya tienes el diseño o necesitas ayuda?",
          "pregunta_tamano": "¿De qué tamaño quieres los stickers?",
          "cierre": "Envíame tu diseño y te ayudo a procesar el pedido"
        }
      },
      "tarjetas": {
        "opciones": {
          "brillantes": 45000,
          "mate_uv": 90000,
          "metalizadas": 220000,
          "imantadas": 190000,
          "troqueladas": 150000
        },
        "flujo": {
          "pregunta_tipo": "¿Qué tipo de tarjeta te interesa?",
          "cierre": "Envíame tu diseño y datos para continuar"
        }
      },
      "logos": {
        "precio": 180000,
        "incluye": [
          "2 propuestas de diseñadores",
          "ajustes hasta aprobación",
          "archivos finales PNG, JPG, PDF",
          "presentación conceptual"
        ],
        "extra_post": 15000,
        "flujo": {
          "cierre": "Si quieres iniciar, te explico el proceso y comenzamos hoy"
        }
      },
      "volantes": {
        "una_cara": {
          "1000_media_carta": 80000,
          "2000_cuarto_carta": 80000
        },
        "doble_cara": {
          "1000_media_carta": 160000,
          "2000_cuarto_carta": 160000
        },
        "diseno": 20000,
        "flujo": {
          "pregunta": "¿Los necesitas a una cara o doble cara?",
          "cierre": "Envíame tu diseño o te ayudamos a crearlo"
        }
      },
      "retablos": {
        "precios": {
          "100x70": 120000,
          "70x50": 70000,
          "50x50": 60000,
          "25x35": 30000
        },
        "flujo": {
          "pregunta": "¿Qué medida estás buscando?",
          "cierre": "Envíame tu imagen y te ayudo a procesarlo"
        }
      },
      "ruleta": {
        "precio": 230000,
        "flujo": {
          "cierre": "Cuéntame qué quieres incluir en la ruleta y la personalizamos"
        }
      },
      "talonarios": {
        "precios": {
          "10_media_carta": 145000,
          "20_cuarto_carta": 190000
        },
        "diseno": 15000,
        "flujo": {
          "cierre": "Envíame los datos que llevará el talonario"
        }
      },
      "dtf_uv": {
        "precio": 180000,
        "tamano": "100x58 cm",
        "flujo": {
          "cierre": "Envíame los diseños y te ayudo a calcular cuántos caben"
        }
      },
      "pendones": {
        "precio_m2": 35000,
        "ejemplos": {
          "50x100": "2 por 35000",
          "60x100": "2 por 42000"
        },
        "diseno": 20000,
        "flujo": {
          "pregunta": "¿Qué medida necesitas?",
          "cierre": "Te cotizo exacto según tamaño"
        }
      },
      "globos": {
        "minimo": 300,
        "precio_unidad": 850,
        "flujo": {
          "cierre": "¿Cuántas unidades necesitas?"
        }
      },
      "vinilos": {
        "microperforado": {
          "precio": 60000
        },
        "esmerilado": {
          "descripcion": "Privacidad sin bloquear luz"
        },
        "flujo": {
          "pregunta": "¿Qué tipo de vinilo necesitas?",
          "cierre": "Envíame medidas y te cotizo"
        }
      },
      "papeles": {
        "antigrasa": {
          "minimo": 300
        },
        "parafinado": {
          "minimo": 15,
          "precio": 650000
        },
        "flujo": {
          "cierre": "Cuéntame qué tamaño necesitas"
        }
      },
      "pines": {
        "minimo": 100,
        "precio_desde": 12000,
        "tiempo": "13 días hábiles",
        "flujo": {
          "cierre": "Envíame tu diseño y te cotizo exacto"
        }
      },
      "agendas": {
        "descripcion": "Agendas personalizadas con branding",
        "flujo": {
          "cierre": "Cuéntame cuántas unidades necesitas"
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
      "saludo": "¡Hola! 😊 Bienvenido a Nexus Estudio Gráfico. ¿Qué producto estás buscando?",
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
