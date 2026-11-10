<div align="center">

<img src="https://files.catbox.moe/obv0zs.png" alt="KAGE BAILEYS" width="850"/>

# KAGE BAILEYS

**Kage Baileys — la mejor Baileys de 2026.**  
API de WhatsApp Web más completa: portada de perfil (cuentas normales y Business), avatares por defecto estilo WhatsApp, botones, carruseles, Native Flows, VoIP, canales, comunidades, Meta AI, mapeo LID, álbumes, tablas, bloques de código y soporte total del protocolo. Documentación 100 % en español.

Creador: **xrljosedv** • Desarrollador: **Jose** • Documentación 100 % en español

[![npm version](https://img.shields.io/npm/v/kage-baileys.svg)](https://www.npmjs.com/package/kage-baileys)
[![Downloads](https://img.shields.io/npm/dm/kage-baileys.svg)](https://www.npmjs.com/package/kage-baileys)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12-brightgreen)](https://nodejs.org)

[![Canal de WhatsApp](https://img.shields.io/badge/WhatsApp-Unirse%20al%20canal-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029VbBibFU9cDDbBZ06fa0U)

</div>

---


## 📋 Índice

- [✨ Características](#-características)
- [📦 Qué incluye](#-qué-incluye)
- [📥 Instalación](#-instalación)
- [🚀 Inicio rápido](#-inicio-rápido)
- [🔌 Conexión de cuenta](#-conexión-de-cuenta)
- [⚙️ Configuración del socket](#-configuración-del-socket)
- [💾 Sesiones y autenticación](#-sesiones-y-autenticación)
- [📡 Gestión de eventos](#-gestión-de-eventos)
- [🗄️ Almacén de datos](#%EF%B8%8F-almacén-de-datos)
- [🪪 Identificadores de WhatsApp](#-identificadores-de-whatsapp)
- [📤 Envío de mensajes](#-envío-de-mensajes)
- [👉🏻 Mensajes interactivos](#%F0%9F%91%89%F0%9F%8F%BB-mensajes-interactivos)
- [💰 Mensajes de pago](#-mensajes-de-pago)
- [📁 Mensajes multimedia](#-mensajes-multimedia)
- [👁️ Opciones adicionales de mensajes](#%EF%B8%8F-opciones-adicionales-de-mensajes)
- [✨ Mensajes enriquecidos (nuevo)](#-mensajes-enriquecidos-nuevo)
- [♻️ Modificar mensajes](#%EF%B8%8F-modificar-mensajes)
- [🖼️ Procesar mensajes multimedia](#%EF%B8%8F-procesar-mensajes-multimedia)
- [📞 Llamadas](#-llamadas)
- [💬 Estados de envío y presencia](#-estados-de-envío-y-presencia)
- [📁 Modificar chats](#-modificar-chats)
- [👤 Consultas de usuario](#-consultas-de-usuario)
- [🔄 Modificar perfil](#-modificar-perfil)
- [👥 Grupos](#-grupos)
- [🏘️ Comunidades](#%EF%B8%8F-comunidades)
- [📣 Canales (newsletters)](#-canales-newsletters)
- [🛒 Gestión empresarial](#-gestión-empresarial)
- [🔒 Privacidad](#-privacidad)
- [📢 Listas de difusión y estados](#-listas-de-difusión-y-estados)
- [🛠️ Funciones personalizadas](#%EF%B8%8F-funciones-personalizadas)
- [🧩 Módulos extra Kage](#-módulos-extra-kage)
- [💡 Consejos y buenas prácticas](#-consejos-y-buenas-prácticas)
- [⚠️ Advertencia](#%EF%B8%8F-advertencia)
- [📄 Licencia y reconocimientos](#-licencia-y-reconocimientos)

---

## ✨ Características

- 🚀 **Moderno y rápido** — construido con TypeScript y las tecnologías más recientes.
- 🔧 **Corrección de @lid y @jid** — resuelve el problema de `@lid` a `@pn` en grupos.
- 📱 **Multi-Device** — compatible con la conexión multidispositivo de WhatsApp.
- 🔐 **Cifrado de extremo a extremo** — comunicación totalmente cifrada.
- 📨 **Todo tipo de mensajes** — texto, medios, encuestas, botones, flujos nativos y más.
- 🚫 **Código sin ofuscación** — fácil de leer y auditar; no se siguen canales automáticamente.

> [!NOTE]
> Las funciones dependen de la compatibilidad del cliente y del servidor de WhatsApp.

## 📦 Qué incluye

| Función | Estado |
|---|---|
| **Portada de perfil (cover photo) — cuentas normales** | ✅ **NUEVO 2026** |
| Portada de perfil Business (updateCoverPhoto) | ✅ Incluido |
| Botones interactivos y carruseles | ✅ Incluido |
| Native Flows (flujos nativos) | ✅ Incluido |
| Álbumes / mensajes de álbum | ✅ Incluido |
| Newsletters / Canales | ✅ Incluido |
| Comunidades | ✅ Incluido |
| Meta AI (respuestas enriquecidas) | ✅ Incluido |
| VoIP / llamadas de voz | ✅ Incluido |
| Mapeo LID ↔ PN (lid-mapping) | ✅ Incluido |
| Tablas, bloques de código, entidades en línea | ✅ Incluido |
| Mensajes de pago / facturas experimentales | ✅ Incluido |
| Stickers packs + procesamiento de imagen (sharp / napi / jimp) | ✅ Incluido |
| Privacidad completa (online, foto, estado, last seen…) | ✅ Incluido |
| Store en memoria + cache-manager | ✅ Incluido |
| Compatibilidad Multi-Device + protocolo actual | ✅ Incluido |
| Documentación 100 % en español + ejemplos completos | ✅ Incluido |
| **Avatar por defecto estilo WhatsApp** (usuario/grupo/canal/comunidad) | ✅ **NUEVO** |
| obtenerFotoPerfil / generarAvatar (fallback sin foto) | ✅ Incluido |

### Ajustes internos

- 🖼️ Ajustes para subir archivos multimedia a canales.
- 📁 Almacén en memoria (`makeInMemoryStore`) compatible con ESM y CommonJS.
- 📦 FFmpeg se ejecuta en procesos separados, sin construir comandos de shell.
- 🗃️ Procesamiento de imágenes con motores opcionales: `sharp`, `@napi-rs/image` o `jimp`.

## 📥 Instalación

### Desde la terminal

```bash
# NPM (estable)
npm i kage-baileys

# NPM (últimas funciones)
npm i kage-baileys@latest

# GitHub
npm i github:xrljosedv/kage-baileys

# Desde carpeta local
npm install ./kage-baileys
```

### Desde `package.json`

```json
{
   "dependencies": {
      "kage-baileys": "latest"
   }
}
```

o desde GitHub:

```json
{
   "dependencies": {
      "kage-baileys": "github:xrljosedv/kage-baileys"
   }
}
```

### Importación (ESM y CJS)

```javascript
// --- ESM
import { makeWASocket } from 'kage-baileys'

// --- CJS
const { makeWASocket } = require('kage-baileys')
```


> Al crear el socket verás el banner de arranque de **Kage Baileys** (creador José · redes xrljose / xrljosedv).  
> Para silenciarlo: `makeWASocket({ silentBanner: true })` o variable de entorno `KAGE_NO_BANNER=1`.

## 🚀 Inicio rápido

```javascript
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, delay } = require('kage-baileys')
const { Boom } = require('@hapi/boom')

const myPhoneNumber = '51987654321' // sin +, () ni -

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_kage-baileys')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['kage-baileys', 'Desktop', '3.0']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Conexión cerrada:', lastDisconnect?.error, '| reconectando:', shouldReconnect)
            if (shouldReconnect) connectToWhatsApp()
        } else if (connection === 'open') {
            console.log('✅ ¡Conectado a WhatsApp con éxito!')
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages) {
            if (!m.message) continue
            console.log('📱 Nuevo mensaje:', JSON.stringify(m, undefined, 2))
            await sock.sendMessage(m.key.remoteJid, {
                text: '👋 ¡Hola! Soy un bot con kage-baileys'
            })
        }
    })
}

connectToWhatsApp()
```

> [!TIP]
> Para conectar **sin QR**, consulta [Conexión con código de emparejamiento](#-conexión-de-cuenta).

## 🔌 Conexión de cuenta

WhatsApp permite vincular un cliente secundario multidispositivo mediante **código QR** o **código de emparejamiento**.

### Conectar con código QR

```javascript
const { default: makeWASocket, Browsers } = require('kage-baileys')

const sock = makeWASocket({
    browser: Browsers.ubuntu('Mi App'), // personaliza el navegador
    printQRInTerminal: true
})
```

Escanea el QR que aparece en la terminal desde WhatsApp en tu teléfono.

### Conectar con código de emparejamiento

> [!IMPORTANT]
> El número debe contener solo dígitos, con el código de país, sin `+`, paréntesis ni guiones.

```javascript
const sock = makeWASocket({ printQRInTerminal: false })

if (!sock.authState.creds.registered) {
    const number = '51987654321'
    const code = await sock.requestPairingCode(number)
    console.log('🔑 Código de emparejamiento:', code)
}
```

**Código personalizado** (8 caracteres):

```javascript
const customCode = 'JOSEMODS'
const code = await sock.requestPairingCode('51987654321', customCode)
console.log('🔑 Código personalizado:', code)
```

> [!NOTE]
> El código de emparejamiento no forma parte de la API móvil: conecta WhatsApp Web sin QR, pero solo en un dispositivo. La disponibilidad y los límites dependen de WhatsApp.

### Conexión automática en el evento `connecting`

```javascript
sock.ev.on('connection.update', async (update) => {
    const { connection } = update
    if (connection === 'connecting' && !sock.authState.creds.registered) {
        await delay(1500)
        const code = await sock.requestPairingCode(myPhoneNumber)
        console.log('🔗 Código:', code)
    }
})
```

### Recibir el historial completo

1. Establece `syncFullHistory: true`.
2. Usa una configuración de navegador de escritorio para solicitar más historial.

```javascript
const { default: makeWASocket, Browsers } = require('kage-baileys')

const sock = makeWASocket({
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: true
})
```

### Resumen de eventos de la primera conexión

1. En la primera vinculación, `connection.update` puede pedir reiniciar el socket.
2. Después, el historial llega en el evento `messaging-history.set`.

## ⚙️ Configuración del socket

### Caché de metadatos de grupos (recomendado)

```javascript
const NodeCache = require('node-cache')
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

const sock = makeWASocket({
    cachedGroupMetadata: async (jid) => groupCache.get(jid)
})

sock.ev.on('groups.update', async ([event]) => {
    groupCache.set(event.id, await sock.groupMetadata(event.id))
})

sock.ev.on('group-participants.update', async (event) => {
    groupCache.set(event.id, await sock.groupMetadata(event.id))
})
```

### Reintentos y descifrado de votos en encuestas

Configura un almacén y la función `getMessage`:

```javascript
const sock = makeWASocket({
    getMessage: async (key) => await getMessageFromStore(key)
})
```

### Recibir notificaciones en la app de WhatsApp

Desactiva el estado en línea al conectar:

```javascript
const sock = makeWASocket({
    markOnlineOnConnect: false
})
```

## 💾 Sesiones y autenticación

Guarda las credenciales para no escanear el QR en cada conexión:

```javascript
const { default: makeWASocket, useMultiFileAuthState } = require('kage-baileys')

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_kage-baileys')
    const sock = makeWASocket({ auth: state })
    sock.ev.on('creds.update', saveCreds)
}

connect()
```

> [!IMPORTANT]
> `useMultiFileAuthState` guarda el estado de autenticación en una carpeta. Para producción usa una base de datos SQL/NoSQL y gestiona las actualizaciones de claves con cuidado: las claves de Signal cambian al enviar y recibir mensajes, y todas las actualizaciones de `authState.keys.set()` deben persistirse, o la entrega de mensajes puede fallar.

> [!NOTE]
> Como alternativas experimentales se incluyen `useSingleFileAuthState` (con caché interna; no requiere `makeCacheableSignalKeyStore`) y `useSqliteAuthState`.

## 📡 Gestión de eventos

Kage usa la interfaz `EventEmitter`; las declaraciones públicas permiten autocompletado en editores compatibles.

```javascript
const sock = makeWASocket()
sock.ev.on('messages.upsert', ({ messages }) => {
    console.log('mensajes recibidos', messages)
})
```

> [!IMPORTANT]
> Recorre `event.messages` con un bucle para procesar **todos** los mensajes del lote.

### Eventos disponibles

```javascript
sock.ev.on('connection.update', (u) => {})
sock.ev.on('creds.update', (u) => {})
sock.ev.on('messaging-history.set', (u) => {})
sock.ev.on('messaging-history.status', (u) => {})
sock.ev.on('chats.upsert', (u) => {})
sock.ev.on('chats.update', (u) => {})
sock.ev.on('chats.delete', (u) => {})
sock.ev.on('chats.lock', (u) => {})
sock.ev.on('lid-mapping.update', (u) => {})
sock.ev.on('presence.update', (u) => {})
sock.ev.on('contacts.upsert', (u) => {})
sock.ev.on('contacts.update', (u) => {})
sock.ev.on('messages.delete', (u) => {})
sock.ev.on('messages.update', (u) => {})
sock.ev.on('messages.media-update', (u) => {})
sock.ev.on('messages.upsert', (u) => {})
sock.ev.on('messages.reaction', (u) => {})
sock.ev.on('message-receipt.update', (u) => {})
sock.ev.on('groups.upsert', (u) => {})
sock.ev.on('groups.update', (u) => {})
sock.ev.on('group-participants.update', (u) => {})
sock.ev.on('group.join-request', (u) => {})
sock.ev.on('group.member-tag.update', (u) => {})
sock.ev.on('blocklist.set', (u) => {})
sock.ev.on('blocklist.update', (u) => {})
sock.ev.on('call', (u) => {})
sock.ev.on('labels.edit', (u) => {})
sock.ev.on('labels.association', (u) => {})
sock.ev.on('newsletter.reaction', (u) => {})
sock.ev.on('newsletter.view', (u) => {})
sock.ev.on('newsletter-participants.update', (u) => {})
sock.ev.on('newsletter-settings.update', (u) => {})
sock.ev.on('settings.update', (u) => {})
```

### Descifrar votos de encuestas

Los votos llegan cifrados en `messages.update`:

```javascript
const { getAggregateVotesInPollMessage } = require('kage-baileys')

sock.ev.on('messages.update', async (updates) => {
    for (const { key, update } of updates) {
        if (update.pollUpdates && key.fromMe) {
            const pollCreation = await getMessage(key) // implementación de tu store
            if (pollCreation) {
                const votes = await getAggregateVotesInPollMessage({
                    message: pollCreation,
                    pollUpdates: update.pollUpdates
                })
                console.log(votes)
            }
        }
    }
})
```

### Descifrar respuestas de eventos

```javascript
const { jidNormalizedUser, getAggregateResponsesInEventMessage } = require('kage-baileys')

sock.ev.on('messages.update', async ([chatUpdate]) => {
    const eventResponses = chatUpdate.update?.eventResponses
    const aggregate = getAggregateResponsesInEventMessage(
        { eventResponses },
        jidNormalizedUser(sock.user.lid)
    )
    console.log(aggregate)
})
```

## 🗄️ Almacén de datos

kage-baileys no incluye almacenamiento por defecto, pero provee una implementación simple en memoria que escucha actualizaciones de chats, contactos y mensajes.

> [!CAUTION]
> Guardar todo el historial en memoria consume demasiada RAM. Para producción, construye tu propio almacén (MongoDB, PostgreSQL, etc.).

```javascript
const { default: makeWASocket, makeInMemoryStore } = require('kage-baileys')

const store = makeInMemoryStore({ })

store.readFromFile('./kage-baileys_store.json')

setInterval(() => {
    store.writeToFile('./kage-baileys_store.json')
}, 10_000)

const sock = makeWASocket({ })
store.bind(sock.ev)

sock.ev.on('chats.upsert', () => {
    console.log('chats recibidos', store.chats.all())
})

sock.ev.on('contacts.upsert', () => {
    console.log('contactos recibidos', Object.values(store.contacts))
})
```

El store también ofrece utilidades como `loadMessages` para agilizar la obtención de mensajes.

## 🪪 Identificadores de WhatsApp

El `id` (o `jid`) identifica a la persona o grupo destinatario.

| Tipo | Formato | Ejemplo |
|---|---|---|
| Usuario | `[país][número]@s.whatsapp.net` | `51987654321@s.whatsapp.net` |
| Grupo | `[id]@g.us` | `123456789-123345@g.us` |
| Lista de difusión | `[timestamp]@broadcast` | `1700000000@broadcast` |
| Estados | `status@broadcast` | `status@broadcast` |
| Canal | `[id]@newsletter` | `1231111111111@newsletter` |

### Buscar identificador de usuario (JID, PN y LID)

> [!NOTE]
> El identificador debe contener solo números y el código de país, sin `+`, paréntesis ni guiones.

```javascript
// Por número de teléfono (PN)
const ids = await sock.findUserId('51987654321@s.whatsapp.net')

// Por identificador local (LID)
const ids = await sock.findUserId('43411111111111@lid')

console.log(ids)
// ✅ Salida: { phoneNumber: '51987654321@s.whatsapp.net', lid: '43411111111111@lid' }
// ❌ Si falla: { phoneNumber: '51987654321@s.whatsapp.net', lid: undefined }
// La forma de la salida es la misma sin importar el tipo de entrada.
```

## 📤 Envío de mensajes

Una sola función envía todos los tipos de mensaje:

```javascript
const jid: string
const content: AnyMessageContent
const options: MiscMessageGenerationOptions

await sock.sendMessage(jid, content, options)
```

### Mensajes sin medios

#### Texto

```javascript
await sock.sendMessage(jid, { text: '¡Hola mundo!' })
```

#### Citar un mensaje (funciona con todos los tipos)

```javascript
await sock.sendMessage(jid, { text: '¡Hola mundo!' }, { quoted: message })
```

#### Mencionar usuarios

`@número` en el texto es opcional; los destinatarios se indican por JID:

```javascript
await sock.sendMessage(jid, {
    text: '¡Hola @12345678901!',
    mentions: ['12345678901@s.whatsapp.net']
}, { quoted: message })
```

#### Mencionar a todos los participantes del grupo

```javascript
await sock.sendMessage(jid, {
    text: '👋 ¡Hola @all!',
    mentionAll: true // menciona sin indicar cada JID manualmente
}, { quoted: message })
```

#### Reenviar mensaje

Necesita el objeto completo del mensaje (del store o del evento):

```javascript
await sock.sendMessage(jid, { forward: message, force: true }) // force opcional
```

#### Ubicación

```javascript
await sock.sendMessage(jid, {
    location: {
        degreesLatitude: 24.121231,
        degreesLongitude: 55.1121221,
        name: '👋 Estoy aquí'
    }
}, { quoted: message })

// Ubicación en tiempo real
await sock.sendMessage(jid, {
    location: { degreesLatitude: 24.121231, degreesLongitude: 55.1121221 },
    live: true
})
```

#### Contacto

```javascript
const vcard = 'BEGIN:VCARD\n'
            + 'VERSION:3.0\n'
            + 'FN:Jeff Singh\n'
            + 'ORG:Ashoka Uni;\n'
            + 'TEL;type=CELL;type=VOICE;waid=51987654321:+51 987 654 321\n'
            + 'END:VCARD'

await sock.sendMessage(jid, {
    contacts: {
        displayName: 'Jeff',
        contacts: [{ vcard }]
    }
}, { quoted: message })
```

#### Reacción

```javascript
await sock.sendMessage(jid, {
    react: {
        text: '💖', // cadena vacía para quitar la reacción
        key: message.key
    }
})
```

#### Fijar mensaje

Necesita la clave del mensaje. Duraciones:

| Tiempo | Segundos |
|-------|----------|
| 24 h | 86400 |
| 7 d | 604800 |
| 30 d | 2592000 |

```javascript
await sock.sendMessage(jid, {
    pin: {
        type: 1, // 2 para quitar
        time: 86400,
        key: message.key
    }
})
```

#### Conservar mensaje

Solo disponible en chats o grupos con mensajes temporales activados:

```javascript
await sock.sendMessage(jid, {
    keep: {
        key: message.key,
        type: 1 // o 2 para quitar
    }
})
```

#### Encuesta

```javascript
await sock.sendMessage(jid, {
    poll: {
        name: '🔥 Hora de votar',
        values: ['Sí', 'No'],
        selectableCount: 1,
        toAnnouncementGroup: false, // o true
        endDate: new Date(Date.now() + 28800000), // opcional
        hideVoter: false,   // opcional
        canAddOption: false // opcional
    }
}, { quoted: message })

// Encuesta tipo quiz en canales
await sock.sendMessage('1231111111111@newsletter', {
    poll: {
        name: '🔥 Quiz',
        values: ['Sí', 'No'],
        correctAnswer: 'Sí',
        pollType: 1
    }
})
```

#### Resultado de encuesta

```javascript
await sock.sendMessage(jid, {
    pollResult: {
        name: 'Hola',
        values: [
            ['Opción 1', 1000],
            ['Opción 2', 2000]
        ]
    }
})
```

#### Evento

```javascript
await sock.sendMessage(jid, {
    event: {
        name: '🎉 Fiesta de meetup',
        description: 'Una reunión casual para conocerse y conversar.',
        call: 'audio', // o 'video'; opcional
        startDate: new Date(Date.now() + 3600000),
        endDate: new Date(Date.now() + 28800000),
        isCancelled: false,        // opcional
        isScheduleCall: false,     // opcional
        extraGuestsAllowed: false, // opcional
        location: {
            name: 'Lima',
            degreesLatitude: -12.04,
            degreesLongitude: -77.03
        }
    }
}, { quoted: message })
```

#### Mensaje de llamada

```javascript
await sock.sendMessage(jid, {
    call: {
        name: 'Hay',
        type: 1 // 2 para video
    }
})
```

#### Invitación de grupo

```javascript
const inviteCode = groupUrl.split('chat.whatsapp.com/')[1]?.split('?')[0]

await sock.sendMessage(jid, {
    groupInvite: {
        inviteCode,
        inviteExpiration: Date.now() + 86400000,
        text: '👋 Te invitamos a unirte a nuestro grupo.',
        jid: '1201111111111@g.us',
        subject: 'kage-baileys'
    }
}, { quoted: message })
```

#### Compartir / solicitar número de teléfono

```javascript
await sock.sendMessage(jid, { sharePhoneNumber: { } })
await sock.sendMessage(jid, { requestPhoneNumber: { } })
```

#### Respuesta a botones

```javascript
// Lista
await sock.sendMessage(jid, {
    buttonReply: { name: 'Hola', description: 'descripción', rowId: 'ID' },
    type: 'list'
})

// Simple
await sock.sendMessage(jid, {
    buttonReply: { displayText: 'Hola', id: 'ID' },
    type: 'plain'
})

// Plantilla
await sock.sendMessage(jid, {
    buttonReply: { displayText: 'Hola', id: 'ID', index: 1 },
    type: 'template'
})

// Interactivo (Native Flow)
await sock.sendMessage(jid, {
    buttonReply: {
        body: 'Hola',
        nativeFlows: {
            name: 'menu_options',
            paramsJson: JSON.stringify({ id: 'ID', description: 'descripción' }),
            version: 1 // 1 | 2 | 3
        }
    },
    type: 'interactive'
})
```

## 👉🏻 Mensajes interactivos

### Botones

```javascript
// Botones simples
await sock.sendMessage(jid, {
    text: '👆 ¡Botones!',
    footer: 'kage-baileys',
    buttons: [{ text: '👋 Registro', id: '#SignUp' }]
}, { quoted: message })

// Botones con medios y flujos nativos
await sock.sendMessage(jid, {
    image: { url: './path/to/image.jpg' },
    caption: '👆 Botones y Native Flow',
    footer: 'kage-baileys',
    buttons: [
        { text: '👋 Valorar', id: '#Rating' },
        {
            text: '📋 Seleccionar',
            sections: [
                {
                    title: '✨ Sección 1',
                    rows: [{ header: '', title: '💭 Ingrediente secreto', description: '', id: '#SecretIngredient' }]
                },
                {
                    title: '✨ Sección 2',
                    highlight_label: '🔥 Popular',
                    rows: [{ header: '', title: '🏷️ Cupón', description: '', id: '#CouponCode' }]
                }
            ]
        }
    ]
}, { quoted: message })
```

### Lista

> [!NOTE]
> Este formato solo funciona en chats privados (`@s.whatsapp.net`).

```javascript
await sock.sendMessage(jid, {
    text: '📋 ¡Lista!',
    footer: 'kage-baileys',
    buttonText: '📋 Seleccionar',
    title: '👋 Hola',
    sections: [
        {
            title: '🚀 Menú 1',
            rows: [{ title: '✨ IA', description: '', rowId: '#AI' }]
        },
        {
            title: '🌱 Menú 2',
            rows: [{ title: '🔍 Buscar', description: '', rowId: '#Search' }]
        }
    ]
}, { quoted: message })
```

### Plantilla

```javascript
await sock.sendMessage(jid, {
    text: '¡Mensaje de plantilla!',
    footer: '¡Hola mundo!',
    templateButtons: [
        { index: 1, urlButton: { displayText: 'Sígueme', url: 'https://whatsapp.com/channel/0029VbBibFU9cDDbBZ06fa0U' } },
        { index: 2, callButton: { displayText: '¡Llámame!', phoneNumber: '51987654321' } },
        { index: 3, quickReplyButton: { displayText: 'Respuesta rápida', id: 'id-like-buttons-message' } }
    ]
}, { quoted: message })
```

### Plantilla enriquecida

```javascript
await sock.sendMessage(jid, {
    title: '👋 Hola',
    image: { url: './path/to/image.jpg' },
    caption: '🫙 ¡Plantilla!',
    footer: 'kage-baileys',
    templateButtons: [
        { text: '👉 Toca aquí', id: '#Order' },
        { text: '🌐 Fuente', url: 'https://www.npmjs.com/package/kage-baileys' },
        { text: '📞 Llamar', call: '51987654321' }
    ]
}, { quoted: message })
```

### Interactivo (Native Flows)

```javascript
await sock.sendMessage(jid, {
    image: { url: './path/to/image.jpg' },
    caption: '🗄️ ¡Interactivo!',
    footer: 'kage-baileys',
    optionText: '👉 Seleccionar opciones', // opcional: agrupa el flujo en una lista
    optionTitle: '📄 Seleccionar opciones', // opcional
    offerText: '🏷️ ¡Cupón nuevo!',         // opcional: añade una oferta
    offerCode: 'kage-baileys',              // opcional
    offerUrl: 'https://www.npmjs.com/package/kage-baileys', // opcional
    offerExpiration: Date.now() + 3_600_000, // opcional
    nativeFlow: [
        { text: '👋 Saludo', id: '#Greeting', icon: 'review' }, // icon opcional
        { text: '📞 Llamar', call: '51987654321' },
        { text: '📋 Copiar', copy: 'kage-baileys' },
        { text: '🌐 Fuente', url: 'https://www.npmjs.com/package/kage-baileys', useWebview: true },
        {
            text: '📋 Seleccionar',
            sections: [
                { title: '✨ Sección 1', rows: [{ header: '', title: '🏷️ Cupón', description: '', id: '#CouponCode' }] },
                { title: '✨ Sección 2', highlight_label: '🔥 Popular', rows: [{ header: '', title: '💭 Ingrediente secreto', description: '', id: '#SecretIngredient' }] }
            ],
            icon: 'default'
        }
    ],
    interactiveAsTemplate: false // opcional: envuelve el mensaje como plantilla
}, { quoted: message })
```

### Carrusel (tarjetas con botones)

```javascript
await sock.sendMessage(jid, {
    text: '🗂️ ¡Carrusel interactivo!',
    footer: 'kage-baileys',
    cards: [
        {
            image: { url: 'https://example.com/imagen1.jpg' }, // o Buffer
            title: 'Título tarjeta',
            body: 'Cuerpo tarjeta',
            footer: 'Pie tarjeta',
            buttons: [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Botón', id: 'ID' }) },
                { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Visitar', url: 'https://example.com' }) }
            ]
        },
        {
            video: { url: 'https://example.com/video1.mp4' }, // o Buffer
            title: 'Título tarjeta 2',
            body: 'Cuerpo tarjeta 2',
            footer: 'Pie tarjeta 2',
            offerText: '🏷️ ¡Cupón nuevo!',
            offerCode: 'kage-baileys',
            offerUrl: 'https://www.npmjs.com/package/kage-baileys',
            offerExpiration: Date.now() + 3_600_000,
            nativeFlow: [{ text: '🌐 Fuente', url: 'https://www.npmjs.com/package/kage-baileys' }]
        }
    ]
}, { quoted: message })
```

### Lista de productos

```javascript
// Solo en chats privados
await sock.sendMessage(jid, {
    text: '¡Lista de productos!',
    footer: '¡Hola mundo!',
    title: 'Catálogo',
    buttonText: 'Ver productos',
    productList: [{
        title: 'Productos destacados',
        products: [{ productId: '1234' }, { productId: '5678' }]
    }],
    businessOwnerJid: '51987654321@s.whatsapp.net',
    thumbnail: 'https://example.com/miniatura.jpg' // o Buffer
})
```

### Mensaje de tienda

```javascript
await sock.sendMessage(jid, {
    text: 'Cuerpo',
    title: 'Título',
    subtitle: 'Subtítulo',
    footer: 'Pie',
    shop: {
        surface: 1, // 1 | 2 | 3 | 4
        id: 'https://example.com'
    },
    viewOnce: true
})
// También admite image, video, document, location y product con el mismo campo `shop`
```

### Mensaje de colección

```javascript
await sock.sendMessage(jid, {
    text: 'Cuerpo',
    title: 'Título',
    subtitle: 'Subtítulo',
    footer: 'Pie',
    collection: {
        bizJid: 'jid',
        id: 'https://example.com',
        version: 1
    },
    viewOnce: true
})
// También admite image, video, document, location y product con el mismo campo `collection`
```

## 💰 Mensajes de pago

### Mensaje de pago

```javascript
await sock.sendMessage(jid, {
    payment: {
        note: '¡Hola!',
        currency: 'PEN',   // opcional
        offset: 0,        // opcional
        amount: '10000',  // opcional
        expiry: 0,        // opcional
        from: '51987654321@s.whatsapp.net', // opcional
        image: { // opcional
            placeholderArgb: 'tu_fondo',
            textArgb: 'tu_texto',
            subtextArgb: 'tu_subtexto'
        }
    }
})
```

### Invitación de pago

```javascript
await sock.sendMessage(jid, { paymentInvite: { type: 1, expiry: 0 } }) // type: 1 | 2 | 3
// o bien:
await sock.sendMessage(jid, { paymentInviteServiceType: 3 })
```

### Factura (experimental)

> [!NOTE]
> Las facturas son experimentales: no se garantiza su aceptación ni visualización.

```javascript
await sock.sendMessage(jid, {
    image: { url: './path/to/image.jpg' },
    invoiceNote: '🏷️ Factura'
})
```

### Pedido

```javascript
await sock.sendMessage(jid, {
    orderText: '🛍️ Pedido',
    thumbnail: fs.readFileSync('./path/to/image.jpg') // debe ser un Buffer
}, { quoted: message })
```

### Solicitud de pago

```javascript
await sock.sendMessage(jid, {
    text: '💳 Solicitud de pago',
    requestPaymentFrom: '0@s.whatsapp.net'
})
```

### Mensaje interactivo PIX (Brasil)

```javascript
await sock.sendMessage(jid, {
    text: '', // obligatoria, aunque esté vacía
    interactiveButtons: [{
        name: 'payment_info',
        buttonParamsJson: JSON.stringify({
            payment_settings: [{
                type: 'pix_static_code',
                pix_static_code: {
                    merchant_name: 'Mi Negocio',
                    key: 'ejemplo@negocio.com',
                    key_type: 'EMAIL' // PHONE | EMAIL | CPF | EVP
                }
            }]
        })
    }]
})
```

### Pago interactivo (review and pay)

```javascript
await sock.sendMessage(jid, {
    text: '', // obligatoria, aunque esté vacía
    interactiveButtons: [{
        name: 'review_and_pay',
        buttonParamsJson: JSON.stringify({
            currency: 'PEN',
            total_amount: { value: '99999', offset: '100' },
            reference_id: '45XXXXX',
            type: 'physical-goods',
            payment_method: 'confirm',
            payment_status: 'captured',
            payment_timestamp: Math.floor(Date.now() / 1000),
            order: {
                status: 'completed',
                order_type: 'PAYMENT_REQUEST',
                items: [{
                    retailer_id: 'tu_retailer_id',
                    name: 'Producto',
                    amount: { value: '99999', offset: '100' },
                    quantity: '1'
                }]
            },
            share_payment_status: false
        })
    }]
})
```

## 📁 Mensajes multimedia

> [!NOTE]
> Los medios aceptan un `Buffer`, `{ stream: Readable }` o `{ url: string }` (ruta local o HTTP/HTTPS). Los archivos se procesan como flujos para reducir el consumo de memoria.

> [!TIP]
> Usa Stream o URL para ahorrar memoria.

### Imagen

```javascript
await sock.sendMessage(jid, {
    image: { url: './Media/mi_imagen.png' },
    caption: '🔥 Increíble'
}, { quoted: message })
```

### Video

```javascript
await sock.sendMessage(jid, {
    video: { url: './Media/mi_video.mp4' },
    caption: '🔥 Increíble',
    gifPlayback: false, // true para enviar como GIF
    ptv: false         // true para video note (PTV)
}, { quoted: message })
```

### GIF

WhatsApp no admite `.gif`; envíalo como `.mp4` con `gifPlayback`:

```javascript
await sock.sendMessage(jid, {
    video: fs.readFileSync('Media/mi_gif.mp4'),
    caption: '¡Hola mundo!',
    gifPlayback: true
})
```

### Audio

Convierte con FFmpeg para máxima compatibilidad:

```bash
ffmpeg -i entrada.mp4 -avoid_negative_ts make_zero -ac 1 salida.ogg
# codec: libopus • ac: 1 • avoid_negative_ts: make_zero
```

```javascript
await sock.sendMessage(jid, {
    audio: { url: './Media/audio.mp3' },
    mimetype: 'audio/mp4',
    ptt: false // true para nota de voz
})
```

### Sticker

```javascript
await sock.sendMessage(jid, {
    sticker: { url: './Media/sticker.webp' }
}, { quoted: message })
```

### Documento

```javascript
await sock.sendMessage(jid, {
    document: { url: './Media/documento.pdf' },
    mimetype: 'application/pdf',
    caption: '✨ ¡Mi trabajo!'
}, { quoted: message })
```

### Álbum

```javascript
await sock.sendMessage(jid, {
    album: [
        { image: { url: './Media/img1.jpg' }, caption: 'Primera imagen' },
        { image: Buffer, caption: 'Segunda imagen' },
        { video: { url: './Media/video1.mp4' }, caption: 'Primer video' },
        { video: Buffer, caption: 'Segundo video' }
    ]
}, { quoted: message })
```

### Paquete de stickers

> [!IMPORTANT]
> Sin `sharp` ni `@napi-rs/image`, la portada (`cover`) y los stickers deben estar ya en formato WebP.

```javascript
await sock.sendMessage(jid, {
    stickerPack: {
        name: 'Mi pack',
        publisher: 'kage-baileys',
        description: 'Descripción',
        cover: Buffer, // Buffer de imagen
        stickers: [
            {
                sticker: { url: 'https://example.com/sticker.webp' },
                emojis: ['❤'],             // opcional
                accessibilityLabel: '',     // opcional
                isLottie: false,            // opcional
                isAnimated: false           // opcional
            },
            { sticker: Buffer, emojis: ['❤'] }
        ]
    }
})
```

## 👁️ Opciones adicionales de mensajes

### Visualización única (view once)

```javascript
await sock.sendMessage(jid, { image: { url: './Media/imagen.png' }, caption: '👁️ Una sola vista', viewOnce: true })

// Variantes del envoltorio:
// viewOnce: true              → viewOnceMessage
// viewOnceV2: true            → viewOnceMessageV2
// viewOnceV2Extension: true   → viewOnceMessageV2Extension
```

### Mensajes efímeros

Duraciones (en segundos):

| Tiempo | Segundos |
|-------|----------|
| Quitar | 0 |
| 24 h | 86400 |
| 7 d | 604800 |
| 90 d | 7776000 |

```javascript
// Activar en el chat
await sock.sendMessage(jid, { disappearingMessagesInChat: WA_DEFAULT_EPHEMERAL })

// Enviar un mensaje efímero puntual
await sock.sendMessage(jid, { text: 'hola' }, { ephemeralExpiration: WA_DEFAULT_EPHEMERAL })

// Desactivar
await sock.sendMessage(jid, { disappearingMessagesInChat: false })
```

### Temporal (ephemeral)

```javascript
await sock.sendMessage(jid, {
    image: { url: './path/to/image.jpg' },
    caption: '🕒 Temporal',
    ephemeral: true // envuelve el contenido en ephemeralMessage
})
```

### Icono de IA

> [!NOTE]
> Solo funciona en chats privados (`@s.whatsapp.net`).

```javascript
await sock.sendMessage(jid, { text: '¡Hola!' }, { ai: true })

// Con relayMessage, usa mayúscula
await sock.relayMessage(jid, { extendedTextMessage: { text: '¡Hola!' } }, { AI: true })
```

### Vista previa publicitaria (externalAdReply)

```javascript
await sock.sendMessage(jid, {
    text: '📰 Vista previa',
    externalAdReply: {
        title: '📝 ¿Sabías que…?',
        body: '❓ No lo sabía',
        thumbnail: fs.readFileSync('./path/to/image.jpg'), // debe ser un Buffer
        largeThumbnail: false, // true para miniatura grande
        url: 'https://www.npmjs.com/package/kage-baileys' // opcional
    }
}, { quoted: message })
```

### Estado de grupo

```javascript
// Solo funciona en grupos (@g.us)
await sock.sendMessage(jid, {
    image: { url: './path/to/image.jpg' },
    caption: '👥 ¡Estado de grupo!',
    groupStatus: true
})
```

### Sticker Lottie

```javascript
await sock.sendMessage(jid, {
    sticker: { url: './path/to/sticker.webp' },
    isLottie: true // envuelve el contenido en lottieStickerMessage
})
```

### Contenido oculto (spoiler)

```javascript
await sock.sendMessage(jid, {
    image: { url: './path/to/image.jpg' },
    caption: '❔ Spoiler',
    spoiler: true // envuelve el contenido en spoilerMessage
})
```

### Etiqueta de servicio seguro de Meta

```javascript
await sock.sendMessage(jid, {
    text: '🏷️ Solo una etiqueta',
    secureMetaServiceLabel: true
})
```

### Contenido directo (raw)

```javascript
await sock.sendMessage(jid, {
    extendedTextMessage: {
        text: '📃 Construido manualmente con la estructura del proto de WhatsApp',
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
}, { quoted: message })
```

### Audio en el pie (audioFooter)

```javascript
await sock.sendMessage(jid, {
    text: '🔈 ¡Música en el pie!',
    audioFooter: { url: './path/to/audio.mp3' }, // también Buffer o stream
    nativeFlow: [
        { text: '👍 Bien, siguiente', id: '#Next', icon: 'review' },
        { text: '👎 Saltar', id: '#Skip', icon: 'default' }
    ]
}, { quoted: message })
```

### Vista previa de enlaces

1. WhatsApp Web no siempre genera la vista previa de enlaces.
2. kage-baileys permite generar los datos de la vista previa (p. ej. con `link-preview-js` o `unfurl.js`).
3. Envía el enlace normalmente:

```javascript
await sock.sendMessage(jid, {
    text: 'Hola, enviado con https://www.npmjs.com/package/kage-baileys'
})
```

## ✨ Mensajes enriquecidos (nuevo)

### Respuesta enriquecida (rich response)

> [!NOTE]
> `richResponse[]` representa los elementos `submessages[]` de `richResponseMessage`. También puedes usar el campo `submessages[]` directamente.

```javascript
await sock.sendMessage(jid, {
    disclaimerText: 'Ejemplo de estructura RAW',
    richResponse: [
        { text: 'Ejemplo de uso' },
        {
            language: 'javascript',
            code: [{ highlightType: 0, codeContent: 'console.log("¡Hola, mundo!")' }]
        },
        { text: '¿Simple, verdad?\n' },
        { text: 'Comparación entre Node.js, Bun y Deno' },
        {
            title: 'Comparación de runtimes',
            table: [
                { isHeading: true, items: ['', 'Node.js', 'Bun', 'Deno'] },
                { isHeading: false, items: ['Motor', 'V8 (C++)', 'JavaScriptCore (C++)', 'V8 (C++)'] },
                { isHeading: false, items: ['Rendimiento', '4/5', '5/5', '4/5'] }
            ]
        },
        { text: '¿Esto ayuda a entender las diferencias?' }
    ]
})
```

Con resaltado de sintaxis mediante `tokenizeCode`:

```javascript
const { tokenizeCode } = require('kage-baileys')

await sock.sendMessage(jid, {
    disclaimerText: 'Ejemplo con tokenizador',
    richResponse: [
        { text: 'Ejemplo de uso' },
        { language: 'javascript', code: tokenizeCode('console.log("¡Hola, mundo!")', 'javascript') },
        { text: '¿Simple, verdad?' }
    ]
})
```

> 💡 Lenguajes disponibles: `css`, `html`, `javascript`, `typescript`, `python`, `golang`, `rust`, `c`, `c#`, `c++`, `bash`, `bat` y `powershell`.

### Mensaje con bloque de código

Incluye el analizador `tokenizeCode` de forma automática:

```javascript
await sock.sendMessage(jid, {
    disclaimerText: 'Bloque de código',
    headerText: '## Ejemplo de uso',
    contentText: '---',
    code: 'console.log("¡Hola, mundo!")',
    language: 'javascript',
    footerText: '¿Simple, verdad?'
})
```

### Mensaje con entidades en línea

```javascript
await sock.sendMessage(jid, {
    disclaimerText: 'Entidades en línea',
    headerText: '## ¡Echa un vistazo!',
    contentText: '---',
    links: [
        { text: '1. Google', title: 'Buscador popular', url: 'https://www.google.com/' },
        { text: '2. YouTube', title: 'Plataforma de streaming', url: 'https://www.youtube.com/' },
        { text: '3. kage-baileys', title: 'Librería infravalorada', url: 'https://www.npmjs.com/package/kage-baileys' }
    ],
    footerText: '---'
})
```

### Mensaje con tabla

```javascript
await sock.sendMessage(jid, {
    disclaimerText: 'Tabla',
    headerText: '## Comparación entre Node.js, Bun y Deno',
    contentText: '---',
    title: 'Comparación de runtimes',
    table: [
        ['', 'Node.js', 'Bun', 'Deno'],
        ['Motor', 'V8 (C++)', 'JavaScriptCore (C++)', 'V8 (C++)'],
        ['Rendimiento', '4/5', '5/5', '4/5']
    ],
    noHeading: false, // opcional
    footerText: '¿Esto ayuda a entender las diferencias?'
})
```

## ♻️ Modificar mensajes

### Eliminar (para todos)

```javascript
const msg = await sock.sendMessage(jid, { text: '¡Hola mundo!' })
await sock.sendMessage(jid, { delete: msg.key })
```

> [!NOTE]
> Eliminar solo para ti se hace mediante `chatModify`; consulta [Modificar chats](#-modificar-chats).

### Editar

```javascript
// Editar texto
await sock.sendMessage(jid, { text: '✨ Quiero decir: ¡muy bien!', edit: message.key })

// Editar el caption de un mensaje con medios
await sock.sendMessage(jid, { caption: '✨ Aquí está la imagen', edit: message.key })
```

## 🖼️ Procesar mensajes multimedia

### Miniaturas

- Imágenes y stickers: miniatura automática si añades `jimp` o `sharp`.
- Video: requiere `ffmpeg` instalado.

### Descargar medios de un mensaje

```javascript
const { createWriteStream } = require('fs')
const { downloadMediaMessage, getContentType } = require('kage-baileys')

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
        stream.pipe(createWriteStream('./mi-descarga.jpeg'))
    }
})
```

### Volver a subir medios

WhatsApp elimina los medios antiguos de su servidor; vuelve a subirlos con:

```javascript
await sock.updateMediaMessage(msg)
```

### Funciones utilitarias

- `getContentType` — devuelve el tipo de contenido de un mensaje.
- `getDevice` — devuelve el dispositivo desde el que se envió el mensaje.
- `makeCacheableSignalKeyStore` — acelera el store de autenticación.
- `downloadContentFromMessage` — descarga el contenido de un mensaje.

### Procesamiento de imágenes

Kage selecciona automáticamente el motor disponible (`sharp`, `@napi-rs/image` o `jimp`):

```javascript
const { getImageProcessingLibrary } = require('kage-baileys')
const { readFile } = require('fs/promises')

const lib = await getImageProcessingLibrary()
const width = 512
let output

// --- Con sharp
if (lib.sharp?.default) {
    output = await lib.sharp.default('./imagen.jpg')
        .resize(width)
        .jpeg({ quality: 80 })
        .toBuffer()
}
// --- Con @napi-rs/image (requiere Buffer)
else if (lib.image?.Transformer) {
    const input = await readFile('./imagen.jpg')
    output = await new lib.image.Transformer(input)
        .resize(width, undefined, 0)
        .jpeg(50)
}
// --- Con jimp
else if (lib.jimp?.Jimp) {
    const img = await lib.jimp.Jimp.read('./imagen.jpg')
    output = await img
        .resize({ w: width, mode: lib.jimp.ResizeStrategy.BILINEAR })
        .getBuffer('image/jpeg', { quality: 50 })
}
else {
    throw new Error('No hay motor de procesamiento de imágenes disponible')
}
```

## 📞 Llamadas

### Rechazar llamadas

Obtén `callId` y `callFrom` del evento `call`:

```javascript
sock.ev.on('call', async ({ id, from }) => {
    await sock.rejectCall(id, from)
})
```

Los módulos VoIP (`VoipClient`, `ActiveCall`, `CallState`) se incluyen como extras; consulta [Módulos extra Kage](#-módulos-extra-kage).

## 💬 Estados de envío y presencia

### Leer mensajes

Las claves deben marcarse como leídas explícitamente:

```javascript
await sock.readMessages([key]) // admite varias claves
await sock.sendReceipt(jid, participant, [messageId], 'read')
```

El identificador único del mensaje está en `message.key.id`.

### Actualizar presencia

`presence` puede ser: `available`, `composing`, `recording`, `paused`, `unavailable`. Dura 10 segundos.

```javascript
await sock.sendPresenceUpdate('available', jid)
await sock.presenceSubscribe(jid) // suscribirse a la presencia de alguien
```

> [!NOTE]
> Si el cliente de escritorio está activo, WhatsApp no envía notificaciones push. Para recibirlas, ponte offline con `await sock.sendPresenceUpdate('unavailable')`.

## 📁 Modificar chats

> [!IMPORTANT]
> WhatsApp usa comunicación cifrada para las actualizaciones de chats. Si actualizas mal, puedes cerrar la sesión en todos los dispositivos.

### Archivar un chat

```javascript
const lastMsgInChat = await getLastMessageInChat(jid) // impleméntalo tú mismo
await sock.chatModify({ archive: true, lastMessages: [lastMsgInChat] }, jid)
```

### Silenciar / quitar silencio

| Tiempo | Milisegundos |
|-------|--------------|
| Quitar | `null` |
| 8 h | 28800000 |
| 7 d | 604800000 |

```javascript
await sock.chatModify({ mute: 8 * 60 * 60 * 1000 }, jid) // silenciar 8 horas
await sock.chatModify({ mute: null }, jid)               // quitar silencio
```

### Marcar como leído / no leído

```javascript
const lastMsgInChat = await getLastMessageInChat(jid)
await sock.chatModify({ markRead: false, lastMessages: [lastMsgInChat] }, jid) // no leído
```

### Eliminar mensajes para mí

```javascript
await sock.chatModify({
    clear: {
        messages: [
            { id: 'ATWYHDNNWU81732J', fromMe: true, timestamp: '1654823909' }
        ]
    }
}, jid)
```

### Eliminar un chat

```javascript
const lastMsgInChat = await getLastMessageInChat(jid)
await sock.chatModify({
    delete: true,
    lastMessages: [{
        key: lastMsgInChat.key,
        messageTimestamp: lastMsgInChat.messageTimestamp
    }]
}, jid)
```

### Fijar / quitar fijado de un chat

```javascript
await sock.chatModify({ pin: true }, jid) // false para quitar
```

### Destacar mensajes

```javascript
await sock.star(jid, [{ id: messageId, fromMe: true }], true) // false para quitar
```

### Contactos y etiquetas

```javascript
await sock.addOrEditContact(jid, { displayName: 'Nombre' })
await sock.removeContact(jid)

await sock.addChatLabel(jid, labelId)
await sock.removeChatLabel(jid, labelId)
await sock.addMessageLabel(jid, messageId, labelId)

// Resincronizar estado de la app
await sock.resyncAppState(['regular', 'critical_block'], true)
```

## 👤 Consultas de usuario

### Comprobar si un ID existe en WhatsApp

```javascript
const [result] = await sock.onWhatsApp(jid)
if (result.exists) console.log(`${jid} existe, con jid: ${result.jid}`)
```

### Consultar historial de chat (también en grupos)

Necesita el mensaje más antiguo del chat (máx. 50 por consulta):

```javascript
const msg = await getOldestMessageInChat(jid) // impleméntalo tú mismo
await sock.fetchMessageHistory(50, msg.key, msg.messageTimestamp)
// Los mensajes llegan en el evento 'messaging-history.set'
```

### Obtener el estado (info)

```javascript
const status = await sock.fetchStatus(jid)
console.log('estado: ' + status)
```

### Obtener foto de perfil (también de grupos)

```javascript
const ppUrl = await sock.profilePictureUrl(jid)          // baja resolución
const ppUrlHD = await sock.profilePictureUrl(jid, 'image') // alta resolución
```

### Obtener perfil de negocio

```javascript
const profile = await sock.getBusinessProfile(jid)
console.log('descripción:', profile.description, '| categoría:', profile.category)
```

### Obtener la presencia de alguien

```javascript
sock.ev.on('presence.update', console.log)
await sock.presenceSubscribe(jid)
```

## 🔄 Modificar perfil

```javascript
await sock.updateProfileStatus('¡Hola mundo!')       // estado
await sock.updateProfileName('Mi Nombre')            // nombre
await sock.updateProfilePicture(jid, { url: './foto-perfil.jpeg' }) // foto (también grupos)
await sock.removeProfilePicture(jid)                 // eliminar foto (también grupos)
```

> [!NOTE]
> Como en los mensajes multimedia, acepta `{ stream }`, `{ url }` o un `Buffer`.

### 🖼️ Portada de perfil (Cover Photo) — Cuentas normales y Business [NUEVO]

WhatsApp añadió en 2026 la foto de portada (cover photo / banner) también a **cuentas normales** (antes solo Business). Kage Baileys lo soporta:

```javascript
// Actualizar portada (funciona en cuenta normal y Business)
const coverId = await sock.updateProfileCoverPhoto({ url: './portada-landscape.jpg' })
// o
const coverId = await sock.updateCoverPhoto({ url: './portada.jpg' })   // alias Business

// También acepta Buffer o stream
const coverId2 = await sock.updateProfileCoverPhoto(fs.readFileSync('./banner.png'))

// Eliminar portada
await sock.removeProfileCoverPhoto(coverId)
// o
await sock.removeCoverPhoto(coverId)
```

> La imagen se recomienda en formato horizontal (landscape). WhatsApp la recorta automáticamente al ratio de portada.  
> En cuentas normales el feature se está desplegando de forma gradual; si el servidor aún no lo tiene habilitado para la sesión puede devolver error temporal.


### 👤 Avatar por defecto estilo WhatsApp (sin foto de perfil)

Cuando un contacto, grupo, comunidad o canal **no tiene foto** (o está oculta por privacidad), genera automáticamente un avatar idéntico al de WhatsApp:

- Misma **paleta de 15 colores**
- Color **determinista** por JID (mismo ID = mismo color siempre)
- Silueta **simple** para usuarios y canales
- Silueta **doble** para grupos y comunidades
- PNG 512×512 listo para enviar o usar como miniatura
- Sin dependencia extra: usa `sharp` (ya incluido)

```javascript
const {
  obtenerFotoPerfil,
  obtenerFotoPerfilBuffer,
  obtenerAvatarPorDefecto,
  generarAvatar,
  comoImagen,
  colorParaId
} = require('kage-baileys')

// 1) Intenta la foto real; si no hay → genera avatar
const foto = await obtenerFotoPerfil(sock, jid)           // URL o Buffer
const buffer = await obtenerFotoPerfilBuffer(sock, jid)   // siempre Buffer

// 2) Forzar solo el avatar (nunca consulta WhatsApp)
const avatar = await obtenerAvatarPorDefecto(jid)
// o
const avatar2 = await generarAvatar(jid, jid.endsWith('@g.us'))

// 3) Enviar como imagen
await sock.sendMessage(chatId, {
  image: comoImagen(foto),
  caption: 'Foto de perfil o avatar por defecto'
})

// Color del avatar de un JID
console.log(colorParaId('51900000000@s.whatsapp.net'))
```

> Funciona con `@s.whatsapp.net`, `@g.us`, `@newsletter` (canales), comunidades y LIDs.


## 👥 Grupos

Para modificar propiedades del grupo debes ser administrador.

```javascript
// Crear
const group = await sock.groupCreate('Mi Grupo', ['1234@s.whatsapp.net', '4564@s.whatsapp.net'])
console.log('grupo creado:', group.id)

// Metadatos
const metadata = await sock.groupMetadata(jid)
console.log(metadata.id, '| título:', metadata.subject, '| descripción:', metadata.desc)

// Participantes: 'add' | 'remove' | 'promote' | 'demote'
await sock.groupParticipantsUpdate(jid, ['abcd@s.whatsapp.net'], 'add')

// Asunto y descripción
await sock.groupUpdateSubject(jid, '¡Nuevo asunto!')
await sock.groupUpdateDescription(jid, '¡Nueva descripción!')

// Configuración
await sock.groupSettingUpdate(jid, 'announcement')      // solo admins publican
await sock.groupSettingUpdate(jid, 'not_announcement')  // todos publican
await sock.groupSettingUpdate(jid, 'locked')            // solo admins cambian config
await sock.groupSettingUpdate(jid, 'unlocked')          // todos cambian config

// Invitaciones
const code = await sock.groupInviteCode(jid)          // enlace: https://chat.whatsapp.com/ + code
await sock.groupRevokeInvite(jid)                     // revocar
await sock.groupAcceptInvite(code)                   // unirse
const info = await sock.groupGetInviteInfo(code)      // info desde el código
await sock.groupAcceptInviteV4(jid, groupInviteMessage) // unirse con invite message

// Solicitudes de unión
const requests = await sock.groupRequestParticipantsList(jid)
await sock.groupRequestParticipantsUpdate(jid, ['abcd@s.whatsapp.net'], 'approve') // o 'reject'

// Aprobar automáticamente a nuevos miembros
await sock.groupJoinApprovalMode(jid, 'on')  // u 'off'

// Etiqueta de miembro
await sock.updateMemberLabel(jid, 'kage-baileys')

// Otros
await sock.groupLeave(jid)
const groups = await sock.groupFetchAllParticipating()

// Efímeros: 0 | 86400 | 604800 | 7776000
await sock.groupToggleEphemeral(jid, 86400)

// Modo de añadir
await sock.groupMemberAddMode(jid, 'all_member_add') // o 'admin_add'
```

## 🏘️ Comunidades

```javascript
// Crear comunidad y grupos vinculados
const community = await sock.communityCreate('kage-baileys', '📣 Novedades cada semana')
const group = await sock.communityCreateGroup('📢 Anuncios', ['51987654321@s.whatsapp.net'], communityJid)

// Vincular / desvincular grupos
await sock.communityLinkGroup(groupJid, communityJid)
await sock.communityUnlinkGroup(groupJid, communityJid)

// Consultas
const metadata = await sock.communityMetadata(jid)
const inviteCode = await sock.communityInviteCode(jid)
const linked = await sock.communityFetchLinkedGroups(jid)
const requests = await sock.communityRequestParticipantsList(jid)
const communities = await sock.communityFetchAllParticipating()
const info = await sock.communityGetInviteInfo('ABC123456789')

// Administración
await sock.communityUpdateSubject(jid, '📦 kage-baileys')
await sock.communityUpdateDescription(jid, 'Descripción actualizada')
await sock.communitySettingUpdate(jid, 'announcement') // 'not_announcement' | 'locked' | 'unlocked'
await sock.communityMemberAddMode(jid, 'admin_add')    // o 'all_member_add'
await sock.communityToggleEphemeral(jid, 86400)         // 0 para desactivar
await sock.communityJoinApprovalMode(jid, 'on')         // u 'off'
await sock.communityRequestParticipantsUpdate(jid, ['jid'], 'approve')
await sock.communityRevokeInvite(jid)
await sock.communityAcceptInvite(inviteCode)
await sock.communityLeave(jid)
```

## 📣 Canales (newsletters)

```javascript
// Crear
await sock.newsletterCreate('kage-baileys', '📣 Novedades cada semana')

// Consultas
const metadata = await sock.newsletterMetadata('1231111111111@newsletter')
const subscribers = await sock.newsletterSubscribers('1231111111111@newsletter')
const following = await sock.newsletterSubscribed()
const admins = await sock.newsletterAdminCount('1231111111111@newsletter')
const messages = await sock.newsletterFetchMessages('jid', '1231111111111@newsletter', 50, 0, 0)

// Seguir / silenciar
await sock.newsletterFollow('1231111111111@newsletter')
await sock.newsletterUnfollow('1231111111111@newsletter')
await sock.newsletterMute('1231111111111@newsletter')
await sock.newsletterUnmute('1231111111111@newsletter')

// Actualizar
await sock.newsletterUpdate('1231111111111@newsletter', { name: 'kage-baileys' })
await sock.newsletterUpdateName('1231111111111@newsletter', '📦 kage-baileys')
await sock.newsletterUpdateDescription('1231111111111@newsletter', '📣 Novedades')
await sock.newsletterUpdatePicture('1231111111111@newsletter', { url: 'path/to/image.jpg' })
await sock.newsletterRemovePicture('1231111111111@newsletter')

// Administración
await sock.newsletterDemote('1231111111111@newsletter', '51987654321@s.whatsapp.net')
await sock.newsletterChangeOwner('1231111111111@newsletter', '51987654321@s.whatsapp.net')

// Reaccionar a un mensaje del canal
await sock.newsletterReactMessage('1231111111111@newsletter', '100', '💛')

// Eliminar
await sock.newsletterDelete('1231111111111@newsletter')
```

## 🛒 Gestión empresarial

```javascript
// Productos del catálogo
const product = await sock.productCreate({
    name: '🧩 Mi Producto (Premium)',
    description: '¡Obtén la versión completa!',
    price: 100000,
    currency: 'PEN',
    originCountryCode: 'PE',
    images: [bufferImage, { url: './path/to/image.jpg' }]
})

await sock.productUpdate(productId, { name: '🧩 Mi Producto', price: 75000, currency: 'PEN' })
await sock.productDelete([productId])

const { products, nextPageCursor } = await sock.getCatalog({
    jid: '51987654321@s.whatsapp.net',
    limit: 10
})

const collections = await sock.getCollections('51987654321@s.whatsapp.net', 10)
const order = await sock.getOrderDetails(orderId, tokenBase64)

// Perfil de negocio
await sock.updateBusinessProfile({
    address: 'Lima, Perú',
    description: '🛒 Tienda oficial',
    websites: ['https://www.npmjs.com/package/kage-baileys'],
    email: 'correo@ejemplo.com',
    hours: {
        timezone: 'America/Lima',
        days: [{ day: 'mon', mode: 'open_24h' }]
    }
})

await sock.updateCoverPhoto({ url: './path/to/image.jpg' })
await sock.removeCoverPhoto(coverId)

// Respuestas rápidas
await sock.addOrEditQuickReply({ shortcut: 'hola', message: '¡Hola desde la cuenta de negocio!' })
await sock.removeQuickReply(timestamp)
```

## 🔒 Privacidad

```javascript
// Bloquear / desbloquear
await sock.updateBlockStatus(jid, 'block')
await sock.updateBlockStatus(jid, 'unblock')

// Consultar configuración y lista de bloqueados
const privacySettings = await sock.fetchPrivacySettings(true)
const blocked = await sock.fetchBlocklist()

// Última vez vista: 'all' | 'contacts' | 'contact_blacklist' | 'nobody'
await sock.updateLastSeenPrivacy('all')

// Estado en línea: 'all' | 'match_last_seen'
await sock.updateOnlinePrivacy('all')

// Foto de perfil: 'all' | 'contacts' | 'contact_blacklist' | 'none'
await sock.updateProfilePicturePrivacy('contacts')

// Estados: 'all' | 'contacts' | 'contact_blacklist' | 'none'
await sock.updateStatusPrivacy('contacts')

// Confirmaciones de lectura: 'all' | 'none'
await sock.updateReadReceiptsPrivacy('all')

// Añadir a grupos: 'all' | 'contacts' | 'contact_blacklist'
await sock.updateGroupsAddPrivacy('all')

// Mensajes: 'all' | 'contacts' | 'nobody'
await sock.updateMessagesPrivacy('all')

// Llamadas: 'everyone' | ...
await sock.updateCallPrivacy('everyone')

// Modo efímero por defecto: 0 | 86400 | 604800 | 7776000
await sock.updateDefaultDisappearingMode(86400)

// Vista previa de enlaces
await sock.updateDisableLinkPreviewsPrivacy(true)
```

## 📢 Listas de difusión y estados

### Enviar difusiones y estados

Añade las opciones de mensaje; el cuerpo puede ser `extendedTextMessage`, `imageMessage`, etc.:

```javascript
await sock.sendMessage(
    jid,
    { image: { url: url }, caption: caption },
    {
        backgroundColor: backgroundColor, // opcional
        font: font,                       // opcional
        statusJidList: statusJidList,    // lista de destinatarios
        broadcast: true                   // activa el modo difusión
    }
)
```

El ID de difusión es `[timestamp]@broadcast`. Para estados: `status@broadcast`.

### Consultar destinatarios y nombre de la lista

```javascript
const bList = await sock.getBroadcastListInfo('1234@broadcast')
console.log(`nombre: ${bList.name}, destinatarios: ${bList.recipients}`)
```

### Menciones en estados

```javascript
const jids = [
    '123451679@g.us',
    '62689xxxx@s.whatsapp.net'
    // máximo 5 menciones por estado
]

// Texto
await sock.sendStatusMentions({
    text: '¡Hola a todos! 👋',
    font: 2,                    // opcional
    textColor: 'FF0000',        // opcional
    backgroundColor: '#000000' // opcional
}, jids)

// Imagen, video o audio (también aceptan Buffer)
await sock.sendStatusMentions({
    image: { url: 'https://example.com/foto.jpg' },
    caption: '¡Hola a todos! 👋' // opcional
}, jids)

await sock.sendStatusMentions({
    audio: { url: 'https://example.com/audio.mp3' },
    backgroundColor: '#000000', // opcional
    mimetype: 'audio/mp4',
    ppt: true
}, jids)
```

## 🛠️ Funciones personalizadas

kage-baileys está diseñado para extenderse sin hacer fork.

### Activar el nivel debug

```javascript
const sock = makeWASocket({
    logger: pino({ level: 'debug' })
})
```

### Cómo se comunica WhatsApp

> [!TIP]
> Estudia el protocolo con el Libsignal Protocol y el Noise Protocol.

Ejemplo: activa los logs y verás frames como este (nivel de batería del teléfono):

```json
{
    "level": 10,
    "fromMe": false,
    "frame": {
        "tag": "ib",
        "attrs": { "from": "@s.whatsapp.net" },
        "content": [
            {
                "tag": "edge_routing",
                "attrs": {},
                "content": [
                    {
                        "tag": "routing_info",
                        "attrs": {},
                        "content": { "type": "Buffer", "data": [8, 2, 8, 5] }
                    }
                ]
            }
        ]
    },
    "msg": "communication"
}
```

`frame` tiene: `tag` (tipo de frame), `attrs` (metadatos), `content` (datos).

### Registrar callbacks del websocket

```javascript
// Para el tag 'edge_routing'
sock.ws.on('CB:edge_routing', (node) => { })

// Con id 'abcd'
sock.ws.on('CB:edge_routing,id:abcd', (node) => { })

// Con el nodo routing_info
sock.ws.on('CB:edge_routing,id:abcd,routing_info', (node) => { })
```

## 🧩 Módulos extra Kage

```javascript
// En Node moderno vienen exportados automáticamente.
// En versiones antiguas:
const extras = await require('kage-baileys').cargarExtrasKage()
// extras: message_builder (botones/carruseles/flows), VoipClient, ActiveCall, CallState
```

## 💡 Consejos y buenas prácticas

- **Usa caché**: cachea los metadatos de grupos para mejorar el rendimiento.
- **Gestiona la reconexión**: implementa auto-reconnect para mayor estabilidad.
- **Gestiona el store**: usa una base de datos (MongoDB, PostgreSQL) en producción.
- **Manejo de errores**: envuelve las llamadas del socket en `try/catch`.
- **Límites de velocidad**: respeta los límites de WhatsApp para evitar baneos; no hagas spam.
- **Seguridad**: no compartas credenciales de autenticación; usa variables de entorno.

## ⚠️ Advertencia

Este proyecto **no está afiliado, relacionado, autorizado ni respaldado** oficialmente por WhatsApp ni sus filiales. El sitio oficial de WhatsApp es [whatsapp.com](https://www.whatsapp.com/).

Los mantenedores de kage-baileys no respaldan el uso de esta librería para violar los Términos de Servicio de WhatsApp. Enfatizamos la responsabilidad personal del usuario para un uso justo y responsable.

> Usa con sabiduría. Evita el spam. No uses automatización excesiva.

## 📄 Licencia y reconocimientos

Distribuido bajo la **Licencia GPL-3.0**. Consulta [LICENSE](LICENSE) para más información.

La identidad del paquete es **Kage Baileys**. Los avisos originales exigidos por las licencias se conservan en `LICENSE` y `licenses/`; los créditos de los componentes no se sustituyen por los del autor de esta distribución. **La redistribución debe respetar los avisos de autoría y las condiciones de licencia.** Gracias 🤍

### Seguridad de dependencias

El informe `maintenance/dependency-audit.json` refleja la auditoría de dependencias de cada entrega. Las alertas sin una actualización compatible no se ocultan ni equivalen a fallos funcionales. Revisa ese informe antes de exponer el servicio a archivos de origen no confiables. No se sustituyen dependencias por versiones mayores sin verificar su compatibilidad.

---

## 💬 Únete al canal

Mantente informado de las actualizaciones y novedades del proyecto:

[![Canal de WhatsApp](https://img.shields.io/badge/WhatsApp-Unirse%20al%20canal-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029VbBibFU9cDDbBZ06fa0U)

**https://whatsapp.com/channel/0029VbBibFU9cDDbBZ06fa0U**

---

<div align="center">

**kage-baileys** — la mejor Baileys de 2026 · API de WhatsApp Web con corrección de @lid a @pn

Creado con 🤍 por **Jose** ([xrljosedv](https://github.com/xrljosedv))

</div>
