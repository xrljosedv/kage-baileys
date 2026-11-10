import { proto } from '../../WAProto/index.js';
/** Bangun proto.IMessage richMessage (AI rich response). Dari @levvsync/baileys (LevviSync, MIT). */
export declare function generateRichMessage(rich: {
    [key: string]: any;
}): Promise<proto.IMessage>;
