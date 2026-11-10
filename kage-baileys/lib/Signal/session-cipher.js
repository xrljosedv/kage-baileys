'use strict';
const { SessionCipher, SessionError } = require('libsignal');
class ScopedSessionCipher extends SessionCipher {
 async decryptWithSessions(data, sessions) {
  if (!sessions.length) throw new SessionError('No sessions available');
  let cause;
  for (const session of sessions) {
   try {
    const plaintext = await this.doDecryptWhisperMessage(data, session);
    session.indexInfo.used = Date.now();
    return { session, plaintext };
   } catch (error) { cause = error; }
  }
  const error = new SessionError('No matching sessions found for message');
  error.code = 'WA_SESSION_RETRY';
  error.cause = cause;
  throw error;
 }
}
module.exports = { ScopedSessionCipher };
