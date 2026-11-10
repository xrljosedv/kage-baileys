# Reparaciones de esta entrega

## Cambios funcionales

1. `package.json`: sharp 0.35.5 explícito y WASM de la misma versión; se elimina el peer opcional duplicado. Se agrega archivo de bloqueo reproducible.
2. `lib/Utils/image-processing.js`: selección diferida de motor, conversiones reales, validación de geometría y respaldo Jimp sin avisos al importar.
3. `lib/Modded/message_builder.js`: las dos variantes de Toolkit delegan el redimensionado al módulo común; no vuelven a llamar a un sharp indefinido.
4. `lib/Utils/messages-media.js`: se repara la ruta pública efectiva de miniaturas/perfiles y el selector adicional; se conserva el resto de implementaciones de compatibilidad. Las dimensiones opcionales ahora funcionan y el valor predeterminado permanece 640px.
5. Se elimina la regla que cruzaba Zod 3 a Zod 4 y rompía Jimp; la prueba de política se actualiza a la corrección compatible. Esto no elimina las alertas de seguridad documentadas.
6. `Example/connection.cjs`: requisito Node alineado con engines.
7. Nuevos diagnóstico e inventario verificables; pruebas de nativo, WebAssembly y ausencia simulada de motores nativos. No se desactivan avisos globales.
8. README principal reorganizado; manual histórico preservado byte por byte, sin presentar sus fragmentos como garantías contra WhatsApp.

## Conservación

No se han quitado funciones, módulos, créditos ni pruebas preexistentes. El archivo de tests de publicación solo cambia la expectativa de Zod porque la regla anterior era justamente la causa de un fallo reproducible.

No se incluyen node_modules ni sesiones: deben instalarse en la plataforma final y nunca compartirse como parte del código.

## Alcance

La validación es local sobre Linux x64 y la versión de Node del informe adjunto. La falta de binarios nativos se simula para probar WASM/Jimp. No demuestra compatibilidad física con todos los hostings ni valida una sesión o llamada real de WhatsApp.

El ZIP original contiene avisos de licencia particulares en el constructor de mensajes. Esos avisos se conservan; comprueba los derechos correspondientes antes de publicar la distribución.
