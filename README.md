# Agente WhatsApp Local

Agente de WhatsApp que se conecta a un número real vía Baileys (WhatsApp
Web, no Meta API ni Twilio) y responde mensajes con **Claude** (con
**Gemini** como fallback automático). Incluye un dashboard local tipo CRM
para ver conversaciones, agregar notas/etiquetas por contacto, intervenir
manualmente y togglear cada chat entre modo **IA** y modo **Humano**.

Todo corre en local. La data vive en SQLite (`./data/messages.db`,
fuente de verdad) con un respaldo opcional en MongoDB Atlas, y la sesión
de WhatsApp la guarda Baileys en `./auth/`.

## Requisitos

- Node.js 20.9+ (recomendado 22)
- Un número de WhatsApp disponible para escanear el QR (puede ser el
  mismo que usás en tu teléfono, WhatsApp Web soporta múltiples
  dispositivos vinculados)
- Una API key de [Claude/Anthropic](https://console.anthropic.com/settings/keys)
- (Opcional pero recomendado) una API key de
  [Gemini/Google AI Studio](https://aistudio.google.com/apikey) para el
  fallback automático
- (Opcional) una connection string de [MongoDB Atlas](https://www.mongodb.com/atlas)
  si querés respaldo de la conversación en la nube

## Instalación

```bash
npm install
cp .env.example .env.local
```

Editá `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-tu-key-real
ANTHROPIC_MODEL=claude-sonnet-5

GEMINI_API_KEY=AIza-tu-key-real
GEMINI_MODEL=gemini-2.5-flash

MONGODB_URI=
MONGODB_DB_NAME=agente_whatsapp
```

`GEMINI_API_KEY` y `MONGODB_URI` pueden quedar vacías: el bot funciona
perfecto sin ellas (solo Claude, sin respaldo en Mongo). Se recomienda
completar al menos Gemini como red de contención ante rate limits o
caídas puntuales de Claude.

## Cómo correrlo

Necesitás dos procesos corriendo en paralelo:

```bash
# Terminal 1: el bot de WhatsApp
npm run start:bot

# Terminal 2: el dashboard
npm run dev
```

O ambos juntos con:

```bash
npm run start:all
```

Abrí [http://localhost:3000](http://localhost:3000). Si no hay sesión
guardada vas a ver la pantalla "Conectar número" con un QR grande.
Escaneá desde tu teléfono: WhatsApp → Configuración → Dispositivos
vinculados → Vincular dispositivo. El dashboard va a transicionar
automáticamente al ver la conexión exitosa (no hace falta recargar).

La sesión queda guardada en `./auth/`. Mientras esa sesión siga activa en
WhatsApp, reiniciar `npm run start:bot` NO vuelve a pedir QR.

Para desconectar el número, usá el botón "Desconectar" del header del
dashboard — esto borra la sesión local y te vuelve a mostrar el QR.

## LLM: Claude primero, Gemini como fallback

Cada respuesta automática intenta primero con **Claude** (Anthropic). Si
la llamada falla por cualquier motivo (rate limit, key inválida, error
5xx, timeout), se reintenta automáticamente una vez con **Gemini** antes
de darse por vencido. La lógica vive en
[`src/lib/llm.ts`](src/lib/llm.ts).

Si ambos fallan, el error queda logueado en la consola del bot y
simplemente no se envía respuesta (el mensaje del cliente ya quedó
guardado en la conversación, así que no se pierde nada — podés
responder manualmente pasando el chat a modo Humano).

## Personalizar el comportamiento del bot

Editá [`src/lib/system-prompt.ts`](src/lib/system-prompt.ts) con el
prompt de tu negocio. Es el system prompt que se le pasa al LLM en cada
respuesta, junto con el historial reciente de la conversación (últimos
20 mensajes).

## CRM simple: notas y etiquetas

Cada conversación tiene, además del modo IA/Humano:

- **Etiquetas**: chips libres (ej. "VIP", "interesado", "reclamo") que
  se agregan/quitan desde el panel de la conversación y se ven también
  en la lista de la izquierda.
- **Notas internas**: un cuadro de texto colapsable ("Notas internas")
  para dejar contexto que solo ve tu equipo — nunca se envía al
  cliente.

Se guardan al instante vía `POST /api/crm/[conversationId]` y persisten
en la misma fila de `conversations` en SQLite (columnas `tags` y
`notes`).

## Cómo funciona

- Cada chat 1:1 tiene un modo: **IA** (responde el bot automáticamente)
  o **Humano** (solo se guarda el mensaje, respondés vos desde el
  dashboard).
- El bot y el dashboard corren en procesos Node separados y no comparten
  memoria — se coordinan a través de SQLite:
  - `connection_state`: fila única que informa al dashboard el estado de
    la conexión de WhatsApp (para mostrar QR o el dashboard real).
  - `outbox`: cuando enviás un mensaje humano desde el dashboard, se
    encola ahí. El proceso bot lo poll-ea cada 2 segundos y lo envía por
    Baileys.
- El dashboard hace polling cada 2 segundos (sin WebSockets) a los
  endpoints de estado de conexión, lista de conversaciones y mensajes.

## Respaldo en MongoDB Atlas (opcional)

SQLite sigue siendo la única fuente de verdad: **todas las lecturas del
dashboard vienen de SQLite**, siempre. Si completás `MONGODB_URI` en
`.env.local`, cada escritura (mensajes, conversaciones, modo, notas,
tags, borrados) además se replica de forma *best-effort* a dos
colecciones en Mongo (`conversations` y `messages`), usando el mismo id
numérico de SQLite como `_id`.

Esto es un espejo/histórico para tener un backup fuera del disco local
(útil si el volumen se corrompe o perdés el archivo `.db`), **no** un
mecanismo de alta disponibilidad ni una segunda fuente de lectura:

- Si Mongo no está configurada o no responde, el bot sigue funcionando
  exactamente igual — la réplica es fire-and-forget y nunca bloquea ni
  hace fallar una escritura en SQLite.
- Si una conexión a Mongo falla, se espera 30s antes de reintentar (para
  no saturar de intentos si Atlas está caído).
- No hay lectura desde Mongo en ningún punto del código; es solo destino
  de escritura.

La lógica vive en [`src/lib/mongo.ts`](src/lib/mongo.ts).

## Troubleshooting

**El bot entra en loop con `code=440`:** es `connectionReplaced`, típico
justo después del pairing. El cliente ya usa `Browsers.macOS('Desktop')`
(fingerprint conocido) y espera 15s antes de reintentar en ese caso
específico. Si persiste:
- Desde tu teléfono, andá a Dispositivos vinculados y borrá sesiones
  viejas de pruebas anteriores.
- Probá cambiar de IP o esperar ~24h si WhatsApp está bloqueando la IP
  temporalmente.

**`code=405`:** versión de protocolo desactualizada. El cliente ya llama
`fetchLatestBaileysVersion()` en cada arranque; si sigue pasando,
actualizá `@whiskeysockets/baileys` a la última versión.

**`code=515`:** es normal, es la señal de pairing exitoso. El cliente
reconecta solo.

**El QR no aparece en el dashboard:** el endpoint
`/api/connection/status` es defensivo y muestra el QR si hay
`qr_string` en DB aunque el status sea `connecting` (puede pasar por una
race condition). Si el QR sigue sin aparecer después de >10s, revisá que
`npm run start:bot` esté corriendo (los logs imprimen el QR también en
ASCII como fallback).

**El bot no responde / veo "Claude falló, reintentando con Gemini" en
los logs:** revisá `ANTHROPIC_API_KEY` en `.env.local`. Si además falla
Gemini, revisá `GEMINI_API_KEY`. Los errores de ambos proveedores quedan
logueados en la consola del bot con el motivo exacto (401, 429, etc.).

**`ANTHROPIC_API_KEY`/`GEMINI_API_KEY` llegan `undefined` al bot:**
asegurate de no reordenar los imports en `scripts/start-bot.ts` —
`./env-loader` tiene que ser el primer import del archivo (los imports
de ES modules se hoistean, así que cualquier módulo que lea
`process.env` en su top-level necesita que el loader ya haya corrido).

## Deploy en producción (sin Docker, ej. EasyPanel/Railway)

El repo incluye `Procfile`, `nixpacks.toml` y `.nvmrc` para deploy con
Nixpacks:

- `Procfile` corre `npm run start:all` (bot + Next.js en el mismo
  proceso web).
- `nixpacks.toml` fuerza Node 22 e instala `python3`, `gcc`, `gnumake`
  (necesarios para compilar el binario nativo de `better-sqlite3`).

**Volúmenes persistentes obligatorios:** montá `/app/data` y `/app/auth`
como volúmenes persistentes. Sin ellos, cada redeploy borra las
conversaciones guardadas Y obliga a re-escanear el QR. (El respaldo en
MongoDB Atlas no reemplaza esto — solo espeja escrituras, no sirve para
restaurar automáticamente el estado en un arranque nuevo.)

## ⚠️ Seguridad — el dashboard no tiene autenticación

Esta v1 no incluye login ni auth en el dashboard. Es aceptable para uso
100% local (`localhost:3000`), pero es **bloqueante** para desplegar a
internet: cualquiera con la URL puede leer todas las conversaciones de
WhatsApp del negocio y enviar mensajes haciéndose pasar por el dueño.

Antes de exponerlo a internet, agregá autenticación a nivel de proxy:
- Basic auth en Nginx/Caddy delante de la app, o
- Cloudflare Access / Cloudflare Tunnel con política de acceso.

## Stack

- Next.js 16 (App Router) + TypeScript + React 19, Tailwind CSS 4
- `@whiskeysockets/baileys` — cliente WhatsApp Web
- `better-sqlite3` — base de datos local, fuente de verdad (WAL habilitado)
- `@anthropic-ai/sdk` — Claude, proveedor principal del LLM
- `@google/genai` — Gemini, fallback del LLM
- `mongodb` — respaldo opcional best-effort en MongoDB Atlas
- `pino`, `qrcode`, `qrcode-terminal`, `tsx`, `concurrently`

## Mejoras pendientes (v2)

- Soporte de imágenes salientes (enviar catálogo/productos como PNG).
- Function calling real con `tools` de Claude/Gemini.
- Auto-toggle a modo Humano cuando el bot detecta una frase específica
  (por ejemplo, regex sobre "derivarte con un asesor humano").
- WebSocket en lugar de polling para actualizaciones en tiempo real.
- Autenticación básica integrada al dashboard (middleware de Next.js),
  en vez de depender solo del proxy.
- Soporte de mensajes de audio/imagen entrantes (hoy se ignoran).
- Soporte de chats grupales (hoy se ignoran, `@g.us`).
- CRM completo: pipeline/kanban por etapas, campos de contacto (email,
  empresa, valor estimado) y agente asignado por conversación.
- Lectura con fallback automático desde MongoDB Atlas si SQLite no está
  disponible (hoy Mongo es solo destino de escritura).
