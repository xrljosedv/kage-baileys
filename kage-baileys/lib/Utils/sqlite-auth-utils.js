// Internal helper shared by the SQLite-backed auth state variants
// (use-*-sqljs-auth-state.js / use-*-sqlite-auth-state.js). Not re-exported
// from Utils/index.js — sql.js and better-sqlite3 are optional dependencies,
// so we only try to load them when one of those auth states is actually used.
let sqlJsPromise;
/** lazily init sql.js (WASM SQLite), shared across all sql.js-backed auth states in this process */
export const getSqlJs = async () => {
    if (!sqlJsPromise) {
        sqlJsPromise = (async () => {
            let initSqlJs;
            try {
                ({ default: initSqlJs } = await import('sql.js'));
            }
            catch {
                throw new Error('sql.js is required for useMultiFileSQLJsAuthState / useSingleFileSQLJsAuthState. ' +
                    'Install it with `npm install sql.js`.');
            }
            return initSqlJs();
        })();
    }
    return sqlJsPromise;
};
let betterSqlite3Promise;
/** lazily load better-sqlite3 (native SQLite binding) */
export const getBetterSqlite3 = async () => {
    if (!betterSqlite3Promise) {
        betterSqlite3Promise = (async () => {
            try {
                const mod = await import('better-sqlite3');
                return mod.default;
            }
            catch {
                throw new Error('better-sqlite3 is required for useMultiFileSQLiteAuthState / useSingleFileSQLiteAuthState. ' +
                    'Install it with `npm install better-sqlite3`.');
            }
        })();
    }
    return betterSqlite3Promise;
};
/** CREATE TABLE used by the "one db per key" variants — single row, id is always 1 */
export const SINGLE_ROW_SCHEMA = 'CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT)';
/** CREATE TABLE used by the "one db for everything" variants — one row per creds/key entry */
export const KV_SCHEMA = 'CREATE TABLE IF NOT EXISTS auth (key TEXT PRIMARY KEY, value TEXT)';
