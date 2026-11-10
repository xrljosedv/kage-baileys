'use strict';
const { setTimeout: sleep } = require('node:timers/promises');
function queryErrorCode(error) {
    const value = error?.output?.statusCode ?? error?.statusCode ?? error?.data?.statusCode ?? error?.code;
    return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
}
function isRetryableQueryError(error) {
    const code = queryErrorCode(error);
    return [408, 429, 502, 503, 504, 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(code)
        || (!code && /^(timed out|request time-?out|socket hang up)$/i.test(error?.message || ''));
}
function queryErrorSummary(error) {
    return { code: queryErrorCode(error) ?? 'QUERY_FAILED', message: String(error?.message || error).slice(0, 240), retryable: isRetryableQueryError(error) };
}
/** Only independent, idempotent initial reads are retried. Mutations are never replayed. */
function createInitQueryRunner(socket, config, tasks) {
    const logger = config.logger;
    const policy = config.initQueryRetry || {};
    const attempts = Math.max(1, Math.min(5, Number.isInteger(policy.maxAttempts) ? policy.maxAttempts : 3));
    const baseDelayMs = Math.max(0, Math.min(30000, Number.isFinite(policy.baseDelayMs) ? policy.baseDelayMs : 1000));
    const random = policy.random || Math.random;
    const wait = policy.sleep || ((ms, signal) => sleep(ms, undefined, { signal }));
    let current, controller, generation = 0, disposed = false;
    let state = { status: 'idle', tasks: [] };
    const snapshot = () => structuredClone(state);
    const emit = () => socket.ev.emit('init.queries.update', snapshot());
    function cancel() {
        generation++; controller?.abort();
        if (state.status === 'running') { state = {status:'cancelled',tasks:state.tasks.map(row => row.status === 'pending' ? {...row,status:'cancelled'} : {...row})}; emit(); }
    }
    const onConnection = update => { if (update.connection === 'close') cancel(); };
    socket.ev.on('connection.update', onConnection);
    socket.registerSocketEndHandler?.(() => { disposed = true; cancel(); socket.ev.off('connection.update', onConnection); });
    function run() {
        if (disposed) return Promise.resolve({ status: 'cancelled', tasks: [] });
        if (current && !controller?.signal.aborted) return current;
        controller = new AbortController();
        const signal = controller.signal, epoch = ++generation;
        const rows = Object.keys(tasks).map(name => ({ name, status: 'pending', attempts: 0 }));
        state = { status: 'running', tasks: rows };
        emit();
        const job = Promise.all(rows.map(async row => {
            for (let i = 0; i < attempts; i++) {
                if (signal.aborted || epoch !== generation) { row.status = 'cancelled'; return; }
                row.attempts = i + 1;
                try {
                    await tasks[row.name]();
                    row.status = signal.aborted ? 'cancelled' : 'fulfilled';
                    delete row.error;
                    return;
                } catch (error) {
                    if (signal.aborted || epoch !== generation) { row.status = 'cancelled'; return; }
                    row.error = queryErrorSummary(error);
                    if (!row.error.retryable || i + 1 >= attempts) {
                        row.status = 'rejected';
                        if (row.error.retryable) (policy.logRecoverable === true ? logger?.warn?.bind(logger) : logger?.debug?.bind(logger))?.({ task: row.name, ...row.error, attempts: row.attempts }, 'Initial read pending; use retryInitialQueries after connection recovers');
                        else logger?.error?.({ err: error, task: row.name }, 'Initial read failed');
                        return;
                    }
                    logger?.debug?.({ task: row.name, attempt: i + 1, code: row.error.code }, 'Retrying initial read');
                    const delay = Math.min(30000, baseDelayMs * 2 ** i) + Math.floor(random() * baseDelayMs);
                    try { await wait(delay, signal); }
                    catch (error) { if (!signal.aborted) throw error; row.status = 'cancelled'; return; }
                }
            }
        })).then(() => {
            const result = { status: signal.aborted || epoch !== generation ? 'cancelled' : rows.some(r => r.status === 'rejected') ? 'partial' : 'complete', tasks: rows };
            if (epoch === generation) { state = result; emit(); }
            return structuredClone(result);
        }).finally(() => { if (current === job) current = undefined; });
        current = job;
        return job;
    }
    run.getState = snapshot;
    run.cancel = cancel;
    return run;
}
module.exports = { queryErrorCode, isRetryableQueryError, queryErrorSummary, createInitQueryRunner };
