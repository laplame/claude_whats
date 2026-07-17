export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
};

export type PricingPlan = {
  id: string;
  name: string;
  tagline: string;
  priceMxn: number;
  priceUsd: number;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
};

/** Punto de partida sugerido — validar precios y límites antes de publicar. */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Para probar el flujo con un negocio chico.",
    priceMxn: 349,
    priceUsd: 19,
    features: [
      "1 número de WhatsApp",
      "Hasta 10 archivos de contexto",
      "CRM por estados (LEAD → CLOSED)",
      "Modo IA / humano",
      "Soporte por email",
    ],
    cta: { label: "Crear cuenta", href: "/app" },
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Para un negocio activo que ya vende por WhatsApp.",
    priceMxn: 799,
    priceUsd: 45,
    features: [
      "1 número de WhatsApp",
      "Archivos de contexto sin límite práctico",
      "Tablero CRM completo con notas y tags",
      "Vista Flujo (ordenar y fusionar contexto)",
      "Soporte prioritario",
    ],
    cta: { label: "Crear cuenta", href: "/app" },
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    tagline: "Para equipos con volumen que necesitan más acompañamiento.",
    priceMxn: 1499,
    priceUsd: 85,
    features: [
      "Todo lo de Pro",
      "Integración BizneAI (MCP) como fuente de contexto",
      "Onboarding asistido",
      "Soporte prioritario por WhatsApp",
    ],
    cta: { label: "Hablar con ventas", href: "/contacto" },
  },
];

export const BIZNEAI = {
  name: "BizneAI",
  url: "https://www.bizneai.com/",
  blurb:
    "Punto de venta con IA para tu negocio. WhatsClaude está preparado para usarse con BizneAI y responder con los datos de tu tienda.",
} as const;

/** Prompt listo para pegar en ChatGPT, Claude u otra IA al generar el MD. */
export const CONTEXT_PROMPT_TEMPLATE = `Actuá como redactor de contexto para un agente de WhatsApp de ventas.
Generá un único archivo Markdown (.md) en español, claro y corto, con esta estructura exacta:

# Nombre del negocio
## Qué vendemos
## Precios y planes
## Políticas (envíos, cambios, horarios, formas de pago)
## Guion de atención
## Preguntas frecuentes
## Cuándo derivar a un humano

Reglas:
- Solo datos reales que yo te dé abajo. Si falta un dato, escribí "[COMPLETAR]".
- Sin inventar precios, stock ni promesas.
- Frases cortas, listas con viñetas, sin tablas complejas.
- El tono debe ser de negocio: directo y profesional.

Datos de mi negocio:
[PEGÁ ACÁ: qué vendés, precios, horarios, políticas, FAQs, objeciones comunes]
`;

export const CONTEXT_EXAMPLE_MD = `# Demo Tienda
## Qué vendemos
- Productos y servicios del catálogo local.
- Atención por WhatsApp con respuesta automática + closer humano.

## Precios y planes
- Plan Demo: gratis para probar el flujo.
- Planes comerciales: confirmar con un asesor (no inventar cifras).

## Políticas
- Horario de atención humana: lun–vie 9:00–18:00.
- Si no hay dato en este documento, derivar a humano.
- No prometer descuentos que no estén listados acá.

## Guion de atención
1. Saludá y preguntá qué necesita.
2. Respondé solo con información de este archivo.
3. Si hay interés de compra, calificá (presupuesto, urgencia, producto).
4. Si está listo para comprar, avisá que un closer continúa.

## Preguntas frecuentes
- ¿Inventan respuestas? No: solo usan este contexto.
- ¿Cómo empiezo? Conectar WhatsApp, subir este MD, probar un mensaje.

## Cuándo derivar a un humano
- Precio no listado, reclamo, pedido urgente o cliente pide hablar con alguien.
`;

