import { EventEmitter } from 'events'

export const proto: any
export { proto as WAProto }

export type WAMessage = any
export type WAMessageKey = any
export type WAMessageContent = any

export interface SocketConfig {
  auth: any
  logger?: any
  browser?: [string, string, string]
  syncFullHistory?: boolean
  markOnlineOnConnect?: boolean
  getMessage?: (key: WAMessageKey) => Promise<WAMessageContent | undefined>
  [option: string]: any
}

export interface WASocket {
  ev: EventEmitter & { process(handler: (events: Record<string, any>) => any): () => void }
  user?: { id: string; name?: string; lid?: string }
  relayMessage(jid: string, message: WAMessageContent, options?: Record<string, any>): Promise<string>
  sendMessage(jid: string, content: Record<string, any>, options?: Record<string, any>): Promise<WAMessage | undefined>
  end(error?: Error): void
  waUploadToServer?: (...args: any[]) => Promise<any>
  [method: string]: any
}

export declare function makeWASocket(config: SocketConfig): WASocket
export default makeWASocket

export declare const Browsers: any
export declare const DisconnectReason: any
export declare const downloadContentFromMessage: any
export declare const downloadMediaMessage: any
export declare const generateWAMessage: any
export declare const generateWAMessageFromContent: any
export declare const generateWAMessageContent: any
export declare const prepareWAMessageMedia: any
export declare const getAggregateVotesInPollMessage: any
export declare const extractMessageContent: any
export declare const jidNormalizedUser: any
export declare const jidDecode: any
export declare const areJidsSameUser: any
export declare const getContentType: any
export declare const generateMessageID: any
export declare const generateMessageIDV2: any
export declare const delay: any
export declare const makeCacheableSignalKeyStore: any
export declare const useMultiFileAuthState: any
export declare const fetchLatestBaileysVersion: any
export declare const makeInMemoryStore: any
export declare const makeStickerPack: any
export declare const encryptedStream: any
export declare const getStream: any
export declare const toBuffer: any
export declare const MEDIA_PATH_MAP: Record<string, string>
export declare const MEDIA_HKDF_KEY_MAPPING: Record<string, string>
export declare const MEDIA_KEYS: string[]
export declare const KAGE_BUILD: { name: string; version: string; revision?: string }

export * from './Utils/sticker-pack'
export * from './Utils/interactive-compat'
