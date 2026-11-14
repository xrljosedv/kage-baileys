export interface StickerPackInput {
  name: string
  publisher?: string
  description?: string
  packId?: string
  stickers?: any[]
  cover?: any
  contextInfo?: any
}
export declare function makeStickerPack(input: StickerPackInput): { stickerPack: any; contextInfo?: any }
