# Kage Baileys — merge Baileys + sticker pack fix

## Fixes
- MEDIA_PATH_MAP `sticker-pack` → `/mms/sticker` (Baileys-compatible upload host)
- `thumbnail-sticker-pack` → `/mms/image`
- messages-media forces correct path even if map is wrong
- Cover of sticker packs converted to JPEG before prepareWAMessageMedia
- Utils/index exports sticker-pack and related helpers
- Dependencies aligned with Baileys (fflate, audio-decode, etc.)

## Kept from Kage
- Interactive messages, AI/rich builders, VoIP, status tools
- makeStickerPack helper
- Extensions, Modded message_builder, username, LID mapping