/** FAQ canónica: alimenta /faq y el system prompt del demo de closer. */
export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "que-es",
    question: "¿Qué es WhatsClaude?",
    answer:
      "WhatsClaude es un agente de WhatsApp con IA y CRM. Conectás tu número, cargás el contexto del negocio en archivos MD y la IA atiende, califica leads y organiza pedidos por estados. Cuando hace falta, un closer humano toma el chat sin perder el historial.",
    tags: ["producto", "overview"],
  },
  {
    id: "bizneai",
    question: "¿Funciona con BizneAI?",
    answer:
      "Sí. WhatsClaude está preparado para usarse con BizneAI (punto de venta con IA). Usa los datos de tu tienda —productos, precios e inventario— como contexto para que el agente de WhatsApp responda con información real del negocio. Más info en https://www.bizneai.com/",
    tags: ["bizneai", "integracion", "tienda"],
  },
  {
    id: "como-funciona",
    question: "¿Cómo funciona el sistema?",
    answer:
      "En tres pasos: 1) Escaneás el QR una vez para vincular WhatsApp. 2) Subís documentos MD con precios, políticas y guiones. 3) La IA responde solo con ese contexto, califica leads y actualiza el CRM (LEAD → MKTQL → SALES → CLOSED). El closer cierra cuando el lead está listo.",
    tags: ["flujo", "setup"],
  },
  {
    id: "contexto",
    question: "¿Qué es el contexto y por qué importa?",
    answer:
      "El contexto son tus documentos MD: precios, políticas, FAQs y guiones de venta. La IA responde exclusivamente con eso. Si no hay contexto definido, el bot no inventa: no responde en automático hasta que haya contexto, o deriva a un humano. Así protegés la marca.",
    tags: ["contexto", "seguridad"],
  },
  {
    id: "crear-contexto",
    question: "¿Cómo creo el contexto con IA?",
    answer:
      "Pedile a tu asistente de IA favorito que genere un archivo Markdown con precios, políticas, guiones y FAQs de tu negocio (sin inventar datos). Descargá/guardá el .md y subilo en el dashboard de WhatsClaude (sección Contexto). Hay un tutorial paso a paso en /contexto.",
    tags: ["contexto", "tutorial", "ia"],
  },
  {
    id: "cuantos-archivos",
    question: "¿Cuántos archivos de contexto puedo agregar? ¿Se concatenan?",
    answer:
      "Recomendamos hasta 20 archivos .md (~100.000 caracteres en total). No hay un límite duro bajo, pero la API de concatenación corta en 40 archivos. Sí se concatenan: al responder, WhatsClaude une todos los MD activos en un solo prompt. También podés fusionarlos a mano en /app → Flujo arrastrando los bloques.",
    tags: ["contexto", "limites", "concat"],
  },
  {
    id: "flujos-imagenes",
    question: "¿Puedo crear flujos con imágenes y arrastre de iconos?",
    answer:
      "Arrastre de iconos para ordenar Markdown: sí, en /app → Flujo (vista Lista). También hay una vista Flowchart que muestra el diagrama fuentes → contexto → IA → WhatsApp/CRM. Flujos con imágenes como contexto del bot: todavía no; la IA solo lee texto .md y datos del MCP.",
    tags: ["contexto", "flujo", "imagenes", "flowchart"],
  },
  {
    id: "mcp-bizneai",
    question: "¿Puedo conectar el MCP de BizneAI?",
    answer:
      "Sí. En /app → Flujo → Flowchart podés agregar el nodo del MCP de BizneAI como fuente. Así el agente usa los datos de tu tienda (catálogo, precios e inventario) como contexto en vivo, además de tus archivos MD. Más info en https://www.bizneai.com/",
    tags: ["bizneai", "mcp", "flujo", "integracion"],
  },
  {
    id: "modo-humano",
    question: "¿Qué pasa cuando un humano escribe?",
    answer:
      "Cuando el vendedor o closer escribe en el chat, la IA se pausa (modo humano). Si hay inactividad, vuelve al modo automático según el timeout configurado. Todo queda en el mismo hilo: mensajes de WhatsApp, IA y notas del equipo.",
    tags: ["humano", "closer", "modo"],
  },
  {
    id: "crm",
    question: "¿Cómo funciona el CRM?",
    answer:
      "Cada conversación tiene un estado: LEAD, MKTQL, SALES, CLOSED y SALES-AGAIN. Podés arrastrar tarjetas en el tablero, agregar notas y abrir el chat desde el CRM. La IA ayuda a calificar; el closer cierra en SALES/CLOSED.",
    tags: ["crm", "pipeline"],
  },
  {
    id: "closer",
    question: "¿Qué hace el closer en el flujo?",
    answer:
      "El closer es el humano que toma leads calificados (MKTQL/SALES). Ve el historial completo, las notas y el contexto. Su trabajo es cerrar la venta sin que el cliente repita información. El demo del sitio simula ese handoff para que veas el cierre en acción.",
    tags: ["closer", "ventas"],
  },
  {
    id: "precio",
    question: "¿Cuánto cuesta?",
    answer:
      "El demo público es gratis para probar el flujo. Los planes y precios comerciales se confirman con un asesor humano: no publicamos cifras inventadas en el chat. Si querés activar, entrá al dashboard o pedí hablar con un closer.",
    tags: ["precio", "planes"],
  },
  {
    id: "requisitos",
    question: "¿Qué necesito para empezar?",
    answer:
      "Un número de WhatsApp de negocio, una cuenta en WhatsClaude y documentos MD con el contexto (precios, FAQs, políticas). Escaneás el QR, subís el contexto y en minutos tenés atención automática con control humano.",
    tags: ["setup", "requisitos"],
  },
  {
    id: "seguridad",
    question: "¿Inventa respuestas la IA?",
    answer:
      "No. La regla del sistema es responder solo con el contexto cargado. Si la pregunta no está cubierta, deriva a un asesor humano en lugar de inventar políticas o precios. Sin archivos de contexto, el bot no atiende en automático.",
    tags: ["seguridad", "contexto"],
  },
  {
    id: "activar",
    question: "¿Cómo activo mi cuenta?",
    answer:
      "Entrá a /app, creá tu cuenta (email o WhatsApp + passcode), vinculá el número con el QR y subí tus MD. Si preferís, pedí en el demo que te pasen con un closer para acompañarte en el alta.",
    tags: ["activar", "onboarding"],
  },
];

export const SITE_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/contexto", label: "Crear contexto" },
  { href: "/precios", label: "Precios" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacto", label: "Contacto" },
  { href: "/app", label: "Dashboard" },
] as const;

export function buildFaqSystemBlock(): string {
  return FAQ_ITEMS.map(
    (item, i) => `${i + 1}. P: ${item.question}\n   R: ${item.answer}`
  ).join("\n\n");
}
