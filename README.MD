# Kage Baileys

## Publicación de la versión 3.2.2

Requiere Node.js >=22.12.0. En Termux, trabajar dentro de `$HOME`, no en `/storage/emulated/0`. Extraer este ZIP en una carpeta nueva: no mezclarlo con archivos antiguos.

```sh
cd ~/kage-baileys
npm ci --include=dev --omit=optional
npm run build
npm run check
npm pack
npm publish --dry-run
npm login
npm publish --access public
```

Si npm informa que 3.2.2 ya existe: `npm version patch --no-git-tag-version` y volver a ejecutar la compilación y las comprobaciones. Solo el propietario o un colaborador autorizado de `kage-baileys` puede publicar ese nombre. npm puede requerir autenticación de dos factores.

El paquete incluye el código completo, protocolos precompilados, tipos CommonJS/ESM, lockfile y pruebas. `protobufjs-cli` es una dependencia de desarrollo: no omitir las dependencias de desarrollo al compilar o publicar. `npm install kage-baileys` como consumidor no regenera los protocolos.

Las reglas `resolutions` se incluyen y se han traducido también a `overrides` para npm. Los overrides solo gobiernan la instalación cuando este proyecto es la raíz; no imponen versiones a los proyectos que lo instalen como dependencia. No usar `npm audit fix --force` sin revisar incompatibilidades.

Las funciones que requieren sharp, better-sqlite3, audio-decode, @napi-rs/image o los puentes nativos necesitan instalar el módulo correspondiente compatible con la plataforma. No se garantiza soporte nativo de VoIP en Android. Las pruebas locales no sustituyen una conexión real a WhatsApp.

Los avisos MIT se conservan en LICENSE y licenses/.

---

# Kage Baileys

**Creado por xrljosedv · Socio David Zuniga**

## Preparación del paquete

Requiere **Node.js 22.12 o posterior**. Esta distribución tiene un único manifiesto y una sola estructura de módulos. Los esquemas se generan desde `WAProto/WAProto.proto`; las entradas CommonJS y ESM están en `lib/index.js` y `lib/index.mjs`.

```sh
npm ci
npm run check
npm run maintenance
npm run prepublishOnly
npm pack
```

No es necesario instalar otro paquete de la biblioteca. Las dependencias declaradas se instalan normalmente en `node_modules`. La publicación en npm requiere una cuenta autorizada y comprobar que la versión está disponible.

## Banner y autoría

```js
const { say, showKageBanner } = require('kage-baileys')
say('kage baileys', {
  font: 'simple',
  align: 'center',
  gradient: ['red', 'magenta']
})
say('Creado por xrljosedv', {
  font: 'console',
  align: 'center',
  colors: ['cyan', 'magenta', 'yellow']
})
say('Socio David Zuniga', {
  font: 'console',
  align: 'center',
  colors: ['cyan', 'magenta', 'yellow']
})
```

El banner automático se activa mediante `kageTools: { banner: true }`; `KAGE_BANNER=0` lo desactiva. En terminales sin color se conserva el texto sin secuencias ANSI.

## Mantenimiento y alcance de las comprobaciones

`npm run maintenance` comprueba estructura, API, esquema y rutas de importación. `npm run check` comprueba sintaxis y ejecuta las pruebas. Los informes actuales están en `maintenance/`. Las pruebas locales no equivalen a una certificación de todos los recorridos de WhatsApp: vinculación, cifrado entre dispositivos, canales, llamadas, pagos y aceptación de mensajes requieren una cuenta real, permisos y servicios compatibles. No se garantiza compatibilidad con cualquier versión de WhatsApp.

Las dependencias nativas son opcionales cuando así se declara. FFmpeg debe instalarse en el sistema para las operaciones de audio y vídeo que lo necesiten. Para SQLite instale `better-sqlite3`; para imágenes puede instalar `sharp` o `@napi-rs/image`. Algunas interfaces ampliadas conservan tipado genérico; las declaraciones detalladas del protocolo sí se regeneran desde el esquema.

## Índice general

