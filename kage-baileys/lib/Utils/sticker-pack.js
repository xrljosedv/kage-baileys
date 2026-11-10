"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } 



const DEFAULT_EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🔥",
  "👍",
  "🎉",
  "😎",
  "🤩",
  "💯",
  "🥳",
];

 










const normalizeSticker = (entry, index) => {
  if (
    Buffer.isBuffer(entry) ||
    (entry &&
      typeof entry === "object" &&
      "url" in entry &&
      !("sticker" in entry))
  ) {
    return {
      sticker: entry,
      emojis: [DEFAULT_EMOJIS[index % DEFAULT_EMOJIS.length]],
      accessibilityLabel: "",
    };
  }
  return {
    sticker: entry.sticker || entry.data,
    emojis: entry.emojis || [DEFAULT_EMOJIS[index % DEFAULT_EMOJIS.length]],
    accessibilityLabel: entry.accessibilityLabel || "",
  };
};

 

































 const makeStickerPack = ({
  name,
  publisher = "Jose AI",
  description = "",
  packId,
  stickers = [],
  cover,
  contextInfo,
} = {}) => {
  if (!name) throw new Error("makeStickerPack: name is required");
  if (!stickers.length)
    throw new Error("makeStickerPack: at least one sticker is required");

  const normalizedStickers = stickers.map(normalizeSticker);
  const resolvedCover = _nullishCoalesce(cover, () => ( normalizedStickers[0].sticker));

  return {
    stickerPack: {
      name,
      publisher,
      description,
      ...(packId ? { packId } : {}),
      stickers: normalizedStickers,
      cover: resolvedCover,
    },
    ...(contextInfo ? { contextInfo } : {}),
  };
}; exports.makeStickerPack = makeStickerPack;
