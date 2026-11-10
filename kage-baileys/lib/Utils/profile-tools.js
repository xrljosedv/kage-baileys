'use strict';
const { queryErrorSummary } = require('./init-queries');
const { jidNormalizedUser } = require('../WABinary');
function normalizeUsername(value) {
    if (typeof value !== 'string') throw new TypeError('Username must be a string');
    const name = value.trim().replace(/^@/, '');
    if (!name || name.length > 128 || /[\s/@\u0000-\u001f]/u.test(name)) throw new TypeError('Invalid username');
    return name;
}
function profileJid(value) {
    if (typeof value !== 'string' || !/^[^@\s]+@(s\.whatsapp\.net|lid)$/.test(value)) throw new TypeError('A user JID is required; @username and LID are not phone numbers');
    return jidNormalizedUser(value);
}
function parseAboutNode(node) {
    if (!node || node.tag !== 'status') return;
    const attrs = { ...node.attrs };
    const raw = node.content;
    const status = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) || raw instanceof Uint8Array ? Buffer.from(raw).toString('utf8') : null;
    const date = key => {
        const seconds = Number(attrs[key]);
        if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
        const result = new Date(seconds * 1000);
        return Number.isNaN(+result) ? undefined : result;
    };
    return { status: status || (Number(attrs.code) === 401 ? '' : null), setAt: date('t') || new Date(0),
        ...(date('expiration') ? { expiresAt: date('expiration') } : {}),
        ...(attrs.emoji ? { emoji: attrs.emoji } : {}), rawAttributes: attrs };
}
function installProfileTools(socket, config = {}) {
    if (socket.fetchUserProfile) return socket;
    const usernames = new Map();
    const ttlMs = 15 * 60 * 1000;
    const remember = contact => {
        if (!contact?.id || typeof contact.username !== 'string' || !contact.username) return;
        let name, jid;
        try { name = normalizeUsername(contact.username); jid = profileJid(contact.id); } catch { return; }
        for (const [key, item] of usernames) if (item.jid === jid || item.expiresAt <= Date.now()) usernames.delete(key);
        usernames.set(name.toLowerCase(), { jid, username: name, expiresAt: Date.now() + ttlMs });
        while (usernames.size > 5000) usernames.delete(usernames.keys().next().value);
    };
    const onContacts = contacts => { if (Array.isArray(contacts)) contacts.forEach(remember); };
    socket.ev.on('contacts.update', onContacts);
    socket.ev.on('contacts.upsert', onContacts);
    const onHistory = history => onContacts(history?.contacts);
    socket.ev.on('messaging-history.set', onHistory);
    socket.registerSocketEndHandler?.(() => {
        socket.ev.off('contacts.update', onContacts);
        socket.ev.off('contacts.upsert', onContacts);
        socket.ev.off('messaging-history.set', onHistory);
        usernames.clear();
    });
    require('./username').installUsernameTools(socket);
    const fetchUsernames = socket.fetchUsernames;
    socket.fetchUsernames = async (...jids) => {
        const rows = await fetchUsernames(...jids);
        for (const row of rows) if (row.username) remember({ id: row.jid, username: row.username });
        return rows;
    };
    socket.fetchUsername = async jid => {
        try { return (await socket.fetchUsernames(jid))[0]?.username ?? null; }
        catch { return null; }
    };
    socket.resolveUsername = async value => {
        const name = normalizeUsername(value), entry = usernames.get(name.toLowerCase());
        if (entry && entry.expiresAt > Date.now()) return { jid: entry.jid, username: entry.username, source: 'contact-cache' };
        if (entry) usernames.delete(name.toLowerCase());
        const error = new Error('Username not present in known contacts. Supply a known JID and fetchUsername first; global reverse lookup is not established by the supplied protocol.');
        error.code = 'USERNAME_NOT_RESOLVED';
        throw error;
    };
    socket.fetchAbout = async jid => {
        const id = profileJid(jid);
        const result = await socket.fetchStatus(id);
        const row = result?.find(item => item.id && jidNormalizedUser(item.id) === id);
        return { jid: id, ...(row?.status || { status: null, setAt: new Date(0) }), source: 'usync' };
    };
    socket.updateAbout = async (text, options = {}) => {
        if (typeof text !== 'string') throw new TypeError('About text must be a string');
        if (Object.keys(options).length) {
            const error = new Error('Scheduling, emoji and audience mutations for temporary About are not verified by this protocol. Only text is supported; use the mobile app for these options.');
            error.code = 'ABOUT_OPTIONS_UNSUPPORTED'; throw error;
        }
        return socket.updateProfileStatus(text);
    };
    socket.fetchUserProfile = async (jid, options = {}) => {
        const id = profileJid(jid);
        const tasks = { username: () => socket.fetchUsername(id), about: () => socket.fetchAbout(id) };
        if (options.business !== false && socket.getBusinessProfile) tasks.business = () => socket.getBusinessProfile(id);
        if (options.picture && socket.profilePictureUrl) tasks.picture = () => socket.profilePictureUrl(id, options.pictureType || 'image');
        const output = { jid: id, username: null, about: null, business: null, links: [], errors: {}, complete: false };
        await Promise.all(Object.entries(tasks).map(async ([name, task]) => {
            try {
                const value = await task();
                output[name] = value ?? null;
            } catch (error) { output.errors[name] = queryErrorSummary(error); }
        }));
        output.links = [...new Set((output.business?.website || []).filter(url => typeof url === 'string' && /^https?:\/\//i.test(url)))];
        output.complete = Object.keys(output.errors).length === 0;
        return output;
    };
    socket.getProfileCapabilities = () => ({ usernameByJid: true, usernameReverseLookup: 'known-contacts-only', aboutText: true,
        temporaryAboutRead: 'server-attributes-only', temporaryAboutWrite: false, aboutAudienceWrite: false,
        businessProfile: typeof socket.getBusinessProfile === 'function', links: 'business-websites', liveVerified: false });
    return socket;
}
module.exports = { normalizeUsername, parseAboutNode, installProfileTools };