- [Preparación del paquete](#preparación-del-paquete)
- [Banner y autoría](#banner-y-autoría)
- [Mantenimiento y alcance de las comprobaciones](#mantenimiento-y-alcance-de-las-comprobaciones)
- [Qué incluye](#qué-incluye)
- [Instalación](#instalación)
- [Uso rápido](#uso-rápido)
- [Módulos extra Kage](#módulos-extra-kage)
- [💬 Únete al canal](#-únete-al-canal)
- [✨ Características principales](#-características-principales)
- [⚠️ Advertencia](#-advertencia)
- [📦 Instalación](#-instalación)
- [🚀 Inicio rápido](#-inicio-rápido)
- [📋 Índice](#-índice)
- [🔌 Conexión de cuenta](#-conexión-de-cuenta)
- [⚙️ Notas importantes de configuración del socket](#-notas-importantes-de-configuración-del-socket)
- [💾 Guardar la información de autenticación](#-guardar-la-información-de-autenticación)
- [🗄️ Implementación del store de datos](#-implementación-del-store-de-datos)
- [🆔 Explicación de los ID de WhatsApp](#-explicación-de-los-id-de-whatsapp)
- [🔧 Funciones utilitarias](#-funciones-utilitarias)
- [📤 Enviar mensajes](#-enviar-mensajes)
- [✏️ Modificar mensajes](#-modificar-mensajes)
- [🖼️ Manipulación de mensajes con medios](#-manipulación-de-mensajes-con-medios)
- [📞 Rechazar llamadas](#-rechazar-llamadas)
- [💬 Estado de envío en el chat](#-estado-de-envío-en-el-chat)
- [📁 Modificar chats](#-modificar-chats)
- [👤 Consultas de usuario](#-consultas-de-usuario)
- [🔄 Modificar perfil](#-modificar-perfil)
- [👥 Grupos](#-grupos)
- [🔒 Privacidad](#-privacidad)
- [📢 Listaas de diintegración y estados](#-listaas-de-diintegración-y-estados)
- [🛠️ Funciones personalizadas](#-funciones-personalizadas)
- [💡 Consejos y buenas prácticas](#-consejos-y-buenas-prácticas)
- [📄 Licencia](#-licencia)
- [Documentoación adicional de la distribución adjunta](#documentoación-adicional-de-la-distribución-adjunta)
- [Referencia completa de la API de Kage](#referencia-completa-de-la-api-de-kage)
- [Conectar una cuenta](#conectar-una-cuenta)
- [Configuración importante del socket](#configuración-importante-del-socket)
- [Guardar y restaurar sesiones](#guardar-y-restaurar-sesiones)
- [Gestión de eventos](#gestión-de-eventos)
- [Implementar un almacén de datos](#implementar-un-almacén-de-datos)
- [Identificadores de WhatsApp](#identificadores-de-whatsapp)
- [Funciones auxiliares](#funciones-auxiliares)
- [Envío de mensajes](#envío-de-mensajes)
- [Modificar mensajes](#modificar-mensajes)
- [Procesar mensajes multimedia](#procesar-mensajes-multimedia)
- [Rechazar llamada](#rechazar-llamada)
- [Enviar estados del chat](#enviar-estados-del-chat)
- [Modificar chats](#modificar-chats)
- [Consultas de usuarios](#consultas-de-usuarios)
- [Cambiar perfil](#cambiar-perfil)
- [Grupos](#grupos)
- [Privacidad](#privacidad)
- [Listaas de diintegración y estados](#listaas-de-diintegración-y-estados)
- [Crear funciones personalizadas](#crear-funciones-personalizadas)
- [Guía ampliada de mensajes y administración](#guía-ampliada-de-mensajes-y-administración)
- [Licencias y reconocimientos](#licencias-y-reconocimientos)

---

<div align='center'>

<img src='https://files.catbox.moe/obv0zs.png' alt='KAGE BAILEYS' width='850'/>

# KAGE BAILEYS

</div>

> **Librería moderna de WhatsApp Web con funciones avanzadas — botones, carruseles, flujos nativos y más.**
> Creador: **xrljosedv** • Desarrollador: **Jose** • Documentoación 100% en español.

<div align='center'>

[![npm version](https://img.shields.io/npm/v/kage-baileys.svg)](https://www.npmjs.com/package/kage-baileys)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Downloads](https://img.shields.io/npm/dm/kage-baileys.svg)](https://www.npmjs.com/package/kage-baileys)

</div>

## Qué incluye

| Función | Estado |
|---|---|
| Botones interactivos y carruseles | Incluido |
| Native Flows (flujos nativos) | Incluido |
| Álbumes / mensajes de álbum | Incluido |
| Newsletters (canales) | Incluido |
| Meta AI (respuestas enriquecidas) | Incluido |
| VoIP / llamadas de voz | Incluido |
| Mapeo LID (lid-mapping) | Incluido |
| Compatibilidad con WhatsApp | Depende del cliente y del servidor |

## Instalación

```bash
npm install kage-baileys
# o desde carpeta local
npm install ./kage-baileys
```

## Uso rápido

```js
const { default: makeWASocket, useMultiFileAuthState } = require('kage-baileys');
// Código de emparejamiento por defecto: JOSEMODS
await sock.requestPairingCode("521234567890"); // clave interna: JOSEMODS
```

## Módulos extra Kage

```js
// En Node moderno ya vienen exportados automáticamente.
// En versiones antiguas:
const extras = await require('kage-baileys').cargarExtrasKage();
// extras: message_builder (botones/carruseles/flows), VoipClient, ActiveCall, CallState
```

## 💬 Únete al canal

Mantente informado de las actualizaciones y novedades del proyecto:

[![Canal de WhatsApp](https://img.shields.io/badge/WhatsApp-Unirse%20al%20canal-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029VbBibFU9cDDbBZ06fa0U)

**https://whatsapp.com/channel/0029VbBibFU9cDDbBZ06fa0U**

## ✨ Características principales

- 🚀 **Moderno y rápido** - Construido con TypeScript y la tecnología más reciente
- 🔧 **Corrección de @lid & @jid** - Soluciona el problema de @lid a @pn en grupos de WhatsApp
- 📱 **Soporte Multi-Device** - Compatible con la conexión multidispositivo de WhatsApp
- 🔐 **Cifrado de extremo a extremo** - Comunicación totalmente cifrada
- 📨 **Todo tipo de mensajes** - Textoo, medios, encuestas, etc.

## ⚠️ Advertencia

Este proyecto no está afiliado, relacionado, autorizado ni respaldado oficialmente por WhatsApp ni sus filiales. El sitio oficial de WhatsApp es whatsapp.com.

Los mantenedores de kage-baileys no respaldan el uso de esta aplicación para violar los Términos de Servicio de WhatsApp. Enfatizamos la responsabilidad personal del usuario para un uso justo y responsable.

Usa con sabiduría. Evita el spam. No uses automatización excesiva.

## 📦 Instalación

### Versión estable (recomendada)

```bash
npm i kage-baileys
```

### Versión edge (últimas funciones)

```bash
npm i kage-baileys@latest
# o
yarn add kage-baileys@latest
```

### Importar en el código

```javascript
const { default: makeWASocket } = require("kage-baileys")
// o ES6
import makeWASocket from "kage-baileys"
```

## 🚀 Inicio rápido

### Ejemplo básico

```javascript
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('kage-baileys')
const { Boom } = require('@hapi/boom')

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_kage-baileys')
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['kage-baileys', 'Desktop', '3.0']
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Conexión cerrada porque ', lastDisconnect.error, ', reconectando ', shouldReconnect)
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('✅ ¡Conectado a WhatsApp con éxito!')
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages) {
            if (!m.message) continue
            
            console.log('📱 Nuevo mensaje:', JSON.stringify(m, undefined, 2))
            
            // Respuesta automática
            await sock.sendMessage(m.key.remoteJid!, { 
                text: '¡Hola! Soy un bot de WhatsApp usando kage-baileys 🤖' 
            })
        }
    })

    sock.ev.on('creds.update', saveCreds)
}

connectToWhatsApp()
```

<a id="-table-of-contents"></a>
## 📋 Índice

Aviso: Esta documentación sigue en fase beta, por lo que puede contener errores o imprecisiones.

## 🔌 Conexión de cuenta

WhatsApp ofrece una API multidispositivo que permite autenticar a kage-baileys como cliente secundario mediante código QR o código de emparejamiento.

### Conectar con código QR

> [!TIP]  
> Personaliza el nombre del navegador con la constante `Browsers`. Consulta las configuraciones disponibles más abajo.

```javascript
const { default: makeWASocket, Browsers } = require("kage-baileys")

const sock = makeWASocket({
    browser: Browsers.ubuntu('Mi App'),
    printQRInTerminal: true
})
```

Tras iniciar la conexión, el código QR aparecerá en la terminal. Escanéalo con WhatsApp en tu teléfono para iniciar sesión.

### Conectar con código de emparejamiento

> [!IMPORTANT]  
> El código de emparejamiento no forma parte de la API móvil. Permite conectar WhatsApp Web sin QR, pero solo en un dispositivo. Consulta el [FAQ de WhatsApp](https://faq.whatsapp.com/).

El número debe ir sin `+`, `()` ni `-`, e incluir el código de país.

```javascript
const { default: makeWASocket } = require("kage-baileys")

const sock = makeWASocket({
    printQRInTerminal: false
})

// Emparejamiento normal
if (!sock.authState.creds.registered) {
    const number = '51987654321'
    const code = await sock.requestPairingCode(number)
    console.log('🔑 Código de emparejamiento:', code)
}

// Emparejamiento personalizado
if (!sock.authState.creds.registered) {
    const pair = "JOSEMODS" // 8 caracteres
    const number = '51987654321'
    const code = await sock.requestPairingCode(number, pair)
    console.log('🔑 Código de emparejamiento personalizado:', code)
}
```

### Recibir el historial completo

1. Establece `syncFullHistory` en `true`.
2. Por defecto, kage-baileys usa la configuración de Chrome. Para una conexión tipo escritorio (con más historial de mensajes), usa:

```javascript
const { default: makeWASocket, Browsers } = require("kage-baileys")

const sock = makeWASocket({
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: true
})
```

## ⚙️ Notas importantes de configuración del socket

### Cachear metadatos de grupos (recomendado)

Para uso en grupos, implementa una caché de metadatos:

```javascript
const { default: makeWASocket } = require("kage-baileys")
const NodeCache = require('node-cache')

const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

const sock = makeWASocket({
    cachedGroupMetadata: async (jid) => groupCache.get(jid)
})

sock.ev.on('groups.update', async ([event]) => {
    const metadata = await sock.groupMetadata(event.id)
    groupCache.set(event.id, metadata)
})

sock.ev.on('group-participants.update', async (event) => {
    const metadata = await sock.groupMetadata(event.id)
    groupCache.set(event.id, metadata)
})
```

### Mejorar reintentos y descifrado de votos en encuestas

Mejora el envío de mensajes y el descifrado de votos con un store:

```javascript
const sock = makeWASocket({
    getMessage: async (key) => await getMessageFromStore(key)
})
```

### Recibir notificaciones en la app de WhatsApp

Desactiva el estado en línea para recibir notificaciones:

```javascript
const sock = makeWASocket({
    markOnlineOnConnect: false
})
```

## 💾 Guardar la información de autenticación

Evita escanear el QR repetidamente guardando las credenciales:

```javascript
const makeWASocket = require("kage-baileys").default
const { useMultiFileAuthState } = require("kage-baileys")

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_kage-baileys')
    const sock = makeWASocket({ auth: state })
    sock.ev.on('creds.update', saveCreds)
}

connect()
```

> [!IMPORTANT]  
> `useMultiFileAuthState` guarda el estado de autenticación en una carpeta. Para producción, usa una base de datos SQL/NoSQL y gestiona las actualizaciones de claves con cuidado.

```javascript
const sock = makeWASocket()
sock.ev.on('messages.upsert', ({ messages }) => {
    console.log('Mensaje recibido:', messages)
})
```

<a id="example-to-start"></a>
### Ejemplo inicial

```javascript
const makeWASocket = require("kage-baileys").default
const { DisconnectReason, useMultiFileAuthState } = require("kage-baileys")
const { Boom } = require('@hapi/boom')

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_kage-baileys')
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Conexión cerrada porque ', lastDisconnect.error, ', reconectando ', shouldReconnect)
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('Conexión abierta')
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages) {
            console.log(JSON.stringify(m, undefined, 2))
            console.log('Responder a', m.key.remoteJid)
            await sock.sendMessage(m.key.remoteJid!, { text: 'Hola Mundo' })
        }
    })

    sock.ev.on('creds.update', saveCreds)
}

connectToWhatsApp()
```

<a id="decrypt-poll-votes"></a>
### Descifrar votos de encuestas

Por defecto, los votos de las encuestas están cifrados y se manejan en `messages.update`:

```javascript
sock.ev.on('messages.update', event => {
    for(const { key, update } of event) {
        if(update.pollUpdates) {
            const pollCreation = await getMessage(key)
            if(pollCreation) {
                console.log(
                    'actualización de encuesta recibida, agregación: ',
                    getAggregateVotesInPollMessage({
                        message: pollCreation,
                        pollUpdates: update.pollUpdates,
                    })
                )
            }
        }
    }
})
```

`getMessage` es una implementación de tu store (de tu lado).

### Resumen de eventos de la primera conexión

1. En la primera conexión, `connection.update` se dispara pidiendo reiniciar el socket.
2. Luego, los mensajes del historial llegan en `messaging.history-set`.

## 🗄️ Implementación del store de datos

kage-baileys no incluye almacenamiento por defecto para chats, contactos ni mensajes. Sin embargo, se provee una implementación simple en memoria. El store escucha actualizaciones de chats, mensajes nuevos, etc., para mantener los datos al día.

> [!IMPORTANT]  
> Recomiendo mucho construir tu propio store de datos, ya que guardar todo el historial de chats en memoria consume mucha RAM.

```javascript
const makeWASocket = require("kage-baileys").default
const { makeInMemoryStore } = require("kage-baileys")

const store = makeInMemoryStore({ })

store.readFromFile('./kage-baileys_store.json')

setInterval(() => {
    store.writeToFile('./kage-baileys_store.json')
}, 10_000)

const sock = makeWASocket({ })
store.bind(sock.ev)

sock.ev.on('chats.upsert', () => {
    console.log('chat recibido', store.chats.all())
})

sock.ev.on('contacts.upsert', () => {
    console.log('contactos recibidos', Object.values(store.contacts))
})
```

El store también ofrece funciones simples como `loadMessages` para agilizar la obtención de datos.

## 🆔 Explicación de los ID de WhatsApp

El `id` es el ID de WhatsApp, también llamado `jid`, de la persona o grupo destinatario del mensaje.

Formato: `[código de país][número de teléfono]@s.whatsapp.net`  
Ejemplo de persona: `+19999999999@s.whatsapp.net`.  

Para grupos: `123456789-123345@g.us`.  

Para listas de diintegración: `[timestamp de creación]@broadcast`.  

Para estados: `status@broadcast`.

## 🔧 Funciones utilitarias

- `getContentType` - Devuelve el tipo de contenido de un mensaje
- `getDevice` - Devuelve el dispositivo desde el que se envió el mensaje
- `makeCacheableSignalKeyStore` - Acelera el store de autenticación
- `downloadContentFromMessage` - Descarga el contenido de un mensaje

## 📤 Enviar mensajes

Envía todo tipo de mensajes con una sola función.

Consulta los contenidos de mensaje admitidos en la sección de abajo.  
Consulta las opciones como citar en los ejemplos siguientes.

```javascript
const jid: string
const content: AnyMessageContent
const options: MiscMessageGenerationOptions

sock.sendMessage(jid, content, options)
```

### Mensajes sin medios

<a id="text-message"></a>
#### Mensaje de texto

```javascript
await sock.sendMessage(jid, { text: 'hola mundo' })
```

#### Mensaje citado (funciona con todos los tipos)

```javascript
await sock.sendMessage(jid, { text: 'hola mundo' }, { quoted: message })
```

#### Mencionar usuarios (funciona con la mayoría de tipos)

`@numero` para mencionar en el texto, opcional.

```javascript
await sock.sendMessage(
    jid,
    {
        text: '@12345678901',
        mentions: ['12345678901@s.whatsapp.net']
    }
)
```

#### Reenviar mensaje

Necesita un objeto de mensaje; obténlo del store o usa el objeto del mensaje.

```javascript
const msg = getMessageFromStore() // impleméntalo tú mismo
await sock.sendMessage(jid, { forward: msg })
```

<a id="location-message"></a>
#### Mensaje de ubicación

```javascript
await sock.sendMessage(
    jid, 
    {
        location: {
            degreesLatitude: 24.121231,
            degreesLongitude: 55.1121221
        }
    }
)
```

<a id="contact-message"></a>
#### Mensaje de contacto

```javascript
const vcard = 'BEGIN:VCARD\n' 
            + 'VERSION:3.0\n' 
            + 'FN:Jeff Singh\n' 
            + 'ORG:Ashoka Uni;\n' 
            + 'TEL;type=CELL;type=VOICE;waid=911234567890:+91 12345 67890\n' 
            + 'END:VCARD'

await sock.sendMessage(
    id,
    { 
        contacts: { 
            displayName: 'Jeff', 
            contacts: [{ vcard }] 
        }
    }
)
```

#### Reaccionar a un mensaje

Necesita la clave del mensaje; obténla del store o usa el objeto clave.

```javascript
await sock.sendMessage(
    jid,
    {
        react: {
            text: '💖', // déjalo vacío para eliminar la reacción
            key: message.key
        }
    }
)
```

<a id="pin-message"></a>
#### Fijar mensaje

Necesita la clave del mensaje.

Tiempos:

| Tiempo | Segundos   |
|-------|------------|
| 24h   | 86.400     |
| 7d    | 604.800    |
| 30d   | 2.592.000  |

```javascript
await sock.sendMessage(
    jid,
    {
        pin: {
            type: 1, // 0 para quitar
            time: 86400,
            key: message.key
        }
    }
)
```

<a id="poll-message"></a>
#### Mensaje de encuesta

```javascript
await sock.sendMessage(
    jid,
    {
        poll: {
            name: 'Mi Encuesta',
            values: ['Opción 1', 'Opción 2', ...],
            selectableCount: 1,
            toAnnouncementGroup: false // o true
        }
    }
)
```

### Enviar con vista previa de enlace

1. Por defecto, WA no genera vistas previas de enlaces web.
2. kage-baileys tiene una función para la vista previa de enlaces.
3. Añade `link-preview-js` con `npm i link-preview-js`.
4. Envía el enlace:

```javascript
await sock.sendMessage(
    jid,
    {
        text: 'Hola, esto se envió usando https://npmjs.com/kage-baileys'
    }
)
```

### Mensajes con medios

El envío de medios (video, stickers, imágenes) es más fácil y eficiente.

> [!NOTE] En mensajes con medios puedes usar `{ stream: Stream }` o `{ url: Url }` o un Buffer directamente; consulta los ejemplos de abajo.

kage-baileys no carga el buffer completo en memoria: cifra como stream.

> [!TIP] Usa Stream o Url para ahorrar memoria.

<a id="gif-message"></a>
#### Mensaje GIF

WA no admite .gif; envíalo como .mp4 con la opción `gifPlayback`.

```javascript
await sock.sendMessage(
    jid, 
    { 
        video: fs.readFileSync('Media/mi_gif.mp4'),
        caption: 'hola mundo',
        gifPlayback: true
    }
)
```

#### Mensaje de video

```javascript
await sock.sendMessage(
    id, 
    { 
        video: {
            url: './Media/mi_video.mp4'
        },
        caption: 'hola mundo',
        ptv: false // true para video note
    }
)
```

<a id="audio-message"></a>
#### Mensaje de audio

Convierte con ffmpeg: `codec: libopus`, `ac: 1`, `avoid_negative_ts`, `make_zero`.

Ejemplo: `ffmpeg -i input.mp4 -avoid_negative_ts make_zero -ac 1 output.ogg`

```javascript
await sock.sendMessage(
    jid, 
    {
        audio: {
            url: './Media/audio.mp3'
        },
        mimetype: 'audio/mp4'
    }
)
```

<a id="image-message"></a>
#### Mensaje de imagen

```javascript
await sock.sendMessage(
    id, 
    { 
        image: {
            url: './Media/mi_img.png'
        },
        caption: 'hola mundo'
    }
)
```

#### Mensaje de una sola vista

Añade `viewOnce: true` a cualquiera de los mensajes anteriores.

```javascript
await sock.sendMessage(
    id, 
    { 
        image: {
            url: './Media/mi_img.png'
        },
        viewOnce: true, // también funciona con video y audio
        caption: 'hola mundo'
    }
)
```

## ✏️ Modificar mensajes

### Eliminar mensaje (para todos)

```javascript
const msg = await sock.sendMessage(jid, { text: 'hola mundo' })
await sock.sendMessage(jid, { delete: msg.key })
```

Nota: eliminar para uno mismo se admite vía `chatModify`; consulta [Modificar chats](#modificar-chats).

### Editar mensaje

Usa contenido editable.

```javascript
await sock.sendMessage(jid, {
      text: 'texto actualizado aquí',
      edit: response.key,
    });
```

## 🖼️ Manipulación de mensajes con medios

### Miniatura en mensajes con medios

Miniatura automática para imágenes y stickers si añades `jimp` o `sharp` (`npm i jimp` o `npm i sharp`).  

Para video, necesitas `ffmpeg` instalado.

### Descargar medios de un mensaje

Para guardar los medios recibidos:

```javascript
import { createWriteStream } from 'fs'
import { downloadMediaMessage, getContentType } from 'kage-baileys'

sock.ev.on('messages.upsert', async ({ messages: [m] }) => {
    if (!m.message) return
    const messageType = getContentType(m)

    if (messageType === 'imageMessage') {
        const stream = await downloadMediaMessage(
            m,
            'stream', // o 'buffer'
            { },
            { 
                logger,
                reuploadRequest: sock.updateMediaMessage
            }
        )
        const writeStream = createWriteStream('./mi-descarga.jpeg')
        stream.pipe(writeStream)
    }
})
```

### Volver a subir medios a WhatsApp

WA elimina los medios antiguos de su servidor. Vuelve a subirlos con:

```javascript
await sock.updateMediaMessage(msg)
```

## 📞 Rechazar llamadas

Obtén `callId` y `callFrom` del evento `call`.

```javascript
await sock.rejectCall(callId, callFrom)
```

## 💬 Estado de envío en el chat

### Leer mensajes

El conjunto de claves de mensajes debe marcarse como leído explícitamente.

```javascript
const key: WAMessageKey
await sock.readMessages([key]) // admite varias claves
```

El ID del mensaje es el identificador único. Accede con `message.key.id`.

<a id="update-presence"></a>
### Actualizar presencia

`presence` puede ser: available, composing, recording, paused, unavailable.

Dura 10 segundos. Informa al jid si estás en línea, desconectado, escribiendo, etc.

```javascript
await sock.sendPresenceUpdate('available', jid) 
```

> [!NOTE] Si el cliente de escritorio está activo, WA no envía notificaciones push. Para recibir notificaciones, ponte offline con `sock.sendPresenceUpdate('unavailable')`.

## 📁 Modificar chats

WA usa comunicación cifrada para las actualizaciones de chats/aplicación.

> [!IMPORTANT] Si actualizas mal, WA puede cerrar sesión en todos los dispositivos.

### Archivar un chat

```javascript
const lastMsgInChat = await getLastMessageInChat(jid) // impleméntalo tú mismo
await sock.chatModify({ archive: true, lastMessages: [lastMsgInChat] }, jid)
```

### Silenciar / quitar silencio de un chat

Tiempos admitidos:

| Tiempo | Milisegundos |
|-------|--------------|
| Quitar | null         |
| 8h    | 28.800.000   |
| 7d    | 604.800.000  |

```javascript
// Silenciar 8 horas
await sock.chatModify({ mute: 8 * 60 * 60 * 1000 }, jid)
// Quitar silencio
await sock.chatModify({ mute: null }, jid)
```

### Marcar chat como leído / no leído

```javascript
const lastMsgInChat = await getLastMessageInChat(jid)
// marcar como no leído
await sock.chatModify({ markRead: false, lastMessages: [lastMsgInChat] }, jid)
```

### Eliminar mensajes para mí

```javascript
await sock.chatModify(
    {
        clear: {
            messages: [
                {
                    id: 'ATWYHDNNWU81732J',
                    fromMe: true, 
                    timestamp: '1654823909'
                }
            ]
        }
    }, 
    jid
)
```

<a id="delete-a-chat"></a>
### Eliminar un chat

```javascript
const lastMsgInChat = await getLastMessageInChat(jid)
await sock.chatModify({
        delete: true,
        lastMessages: [
            {
                key: lastMsgInChat.key,
                messageTimestamp: lastMsgInChat.messageTimestamp
            }
        ]
    },
    jid
)
```

### Fijar / quitar fijado de un chat

```javascript
await sock.chatModify({
        pin: true // o false para quitar
    },
    jid
)
```

### Destacar / quitar destaque de mensajes

```javascript
await sock.chatModify({
        star: {
            messages: [
                {
                    id: 'messageID',
                    fromMe: true // o false
                }
            ],
            star: true // true: Destacar; false: Quitar destaque
        }
    },
    jid
)
```

### Mensajes efímeros

Duraciones:

| Tiempo | Segundos   |
|-------|------------|
| Quitar | 0          |
| 24h   | 86.400     |
| 7d    | 604.800    |
| 90d   | 7.776.000  |

Usa segundos; por defecto 7 días.

```javascript
// Activar mensajes efímeros
await sock.sendMessage(
    jid, 
    { disappearingMessagesInChat: WA_DEFAULT_EPHEMERAL }
)

// Enviar como mensaje efímero
await sock.sendMessage(jid, { text: 'hola' }, { ephemeralExpiration: WA_DEFAULT_EPHEMERAL })

// Desactivar
await sock.sendMessage(
    jid, 
    { disappearingMessagesInChat: false }
)
```

## 👤 Consultas de usuario

### Comprobar si un ID existe en WhatsApp

```javascript
const [result] = await sock.onWhatsApp(jid)
if (result.exists) console.log(`${jid} existe en WhatsApp, con jid: ${result.jid}`)
```

### Consultar historial de chat (también en grupos)

Necesita el mensaje más antiguo del chat.

```javascript
const msg = await getOldestMessageInChat(jid) // impleméntalo tú mismo
await sock.fetchMessageHistory(
    50, // cantidad (máx: 50 por consulta)
    msg.key,
    msg.messageTimestamp
)
```

Los mensajes llegan en el evento `messaging.history-set`.

### Obtener el estado (info)

```javascript
const status = await sock.fetchStatus(jid)
console.log('estado: ' + status)
```

### Obtener foto de perfil (también de grupos)

```javascript
// baja resolución
const ppUrl = await sock.profilePictureUrl(jid)
console.log(ppUrl)

// alta resolución
const ppUrl = await sock.profilePictureUrl(jid, 'image')
```

### Obtener perfil de negocio (descripción o categoría)

```javascript
const profile = await sock.getBusinessProfile(jid)
console.log('descripción del negocio: ' + profile.description + ', categoría: ' + profile.category)
```

### Obtener la presencia de alguien (escribiendo o en línea)

```javascript
sock.ev.on('presence.update', console.log)

await sock.presenceSubscribe(jid) 
```

## 🔄 Modificar perfil

### Cambiar el estado del perfil

```javascript
await sock.updateProfileStatus('¡Hola Mundo!')
```

### Cambiar el nombre del perfil

```javascript
await sock.updateProfileName('Mi Nombre')
```

### Cambiar foto de perfil (también de grupos)

> [!NOTE] Como en los mensajes con medios, usa `{ stream: Stream }` o `{ url: Url }` o un Buffer; consulta [Mensajes con medios](#mensajes-con-medios).

```javascript
await sock.updateProfilePicture(jid, { url: './nueva-foto-perfil.jpeg' })
```

### Eliminar foto de perfil (también de grupos)

```javascript
await sock.removeProfilePicture(jid)
```

## 👥 Grupos

Para modificar propiedades del grupo, debes ser administrador.

### Crear un grupo

```javascript
const group = await sock.groupCreate('Mi Grupo', ['1234@s.whatsapp.net', '4564@s.whatsapp.net'])
console.log('grupo creado con id: ' + group.gid)
await sock.sendMessage(group.id, { text: 'hola a todos' })
```

### Añadir/Eliminar o Degradar/Ascender

```javascript
await sock.groupParticipantsUpdate(
    jid, 
    ['abcd@s.whatsapp.net', 'efgh@s.whatsapp.net'],
    'add' // cambia a 'remove', 'demote' o 'promote'
)
```

### Cambiar el asunto (nombre)

```javascript
await sock.groupUpdateSubject(jid, '¡Nuevo Asunto!')
```

### Cambiar la descripción

```javascript
await sock.groupUpdateDescription(jid, '¡Nueva Descripción!')
```

### Cambiar la configuración

```javascript
// Solo administradores pueden enviar mensajes
await sock.groupSettingUpdate(jid, 'announcement')
// Todos pueden enviar
await sock.groupSettingUpdate(jid, 'not_announcement')
// Todos pueden cambiar la configuración del grupo
await sock.groupSettingUpdate(jid, 'unlocked')
// Solo administradores cambian la configuración
await sock.groupSettingUpdate(jid, 'locked')
```

### Salir del grupo

```javascript
await sock.groupLeave(jid)
```

### Obtener el código de invitación

Crea el enlace: `'https://chat.whatsapp.com/' + code`.

```javascript
const code = await sock.groupInviteCode(jid)
console.log('código del grupo: ' + code)
```

### Revocar el código de invitación

```javascript
const code = await sock.groupRevokeInvite(jid)
console.log('Nuevo código del grupo: ' + code)
```

### Unirse con código de invitación

El código sin `https://chat.whatsapp.com/`.

```javascript
const response = await sock.groupAcceptInvite(code)
console.log('unido a: ' + response)
```

### Obtener info del grupo desde el código de invitación

```javascript
const response = await sock.groupGetInviteInfo(code)
console.log('info del grupo: ' + response)
```

### Consultar metadatos (participantes, nombre, descripción...)

```javascript
const metadata = await sock.groupMetadata(jid) 
console.log(metadata.id + ', título: ' + metadata.subject + ', descripción: ' + metadata.desc)
```

### Unirse con groupInviteMessage

```javascript
const response = await sock.groupAcceptInviteV4(jid, groupInviteMessage)
console.log('unido a: ' + response)
```

### Obtener la lista de solicitudes de unión

```javascript
const response = await sock.groupRequestParticipantsList(jid)
console.log(response)
```

### Aprobar/Rechazar solicitudes de unión

```javascript
const response = await sock.groupRequestParticipantsUpdate(
    jid,
    ['abcd@s.whatsapp.net', 'efgh@s.whatsapp.net'],
    'approve' // o 'reject'
)
console.log(response)
```

### Obtener todos los metadatos de grupos en los que participas

```javascript
const response = await sock.groupFetchAllParticipating()
console.log(response)
```

### Alternar efímeros

Duraciones:

| Tiempo | Segundos   |
|-------|------------|
| Quitar | 0          |
| 24h   | 86.400     |
| 7d    | 604.800    |
| 90d   | 7.776.000  |

```javascript
await sock.groupToggleEphemeral(jid, 86400)
```

### Cambiar el modo de añadir

```javascript
await sock.groupMemberAddMode(
    jid,
    'all_member_add' // o 'admin_add'
)
```

## 🔒 Privacidad

### Bloquear/Desbloquear usuarios

```javascript
await sock.updateBlockStatus(jid, 'block') // Bloquear
await sock.updateBlockStatus(jid, 'unblock') // Desbloquear
```

### Obtener configuración de privacidad

```javascript
const privacySettings = await sock.fetchPrivacySettings(true)
console.log('configuración de privacidad: ' + privacySettings)
```

### Obtener la lista de bloqueados

```javascript
const response = await sock.fetchBlocklist()
console.log(response)
```

### Actualizar privacidad de última vez visto

```javascript
const value = 'all' // 'contacts' | 'contact_blacklist' | 'none'
await sock.updateLastSeenPrivacy(value)
```

### Actualizar privacidad de estado en línea

```javascript
const value = 'all' // 'match_last_seen'
await sock.updateOnlinePrivacy(value)
```

### Actualizar privacidad de foto de perfil

```javascript
const value = 'all' // 'contacts' | 'contact_blacklist' | 'none'
await sock.updateProfilePicturePrivacy(value)
```

### Actualizar privacidad de estados

```javascript
const value = 'all' // 'contacts' | 'contact_blacklist' | 'none'
await sock.updateStatusPrivacy(value)
```

### Actualizar privacidad de confirmación de lectura

```javascript
const value = 'all' // 'none'
await sock.updateReadReceiptsPrivacy(value)
```

### Actualizar privacidad de añadir a grupos

```javascript
const value = 'all' // 'contacts' | 'contact_blacklist'
await sock.updateGroupsAddPrivacy(value)
```

### Actualizar el modo efímero por defecto

Duraciones:

| Tiempo | Segundos   |
|-------|------------|
| Quitar | 0          |
| 24h   | 86.400     |
| 7d    | 604.800    |
| 90d   | 7.776.000  |

```javascript
const ephemeral = 86400 
await sock.updateDefaultDisappearingMode(ephemeral)
```

<a id="-listas-de-diintegración-y-estados"></a>
## 📢 Listaas de diintegración y estados

### Enviar diintegración y estados

Los mensajes pueden enviarse a diintegración y estados. Añade las opciones de mensaje:

```javascript
await sock.sendMessage(
    jid,
    {
        image: {
            url: url
        },
        caption: caption
    },
    {
        backgroundColor: backgroundColor,
        font: font,
        statusJidList: statusJidList,
        broadcast: true
    }
)
```

El cuerpo del mensaje puede ser `extendedTextMessage`, `imageMessage`, etc.; consulta [Mensajes con medios](#mensajes-con-medios).  

`broadcast: true` activa el modo diintegración.  

`statusJidList`: lista de destinatarios.  

ID de diintegración: `12345678@broadcast`.

### Consultar destinatarios y nombre de la lista de diintegración

```javascript
const bList = await sock.getBroadcastListInfo('1234@broadcast')
console.log(`nombre de la lista: ${bList.name}, destinatarios: ${bList.recipients}`)
```

## 🛠️ Funciones personalizadas

kage-baileys está diseñado para funciones personalizadas. Añade tus propias extensiones sin hacer fork.

### Activar el nivel debug en los logs de kage-baileys

```javascript
const sock = makeWASocket({
    logger: P({ level: 'debug' }),
})
```

Esto muestra los mensajes de WhatsApp en consola.

<a id="how-whatsapp-communicate-with-us"></a>
### Cómo se comunica WhatsApp

> [!TIP] Estudia el protocolo de WhatsApp con el Libsignal Protocol y el Noise Protocol.

Ejemplo: rastrear el porcentaje de batería del teléfono. Activa los logs y aparece el mensaje de batería:

```json
{
    "level": 10,
    "fromMe": false,
    "frame": {
        "tag": "ib",
        "attrs": {
            "from": "@s.whatsapp.net"
        },
        "content": [
            {
                "tag": "edge_routing",
                "attrs": {},
                "content": [
                    {
                        "tag": "routing_info",
                        "attrs": {},
                        "content": {
                            "type": "Buffer",
                            "data": [8,2,8,5]
                        }
                    }
                ]
            }
        ]
    },
    "msg":"communication"
}
```

`'frame'` tiene: `tag` (tipo de frame), `attrs` (metadatos), `content` (datos).  

### Registrar callbacks para eventos del websocket

> [!TIP] Consulta la función `onMessageReceived` en `socket.ts`.

```javascript
// Para el tag 'edge_routing'
sock.ws.on('CB:edge_routing', (node: BinaryNode) => { })

// Con id 'abcd'
sock.ws.on('CB:edge_routing,id:abcd', (node: BinaryNode) => { })

// Con el nodo routing_info
sock.ws.on('CB:edge_routing,id:abcd,routing_info', (node: BinaryNode) => { })
```

## 💡 Consejos y buenas prácticas

- **Usa caché**: cachea los metadatos de grupos para mejor rendimiento.
- **Gestiona la reconexión**: implementa auto-reconnect para mayor estabilidad.
- **Gestiona el store**: usa una base de datos (MongoDB, PostgreSQL) en producción.
- **Manejo de errores**: envuelve las llamadas del socket en try-catch.
- **Límites de velocidad**: respeta los límites de WhatsApp para evitar baneos; no hagas spam.
- **Seguridad**: no compartas credenciales de autenticación; usa variables de entorno.

## 📄 Licencia

Distribuido bajo la Licencia GPL-3.0. Consulta [LICENSE](LICENSE) para más información.

---

<div align="center">
  kage-baileys - API moderna de WhatsApp Web con corrección de @lid a @pn  
  Desarrollado por Jose (xrljosedv)
</div>

---

<a id="documentación-adicional-de-la-distribución-adjunta"></a>
## Documentoación adicional de la distribución adjunta

# <div align='center'>Baileys - Typescript/Javascript WhatsApp Web API</div>

<div align="center">

<img src="https://wy0xihlhnevw1toh.public.blob.vercel-storage.com/images/ueug_ItsukichanBot-kSBgWKyatxf68Vxl3DMdr14VhAv7tR.png" alt="Header Imagen" width="100%"/>

<br/>

<!-- Badges -->
<p>
  <img src="https://img.shields.io/npm/dw/%40itsukichan%2Fbaileys?label=npm&color=%23CB3837" alt="NPM Downloads"/>

## Referencia completa de la API de Kage

<a id="connecting-account"></a>
## Conectar una cuenta

WhatsApp permite vincular un cliente multidispositivo mediante un código QR o un código de vinculación desde el teléfono.

> [!NOTE]
> El ejemplo inicial muestra la gestión básica de eventos.

> [!TIP]
> Consulte las opciones de configuración de `SocketConfig` en las declaraciones del paquete.

<a id="starting-socket-with-qr-code"></a>
### Iniciar el socket con **código QR**

> [!TIP]
> Con el código QR puede personalizarse el navegador mediante las opciones de `Browsers`.

```ts
import makeWASocket from 'kage-baileys'

const suki = makeWASocket({
    // can provide additional config here
    browser: Browsers.ubuntu('My App'),
    printQRInTerminal: true
})
```

Cuando aparezca el código QR en la terminal, escanéelo desde WhatsApp en el teléfono.

<a id="starting-socket-with-pairing-code"></a>
### Iniciar el socket con **código de vinculación**


> [!IMPORTANT]
> El código de vinculación conecta WhatsApp Web sin QR; no es una API móvil. La disponibilidad y los límites dependen de WhatsApp.

El teléfono debe contener solo números, incluido el código de país, sin `+`, paréntesis ni guiones.

```ts
import makeWASocket from 'kage-baileys'

const suki = makeWASocket({
    // can provide additional config here
    printQRInTerminal: false //need to be false
})

if (!suki.authState.creds.registered) {
    const number = 'XXXXXXXXXXX'
    const code = await suki.requestPairingCode(number) // or await suki.requestPairingCode(number, 'CODEOTPS') custom your pairing code
    console.log(code)
}
```

<a id="receive-full-history"></a>
### Recibir historial completo

1. Configure `syncFullHistory: true`.
2. El navegador se configura mediante `Browsers`.
   - Para emular una conexión de escritorio y solicitar más historial, utilice una configuración de navegador de escritorio.

```ts
const suki = makeWASocket({
    ...otherOpts,
    // Ejemplo de uso de la API de Kage Baileys.
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: true
})
```

<a id="important-notes-about-socket-config"></a>
## Configuración importante del socket

<a id="caching-group-metadata-recommended"></a>
### Caché de metadatos de grupos (recomendado)
- Para grupos se recomienda implementar una caché mediante `cachedGroupMetadata`:

    ```ts
    const groupCache = new NodeCache({stdTTL: 5 * 60, useClones: false})

    const suki = makeWASocket({
        cachedGroupMetadata: async (jid) => groupCache.get(jid)
    })

    suki.ev.on('groups.update', async ([event]) => {
        const metadata = await suki.groupMetadata(event.id)
        groupCache.set(event.id, metadata)
    })

    suki.ev.on('group-participants.update', async (event) => {
        const metadata = await suki.groupMetadata(event.id)
        groupCache.set(event.id, metadata)
    })
    ```

<a id="improve-retry-system--decrypt-poll-votes"></a>
### Reintentos y descifrado de votos de encuestas
- Configure un almacén y la función `getMessage` para los reintentos y el descifrado de votos:
    ```ts
    const suki = makeWASocket({
        getMessage: async (key) => await getMessageFromStore(key)
    })
    ```

<a id="receive-notifications-in-whatsapp-app"></a>
### Recibir notificaciones en la aplicación de WhatsApp
- Configure `markOnlineOnConnect: false` para permitir notificaciones en la aplicación del teléfono.
    ```ts
    const suki = makeWASocket({
        markOnlineOnConnect: false
    })
    ```
<a id="saving--restoring-sessions"></a>
## Guardar y restaurar sesiones

Guarde las credenciales para no tener que escanear el QR en cada conexión.

Después puede restaurarlas y volver a iniciar sesión:
```ts
import makeWASocket, { useMultiFileAuthState } from 'kage-baileys'

const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')

// Ejemplo de uso de la API de Kage Baileys.
// so if valid credentials are available -- it'll connect without QR
const suki = makeWASocket({ auth: state })

// Ejemplo de uso de la API de Kage Baileys.
suki.ev.on('creds.update', saveCreds)
```

> [!IMPORTANT]
> `useMultiFileAuthState` guarda el estado de autenticación en una carpeta. En producción se recomienda implementar almacenamiento transaccional en una base de datos SQL o NoSQL.

> [!NOTE]
> Las claves de Signal cambian al enviar y recibir mensajes. Deben persistirse todas las actualizaciones de `authState.keys.set()`: no hacerlo puede impedir la entrega de mensajes. El almacenamiento multifichero ya realiza esta operación.

<a id="handling-events"></a>
## Gestión de eventos

- Kage utiliza la interfaz `EventEmitter` para los eventos.
Las declaraciones públicas permiten autocompletado en editores compatibles.

> [!IMPORTANT]
> Revise los eventos disponibles y procese todos los mensajes recibidos en cada lote.

Puede escuchar los eventos de la siguiente forma:
```ts
const suki = makeWASocket()
suki.ev.on('messages.upsert', ({ messages }) => {
    console.log('got messages', messages)
})
```

<a id="example-to-start"></a>
### Ejemplo inicial

> [!NOTE]
> El ejemplo también incluye almacenamiento básico de autenticación.

```ts
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from 'kage-baileys'
import { Boom } from '@hapi/boom'

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys')
    const suki = makeWASocket({
        // can provide additional config here
        auth: state,
        printQRInTerminal: true
    })
    suki.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)
            // reconnect if not logged out
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('opened connection')
        }
    })
    suki.ev.on('messages.upsert', event => {
        for (const m of event.messages) {
            console.log(JSON.stringify(m, undefined, 2))

            console.log('replying to', m.key.remoteJid)
            await suki.sendMessage(m.key.remoteJid!, { text: 'Hello Word' })
        }
    })

    // Ejemplo de uso de la API de Kage Baileys.
    suki.ev.on('creds.update', saveCreds)
}
// run in main file
connectToWhatsApp()
```

> [!IMPORTANT]
> En `messages.upsert` recorra `event.messages` mediante un bucle para procesar todos los mensajes del lote.

<a id="decrypt-poll-votes"></a>
### Descifrar votos de encuestas

- Los votos de encuestas se reciben cifrados y se gestionan en `messages.update`.
```ts
import pino from "pino"
import { makeInMemoryStore, getAggregateVotesInPollMessage } from 'kage-baileys'

const logger = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` }).child({ class: "@Itsukichann" })
logger.level = "fatal"
const store = makeInMemoryStore({ logger })

async function getMessage(key){
    if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id)
        return msg?.message
    }
    return {
        conversation: "Itsukii Kawaiii"
    }
} 

suki.ev.on("messages.update", async (chatUpdate) => {
    for(const { key, update } of chatUpdate) {
         if(update.pollUpdates && key.fromMe) {
           const pollCreation = await getMessage(key)
             if(pollCreation) {
               const pollUpdate = await getAggregateVotesInPollMessage({
                    message: pollCreation,
                    pollUpdates: update.pollUpdates,
                })
               const toCmd = pollUpdate.filter(v => v.voters.length !== 0)[0]?.name
               if (toCmd == undefined) return
               console.log(toCmd)
	        }
        }
    } 
})
```

<a id="decrypt-event-response"></a>
### Descifrar respuestas de eventos

- Las respuestas de eventos se reciben cifradas y se gestionan en `messages.update`.
```ts
import { jidNormalizedUser, getAggregateResponsesInEventMessage } from 'kage-baileys'

suki.ev.on("messages.update", async ([chatUpdate]) => {
    const eventResponses = chatUpdate.update?.eventResponses
    const agregate = getAggregateResponsesInEventMessage({ eventResponses }, jidNormalizedUser(suki.user.lid)) 
    console.log(agregate) 
})
```

<a id="summary-of-events-on-first-connection"></a>
### Eventoos durante la primera conexión

1. En la primera vinculación, `connection.update` puede solicitar reiniciar el socket.
2. Después se recibe el historial en `messaging-history.set`.

<a id="implementing-a-data-store"></a>
## Implementar un almacén de datos

- Se incluye un almacén en memoria que escucha cambios de chats, contactos y mensajes para mantener una vista actualizada de los datos.

> [!IMPORTANT]
> Para producción se recomienda un almacén propio; guardar todo el historial en memoria consume demasiada RAM.

Ejemplo de uso:

```ts
import makeWASocket, { makeInMemoryStore } from 'kage-baileys'
// Ejemplo de uso de la API de Kage Baileys.
// Ejemplo de uso de la API de Kage Baileys.
const store = makeInMemoryStore({ })
// Ejemplo de uso de la API de Kage Baileys.
store.readFromFile('./baileys_store.json')
// Ejemplo de uso de la API de Kage Baileys.
setInterval(() => {
    store.writeToFile('./baileys_store.json')
}, 10_000)

const suki = makeWASocket({ })
// Ejemplo de uso de la API de Kage Baileys.
// Ejemplo de uso de la API de Kage Baileys.
store.bind(suki.ev)

suki.ev.on('chats.upsert', () => {
    // Ejemplo de uso de la API de Kage Baileys.
    // 'chats' => a KeyedDB instance
    console.log('got chats', store.chats.all())
})

suki.ev.on('contacts.upsert', () => {
    console.log('got contacts', Object.values(store.contacts))
})

```

El almacén incluye funciones como `loadMessages` para agilizar la recuperación de datos.

<a id="whatsapp-ids-explain"></a>
## Identificadores de WhatsApp

- El identificador `jid` señala al destinatario: usuario, grupo, canal o estado.
   - Los usuarios utilizan `[código de país][número]@s.whatsapp.net`.
   - Ejemplo: `19999999999@s.whatsapp.net`, sin el signo `+`.
   - Los grupos utilizan `123456789-123345@g.us`.
   - Las diintegraciónes utilizan `[marca de tiempo]@broadcast`.
   - Los estados utilizan `status@broadcast`.

<a id="utility-functions"></a>
## Funciones auxiliares

- `getContentType`: devuelve el tipo de contenido del mensaje.
- `getDevice`: identifica el dispositivo a partir del mensaje.
- `makeCacheableSignalKeyStore`: añade caché al almacén de claves.
- `downloadContentFromMessage`: descarga el contenido multimedia.

<a id="sending-messages"></a>
## Envío de mensajes

- Una misma función permite enviar diferentes tipos de mensaje.
   - Consulte `AnyMessageContent` para los contenidos admitidos.
   - Consulte las opciones de generación para citas y opciones adicionales.

    ```ts
    const jid: string
    const content: AnyMessageContent
    const options: MiscMessageGenerationOptions

    suki.sendMessage(jid, content, options)
    ```

<a id="non-media-messages"></a>
### Mensajes sin archivos multimedia

<a id="text-message"></a>
#### Mensaje de texto
```ts
await suki.sendMessage(jid, { text: 'hello word' })
```

<a id="quote-message-works-with-all-types"></a>
#### Citar mensajes (todos los tipos)
```ts
await suki.sendMessage(jid, { text: 'hello word' }, { quoted: message })
```

<a id="mention-user-works-with-most-types"></a>
#### Mencionar usuarios (la mayoría de tipos)
- `@número` es una mención textual opcional; los destinatarios se indican mediante JID.
```ts
await suki.sendMessage(
    jid,
    {
        text: '@12345678901',
        mentions: ['12345678901@s.whatsapp.net']
    }
)
```

<a id="forward-messages"></a>
#### Reenviar mensajes
- Para reenviar se necesita el objeto completo del mensaje, recuperado del almacén o del evento recibido.
```ts
const msg = getMessageFromStore() // implement this on your end
await suki.sendMessage(jid, { forward: msg, force: true or number }) // WA forward the message!
```

<a id="location-message"></a>
#### Mensaje de ubicación
```ts
await suki.sendMessage(
    jid, 
    {
        location: {
            degreesLatitude: 24.121231,
            degreesLongitude: 55.1121221
        }
    }
)
```

<a id="live-location-message"></a>
#### Ubicación en tiempo real
```ts
await suki.sendMessage(
    jid, 
    {
        location: {
            degreesLatitude: 24.121231,
            degreesLongitude: 55.1121221
        }, 
        live: true
    }
)
```
<a id="contact-message"></a>
#### Mensaje de contacto
```ts
const vcard = 'BEGIN:VCARD\n' // metadata of the contact card
            + 'VERSION:3.0\n' 
            + 'FN:Jeff Singh\n' // full name
            + 'ORG:Ashoka Uni\n' // the organization of the contact
            + 'TELtype=CELLtype=VOICEwaid=911234567890:+91 12345 67890\n' // WhatsApp ID + phone number
            + 'END:VCARD'

await suki.sendMessage(
    id,
    { 
        contacts: { 
            displayName: 'Itsukichann', 
            contacts: [{ vcard }] 
        }
    }
)
```

<a id="reaction-message"></a>
#### Mensaje de reacción
- Proporcione la clave del mensaje, disponible en el almacén o en `message.key`.
```ts
await suki.sendMessage(
    jid,
    {
        react: {
            text: '💖', // use an empty string to remove the reaction
            key: message.key
        }
    }
)
```

<a id="pin-message"></a>
#### Fijar mensaje
- Proporcione la clave del mensaje desde el almacén o desde `message.key`.

- Duraciones disponibles:

| Tiempo  | Segundos        |
|-------|----------------|
| 24h    | 86.400        |
| 7d     | 604.800       |
| 30d    | 2.592.000     |

```ts
await suki.sendMessage(
    jid,
    {
        pin: {
            type: 1, // 2 to remove
            time: 86400,
            key: Key
        }
    }
)
```

<a id="keep-message"></a>
### Conservar mensaje
```ts
await suki.sendMessage(
    jid,
    {
        keep: {
            key: Key,
            type: 1 // or 2
        }
    }
)
```

<a id="poll-message"></a>
#### Mensaje de encuesta
```ts
await suki.sendMessage(
    jid,
    {
        poll: {
            name: 'My Poll',
            values: ['Option 1', 'Option 2', ...],
            selectableCount: 1,
            toAnnouncementGroup: false // or true
        }
    }
)
```

<a id="poll-result-message"></a>
#### Resultado de encuesta
```ts
await suki.sendMessage(
    jid, 
    {
        pollResult: {
            name: 'Hi', 
            values: [
               [
               'Option 1',
               1000
               ], 
               [
               'Option 2', 
               2000
               ]
           ]
        }
    }
)
```

<a id="call-message"></a>
### Mensaje de llamada
```ts
await suki.sendMessage(
    jid,
    {
        call: {
            name: 'Hay',
            type: 1 // 2 for video
        }
    }
)
```

<a id="event-message"></a>
### Mensaje de evento
```ts
await suki.sendMessage(
    jid,
    {
        event: {
            isCanceled: false, // or true
            name: 'holiday together!',
            description: 'who wants to come along?', 
            location: {
                degreesLatitude: 24.121231,
                degreesLongitude: 55.1121221,
                name: 'name'
            },
            call: 'audio', // or 'video'
            startTime: number, 
            endTime: number, 
            extraGuestsAllowed: true // or false
        }
    }
)
```

<a id="order-message"></a>
### Mensaje de pedido
```ts
await suki.sendMessage(
    jid,
    {
        order: {
            orderId: '574xxx',
            thumbnail: 'your_thumbnail', 
            itemCount: 'your_count',
            status: 'your_status', // INQUIRY || ACCEPTED || DECLINED
            surface: 'CATALOG',
            message: 'your_caption',
            orderTitle: "your_title",
            sellerJid: 'your_jid'',
            token: 'your_token',
            totalAmount1000: 'your_amount',
            totalCurrencyCode: 'IDR'
        }
    }
)
```

<a id="product-message"></a>
### Mensaje de producto
```ts
await suki.sendMessage(
    jid,
    {
        product: {
            productImage: {   // for using buffer >> productImage: your_buffer
              url: your_url
            },
            productId: 'your_id', 
            title: 'your_title',
            description: 'your_description', 
            currencyCode: 'IDR', 
            priceAmount1000: 'your_amount', 
            retailerId: 'your_reid', // optional use if needed
            url: 'your_url', // optional use if needed
            productImageCount: 'your_imageCount', 
            firstImageId: 'your_image', // optional use if needed
            salePriceAmount1000: 'your_priceSale', 
            signedUrl: 'your_url' // optional use if needed
        },
       businessOwnerJid: 'your_jid' 
    }
)
```

<a id="payment-message"></a>
### Mensaje de pago
```ts
await suki.sendMessage(
    jid,
    {
        payment: {
            note: 'Hi!',
            currency: 'IDR', // optional 
            offset: 0, // optional
            amount: '10000', // optional
            expiry: 0, // optional
            from: '628xxxx@s.whatsapp.net', // optional
            image: { // optional
               placeholderArgb: "your_background", // optional
               textArgb: "your_text",  // optional
               subtextArgb: "your_subtext" // optional
            }
        }
    }
)
```

<a id="payment-invite-message"></a>
#### Invitación de pago
```ts
await suki.sendMessage(
    id, 
    { 
        paymentInvite: {
            type: number, // 1 || 2 || 3
            expiry: 0 
        }   
    }
)
```

<a id="admin-invite-message"></a>
### Invitación de administrador
```ts
await suki.sendMessage(
    jid,
    {
        adminInvite: {
            jid: '123xxx@newsletter',
            name: 'newsletter_name', 
            caption: 'Please be my channel admin',
            expiration: 86400,
            jpegThumbnail: Buffer // optional
        }
    }
)
```

<a id="group-invite-message"></a>
### Invitación de grupo
```ts
await suki.sendMessage(
    jid,
    {
        groupInvite: {
            jid: '123xxx@g.us',
            name: 'group_name', 
            caption: 'Please Join My Whatsapp Group',
            code: 'code_invite',
            expiration: 86400,
            jpegThumbnail: Buffer, // optional            
        }
    }
)
```

<a id="sticker-pack-message"></a>
### Paquete de stickers
```ts 
// Ejemplo de uso de la API de Kage Baileys.
await suki.sendMessage(
    jid,
    {
        stickerPack: {
            name: 'Hiii', 
            publisher: 'By Itsukichann', 
            description: 'Hello', 
            cover: Buffer, // Image buffer
            stickers: [{
                sticker: { url: 'https://example.com/1234kjd.webp' }, 
                emojis: ['❤'], // optional
                accessibilityLabel: '', // optional
                isLottie: Boolean, // optional
                isAnimated: Boolean // optional
            }, 
            {
                sticker: Buffer, 
                emojis: ['❤'], // optional
                accessibilityLabel: '', // optional
                isLottie: Boolean, // optional
                isAnimated: Boolean // optional
            }]
        }
    }
)
```

<a id="share-phone-number-message"></a>
### Compartir número de teléfono
```ts
await suki.sendMessage(
    jid,
    {
        sharePhoneNumber: {
        }
    }
)
```

<a id="request-phone-number-message"></a>
### Solicitar número de teléfono
```ts
await suki.sendMessage(
    jid,
    {
        requestPhoneNumber: {
        }
    }
)
```

<a id="buttons-reply-message"></a>
### Respuesta a botones
```ts
// List
await suki.sendMessage(
    jid,
    {
        buttonReply: {
            name: 'Hii', 
            description: 'description', 
            rowId: 'ID'
       }, 
       type: 'list'
    }
)
// Plain
await suki.sendMessage(
    jid,
    {
        buttonReply: {
            displayText: 'Hii', 
            id: 'ID'
       }, 
       type: 'plain'
    }
)

// Template
await suki.sendMessage(
    jid,
    {
        buttonReply: {
            displayText: 'Hii', 
            id: 'ID', 
            index: 'number'
       }, 
       type: 'template'
    }
)

// Interactive
await suki.sendMessage(
    jid,
    {
        buttonReply: {
            body: 'Hii', 
            nativeFlows: {
                name: 'menu_options', 
                paramsJson: JSON.stringify({ id: 'ID', description: 'description' }) 
                version: 1 // 2 | 3
            }
       }, 
       type: 'interactive'
    }
)
```

<a id="buttons-message"></a>
### Mensaje con botones
```ts
await suki.sendMessage(
    jid,
    {
        text: 'This is a button message!',  // image: buffer or // image: { url: url } If you want to use images
        caption: 'caption', // Use this if you are using an image or video
        footer: 'Hello World!',  
        buttons: [{ 
            buttonId: 'Id1', 
            buttonText: { 
                 displayText: 'Button 1'
              }
          }, 
          { 
            buttonId: 'Id2', 
            buttonText: { 
                 displayText: 'Button 2'
              }
          }, 
          { 
            buttonId: 'Id3', 
            buttonText: { 
                 displayText: 'Button 3'
              }
         }]
    }
)
```

<a id="buttons-list-message"></a>
### Listaa de botones
```ts
// Just working in a private chat
await suki.sendMessage(
    jid,
    {
        text: 'This is a list!', 
        footer: 'Hello World!', 
        title: 'Amazing boldfaced list title', 
        buttonText: 'Required, text on the button to view the list', 
        sections: [
           {
         	title: 'Section 1',
         	rows: [{
                title: 'Option 1', 
                rowId: 'option1'
             },
 	        {
                title: 'Option 2', 
                rowId: 'option2', 
                description: 'This is a description'
           }]
       },
       {
       	title: 'Section 2',
       	rows: [{
               title: 'Option 3', 
               rowId: 'option3'
           },
	       {
               title: 'Option 4', 
               rowId: 'option4', 
               description: 'This is a description V2'
           }]
       }]
    }
)
```

<a id="buttons-product-list-message"></a>
### Listaa de productos con botones
```ts
// Just working in a private chat
await suki.sendMessage(
    jid,
    {
        text: 'This is a list!', 
        footer: 'Hello World!', 
        title: 'Amazing boldfaced list title', 
        buttonText: 'Required, text on the button to view the list', 
        productList: [{
            title: 'This is a title', 
            products: [
               {
                  productId: '1234'
               }, 
               {
                  productId: '5678'
               }
            ]
        }], 
        businessOwnerJid: '628xxx@s.whatsapp.net', 
        thumbnail: 'https://example.com/jdbenkksjs.jpg' // or buffer
    }
)
```

<a id="buttons-cards-message"></a>
### Tarjetas con botones
```ts
await suki.sendMessage(
    jid,
    {
        text: 'Body Message',
        title: 'Title Message', 
        subtile: 'Subtitle Message', 
        footer: 'Footer Message',
        cards: [
           {
              image: { url: 'https://example.com/jdbenkksjs.jpg' }, // or buffer
              title: 'Title Cards',
              body: 'Body Cards',
              footer: 'Footer Cards',
              buttons: [
                  {
                      name: 'quick_reply',
                      buttonParamsJson: JSON.stringify({
                         display_text: 'Display Button',
                         id: 'ID'
                      })
                  },
                  {
                      name: 'cta_url',
                      buttonParamsJson: JSON.stringify({
                         display_text: 'Display Button',
                         url: 'https://www.example.com'
                      })
                  }
              ]
           },
           {
              video: { url: 'https://example.com/jdbenkksjs.mp4' }, // or buffer
              title: 'Title Cards',
              body: 'Body Cards',
              footer: 'Footer Cards',
              buttons: [
                  {
                      name: 'quick_reply',
                      buttonParamsJson: JSON.stringify({
                         display_text: 'Display Button',
                         id: 'ID'
                      })
                  },
                  {
                      name: 'cta_url',
                      buttonParamsJson: JSON.stringify({
                         display_text: 'Display Button',
                         url: 'https://www.example.com'
                      })
                  }
              ]
           }
        ]
    }
)
```

<a id="buttons-template-message"></a>
### Plantilla con botones
```ts
// Ejemplo de uso de la API de Kage Baileys.
await suki.sendMessage(
    jid,
    {
       text: 'This is a template message!', 
       footer: 'Hello World!', 
       templateButtons: [{
           index: 1,
           urlButton: {
                displayText: 'Follow Me', 
                url: 'https://whatsapp.com/channel/0029Vag9VSI2ZjCocqa2lB1y'
             }, 
         }, 
         {
            index: 2,
            callButton: {
                displayText: 'Call Me!', 
                phoneNumber: '628xxx'
            }, 
        }, 
        {
           index: 3,
           quickReplyButton: {
                displayText: 'This is a reply, just like normal buttons!', 
                id: 'id-like-buttons-message'
            }, 
       }]
    }
)
```

<a id="buttons-interactive-message"></a>
### Mensaje interactivo con botones
```ts
await suki.sendMessage(
    jid,
    {
        text: 'This is an Interactive message!',
        title: 'Hiii',
        subtitle: 'There is a subtitle', 
        footer: 'Hello World!',
        interactiveButtons: [
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: 'Click Me!',
                    id: 'your_id'
                })
            },
            {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: 'Follow Me',
                    url: 'https://whatsapp.com/channel/0029Vag9VSI2ZjCocqa2lB1y',
                    merchant_url: 'https://whatsapp.com/channel/0029Vag9VSI2ZjCocqa2lB1y'
                })
            },
            {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: 'Click Me!',
                    copy_code: 'https://whatsapp.com/channel/0029Vag9VSI2ZjCocqa2lB1y'
                })
            },
            {
                name: 'cta_call',
                buttonParamsJson: JSON.stringify({
                    display_text: 'Call Me!',
                    phone_number: '628xxx'
                })
            },
            {
                name: 'cta_catalog',
                buttonParamsJson: JSON.stringify({
                    business_phone_number: '628xxx'
                })
            },
            {
                name: 'cta_reminder',
                buttonParamsJson: JSON.stringify({
                    display_text: '...'
                })
            },
            {
                name: 'cta_cancel_reminder',
                buttonParamsJson: JSON.stringify({
                    display_text: '...'
                })
            },
            {
                name: 'address_message',
                buttonParamsJson: JSON.stringify({
                    display_text: '...'
                })
            },
            {
                name: 'send_location',
                buttonParamsJson: JSON.stringify({
                    display_text: '...'
                })
            },
            {
                name: 'open_webview',
                buttonParamsJson: JSON.stringify({
                    title: 'Follow Me!',
                    link: {
                        in_app_webview: true, // or false
                        url: 'https://whatsapp.com/channel/0029Vag9VSI2ZjCocqa2lB1y'
                    }
                })
            },
            {
               name: 'mpm',
               buttonParamsJson: JSON.stringify({
                  product_id: '8816262248471474'
               })
            },
            {
               name: 'wa_payment_transaction_details',
               buttonParamsJson: JSON.stringify({
                  transaction_id: '12345848'
               })
            },
            {
               name: 'automated_greeting_message_view_catalog',
               buttonParamsJson: JSON.stringify({
                   business_phone_number: '628xxx', 
                   catalog_product_id: '12345'
               })
            },
            {
                name: 'galaxy_message', 
                buttonParamsJson: JSON.stringify({
                	mode: 'published', 
                    flow_message_version: '3', 
                    flow_token: '1:1307913409923914:293680f87029f5a13d1ec5e35e718af3',
                    flow_id: '1307913409923914',
                    flow_cta: 'Itsukichann kawaii >\\<', 
                    flow_action: 'navigate', 
                    flow_action_payload: {
                    	screen: 'QUESTION_ONE',
                        params: {
                        	user_id: '123456789', 
                            referral: 'campaign_xyz'
                        }
                    }, 
                    flow_metadata: {
                    	flow_json_version: '201', 
                        data_api_protocol: 'v2', 
                        flow_name: 'Lead Qualification [en]',
                        data_api_version: 'v2', 
                        categories: ['Lead Generation', 'Sales']
                   }
                }) 
            }, 
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: 'Click Me!',
                    sections: [
                        {
                            title: 'Title 1',
                            highlight_label: 'Highlight label 1',
                            rows: [
                                {
                                    header: 'Header 1',
                                    title: 'Title 1',
                                    description: 'Description 1',
                                    id: 'Id 1'
                                },
                                {
                                    header: 'Header 2',
                                    title: 'Title 2',
                                    description: 'Description 2',
                                    id: 'Id 2'
                                }
                            ]
                        }
                    ]
                })
            }
        ]
    }
)

// Ejemplo de uso de la API de Kage Baileys.
await suki.sendMessage(
    jid, 
    {
       image: { 
          url: 'https://example.com/jdbenkksjs.jpg' 
       },
       caption: 'Body',
       title: 'Title',
       subtitle: 'Subtitle', 
       footer: 'Footer',
       interactiveButtons: [
           {
               name: 'quick_reply',
               buttonParamsJson: JSON.stringify({
                   display_text: 'DisplayText',
                   id: 'ID1'
               })
           }
       ], 
       hasMediaAttachment: false // or true
    }
)

// Ejemplo de uso de la API de Kage Baileys.
await suki.sendMessage(
    jid, 
    {
        video: { 
          url: 'https://example.com/jdbenkksjs.mp4' 
       },
       caption: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       interactiveButtons: [
           {
               name: 'quick_reply',
               buttonParamsJson: JSON.stringify({
                   display_text: 'DisplayText',
                   id: 'ID1'
               })
           }
       ], 
       hasMediaAttachment: false // or true
    }
)

// Ejemplo de uso de la API de Kage Baileys.
await suki.sendMessage(
    jid, 
    {
        document: { 
          url: 'https://example.com/jdbenkksjs.jpg' 
       }, 
       mimetype: 'image/jpeg', 
       jpegThumbnail: await suki.resize('https://example.com/jdbenkksjs.jpg', 320, 320), 
       caption: 'Body',
       title: 'Title',
       subtitle: 'Subtitle', 
       footer: 'Footer',
       interactiveButtons: [
           {
               name: 'quick_reply',
               buttonParamsJson: JSON.stringify({
                   display_text: 'DisplayText',
                   id: 'ID1'
               })
           }
       ], 
       hasMediaAttachment: false // or true
    }
)

// Ejemplo de uso de la API de Kage Baileys.
await suki.sendMessage(
    jid, 
    {
        location: { 
          degressLatitude: -0,
          degressLongitude: 0,
          name: 'Hi'
       },
       caption: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       interactiveButtons: [
           {
               name: 'quick_reply',
               buttonParamsJson: JSON.stringify({
                   display_text: 'DisplayText',
                   id: 'ID1'
               })
           }
       ], 
       hasMediaAttachment: false // or true
    }
)

// Ejemplo de uso de la API de Kage Baileys.
await suki.sendMessage(
    jid,
    {
        product: {
            productImage: { 
               url: 'https://example.com/jdbenkksjs.jpg'
            },
            productId: '836xxx',
            title: 'Title',
            description: 'Description',
            currencyCode: 'IDR',
            priceAmount1000: '283xxx',
            retailerId: 'Itsukichann',
            url: 'https://example.com',
            productImageCount: 1
        },
        businessOwnerJid: '628xxx@s.whatsapp.net',
        caption: 'Body',
        title: 'Title', 
        subtitle: 'Subtitle', 
        footer: 'Footer',
        interactiveButtons: [
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: 'DisplayText',
                    id: 'ID1'
                })
            }
        ], 
        hasMediaAttachment: false // or true
    }
)
```

<a id="buttons-interactive-message-pix"></a>
### Mensaje interactivo PIX
```ts
await suki.sendMessage( 
    jid, 
    { 
       text: '', // This string is required. Even it's empty. 
       interactiveButtons: [ 
          { 
             name: 'payment_info', 
             buttonParamsJson: JSON.stringify({ 
                payment_settings: [{ 
                   type: "pix_static_code", 
                   pix_static_code:  { 
                      merchant_name: 'itsukichann kawaii >\\\\\\<', 
                      key: 'example@itsukichan.com', 
                      key_type: 'EMAIL' // PHONE || EMAIL || CPF || EVP 
                   } 
               }] 
            }) 
         } 
      ], 
   } 
)
 ```

<a id="buttons-interactive-message-pay"></a>
### Mensaje interactivo de pago
```ts
await suki.sendMessage( 
    jid, 
    { 
       text: '', // This string is required. Even it's empty. 
       interactiveButtons: [ 
          { 
             name: 'review_and_pay', 
             buttonParamsJson: JSON.stringify({ 
                currency: 'IDR', 
                payment_configuration: '', 
                payment_type: '', 
                total_amount: {
                    value: '999999999',
                    offset: '100'
                }, 
                reference_id: '45XXXXX',
                type: 'physical-goods',
                payment_method: 'confirm', 
                payment_status: 'captured', 
                payment_timestamp: Math.floor(Date.now() / 1000),
                order: {
                    status: 'completed', 
                    description: '', 
                    subtotal: {
                        value: '0', 
                        offset: '100'
                    }, 
                    order_type: 'PAYMENT_REQUEST', 
                    items: [{
                        retailer_id: 'your_retailer_id', 
                        name: 'Itsukichann Kawaii >\\\<', 
                        amount: {
                            value: '999999999', 
                            offset: '100'
                        }, 
                        quantity: '1', 
                    }]
                }, 
                additional_note: 'Itsukichann Kawaii >\\\<', 
                native_payment_methods: [], 
                share_payment_status: false
            }) 
         } 
      ], 
   } 
)
 ```

<a id="status-mentions-message"></a>
### Menciones en estados
```ts
const jidat = [
    '123451679@g.us', 
    '124848899@g.us', 
    '111384848@g.us', 
    '62689xxxx@s.whatsapp.net', 
    '62xxxxxxx@s.whatsapp.net'
]
// Text
await suki.sendStatusMentions(
    {
      text: 'Hello Everyone :3', 
      font: 2, // optional
      textColor: 'FF0000', // optional
      backgroundColor: '#000000' // optional
    }, 
    jids // Limit to 5 mentions per status
)

// Image
await suki.sendStatusMentions(
    {
      Image: { url: 'https://example.com/ruriooe.jpg' }, or image buffer
      caption: 'Hello Everyone :3' // optional
    }, 
    jids // Limit to 5 mentions per status
)

// Video
await suki.sendStatusMentions(
    {
      video: { url: 'https://example.com/ruriooe.mp4' }, or video buffer
      caption: 'Hello Everyone :3' // optional
    }, 
    jids // Limit to 5 mentions per status
)

// Audio
await suki.sendStatusMentions(
    {
      audio: { url: 'https://example.com/ruriooe.mp3' }, or audio buffer
      backgroundColor: '#000000', // optional 
      mimetype: 'audio/mp4', 
      ppt: true
    }, 
    jids // Limit to 5 mentions per status
)
```

<a id="shop-message"></a>
### Mensaje de tienda
```ts
await suki.sendMessage(
    jid, 
    {      
       text: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       shop: {
          surface: 1, // 2 | 3 | 4
          id: 'https://example.com'
       }, 
       viewOnce: true
    }
)

// Image
await suki.sendMessage(
    jid, 
    { 
       image: {
          url: 'https://example.com/jdbenkksjs.jpg'
       },    
       caption: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       shop: {
          surface: 1, // 2 | 3 | 4
          id: 'https://example.com'
       }, 
       hasMediaAttachment: false, // or true
       viewOnce: true
    }
)

// Video
await suki.sendMessage(
    jid, 
    { 
       video: {
          url: 'https://example.com/jdbenkksjs.jpg'
       },    
       caption: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       shop: {
          surface: 1, // 2 | 3 | 4
          id: 'https://example.com'
       }, 
       hasMediaAttachment: false, // or true
       viewOnce: true
    }
)

// Document
await suki.sendMessage(
    jid, 
    {
        document: { 
          url: 'https://example.com/jdbenkksjs.jpg' 
       }, 
       mimetype: 'image/jpeg', 
       jpegThumbnail: await suki.resize('https://example.com/jdbenkksjs.jpg', 320, 320), 
       caption: 'Body',
       title: 'Title',
       subtitle: 'Subtitle', 
       footer: 'Footer',
       shop: {
          surface: 1, // 2 | 3 | 4
          id: 'https://example.com'
       }, 
       hasMediaAttachment: false, // or true, 
       viewOnce: true
    }
)

// Location
await suki.sendMessage(
    jid, 
    { 
       location: {
         degressLatitude: -0, 
         degressLongitude: 0,
         name: 'Hi'
       },    
       caption: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       shop: {
          surface: 1, // 2 | 3 | 4
          id: 'https://example.com'
       }, 
       hasMediaAttachment: false, // or true
       viewOnce: true
    }
)

// Product
await suki.sendMessage(
    jid,
    {
        product: {
            productImage: { 
               url: 'https://example.com/jdbenkksjs.jpg'
            },
            productId: '836xxx',
            title: 'Title',
            description: 'Description',
            currencyCode: 'IDR',
            priceAmount1000: '283xxx',
            retailerId: 'Itsukichann',
            url: 'https://example.com',
            productImageCount: 1
        },
        businessOwnerJid: '628xxx@s.whatsapp.net',
        caption: 'Body',
        title: 'Title', 
        subtitle: 'Subtitle', 
        footer: 'Footer',
        shop: {
          surface: 1, // 2 | 3 | 4
          id: 'https://example.com'
       }, 
        hasMediaAttachment: false, // or true
        viewOnce: true
    }
)
```
<a id="collection-message"></a>
### Mensaje de colección
```ts
await suki.sendMessage(
    jid, 
    {      
       text: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       collection: {
          bizJid: 'jid', 
          id: 'https://example.com', 
          version: 1
       }, 
       viewOnce: true
    }
)

// Image
await suki.sendMessage(
    jid, 
    { 
       image: {
          url: 'https://example.com/jdbenkksjs.jpg'
       },    
       caption: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       collection: {
          bizJid: 'jid', 
          id: 'https://example.com', 
          version: 1
       }, 
       hasMediaAttachment: false, // or true
       viewOnce: true
    }
)

// Video
await suki.sendMessage(
    jid, 
    { 
       video: {
          url: 'https://example.com/jdbenkksjs.jpg'
       },    
       caption: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       collection: {
          bizJid: 'jid', 
          id: 'https://example.com', 
          version: 1
       }, 
       hasMediaAttachment: false, // or true
       viewOnce: true
    }
)

// Document
await suki.sendMessage(
    jid, 
    {
        document: { 
          url: 'https://example.com/jdbenkksjs.jpg' 
       }, 
       mimetype: 'image/jpeg', 
       jpegThumbnail: await suki.resize('https://example.com/jdbenkksjs.jpg', 320, 320), 
       caption: 'Body',
       title: 'Title',
       subtitle: 'Subtitle', 
       footer: 'Footer',
       collection: {
          bizJid: 'jid', 
          id: 'https://example.com', 
          version: 1
       }, 
       hasMediaAttachment: false, // or true, 
       viewOnce: true
    }
)

// Location
await suki.sendMessage(
    jid, 
    { 
       location: {
         degressLatitude: -0, 
         degressLongitude: 0,
         name: 'Hi'
       },    
       caption: 'Body',
       title: 'Title', 
       subtitle: 'Subtitle', 
       footer: 'Footer',
       collection: {
          bizJid: 'jid', 
          id: 'https://example.com', 
          version: 1
       }, 
       hasMediaAttachment: false, // or true
       viewOnce: true
    }
)

// Product
await suki.sendMessage(
    jid,
    {
        product: {
            productImage: { 
               url: 'https://example.com/jdbenkksjs.jpg'
            },
            productId: '836xxx',
            title: 'Title',
            description: 'Description',
            currencyCode: 'IDR',
            priceAmount1000: '283xxx',
            retailerId: 'Itsukichann',
            url: 'https://example.com',
            productImageCount: 1
        },
        businessOwnerJid: '628xxx@s.whatsapp.net',
        caption: 'Body',
        title: 'Title', 
        subtitle: 'Subtitle', 
        footer: 'Footer',
        collection: {
          bizJid: 'jid', 
          id: 'https://example.com', 
          version: 1
       }, 
        hasMediaAttachment: false, // or true
        viewOnce: true
    }
)
```

<a id="ai-icon-feature-"></a>
### Función de icono de IA 
```ts
await suki.sendMessage(
    jid,
    {
        text: 'Hi'
    }, {
    ai: true // Add ai usage and change it to true
    }
)

// If using relay
await suki.relayMessage(
    jid,
    {
        extendedTextMessage: {
            text: 'Hi'
        }
    }, {
    AI: true // Use capital letters
    }
)
```

<a id="sending-messages-with-link-previews"></a>
### Mensajes con vista previa de enlaces

1. WhatsApp Web no siempre genera la vista previa al enviar un enlace.
2. Kage permite generar los datos de la vista previa.
3. Puede utilizarse la dependencia `unfurl.js` para obtener los metadatos del enlace.
4. Envíe el enlace:
```ts
await suki.sendMessage(
    jid,
    {
        text: 'Hi, this was sent using https://github.com/whiskeysockets/baileys'
    }
)
```

<a id="media-messages"></a>
### Mensajes multimedia

Los archivos multimedia se procesan mediante flujos para reducir el consumo de memoria.

> [!NOTE]
> Se admite un `Buffer`, `{ stream: Stream }` o `{ url: Url }` como origen multimedia.

- Cuando se utiliza una URL, el contenido puede descargarse y cifrarse como flujo sin cargarlo entero en memoria.

> [!TIP]
> Para ahorrar memoria se recomienda utilizar un flujo o una URL.

<a id="gif-message"></a>
#### Mensaje GIF
- Los GIF se envían como vídeos `.mp4` con `gifPlayback`, porque WhatsApp no acepta el archivo `.gif` como vídeo.
```ts
await suki.sendMessage(
    jid, 
    { 
        video: fs.readFileSync('Media/ma_gif.mp4'),
        caption: 'hello word',
        gifPlayback: true
    }
)
```

<a id="video-message"></a>
#### Mensaje de vídeo
```ts
await suki.sendMessage(
    id, 
    { 
        video: {
            url: './Media/ma_gif.mp4'
        },
        caption: 'hello word',	    
    }
)
```

<a id="video-ptv-message"></a>
#### Vídeomensaje circular
```ts
await suki.sendMessage(
    id, 
    { 
        video: {
            url: './Media/ma_gif.mp4'
        },
        ptv: true	    
    }
)
```

<a id="audio-message"></a>
#### Mensaje de audio
- Para mejorar la compatibilidad de audio, conviértalo mediante FFmpeg con parámetros adecuados:
    ```bash
        codec: libopus //ogg file
        ac: 1 //one channel
        avoid_negative_ts
        make_zero
    ```
   - Ejemplo:
    ```bash
    ffmpeg -i input.mp4 -avoid_negative_ts make_zero -ac 1 output.ogg
    ```
```ts
await suki.sendMessage(
    jid, 
    {
        audio: {
            url: './Media/audio.mp3'
        },
        mimetype: 'audio/mp4'
    }
)
```

<a id="image-message"></a>
#### Mensaje de imagen
```ts
await suki.sendMessage(
    id, 
    { 
        image: {
            url: './Media/ma_img.png'
        },
        caption: 'hello word'
    }
)
```

<a id="album-message"></a>
### Mensaje de álbum
```ts
await suki.sendMessage(
    id, 
    { 
        album: [{
        	image: {
        		url: 'https://example.com/itsukichan.jpg'
        	}, 
        	caption: 'Hay'
        }, {
        	image: Buffer, 
        	caption: 'Hay'
        }, {
        	video: {
        		url: 'https://example.com/itsukichan.mp4'
        	}, 
        	caption: 'Hay'
        }, {
        	video: Buffer, 
        	caption: 'Hay'
        }
    }
)
```

<a id="view-once-message"></a>
#### Mensaje de visualización única

- Añada `viewOnce: true` al contenido para envolver el mensaje como visualización única.

```ts
await suki.sendMessage(
    id, 
    { 
        image: {
            url: './Media/ma_img.png'
        },
        viewOnce: true, //works with video, audio too
        caption: 'hello word'
    }
)
```

<a id="modify-messages"></a>
## Modificar mensajes

<a id="deleting-messages-for-everyone"></a>
### Eliminar mensajes para todos

```ts
const msg = await suki.sendMessage(jid, { text: 'hello word' })
await suki.sendMessage(jid, { delete: msg.key })
```

**Nota:** para eliminar solo para uno mismo utilice `chatModify`.

<a id="editing-messages"></a>
### Editar mensajes

- Pueden utilizarse contenidos que WhatsApp permita editar.
```ts
await suki.sendMessage(jid, {
      text: 'updated text goes here',
      edit: response.key,
    })
```

<a id="manipulating-media-messages"></a>
## Procesar mensajes multimedia

<a id="thumbnail-in-media-messages"></a>
### Miniaturas multimedia
- Para generar miniaturas de imágenes y stickers se necesita un motor compatible, como `jimp` o `sharp`.
- Las miniaturas de vídeo requieren FFmpeg instalado en el sistema.

<a id="downloading-media-messages"></a>
### Descargar archivos multimedia

Para guardar archivos multimedia recibidos:
```ts
import { createWriteStream } from 'fs'
import { downloadMediaMessage, getContentType } from 'kage-baileys'

suki.ev.on('messages.upsert', async ({ [m] }) => {
    if (!m.message) return // if there is no text or media message
    const messageType = getContentType(m) // get what type of message it is (text, image, video...)

    // Ejemplo de uso de la API de Kage Baileys.
    if (messageType === 'imageMessage') {
        // Ejemplo de uso de la API de Kage Baileys.
        const stream = await downloadMediaMessage(
            m,
            'stream', // can be 'buffer' too
            { },
            { 
                logger,
                // Ejemplo de uso de la API de Kage Baileys.
                // that has been deleted
                reuploadRequest: suki.updateMediaMessage
            }
        )
        // Ejemplo de uso de la API de Kage Baileys.
        const writeStream = createWriteStream('./my-download.jpeg')
        stream.pipe(writeStream)
    }
}
```

<a id="re-upload-media-message-to-whatsapp"></a>
### Volver a subir archivos a WhatsApp

- WhatsApp puede retirar archivos antiguos de sus servidores. Otro dispositivo que conserve el archivo debe volver a subirlo para que pueda descargarse:
```ts
await suki.updateMediaMessage(msg)
```

<a id="reject-call"></a>
## Rechazar llamada

- El evento `call` proporciona `callId` y `callFrom`.

```ts
await suki.rejectCall(callId, callFrom)
```

<a id="send-states-in-chat"></a>
## Enviar estados del chat

<a id="reading-messages"></a>
### Marcar mensajes como leídos
- Marque explícitamente como leídas las claves de los mensajes correspondientes.
- No se puede sustituir esta operación por una marca de lectura global sin las claves necesarias.
Mantenga un registro de los mensajes pendientes de lectura.

```ts
const key: WAMessageKey
// Ejemplo de uso de la API de Kage Baileys.
await suki.readMessages([key])
```

El identificador de mensaje señala de forma única el mensaje que se marca como leído.
En `WAMessage`, el identificador está disponible en `message.key.id`.

<a id="update-presence"></a>
### Actualizar presencia

- El campo `presence` utiliza los valores admitidos por la API de presencia.
- La presencia caduca aproximadamente a los diez segundos.
- Permite informar si el usuario está conectado, desconectado o escribiendo.

```ts
await suki.sendPresenceUpdate('available', jid) 
```

> [!NOTE]
> Para recibir notificaciones en el teléfono, marque el cliente como no disponible mediante `sendPresenceUpdate('unavailable')`.

<a id="modifying-chats"></a>
## Modificar chats

WhatsApp transmite las modificaciones de chats y de la aplicación mediante parches cifrados. Los ejemplos siguientes muestran operaciones compatibles.

> [!IMPORTANT]
> Una actualización inválida puede provocar el cierre de las sesiones. Haga una copia de seguridad y valide los datos.

<a id="archive-a-chat"></a>
### Archivar chat
```ts
const lastMsgInChat = await getLastMessageInChat(jid) // implement this on your end
await suki.chatModify({ archive: true, lastMessages: [lastMsgInChat] }, jid)
```
<a id="muteunmute-a-chat"></a>
### Silenciar o activar un chat

- Duraciones admitidas:

| Tiempo  | Milisegundos     |
|-------|-----------------|
| Desactivar | null           |
| 8h     | 86.400.000     |
| 7d     | 604.800.000    |

```ts
// Ejemplo de uso de la API de Kage Baileys.
await suki.chatModify({ mute: 8 * 60 * 60 * 1000 }, jid)
// unmute
await suki.chatModify({ mute: null }, jid)
```
<a id="mark-a-chat-readunread"></a>
### Marcar chat como leído o no leído
```ts
const lastMsgInChat = await getLastMessageInChat(jid) // implement this on your end
// mark it unread
await suki.chatModify({ markRead: false, lastMessages: [lastMsgInChat] }, jid)
```

<a id="delete-a-message-for-me"></a>
### Eliminar un mensaje para mí
```ts
await suki.chatModify(
    {
        clear: {
            messages: [
                {
                    id: 'ATWYHDNNWU81732J',
                    fromMe: true, 
                    timestamp: '1654823909'
                }
            ]
        }
    }, 
    jid
)

```
<a id="delete-a-chat"></a>
### Eliminar un chat
```ts
const lastMsgInChat = await getLastMessageInChat(jid) // implement this on your end
await suki.chatModify({
        delete: true,
        lastMessages: [
            {
                key: lastMsgInChat.key,
                messageTimestamp: lastMsgInChat.messageTimestamp
            }
        ]
    },
    jid
)
```
<a id="pinunpin-a-chat"></a>
### Fijar o desfijar chat
```ts
await suki.chatModify({
        pin: true // or `false` to unpin
    },
    jid
)
```
<a id="starunstar-a-message"></a>
### Destacar o quitar destacado
```ts
await suki.chatModify({
        star: {
            messages: [
                {
                    id: 'messageID',
                    fromMe: true // or `false`
                }
            ],
            star: true // - true: Star Message false: Unstar Message
        }
    },
    jid
)
```

<a id="disappearing-messages"></a>
### Mensajes temporales

- Duraciones de mensajes temporales:

| Tiempo  | Segundos        |
|-------|----------------|
| Desactivar | 0          |
| 24h    | 86.400     |
| 7d     | 604.800    |
| 90d    | 7.776.000  |

- Indique la duración en segundos; la opción predeterminada habitual es siete días.

```ts
// turn on disappearing messages
await suki.sendMessage(
    jid, 
    // Ejemplo de uso de la API de Kage Baileys.
    { disappearingMessagesInChat: WA_DEFAULT_EPHEMERAL }
)

// Ejemplo de uso de la API de Kage Baileys.
await suki.sendMessage(jid, { text: 'hello' }, { ephemeralExpiration: WA_DEFAULT_EPHEMERAL })

// turn off disappearing messages
await suki.sendMessage(
    jid, 
    { disappearingMessagesInChat: false }
)
```

<a id="clear-messages"></a>
### Vaciar mensajes
```ts
await suki.clearMessage(jid, key, timestamps) 
```

<a id="user-querys"></a>
## Consultas de usuarios

<a id="check-if-id-exists-in-whatsapp"></a>
### Comprobar si un identificador existe en WhatsApp
```ts
const [result] = await suki.onWhatsApp(jid)
if (result.exists) console.log (`${jid} exists on WhatsApp, as jid: ${result.jid}`)
```

<a id="query-chat-history-groups-too"></a>
### Consultar historial de chats y grupos

- Se necesita el mensaje más antiguo disponible en el chat.
```ts
const msg = await getOldestMessageInChat(jid)
await suki.fetchMessageHistory(
    50, //quantity (max: 50 per query)
    msg.key,
    msg.messageTimestamp
)
```
- Los mensajes se reciben mediante el evento `messaging-history.set`.

<a id="fetch-status"></a>
### Consultar estado
```ts
const status = await suki.fetchStatus(jid)
console.log('status: ' + status)
```

<a id="fetch-profile-picture"></a>
### Consultar foto de perfil
- Permite consultar la foto de una persona, grupo o canal.
```ts
// Ejemplo de uso de la API de Kage Baileys.
const ppUrl = await suki.profilePictureUrl(jid)
console.log(ppUrl)
```

<a id="fetch-bussines-profile-such-as-description-or-category"></a>
### Consultar perfil empresarial, descripción y categoría
```ts
const profile = await suki.getBusinessProfile(jid)
console.log('business description: ' + profile.description + ', category: ' + profile.category)
```

<a id="fetch-someones-presence-if-theyre-typing-or-online"></a>
### Consultar presencia y escritura
```ts
// Ejemplo de uso de la API de Kage Baileys.
suki.ev.on('presence.update', console.log)

// Ejemplo de uso de la API de Kage Baileys.
await suki.presenceSubscribe(jid) 
```

<a id="change-profile"></a>
## Cambiar perfil

<a id="change-profile-status"></a>
### Cambiar estado del perfil
```ts
await suki.updateProfileStatus('Hello World!')
```
<a id="change-profile-name"></a>
### Cambiar nombre del perfil
```ts
await suki.updateProfileName('My name')
```
<a id="change-display-picture-groups-too"></a>
### Cambiar foto de usuarios y grupos
- Permite cambiar la foto propia o la de un grupo con permisos suficientes.

> [!NOTE]
> Al igual que otros archivos multimedia, acepta `Buffer`, flujo o URL.

```ts
await suki.updateProfilePicture(jid, { url: './new-profile-picture.jpeg' })
```
<a id="remove-display-picture-groups-too"></a>
### Eliminar foto de usuarios y grupos
```ts
await suki.removeProfilePicture(jid)
```

<a id="groups"></a>
## Grupos

- Para modificar propiedades del grupo se necesitan permisos de administrador.

<a id="create-a-group"></a>
### Crear grupo
```ts
// title & participants
const group = await suki.groupCreate('My Fab Group', ['1234@s.whatsapp.net', '4564@s.whatsapp.net'])
console.log('created group with id: ' + group.gid)
await suki.sendMessage(group.id, { text: 'hello there' }) // say hello to everyone on the group
```
<a id="addremove-or-demotepromote"></a>
### Añadir, eliminar, ascender o descender participantes
```ts
// Ejemplo de uso de la API de Kage Baileys.
await suki.groupParticipantsUpdate(
    jid, 
    ['abcd@s.whatsapp.net', 'efgh@s.whatsapp.net'],
    'add' // replace this parameter with 'remove' or 'demote' or 'promote'
)
```
<a id="change-subject-name"></a>
### Cambiar nombre
```ts
await suki.groupUpdateSubject(jid, 'New Subject!')
```
<a id="change-description"></a>
### Cambiar descripción
```ts
await suki.groupUpdateDescription(jid, 'New Description!')
```
<a id="change-settings"></a>
### Cambiar configuración
```ts
// Ejemplo de uso de la API de Kage Baileys.
await suki.groupSettingUpdate(jid, 'announcement')
// Ejemplo de uso de la API de Kage Baileys.
await suki.groupSettingUpdate(jid, 'not_announcement')
// Ejemplo de uso de la API de Kage Baileys.
await suki.groupSettingUpdate(jid, 'unlocked')
// Ejemplo de uso de la API de Kage Baileys.
await suki.groupSettingUpdate(jid, 'locked')
```
<a id="leave-a-group"></a>
### Salir de un grupo
```ts
// will throw error if it fails
await suki.groupLeave(jid)
```
<a id="get-invite-code"></a>
### Obtener código de invitación
- Construya el enlace de invitación con `'https://chat.whatsapp.com/' + code`.
```ts
const code = await suki.groupInviteCode(jid)
console.log('group code: ' + code)
```
<a id="revoke-invite-code"></a>
### Revocar código de invitación
```ts
const code = await suki.groupRevokeInvite(jid)
console.log('New group code: ' + code)
```
<a id="join-using-invitation-code"></a>
### Unirse mediante código de invitación
- Indique solo el código, sin el prefijo `https://chat.whatsapp.com/`.
```ts
const response = await suki.groupAcceptInvite(code)
console.log('joined to: ' + response)
```
<a id="get-group-info-by-invite-code"></a>
### Consultar grupo mediante invitación
```ts
const response = await suki.groupGetInviteInfo(code)
console.log('group information: ' + response)
```
<a id="query-metadata-participants-name-description"></a>
### Consultar participantes, nombre y descripción
```ts
const metadata = await suki.groupMetadata(jid) 
console.log(metadata.id + ', title: ' + metadata.subject + ', description: ' + metadata.desc)
```
### Join using `groupInviteMessage`
```ts
const response = await suki.groupAcceptInviteV4(jid, groupInviteMessage)
console.log('joined to: ' + response)
```
<a id="get-request-join-list"></a>
### Obtener solicitudes de ingreso
```ts
const response = await suki.groupRequestParticipantsList(jid)
console.log(response)
```
<a id="approvereject-request-join"></a>
### Aprobar o rechazar solicitudes de ingreso
```ts
const response = await suki.groupRequestParticipantsUpdate(
    jid, // group id
    ['abcd@s.whatsapp.net', 'efgh@s.whatsapp.net'],
    'approve' // or 'reject' 
)
console.log(response)
```
<a id="get-all-participating-groups-metadata"></a>
### Consultar todos los grupos
```ts
const response = await suki.groupFetchAllParticipating()
console.log(response)
```
<a id="toggle-ephemeral"></a>
### Configurar mensajes temporales

- Duraciones de mensajes temporales:

| Tiempo  | Segundos        |
|-------|----------------|
| Desactivar | 0          |
| 24h    | 86.400     |
| 7d     | 604.800    |
| 90d    | 7.776.000  |

```ts
await suki.groupToggleEphemeral(jid, 86400)
```

<a id="change-add-mode"></a>
### Cambiar modo de incorporación
```ts
await suki.groupMemberAddMode(
    jid,
    'all_member_add' // or 'admin_add'
)
```

<a id="privacy"></a>
## Privacidad

<a id="blockunblock-user"></a>
### Bloquear o desbloquear usuario
```ts
await suki.updateBlockStatus(jid, 'block') // Block user
await suki.updateBlockStatus(jid, 'unblock') // Unblock user
```
<a id="get-privacy-settings"></a>
### Consultar privacidad
```ts
const privacySettings = await suki.fetchPrivacySettings(true)
console.log('privacy settings: ' + privacySettings)
```
<a id="get-blocklist"></a>
### Consultar bloqueados
```ts
const response = await suki.fetchBlocklist()
console.log(response)
```
<a id="update-lastseen-privacy"></a>
### Privacidad de última conexión
```ts
const value = 'all' // 'contacts' | 'contact_blacklist' | 'none'
await suki.updateLastSeenPrivacy(value)
```
<a id="update-online-privacy"></a>
### Privacidad de conexión
```ts
const value = 'all' // 'match_last_seen'
await suki.updateOnlinePrivacy(value)
```
<a id="update-profile-picture-privacy"></a>
### Privacidad de foto de perfil
```ts
const value = 'all' // 'contacts' | 'contact_blacklist' | 'none'
await suki.updateProfilePicturePrivacy(value)
```
<a id="update-status-privacy"></a>
### Privacidad de estados
```ts
const value = 'all' // 'contacts' | 'contact_blacklist' | 'none'
await suki.updateStatusPrivacy(value)
```
<a id="update-read-receipts-privacy"></a>
### Privacidad de confirmaciones de lectura
```ts
const value = 'all' // 'none'
await suki.updateReadReceiptsPrivacy(value)
```
<a id="update-groups-add-privacy"></a>
### Privacidad de invitaciones a grupos
```ts
const value = 'all' // 'contacts' | 'contact_blacklist'
await suki.updateGroupsAddPrivacy(value)
```
<a id="update-default-disappearing-mode"></a>
### Duración predeterminada de mensajes temporales

- Utilice las mismas duraciones de mensajes temporales:

| Tiempo  | Segundos        |
|-------|----------------|
| Desactivar | 0          |
| 24h    | 86.400     |
| 7d     | 604.800    |
| 90d    | 7.776.000  |

```ts
const ephemeral = 86400 
await suki.updateDefaultDisappearingMode(ephemeral)
```

<a id="broadcast-lists--stories"></a>
## Listaas de diintegración y estados

<a id="send-broadcast--stories"></a>
### Enviar diintegraciónes y estados
- Para enviar diintegraciónes o estados añada las opciones correspondientes a `sendMessage`:
```ts
await suki.sendMessage(
    jid,
    {
        image: {
            url: url
        },
        caption: caption
    },
    {
        backgroundColor: backgroundColor,
        font: font,
        statusJidList: statusJidList,
        broadcast: true
    }
)
```
- El contenido puede ser texto extendido, imagen, vídeo o mensaje de voz.
- Las opciones de generación admiten `backgroundColor` y otras propiedades.
- `broadcast: true` activa el envío de diintegración.
- `statusJidList` contiene los JID de los destinatarios del estado.

- Las listas de diintegración permiten enviar contenido de forma similar a chats y grupos.
- WhatsApp Web no permite crear nuevas listas de diintegración en todos los casos; sí pueden eliminarse listas existentes.
- Los identificadores de diintegración tienen el formato `12345678@broadcast`.
<a id="query-a-broadcast-lists-recipients--name"></a>
### Consultar nombre y destinatarios de diintegración
```ts
const bList = await suki.getBroadcastListInfo('1234@broadcast')
console.log (`list name: ${bList.name}, recps: ${bList.recipients}`)
```

<a id="writing-custom-functionality"></a>
## Crear funciones personalizadas
Kage permite ampliar las funciones mediante extensiones del socket sin reescribir el transporte.

<a id="enabling-debug-level-in-baileys-logs"></a>
### Activar registros de depuración
Active el nivel de depuración para registrar los mensajes del protocolo:
```ts
const suki = makeWASocket({
    logger: P({ level: 'debug' }),
})
```
La consola mostrará los mensajes de comunicación recibidos desde WhatsApp.

<a id="how-whatsapp-communicate-with-us"></a>
### Cómo se comunica WhatsApp

> [!TIP]
> Para estudiar el protocolo se recomienda conocer Signal y Noise.

- **Ejemplo:** con la depuración activada pueden observarse los mensajes de información del dispositivo.
    ```
    {
        "level": 10,
        "fromMe": false,
        "frame": {
            "tag": "ib",
            "attrs": {
                "from": "@s.whatsapp.net"
            },
            "content": [
                {
                    "tag": "edge_routing",
                    "attrs": {},
                    "content": [
                        {
                            "tag": "routing_info",
                            "attrs": {},
                            "content": {
                                "type": "Buffer",
                                "data": [8,2,8,5]
                            }
                        }
                    ]
                }
            ]
        },
        "msg":"communication"
    }
    ``` 

Una trama recibida tiene tres componentes principales:
- `tag`: indica el tipo de nodo; por ejemplo, `message`.
- `attrs`: atributos de texto con metadatos, como el identificador del mensaje.
- `content`: datos o nodos hijos que transportan el contenido.
- Consulte los codificadores y decodificadores en `lib/WABinary/`.

<a id="register-a-callback-for-websocket-events"></a>
### Registrar manejadores de eventos WebSocket

> [!TIP]
> Consulte el manejador `onMessageReceived` del socket para conocer los eventos WebSocket.

```ts
// Ejemplo de uso de la API de Kage Baileys.
suki.ws.on('CB:edge_routing', (node: BinaryNode) => { })

// Ejemplo de uso de la API de Kage Baileys.
suki.ws.on('CB:edge_routing,id:abcd', (node: BinaryNode) => { })

// Ejemplo de uso de la API de Kage Baileys.
suki.ws.on('CB:edge_routing,id:abcd,routing_info', (node: BinaryNode) => { })
```

> [!NOTE]
> Las licencias de las dependencias deben revisarse antes de redistribuir. Los avisos incluidos se conservan en `licenses/`.


---

## Guía ampliada de mensajes y administración

<a id="-highlights"></a>
### ✨ Características destacadas

Kage Baileys incorpora herramientas orientadas a la claridad y la seguridad.

- 🚫 Código sin ofuscación, fácil de leer y auditar.
- 🚫 No se siguen canales automáticamente.

> [!IMPORTANT]
> Los avisos de autoría y las licencias de los componentes se conservan en `licenses/`.
>
>
>
> **La redistribución debe respetar los avisos de autoría y las condiciones de licencia.**
>
> Gracias. 🤍

> [!NOTE]
> 📄 Las funciones dependen de la compatibilidad del cliente y del servidor de WhatsApp.
>
>

<a id="-internal-adjustments"></a>
### 🛠️ Ajustes internos
- 🖼️ Ajustes para subir archivos multimedia a canales.
- 📁 Almacén en memoria mediante `makeInMemoryStore`, con compatibilidad de importación ESM y CommonJS.
- 📦 Ejecución de FFmpeg mediante procesos separados, sin construir comandos de shell.
- 🗃️ Procesamiento de imágenes mediante los motores opcionales disponibles: `sharp`, `@napi-rs/image` o `jimp`.

<a id="-messages-handling--compatibility"></a>
### 📨 Gestión y compatibilidad de mensajes
- 📩 Tipos de mensaje adicionales:
   - 🖼️ [Mensaje de álbum](#%EF%B8%8F-album-image--video)
   - 👤 [Mensaje de estado de grupo](#%E2%80%8D%E2%80%8D-group-status)
   - 👉🏻 Mensajes interactivos: botones, listas, flujos nativos, plantillas y carruseles.
   - 🎞️ [Mensaje de mención en estados](#%EF%B8%8F-status-mention)
   - 📦 [Paquete de stickers](#-sticker-pack)
   - ✨ [Mensaje de respuesta enriquecida](#-rich-response) **[NUEVO]**
   - 🧾 [Mensaje con bloque de código](#-message-with-code-block) **[NUEVO]**
   - [🌏 Mensaje con entidades en línea](#-message-with-inline-entities) **[NUEVO]**
   - 📋 [Mensaje con tabla](#-message-with-table) **[NUEVO]**
   - 💳 Mensajes de pago: solicitudes, invitaciones, pedidos y facturas experimentales.
- 📰 Miniaturas publicitarias mediante `externalAdReply`, sin construir manualmente `contextInfo`.
- 💭 Citas de mensajes dentro de canales.
- 🎀 Iconos personalizados para botones.

<a id="-additional-message-options"></a>
### 🧩 Opciones adicionales de mensajes
- 👁️ Opciones para controlar la construcción del mensaje:
   - 🤖 `ai`: icono de inteligencia artificial.
   - 📣 `mentionAll`: menciona a los participantes del grupo sin proporcionar cada JID manualmente.
   - 🔧 `ephemeral`, `groupStatus`, `isLottie`, `spoiler`, `viewOnce`, `viewOnceV2`, `viewOnceV2Extension` e `interactiveAsTemplate`: envoltorios de mensaje.
   - 🔒 `secureMetaServiceLabel`: etiqueta de servicio seguro de Meta.
   - 📄 `raw`: construcción manual del contenido; no debe utilizarse para explotar vulnerabilidades.

<a id="-installation"></a>
### 📥 Instalación

- 📄 Desde `package.json`

```json
# NPM
"dependencies": {
   "kage-baileys": "latest"
}

# GitHub
"dependencies": {
   "kage-baileys": "github:xrljosedv/kage-baileys"
}
```

- ⌨️ Desde la terminal

```bash
# NPM
npm i kage-baileys@latest

# GitHub
npm i github:xrljosedv/kage-baileys
```

<a id="-import-esm--cjs"></a>
#### 🧩 Importación (ESM y CJS)

```javascript
// --- ESM
import { makeWASocket } from 'kage-baileys'

// --- CJS (tested and working on Node.js 24 ✅)
const { makeWASocket } = require('kage-baileys')
```

<a id="-connect-to-whatsapp-quick-step"></a>
### 🌐 Conexión rápida con WhatsApp

```javascript
import { makeWASocket, delay, DisconnectReason, useMultiFileAuthState } from 'kage-baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'

// Ejemplo de uso de la API de Kage Baileys.
const myPhoneNumber = '6288888888888'

const logger = pino({ level: 'silent' })

const connectToWhatsApp = async () => {
   const { state, saveCreds } = await useMultiFileAuthState('session')
    
   const sock = makeWASocket({
      logger,
      auth: state
   })

   sock.ev.on('creds.update', saveCreds)

   sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update
      if (connection === 'connecting' && !sock.authState.creds.registered) {
         await delay(1500)
         const code = await sock.requestPairingCode(myPhoneNumber)
         console.log('🔗 Pairing code', ':', code)
      }
      else if (connection === 'close') {
         const shouldReconnect = new Boom(connection?.lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
         console.log('⚠️ Connection closed because', lastDisconnect.error, ', reconnecting ', shouldReconnect)
         if (shouldReconnect) {
            connectToWhatsApp()
         }
      }
      else if (connection === 'open') {
         console.log('✅ Successfully connected to WhatsApp')
      }
   })

   sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages) {
         if (!message.message) continue

         console.log('🔔 Got new message', ':', message)
         await sock.sendMessage(message.key.remoteJid, {
            text: '👋🏻 Hello world'
         })
      }
   })
}

connectToWhatsApp()
```

<a id="-auth-state"></a>
#### 🔐 Estado de autenticación

> [!NOTE]
> Como alternativas experimentales a `useMultiFileAuthState` se incluyen `useSingleFileAuthState` y `useSqliteAuthState`. El primero incorpora caché interna: no es necesario envolver `state.keys` con `makeCacheableSignalKeyStore`.

<a id="-implementing-data-store"></a>
### 🗄️ Almacenamiento de datos

> [!CAUTION]
> Para producción se recomienda un almacén propio; conservar todo el historial en memoria puede consumir demasiada RAM.

```javascript
import { makeWASocket, makeInMemoryStore, delay, DisconnectReason, useMultiFileAuthState } from 'kage-baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'

const myPhoneNumber = '6288888888888'

// Ejemplo de uso de la API de Kage Baileys.
const storePath = './store.json'

const logger = pino({ level: 'silent' })

const connectToWhatsApp = async () => {
   const { state, saveCreds } = await useMultiFileAuthState('session')
    
   const sock = makeWASocket({
      logger,
      auth: state
   })

   const store = makeInMemoryStore({
      logger,
      socket: sock
   })

   store.bind(sock.ev)

   sock.ev.on('creds.update', saveCreds)

   sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update
      if (connection === 'connecting' && !sock.authState.creds.registered) {
         await delay(1500)
         const code = await sock.requestPairingCode(myPhoneNumber)
         console.log('🔗 Pairing code', ':', code)
      }
      else if (connection === 'close') {
         const shouldReconnect = new Boom(connection?.lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
         console.log('⚠️ Connection closed because', lastDisconnect.error, ', reconnecting ', shouldReconnect)
         if (shouldReconnect) {
            connectToWhatsApp()
         }
      }
      else if (connection === 'open') {
         console.log('✅ Successfully connected to WhatsApp')
      }
   })

   sock.ev.on('chats.upsert', () => {
      console.log('✉️ Got chats', store.chats.all())
   })

   sock.ev.on('contacts.upsert', () => {
      console.log('👥 Got contacts', Object.values(store.contacts))
   })

   // Ejemplo de uso de la API de Kage Baileys.
   store.readFromFile(storePath)

   // Ejemplo de uso de la API de Kage Baileys.
   setInterval(() => {
      store.writeToFile(storePath)
   }, 180000)
}

connectToWhatsApp()
```

<a id="-whatsapp-ids-explain"></a>
### 🪪 Identificadores de WhatsApp

`id`, `jid` y `lid` identifican al usuario, grupo o destino del mensaje.
- Para números de teléfono: `[código de país][número]@s.whatsapp.net`.
   - Ejemplos: `19999999999@s.whatsapp.net` y `12699999999@lid`.
   - Los grupos utilizan identificadores como `123456789-123345@g.us`.
- Meta AI utiliza identificadores con dominio `@bot`.
- Las listas de diintegración utilizan `[marca de tiempo]@broadcast`.
- Los estados utilizan `status@broadcast`.

<a id="-sending-messages"></a>
### ✉️ Envío de mensajes

> [!NOTE]
> El JID de la conversación está disponible en `message.key.remoteJid`.

<a id="-text"></a>
#### 🔠 Texto

```javascript
// Ejemplo de uso de la API de Kage Baileys.
sock.sendMessage(jid, {
   text: '👋🏻 Hello'
}, {
   quoted: message
})

// Ejemplo de uso de la API de Kage Baileys.
const urlA = 'https://www.npmjs.com/package/kage-baileys'

sock.sendMessage(jid, {
   text: urlA + ' 👆🏻 Check it out!',
   linkPreview: {
      'matched-text': urlA,
      title: '🌱 kage-baileys',
      description: 'Underrated Baileys Fork',
      previewType: 0, // --- Use 1 for video playback in the link preview
      jpegThumbnail: fs.readFileSync('./path/to/image.jpg')
   }
})

// Ejemplo de uso de la API de Kage Baileys.
import { prepareWAMessageMedia } from 'kage-baileys'

const urlB = 'https://www.npmjs.com/package/kage-baileys#readme'

const { imageMessage: image } = await prepareWAMessageMedia({
   image: {
      url: './path/to/image.jpg'
   }
}, {
   upload: sock.waUploadToServer,
   mediaTypeOverride: 'thumbnail-link'
})

// Ejemplo de uso de la API de Kage Baileys.
image.height = 720
image.width = 480

sock.sendMessage(jid, {
   text: urlB + ' 👆🏻 Check it out!',
   linkPreview: {
      'matched-text': urlB,
      title: '🌱 kage-baileys',
      description: 'Underrated Baileys Fork',
      previewType: 0,
      jpegThumbnail: fs.readFileSync('./path/to/image.jpg'),
      highQualityThumbnail: image,
      linkPreviewMetadata: {
         linkMediaDuration: 0, // --- Duration in seconds (for video/audio content)
         socialMediaPostType: 1, // --- Enum: 0 = NONE, 1 = REEL, 2 = LIVE_VIDEO, 3 = LONG_VIDEO, 4 = SINGLE_IMAGE, 5 = CAROUSEL
      } // --- Additional metadata for large link preview
   },
   favicon: {
      url: './path/to/tiny-image.ico'
   }
})
```

<a id="-mention"></a>
#### 🔔 Mención

```javascript
// --- Regular mention
sock.sendMessage(jid, {
   text: '👋🏻 Hello @628123456789',
   mentions: ['628123456789@s.whatsapp.net']
}, {
   quoted: message
})

// --- Mention all
sock.sendMessage(jid, {
   text: '👋🏻 Hello @all',
   mentionAll: true
}, {
   quoted: message
})
```

<a id="-reaction"></a>
#### 😁 Reacción

```javascript
sock.sendMessage(jid, {
   react: {
      key: message.key,
      text: '✨'
   }
})
```

<a id="-pin-message"></a>
#### 📌 Fijar mensaje

```javascript
sock.sendMessage(jid, {
   pin: message.key,
   time: 86400, // --- Set the value in seconds: 86400 (1d), 604800 (7d), or 2592000 (30d)
   type: 1 // --- Or 2 to remove
})
```

<a id="-keep-chat"></a>
#### 🔖 Conservar mensaje

> [!NOTE]
> Conservar mensajes solo está disponible en chats o grupos que tengan activados los mensajes temporales.

```javascript
sock.sendMessage(jid, {
   keep: message.key,
   type: 1 // --- Or 2 to remove
})
```

<a id="-forward-message"></a>
#### ➡️ Reenviar mensaje

```javascript
sock.sendMessage(jid, {
   forward: message,
   force: true // Opcional
})
```

<a id="-contact"></a>
#### 👤 Contacto

```javascript
const vcard = 'BEGIN:VCARD\n'
            + 'VERSION:3.0\n'
            + 'FN:Lia Wynn\n'
            + 'ORG:Waitress;\n'
            + 'TEL;type=CELL;type=VOICE;waid=628123456789:+62 8123 4567 89\n'
            + 'END:VCARD'

sock.sendMessage(jid, {
   contacts: {
      displayName: 'Lia Wynn',
      contacts: [
         { vcard }
      ]
   }
}, {
   quoted: message
})
```

<a id="-location"></a>
#### 📍 Ubicación

```javascript
sock.sendMessage(jid, {
   location: {
      degreesLatitude: 24.121231,
      degreesLongitude: 55.1121221,
      name: '👋🏻 I am here'
   }
}, {
   quoted: message
})
```

<a id="-event"></a>
#### 🗓️ Evento

```javascript
sock.sendMessage(jid, {
   event: {
      name: '🎶 Meet & Mingle Party',
      description: 'Meet & Mingle Party is a fun, casual gathering to connect, chat, and build new relationships within the community.',
      call: 'audio', // O bien "video"; opcional
      startDate: new Date(Date.now() + 3600000),
      endDate: new Date(Date.now() + 28800000),
      isCancelled: false, // Opcional
      isScheduleCall: false, // Opcional
      extraGuestsAllowed: false, // Opcional
      location: {
         name: 'Jakarta',
         degreesLatitude: -6.2,
         degreesLongitude: 106.8
      }
   }
}, {
   quoted: message
})
```

<a id="-group-invite"></a>
#### 👥 Invitación de grupo

```javascript
const inviteCode = groupUrl
   .split('chat.whatsapp.com/')[1]
   ?.split('?')[0]

const groupJid = '1201111111111@g.us'
const groupName = 'kage-baileys'

sock.sendMessage(jid, {
   groupInvite: {
      inviteCode,
      inviteExpiration: Date.now() + 86400000,
      text: '👋🏻 Hello, we invite you to join our group.',
      jid: groupJid,
      subject: groupName,
   }
}, {
   quoted: message
})
```

<a id="-product"></a>
#### 🛍️ Producto

```javascript
import { randomUUID } from 'crypto'

sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   body: '👋🏻 Check my product here!',
   footer: 'kage-baileys',
   product: {
      currencyCode: 'IDR',
      description: '🛍️ Interesting product!',
      priceAmount1000: 70_000_000,
      productId: randomUUID(),
      productImageCount: 1,
      salePriceAmount1000: 65_000_000,
      signedUrl: 'https://www.npmjs.com/package/kage-baileys',
      title: '📦 Starseed (Premium)',
      url: 'https://www.npmjs.com/package/kage-baileys'
   },
   businessOwnerJid: '0@s.whatsapp.net'
})
```

<a id="-poll"></a>
#### 📊 Encuesta

```javascript
// Ejemplo de uso de la API de Kage Baileys.
sock.sendMessage(jid, {
   poll: {
      name: '🔥 Voting time',
      values: ['Yes', 'No'],
      selectableCount: 1,
      toAnnouncementGroup: false,
      endDate: new Date(Date.now() + 28800000), // Opcional
      hideVoter: false, // Opcional
      canAddOption: false // Opcional
   }
}, {
   quoted: message
})

// Ejemplo de uso de la API de Kage Baileys.
sock.sendMessage('1211111111111@newsletter', {
   poll: {
      name: '🔥 Quiz',
      values: ['Yes', 'No'],
      correctAnswer: 'Yes',
      pollType: 1
   }
}, {
   quoted: message
})

// --- Poll result
sock.sendMessage(jid, {
   pollResult: {
      name: '📝 Poll Result',
      votes: [{
         name: 'Nice',
         voteCount: 10
      }, {
         name: 'Nah',
         voteCount: 2
      }],
      pollType: 0 // Or 1 for quiz
   }
}, {
   quoted: message
})

// Ejemplo de uso de la API de Kage Baileys.
sock.sendMessage(jid, {
   pollUpdate: {
      metadata: {},
      key: message.key,
      vote: {
         enclv: /* <Buffer> */,
         encPayload: /* <Buffer> */
      }
   }
}, {
   quoted: message
})
```

<a id="-button-response"></a>
#### 💭 Respuesta de botón

```javascript
// --- Using buttonsResponseMessage
sock.sendMessage(jid, {
   type: 'plain',
   buttonReply: {
      id: '#Menu',
      displayText: '✨ Interesting Menu'
   }
}, {
   quoted: message
})

// --- Using interactiveResponseMessage
sock.sendMessage(jid, {
   flowReply: {
      format: 0,
      text: '💭 Response',
      name: 'menu_options',
      paramsJson: JSON.stringify({
         id: '#Menu',
         description: '✨ Interesting Menu'
      })
   }
}, {
   quoted: message
})

// --- Using listResponseMessage
sock.sendMessage(jid, {
   listReply: {
      title: '📄 See More',
      description: '✨ Interesting Menu',
      id: '#Menu'
   }
}, {
   quoted: message
})

// --- Using templateButtonReplyMessage
sock.sendMessage(jid, {
   type: 'template',
   buttonReply: {
      id: '#Menu',
      displayText: '✨ Interesting Menu',
      index: 1
   }
}, {
   quoted: message
})
```

<a id="-rich-response"></a>
#### ✨ Respuesta enriquecida

> [!NOTE]
> `richResponse[]` representa los elementos `submessages[]` de `richResponseMessage`.

> [!TIP]
> También puede utilizarse directamente el campo `submessages[]` del protocolo.
> El ejemplo utiliza un ayudante; no impone una estructura obligatoria para todos los casos.

```javascript
sock.sendMessage(jid, {
   disclaimerText: 'RAW submessages structure example',
   richResponse: [{
      text: 'Example Usage',
   }, {
      language: 'javascript',
      code: [{
         highlightType: 0,
         codeContent: 'console.log("Hello, World!")'
      }]
   }, {
      text: 'Pretty simple, right?\n'
   }, {
      text: 'Comparison between Node.js, Bun, and Deno',
   }, {
      title: 'Runtime Comparison',
      table: [{
         isHeading: true,
         items: ['', 'Node.js', 'Bun', 'Deno']
      }, {
         isHeading: false,
         items: ['Engine', 'V8 (C++)', 'JavaScriptCore (C++)', 'V8 (C++)']
      }, {
         isHeading: false,
         items: ['Performance', '4/5', '5/5', '4/5']
      }]
   }, {
      text: 'Does this help clarify the differences?'
   }]
})
```

> [!TIP]
> Para resaltar la sintaxis puede importarse `tokenizeCode` desde Kage Baileys.

```javascript
import { tokenizeCode } from 'kage-baileys'

const language = 'javascript'
const code = 'console.log("Hello, World!")'

sock.sendMessage(jid, {
   disclaimerText: 'Example of tokenizing Code Block',
   richResponse: [{
      text: 'Example Usage',
   }, {
      language,
      code: tokenizeCode(code, language)
   }, {
      text: 'Pretty simple, right?'
   }]
})
```

> 💡 Lenguajes disponibles: `css`, `html`, `javascript`, `typescript`, `python`, `golang`, `rust`, `c`, `c#`, `c++`, `bash`, `bat` y `powershell`.

<a id="-message-with-code-block"></a>
#### 🧾 Mensaje con bloque de código

> [!NOTE]
> Esta función ya incorpora el analizador `tokenizeCode`.

```javascript
sock.sendMessage(jid, {
   disclaimerText: 'Code Block',
   headerText: '## Example Usage',
   contentText: '---',
   code: 'console.log("Hello, World!")',
   language: 'javascript',
   footerText: 'Pretty simple, right?'
})
```

<a id="-message-with-inline-entities"></a>
#### 🌏 Mensaje con entidades en línea

```javascript
sock.sendMessage(jid, {
   disclaimerText: 'Inline Entities',
   headerText: '## Check Out!',
   contentText: '---',
   links: [{
      text: '1. Google',
      title: 'Popular Search Engine',
      url: 'https://www.google.com/'
   }, {
      text: '2. YouTube',
      title: 'Popular Streaming Platform',
      url: 'https://www.youtube.com/'
   }, {
      text: '3. Modded Baileys',
      title: 'Underrated Baileys Fork',
      url: 'https://www.npmjs.com/package/kage-baileys'
   }],
   footerText: '---'
})
```

<a id="-message-with-table"></a>
#### 📋 Mensaje con tabla

```javascript
sock.sendMessage(jid, {
   disclaimerText: 'Table',
   headerText: '## Comparison between Node.js, Bun, and Deno',
   contentText: '---',
   title: 'Runtime Comparison',
   table: [
      ['', 'Node.js', 'Bun', 'Deno'],
      ['Engine', 'V8 (C++)', 'JavaScriptCore (C++)', 'V8 (C++)'],
      ['Performance', '4/5', '5/5', '4/5']
   ],
   noHeading: false, // Opcional
   footerText: 'Does this help clarify the differences?'
})
```

<a id="-status-mention"></a>
#### 🎞️ Mención en estados

```javascript
sock.sendMessage([jidA, jidB, jidC], {
   text: 'Hello! 👋🏻'
})
```

<a id="-sending-media-messages"></a>
### 📁 Envío de archivos multimedia

> [!NOTE]
> Los archivos multimedia aceptan un `Buffer`, `{ stream: Readable }` o `{ url: string }`; la URL puede ser una ruta local o una dirección HTTP/HTTPS.

<a id="-image"></a>
#### 🖼️ Imagen

```javascript
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '🔥 Superb'
}, {
   quoted: message
})
```

<a id="-video"></a>
#### 🎥 Vídeo

```javascript
sock.sendMessage(jid, {
   video: {
      url: './path/to/video.mp4'
   },
   gifPlayback: false, // --- Set true if you want to send video as GIF
   ptv: false,  // --- Set true if you want to send video as PTV
   caption: '🔥 Superb'
}, {
   quoted: message
})
```

#### 📃 Sticker

```javascript
sock.sendMessage(jid, {
   sticker: {
      url: './path/to/sticker.webp'
   }
}, {
   quoted: message
})
```

#### 💽 Audio

```javascript
sock.sendMessage(jid, {
   audio: {
      url: './path/to/audio.mp3'
   },
   ptt: false // --- Set true if you want to send audio as Voice Note
}, {
   quoted: message
})
```

<a id="-document"></a>
#### 🗂️ Documento

```javascript
sock.sendMessage(jid, {
   document: {
      url: './path/to/document.pdf'
   },
   mimetype: 'application/pdf',
   caption: '✨ My work!'
}, {
   quoted: message
})
```

<a id="-album-image--video"></a>
#### 🖼️ Álbum de imágenes y vídeos

```javascript
sock.sendMessage(jid, {
   album: [{
      image: {
         url: './path/to/image.jpg'
      },
      caption: '1st image'
   }, {
      video: {
         url: './path/to/video.mp4'
      },
      caption: '1st video'
   }, {
      image: {
         url: './path/to/image.jpg'
      },
      caption: '2nd image'
   }, {
      video: {
         url: './path/to/video.mp4'
      },
      caption: '2nd video'
   }]
}, {
   quoted: message
})
```

<a id="-sticker-pack"></a>
#### 📦 Paquete de stickers

> [!IMPORTANT]
> Sin `sharp` ni `@napi-rs/image`, la portada `cover` y los elementos `stickers` deben estar ya en formato WebP.

```javascript
sock.sendMessage(jid, {
   cover: {
      url: './path/to/image.webp'
   },
   stickers: [{
      data: {
         url: './path/to/image.webp'
      }
   }, {
      data: {
         url: './path/to/image.webp'
      }
   }, {
      data: {
         url: './path/to/image.webp'
      }
   }],
   name: '📦 My Sticker Pack',
   publisher: '🌟 Lia Wynn',
   description: 'kage-baileys'
}, {
   quoted: message
})
```

<a id="-sending-interactive-messages"></a>
### 👉🏻 Envío de mensajes interactivos

<a id="-buttons"></a>
#### 🔘 Botones

```javascript
// Mensaje de botones normal
sock.sendMessage(jid, {
   text: '👆🏻 Buttons!',
   footer: 'kage-baileys',
   buttons: [{
      text: '👋🏻 SignUp',
      id: '#SignUp'
   }]
}, {
   quoted: message
})

// Botones con archivos y flujos nativos
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '👆🏻 Buttons and Native Flow!',
   footer: 'kage-baileys',
   buttons: [{
      text: '👋🏻 Rating',
      id: '#Rating'
   }, {
      text: '📋 Select',
      sections: [{
         title: '✨ Section 1',
         rows: [{
            header: '',
            title: '💭 Secret Ingredient',
            description: '',
            id: '#SecretIngredient'
         }]
      }, {
         title: '✨ Section 2',
         highlight_label: '🔥 Popular',
         rows: [{
            header: '',
            title: '🏷️ Coupon',
            description: '',
            id: '#CouponCode'
         }]
      }]
   }]
}, {
   quoted: message
})
```

<a id="-list"></a>
#### 📋 Lista

> [!NOTE]
> Este formato solo funciona en chats privados (`@s.whatsapp.net`).

```javascript
sock.sendMessage(jid, {
   text: '📋 List!',
   footer: 'kage-baileys',
   buttonText: '📋 Select',
   title: '👋🏻 Hello',
   sections: [{
      title: '🚀 Menu 1',
      rows: [{
         title: '✨ AI',
         description: '',
         rowId: '#AI'
      }]
   }, {
      title: '🌱 Menu 2',
      rows: [{
         title: '🔍 Search',
         description: '',
         rowId: '#Search'
      }]
   }]
}, {
   quoted: message
})
```

<a id="-interactive"></a>
#### 🗄️ Interactivo

```javascript
// Flujo nativo
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '🗄️️ Interactive!',
   footer: 'kage-baileys',
   optionText: '👉🏻 Select Options', // Opcional, wrap all native flow into a single list
   optionTitle: '📄 Select Options', // Opcional
   offerText: '🏷️ Newest Coupon!', // Opcional, add an offer into message
   offerCode: 'kage-baileys', // Opcional
   offerUrl: 'https://www.npmjs.com/package/kage-baileys', // Opcional
   offerExpiration: Date.now() + 3_600_000, // Opcional
   nativeFlow: [{
      text: '👋🏻 Greeting',
      id: '#Greeting',
      icon: 'review' // Opcional
   }, {
      text: '📞 Call',
      call: '628123456789'
   }, {
      text: '📋 Copy',
      copy: 'kage-baileys'
   }, {
      text: '🌐 Source',
      url: 'https://www.npmjs.com/package/kage-baileys',
      useWebview: true // Opcional
   }, {
      text: '📋 Select',
      sections: [{
         title: '✨ Section 1',
         rows: [{
            header: '',
            title: '🏷️ Coupon',
            description: '',
            id: '#CouponCode'
         }]
      }, {
         title: '✨ Section 2',
         highlight_label: '🔥 Popular',
         rows: [{
            header: '',
            title: '💭 Secret Ingredient',
            description: '',
            id: '#SecretIngredient'
         }]
      }],
      icon: 'default' // Opcional
   }],
   interactiveAsTemplate: false, // Opcional, wrap the interactive message into a template
}, {
   quoted: message
})

// --- Carousel & Native Flow
sock.sendMessage(jid, {
   text: '🗂️ Interactive with Carousel!',
   footer: 'kage-baileys',
   cards: [{
      image: {
         url: './path/to/image.jpg'
      },
      caption: '🖼️ Image 1',
      footer: '🏷️️ Pinterest',
      nativeFlow: [{
         text: '🌐 Source',
         url: 'https://www.npmjs.com/package/kage-baileys',
         useWebview: true
      }]
   }, {
      image: {
         url: './path/to/image.jpg'
      },
      caption: '🖼️ Image 2',
      footer: '🏷️ Pinterest',
      offerText: '🏷️ New Coupon!',
      offerCode: 'kage-baileys',
      offerUrl: 'https://www.npmjs.com/package/kage-baileys',
      offerExpiration: Date.now() + 3_600_000,
      nativeFlow: [{
         text: '🌐 Source',
         url: 'https://www.npmjs.com/package/kage-baileys'
      }]
   }, {
      image: {
         url: './path/to/image.jpg'
      },
      caption: '🖼️ Image 3',
      footer: '🏷️ Pinterest',
      optionText: '👉🏻 Select Options',
      optionTitle: '👉🏻 Select Options',
      offerText: '🏷️ New Coupon!',
      offerCode: 'kage-baileys',
      offerUrl: 'https://www.npmjs.com/package/kage-baileys',
      offerExpiration: Date.now() + 3_600_000,
      nativeFlow: [{
         text: '🛒 Product',
         id: '#Product',
         icon: 'default'
      }, {
         text: '🌐 Source',
         url: 'https://www.npmjs.com/package/kage-baileys'
      }]
   }]
}, {
   quoted: message
})

// Ejemplo de uso de la API de Kage Baileys.
sock.sendMessage(jid, {
   text: '🔈 Music in the footer!',
   audioFooter: {
      url: './path/to/audio.mp3'
   }, // --- Like other media upload methods, buffers and streams are supported
   nativeFlow: [{
      text: '👍🏻 Good, next',
      id: '#Next',
      icon: 'review'
   }, {
      text: '👎🏻 Skip',
      id: '#Skip',
      icon: 'default'
   }]
}, {
   quoted: message
})
```

<a id="-hydrated-template"></a>
#### 🫙 Plantilla enriquecida

```javascript
sock.sendMessage(jid, {
   title: '👋🏻 Hello',
   image: {
      url: './path/to/image.jpg'
   },
   caption: '🫙 Template!',
   footer: 'kage-baileys',
   templateButtons: [{
      text: '👉🏻 Tap Here',
      id: '#Order'
   }, {
      text: '🌐 Source',
      url: 'https://www.npmjs.com/package/kage-baileys'
   }, {
      text: '📞 Call',
      call: '628123456789'
   }]
}, {
   quoted: message
})
```

<a id="-sending-payment-messages"></a>
### 💳 Envío de mensajes de pago

<a id="-invite-payment"></a>
#### ➕ Invitación de pago

```javascript
sock.sendMessage(jid, {
   paymentInviteServiceType: 3 // 1, 2, or 3
})
```

<a id="-invoice"></a>
#### 🧾 Factura

> [!NOTE]
> Las facturas son experimentales: no se garantiza su aceptación ni visualización en WhatsApp.

```javascript
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   invoiceNote: '🏷️ Invoice'
})
```

<a id="-order"></a>
#### 🛍️ Pedido

```javascript
sock.sendMessage(chat, {
   orderText: '🛍️ Order',
   thumbnail: fs.readFileSync('./path/to/image.jpg') // Debe ser un Buffer
}, {
   quoted: message
})
```

<a id="-request-payment"></a>
#### 💳 Solicitud de pago

```javascript
sock.sendMessage(jid, {
   text: '💳 Request Payment',
   requestPaymentFrom: '0@s.whatsapp.net'
})
```

<a id="-other-message-options"></a>
### 👁️ Otras opciones de mensajes

<a id="-ai-icon"></a>
#### 🤖 Icono de IA

> [!NOTE]
> Esta opción solo funciona en chats privados (`@s.whatsapp.net`).

```javascript
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '🤖 With AI icon!',
   ai: true
}, {
   quoted: message
})
```

<a id="-ephemeral"></a>
#### 🕒 Temporal

> [!NOTE]
> Envuelve el contenido en `ephemeralMessage`.

```javascript
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '👁️ Ephemeral',
   ephemeral: true
})
```

<a id="-external-ad-reply"></a>
#### 📰 Vista previa publicitaria

> [!NOTE]
> Añade una miniatura publicitaria; algunas versiones de WhatsApp pueden no mostrarla.

```javascript
sock.sendMessage(jid, {
   text: '📰 External Ad Reply',
   externalAdReply: {
      title: '📝 Did you know?',
      body: '❓ I dont know',
      thumbnail: fs.readFileSync('./path/to/image.jpg'), // Debe ser un Buffer
      largeThumbnail: false, // --- Or true for bigger thumbnail
      url: 'https://www.npmjs.com/package/kage-baileys' // Opcional, used for WhatsApp internal thumbnail caching and direct URL
   }
}, {
   quoted: message
})
```

<a id="-group-status"></a>
#### 🧑‍🧑‍🧒 Estado de grupo

> [!NOTE]
> Esta opción solo funciona en grupos (`@g.us`).

```javascript
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '👥 Group Status!',
   groupStatus: true
})
```

<a id="-lottie-sticker"></a>
#### 🐱 Sticker Lottie

> [!NOTE]
> Envuelve el contenido en `lottieStickerMessage`.

```javascript
sock.sendMessage(jid, {
   sticker: {
      url: './path/to/sticker.webp'
   },
   isLottie: true
})
```

<a id="-raw"></a>
#### 🧩 Contenido directo

```javascript
sock.sendMessage(jid, {
   extendedTextMessage: {
      text: '📃 Built manually from scratch using the raw WhatsApp proto structure',
      contextInfo: {
         externalAdReply: {
            title: 'kage-baileys',
            thumbnail: fs.readFileSync('./path/to/image.jpg'),
            sourceApp: 'whatsapp',
            showAdAttribution: true,
            mediaType: 1
         }
      }
   },
   raw: true
}, {
   quoted: message
})
```

<a id="-secure-meta-service-label"></a>
#### 🏷️ Etiqueta de servicio seguro de Meta

```javascript
sock.sendMessage(jid, {
   text: '🏷️ Just a label!',
   secureMetaServiceLabel: true
})
```

<a id="-spoiler"></a>
#### 📑 Contenido oculto

> [!NOTE]
> Envuelve el contenido en `spoilerMessage`.

```javascript
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '❔ Spoiler',
   spoiler: true
})
```

<a id="-view-once"></a>
#### 👁️ Visualización única

> [!NOTE]
> Envuelve el contenido en `viewOnceMessage`.

```javascript
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '👁️ View Once',
   viewOnce: true
})
```

<a id="-view-once-v2"></a>
#### 👁️ Visualización única V2

> [!NOTE]
> Envuelve el contenido en `viewOnceMessageV2`.

```javascript
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '👁️ View Once V2',
   viewOnceV2: true
})
```

<a id="-view-once-v2-extension"></a>
#### 👁️ Visualización única V2 extendida

> [!NOTE]
> Envuelve el contenido en `viewOnceMessageV2Extension`.

```javascript
sock.sendMessage(jid, {
   image: {
      url: './path/to/image.jpg'
   },
   caption: '👁️ View Once V2 Extension',
   viewOnceV2Extension: true
})
```

<a id="-modify-messages"></a>
### ♻️ Modificar mensajes

<a id="-delete-messages"></a>
#### 🗑️ Eliminar mensajes

```javascript
sock.sendMessage(jid, {
   delete: message.key
})
```

<a id="-edit-messages"></a>
#### ✏️ Editar mensajes

```javascript
// --- Edit plain text
sock.sendMessage(jid, {
   text: '✨ I mean, nice!',
   edit: message.key
})

// --- Edit media messages caption
sock.sendMessage(jid, {
   caption: '✨ I mean, here is the image!',
   edit: message.key
})
```

<a id="-additional-contents"></a>
### 🧰 Contenido adicional

<a id="-find-user-id-jidpnlid"></a>
#### 🏷️ Buscar identificador de usuario (JID, PN y LID)

> [!NOTE]
> El identificador debe contener únicamente números y el código de país; no incluya `+`, paréntesis ni guiones.

```javascript
// --- PN (Phone Number)
const phoneNumber = '6281111111111@s.whatsapp.net'

const ids = await sock.findUserId(phoneNumber)

console.log('🏷️ Got user ID', ':', ids)

// --- LID (Local Identifier)
const lid = '43411111111111@lid'

const ids = await sock.findUserId(lid)

console.log('🏷️ Got user ID', ':', ids)

// --- Output
// {
//    phoneNumber: '6281111111111@s.whatsapp.net',
//    lid: '43411111111111@lid'
// }
// --- Output when failed
// {
//    phoneNumber: '6281111111111@s.whatsapp.net',
//    lid: undefined
// }
// --- Same output shape regardless of input type
```

<a id="-request-custom-pairing-code"></a>
#### 🔑 Código de vinculación personalizado

> [!NOTE]
> El teléfono debe contener únicamente números y el código de país; no incluya `+`, paréntesis ni guiones.

```javascript
const phoneNumber = '6281111111111'
const customPairingCode = 'STARFALL'

await sock.requestPairingCode(phoneNumber, customPairingCode)

console.log('🔗 Pairing code', ':', customPairingCode)
```

<a id="-image-processing"></a>
#### 🖼️ Procesamiento de imágenes

> [!NOTE]
> Se selecciona un motor de imágenes disponible: `sharp`, `@napi-rs/image` o `jimp`.

```javascript
import { getImageProcessingLibrary } from 'kage-baileys'
import { readFile } from 'fs/promises'

const lib = await getImageProcessingLibrary()

const bufferOrFilePath = './path/to/image.jpg'
const width = 512

let output

// --- If sharp installed
if (lib.sharp?.default) {
   const img = lib.sharp.default(bufferOrFilePath)

   output = await img.resize(width)
      .jpeg({ quality: 80 })
      .toBuffer()
}

// --- If @napi-rs/image installed
else if (lib.image?.Transformer) {
   // Debe ser un Buffer
   const inputBuffer = Buffer.isBuffer(bufferOrFilePath)
      ? bufferOrFilePath
      : await readFile(bufferOrFilePath)

   const img = new lib.image.Transformer(inputBuffer)

   output = await img.resize(width, undefined, 0)
      .jpeg(50)
}

// --- If jimp installed
else if (lib.jimp?.Jimp) {
   const img = await lib.jimp.Jimp.read(bufferOrFilePath)

   output = await img
      .resize({ w: width, mode: lib.jimp.ResizeStrategy.BILINEAR })
      .getBuffer('image/jpeg', { quality: 50 })
}

// --- Fallback
else {
   throw new Error('No image processing available')
}

console.log('✅ Process completed!')
console.dir(output, { depth: null })
```

<a id="-newsletter-management"></a>
#### 📣 Gestión de canales

```javascript
// Ejemplo de uso de la API de Kage Baileys.
sock.newsletterCreate('kage-baileys', '📣 Fresh updates weekly')

// Ejemplo de uso de la API de Kage Baileys.
const metadata = sock.newsletterMetadata('1231111111111@newsletter')
console.dir(metadata, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const subscribers = await sock.newsletterSubscribers('1231111111111@newsletter')
console.dir(subscribers, { depth: null })

// --- Follow and Unfollow
sock.newsletterFollow('1231111111111@newsletter')
sock.newsletterUnfollow('1231111111111@newsletter')

// --- Mute and Unmute
sock.newsletterMute('1231111111111@newsletter')
sock.newsletterUnmute('1231111111111@newsletter')

// --- Demote admin
sock.newsletterDemote('1231111111111@newsletter', '6281111111111@s.whatsapp.net')

// Ejemplo de uso de la API de Kage Baileys.
sock.newsletterChangeOwner('1231111111111@newsletter', '6281111111111@s.whatsapp.net')

// Ejemplo de uso de la API de Kage Baileys.
sock.newsletterUpdate('1231111111111@newsletter', { name: 'kage-baileys' })

// Ejemplo de uso de la API de Kage Baileys.
sock.newsletterUpdateName('1231111111111@newsletter', '📦 kage-baileys')

// Ejemplo de uso de la API de Kage Baileys.
sock.newsletterUpdateDescription('1231111111111@newsletter', '📣 Fresh updates weekly')

// Ejemplo de uso de la API de Kage Baileys.
sock.newsletterUpdatePicture('1231111111111@newsletter', {
   url: 'path/to/image.jpg'
})

// Ejemplo de uso de la API de Kage Baileys.
sock.newsletterRemovePicture('1231111111111@newsletter')

// Ejemplo de uso de la API de Kage Baileys.
sock.newsletterReactMessage('1231111111111@newsletter', '100', '💛')

// Ejemplo de uso de la API de Kage Baileys.
const count = await sock.newsletterAdminCount('1231111111111@newsletter')

// Ejemplo de uso de la API de Kage Baileys.
const newsletters = await sock.newsletterSubscribed()
console.dir(newsletters, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const messages = sock.newsletterFetchMessages('jid', '1231111111111@newsletter', 50, 0, 0)
console.dir(messages, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
sock.newsletterDelete('1231111111111@newsletter')
```

<a id="-group-management"></a>
#### 👥 Gestión de grupos

```javascript
// Ejemplo de uso de la API de Kage Baileys.
const group = sock.groupCreate('kage-baileys', ['628123456789@s.whatsapp.net'])
console.dir(group, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const metadata = await sock.groupMetadata(jid)
console.dir(metadata, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const inviteCode = await sock.groupInviteCode(jid)
console.dir(inviteCode, { depth: null })


// --- Revoke invite link
sock.groupRevokeInvite(jid)

// Ejemplo de uso de la API de Kage Baileys.
sock.groupAcceptInvite(inviteCode)

// Ejemplo de uso de la API de Kage Baileys.
sock.groupLeave(jid)

// Ejemplo de uso de la API de Kage Baileys.
sock.groupParticipantsUpdate(jid, ['628123456789@s.whatsapp.net'], 'add')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupParticipantsUpdate(jid, ['628123456789@s.whatsapp.net'], 'remove')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupParticipantsUpdate(jid, ['628123456789@s.whatsapp.net'], 'promote')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupParticipantsUpdate(jid, ['628123456789@s.whatsapp.net'], 'demote')

// --- Accept join requests
sock.groupRequestParticipantsUpdate(jid, ['628123456789@s.whatsapp.net'], 'approve')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupUpdateSubject(jid, '📦 kage-baileys')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupUpdateDescription(jid, 'Updated description')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateProfilePicture(jid, {
   url: 'path/to/image.jpg'
})

// Ejemplo de uso de la API de Kage Baileys.
sock.removeProfilePicture(jid)

// Ejemplo de uso de la API de Kage Baileys.
sock.groupSettingUpdate(jid, 'announcement')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupSettingUpdate(jid, 'not_announcement')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupSettingUpdate(jid, 'locked')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupSettingUpdate(jid, 'unlocked')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupMemberAddMode(jid, 'admin_add')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupMemberAddMode(jid, 'all_member_add')

// Ejemplo de uso de la API de Kage Baileys.
sock.groupToggleEphemeral(jid, 86400)

// --- Disable temporary messages
sock.groupToggleEphemeral(jid, 0)

// --- Enable or disable membership approval mode
sock.groupJoinApprovalMode(jid, 'on')
sock.groupJoinApprovalMode(jid, 'off')

// Ejemplo de uso de la API de Kage Baileys.
const groups = await sock.groupFetchAllParticipating()
console.dir(groups, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const requests = await sock.groupRequestParticipantsList(jid)
console.dir(requests, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const group = await sock.groupGetInviteInfo('ABC123456789')
console.log('👥 Got group info from invite code', ':', group)

// Ejemplo de uso de la API de Kage Baileys.
sock.updateMemberLabel(jid, 'kage-baileys')
```

<a id="-community-management"></a>
#### 👥 Gestión de comunidades

```javascript
// Ejemplo de uso de la API de Kage Baileys.
const community = await sock.communityCreate('kage-baileys', '📣 Fresh updates weekly')
console.dir(community, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const group = await sock.communityCreateGroup('📢 Announcements', ['628123456789@s.whatsapp.net'], communityJid)

// Ejemplo de uso de la API de Kage Baileys.
sock.communityLinkGroup(groupJid, communityJid)

// Ejemplo de uso de la API de Kage Baileys.
sock.communityUnlinkGroup(groupJid, communityJid)

// Ejemplo de uso de la API de Kage Baileys.
const metadata = await sock.communityMetadata(jid)
console.dir(metadata, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const inviteCode = await sock.communityInviteCode(jid)
console.dir(inviteCode, { depth: null })

// --- Revoke invite link
sock.communityRevokeInvite(jid)

// --- Accept community invite
sock.communityAcceptInvite(inviteCode)

// --- Leave community
sock.communityLeave(jid)

// --- Accept join requests
sock.communityRequestParticipantsUpdate(jid, ['628123456789@s.whatsapp.net'], 'approve')

// Ejemplo de uso de la API de Kage Baileys.
sock.communityUpdateSubject(jid, '📦 kage-baileys')

// Ejemplo de uso de la API de Kage Baileys.
sock.communityUpdateDescription(jid, 'Updated description')

// Ejemplo de uso de la API de Kage Baileys.
sock.communitySettingUpdate(jid, 'announcement')

// Ejemplo de uso de la API de Kage Baileys.
sock.communitySettingUpdate(jid, 'not_announcement')

// Ejemplo de uso de la API de Kage Baileys.
sock.communitySettingUpdate(jid, 'locked')

// Ejemplo de uso de la API de Kage Baileys.
sock.communitySettingUpdate(jid, 'unlocked')

// Ejemplo de uso de la API de Kage Baileys.
sock.communityMemberAddMode(jid, 'admin_add')

// Ejemplo de uso de la API de Kage Baileys.
sock.communityMemberAddMode(jid, 'all_member_add')

// Ejemplo de uso de la API de Kage Baileys.
sock.communityToggleEphemeral(jid, 86400)

// --- Disable temporary messages
sock.communityToggleEphemeral(jid, 0)

// --- Enable or disable membership approval mode
sock.communityJoinApprovalMode(jid, 'on')
sock.communityJoinApprovalMode(jid, 'off')

// Ejemplo de uso de la API de Kage Baileys.
const communities = await sock.communityFetchAllParticipating()
console.dir(communities, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const linked = await sock.communityFetchLinkedGroups(jid)
console.dir(linked, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const requests = await sock.communityRequestParticipantsList(jid)
console.dir(requests, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const community = await sock.communityGetInviteInfo('ABC123456789')
console.log('👥 Got community info from invite code', ':', community)
```

<a id="-profile-management"></a>
#### 👤 Gestión del perfil

```javascript
// Ejemplo de uso de la API de Kage Baileys.
const url = await sock.profilePictureUrl(jid, 'image')
console.log('🖼️ Got user profile url', url)

// Ejemplo de uso de la API de Kage Baileys.
sock.updateProfilePicture(jid, buffer)
sock.updateProfilePicture(jid, { url })

// Ejemplo de uso de la API de Kage Baileys.
sock.removeProfilePicture(jid)

// Ejemplo de uso de la API de Kage Baileys.
sock.updateProfileName('My Name')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateProfileStatus('Available')

// --- Presence
sock.sendPresenceUpdate('available', jid)
sock.presenceSubscribe(jid)

// Ejemplo de uso de la API de Kage Baileys.
sock.readMessages([message.key])
sock.sendReceipt(jid, participant, [messageId], 'read')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateBlockStatus(jid, 'block')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateBlockStatus(jid, 'unblock')

// Ejemplo de uso de la API de Kage Baileys.
const blocked = await sock.fetchBlocklist()
console.dir(blocked, { depth: null })

// --- Modify chats
sock.chatModify({
   archive: true,
   lastMessageOrig: message,
   lastMessage: message
}, jid)

// --- Star messages
sock.star(jid, [{ id: messageId, fromMe: true }], true)

// --- Contact
sock.addOrEditContact(jid, { displayName: 'Starseed' })
sock.removeContact(jid)

// --- Label
sock.addChatLabel(jid, labelId)
sock.removeChatLabel(jid, labelId)
sock.addMessageLabel(jid, messageId, labelId)

// --- App state sync
sock.resyncAppState(['regular', 'critical_block'], true)

// Ejemplo de uso de la API de Kage Baileys.
const profile = await sock.getBusinessProfile(jid)
console.dir(profile, { depth: null })
```

<a id="-business-management"></a>
#### 🛒 Gestión empresarial

```javascript
// Ejemplo de uso de la API de Kage Baileys.
const product = await sock.productCreate({
   name: '🧩 Starseed (Premium)',
   description: 'Get a full version of Starseed!',
   price: 100000,
   currency: 'IDR',
   originCountryCode: 'ID',
   images: [
      bufferImage,
      {
         url: './path/to/image.jpg'
      }
   ]
})
console.dir(product, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
await sock.productUpdate(productId, {
   name: '🧩 Starseed (Premium)',
   description: 'Get a full version of Starseed with more features!',
   price: 75000,
   currency: 'IDR',
   images: [
      {
         url: './path/to/image.jpg'
      }
   ]
})

// Ejemplo de uso de la API de Kage Baileys.
sock.productDelete([productId])

// Ejemplo de uso de la API de Kage Baileys.
const { products, nextPageCursor } = await sock.getCatalog({
  jid: '628123456789@s.whatsapp.net',
  limit: 10
})

// Ejemplo de uso de la API de Kage Baileys.
const collections = await sock.getCollections('628123456789@s.whatsapp.net', 10)
console.dir(collections, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
const order = await sock.getOrderDetails(orderId, tokenBase64)
console.dir(order, { depth: null })

// Ejemplo de uso de la API de Kage Baileys.
await sock.updateBusinessProfile({
   address: 'Jakarta, Indonesia',
   description: '🛒 Official Starseed Store',
   websites: ['https://www.npmjs.com/package/kage-baileys'],
   email: 'more-more@gmail.com',
   hours: {
      timezone: 'Asia/Jakarta',
      days: [{ day: 'mon', mode: 'open_24h' }]
   }
})

// Ejemplo de uso de la API de Kage Baileys.
sock.updateCoverPhoto({
   url: './path/to/image.jpg'
})

// Ejemplo de uso de la API de Kage Baileys.
sock.removeCoverPhoto(coverId)

// Ejemplo de uso de la API de Kage Baileys.
sock.addOrEditQuickReply({
  shortcut: 'hello',
  message: 'Hello from business account',
})

// Ejemplo de uso de la API de Kage Baileys.
sock.removeQuickReply(timestamp)
```

<a id="-privacy-management"></a>
#### 🔐 Gestión de privacidad

```javascript
// Ejemplo de uso de la API de Kage Baileys.
sock.updateLastSeenPrivacy('all')
sock.updateLastSeenPrivacy('contacts')
sock.updateLastSeenPrivacy('contact_blacklist')
sock.updateLastSeenPrivacy('nobody')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateOnlinePrivacy('all')
sock.updateOnlinePrivacy('match_last_seen')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateProfilePicturePrivacy('contacts')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateStatusPrivacy('contacts')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateReadReceiptsPrivacy('all')
sock.updateReadReceiptsPrivacy('none')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateGroupsAddPrivacy('all')
sock.updateGroupsAddPrivacy('contacts')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateMessagesPrivacy('all')
sock.updateMessagesPrivacy('contacts')
sock.updateMessagesPrivacy('nobody')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateCallPrivacy('everyone')

// Ejemplo de uso de la API de Kage Baileys.
sock.updateDefaultDisappearingMode(86400)

// Ejemplo de uso de la API de Kage Baileys.
sock.updateDisableLinkPreviewsPrivacy(true)
```

<a id="-events"></a>
#### 📡 Eventos

```javascript
sock.ev.on('connection.update', (update) => {})
sock.ev.on('creds.update', (update) => {})
sock.ev.on('messaging-history.set', (update) => {})
sock.ev.on('messaging-history.status', (update) => {})
sock.ev.on('chats.upsert', (update) => {})
sock.ev.on('chats.update', (update) => {})
sock.ev.on('chats.delete', (update) => {})
sock.ev.on('chats.lock', (update) => {})
sock.ev.on('lid-mapping.update', (update) => {})
sock.ev.on('presence.update', (update) => {})
sock.ev.on('contacts.upsert', (update) => {})
sock.ev.on('contacts.update', (update) => {})
sock.ev.on('messages.delete', (update) => {})
sock.ev.on('messages.update', (update) => {})
sock.ev.on('messages.media-update', (update) => {})
sock.ev.on('messages.upsert', (update) => {})
sock.ev.on('messages.reaction', (update) => {})
sock.ev.on('message-receipt.update', (update) => {})
sock.ev.on('groups.upsert', (update) => {})
sock.ev.on('groups.update', (update) => {})
sock.ev.on('group-participants.update', (update) => {})
sock.ev.on('group.join-request', (update) => {})
sock.ev.on('group.member-tag.update', (update) => {})
sock.ev.on('blocklist.set', (update) => {})
sock.ev.on('blocklist.update', (update) => {})
sock.ev.on('call', (update) => {})
sock.ev.on('labels.edit', (update) => {})
sock.ev.on('labels.association', (update) => {})
sock.ev.on('newsletter.reaction', (update) => {})
sock.ev.on('newsletter.view', (update) => {})
sock.ev.on('newsletter-participants.update', (update) => {})
sock.ev.on('newsletter-settings.update', (update) => {})
sock.ev.on('settings.update', (update) => {})
```

## Licencias y reconocimientos

La identidad del paquete es Kage Baileys. Se conservan los avisos originales exigidos por las licencias en `LICENSE` y `licenses/`. Los créditos de los componentes no se sustituyen por los del autor de esta distribución.

## Seguridad de dependencias

El informe `maintenance/dependency-audit.json` refleja el resultado de la auditoría de dependencias de esta entrega. Las alertas sin una actualización compatible no se ocultan ni equivalen a fallos de las pruebas funcionales. Revise ese informe antes de exponer el servicio a archivos de origen no confiable. No se sustituyen dependencias por versiones mayores sin verificar su compatibilidad.
