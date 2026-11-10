'use strict';
const { parsePhoneNumberFromString } = require('libphonenumber-js/max');
const countries = require('./countries.json');
function getCountryInfo(input) {
  if (typeof input !== 'string') return null;
   
  if (input.includes('@') && !/@s\.whatsapp\.net$/.test(input)) return null;
  const value = input.replace(/:\d+@/, '@').replace(/@s\.whatsapp\.net$/, '');
  if (!/^\+?[\d\s().-]{4,30}$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 5 || digits.length > 15) return null;
  try {
    const phone = parsePhoneNumberFromString('+' + digits);
    if (!phone || !phone.isValid() || !phone.country || !countries[phone.country]) return null;
    const country = countries[phone.country];
    return { ...JSON.parse(JSON.stringify(country)), capital: country.capitals.join(', ') || null,
      callingCode: '+' + phone.countryCallingCode, number: phone.number, international: phone.formatInternational(),
      source: 'offline-phone-prefix', note: 'Región del número telefónico; no identifica nacionalidad, residencia ni ubicación actual.' };
  } catch { return null; }
}
async function getCountryForJid(conn, jid) {
  if (typeof jid !== 'string') return null;
  let actual = jid.replace(/:\d+@/, '@');
  if (actual.endsWith('@lid')) {
    try { actual = await conn?.signalRepository?.lidMapping?.getPNForLID?.(actual); }
    catch { return null; }
  }
  return getCountryInfo(actual);
}
exports.getCountryInfo = getCountryInfo;
exports.getCountryForJid = getCountryForJid;
