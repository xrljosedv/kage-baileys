# MessageBuilder (integrado en Kage)

No hace falta `npm install baileys-mbuilder`. Todo viene dentro de Kage.

```js
const { MessageBuilder, Button, ButtonV2, Carousel, AIRich, bind } = require('kage-baileys');
// o
const MB = require('kage-baileys/lib/MessageBuilder');

// Botón simple
const msg = new MB.Button()
  .text('Elige una opción')
  .button('Perfil', 'perfil')
  .button('Ayuda', 'ayuda')
  .footer('Kage')
  .build();

// Con socket (recomendado)
const Bound = bind(sock); // o MB.bind(sock)
await new Bound.Button()
  .text('Hola')
  .button('OK', 'ok1')
  .send(jid);

// Carousel
await new Bound.Carousel()
  .card(c => c.title('Card 1').text('Desc').button('Ver', 'v1'))
  .card(c => c.title('Card 2').text('Desc').button('Ver', 'v2'))
  .send(jid);

// AIRich
await new Bound.AIRich()
  .text('Visita [Google](https://google.com)')
  .send(jid);
```

Dependencias ya incluidas en Kage: `sharp`, `fluent-ffmpeg` (opcional para previews de video).
