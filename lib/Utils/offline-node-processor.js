"use strict";Object.defineProperty(exports, "__esModule", {value: true});/**
 * Creates a processor for offline stanza nodes that:
 * - Queues nodes for sequential processing
 * - Yields to the event loop periodically to avoid blocking
 * - Catches handler errors to prevent the processing loop from crashing
 */
 function makeOfflineNodeProcessor(nodeProcessorMap, deps, batchSize = 10) {
    const nodes = [];
    let isProcessing = false;
    const enqueue = (type, node) => {
        nodes.push({ type, node });
        if (isProcessing) {
            return;
        }
        isProcessing = true;
        const promise = async () => {
            let processedInBatch = 0;
            while (nodes.length && deps.isWsOpen()) {
                const { type, node } = nodes.shift();
                const nodeProcessor = nodeProcessorMap.get(type);
                if (!nodeProcessor) {
                    deps.onUnexpectedError(new Error(`unknown offline node type: ${type}`), 'processing offline node');
                    continue;
                }
                await nodeProcessor(node).catch(err => deps.onUnexpectedError(err, `processing offline ${type}`));
                processedInBatch++;
                // Yield to event loop after processing a batch
                // This prevents blocking the event loop for too long when there are many offline nodes
                if (processedInBatch >= batchSize) {
                    processedInBatch = 0;
                    await deps.yieldToEventLoop();
                }
            }
            isProcessing = false;
        };
        promise().catch(error => deps.onUnexpectedError(error, 'processing offline nodes'));
    };
    return { enqueue };
} exports.makeOfflineNodeProcessor = makeOfflineNodeProcessor;
//# 
// Kage: funciones avanzadas.
const __kageModule180 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeOfflineNodeProcessor = makeOfflineNodeProcessor;
/**
 * Creates a processor for offline stanza nodes that:
 * - Queues nodes for sequential processing
 * - Yields to the event loop periodically to avoid blocking
 * - Catches handler errors to prevent the processing loop from crashing
 */
function makeOfflineNodeProcessor(nodeProcessorMap, deps, batchSize = 10) {
    const nodes = [];
    let isProcessing = false;
    const enqueue = (type, node) => {
        nodes.push({ type, node });
        if (isProcessing) {
            return;
        }
        isProcessing = true;
        const promise = async () => {
            let processedInBatch = 0;
            while (nodes.length && deps.isWsOpen()) {
                const { type, node } = nodes.shift();
                const nodeProcessor = nodeProcessorMap.get(type);
                if (!nodeProcessor) {
                    deps.onUnexpectedError(new Error(`unknown offline node type: ${type}`), 'processing offline node');
                    continue;
                }
                await nodeProcessor(node).catch(err => deps.onUnexpectedError(err, `processing offline ${type}`));
                processedInBatch++;
                // Yield to event loop after processing a batch
                // This prevents blocking the event loop for too long when there are many offline nodes
                if (processedInBatch >= batchSize) {
                    processedInBatch = 0;
                    await deps.yieldToEventLoop();
                }
            }
            isProcessing = false;
        };
        promise().catch(error => deps.onUnexpectedError(error, 'processing offline nodes'));
    };
    return { enqueue };
}

return module.exports;
})();
for (const key of Object.keys(__kageModule180)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule180[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule180, configurable:true});
