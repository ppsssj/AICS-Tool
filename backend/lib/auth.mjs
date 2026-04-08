import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE_NAME = 'aics_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);

  return {
    salt,
    passwordHash: Buffer.from(derivedKey).toString('hex'),
  };
}

export async function verifyPassword(password, passwordHash, salt) {
  const derivedKey = await scrypt(password, salt, 64);
  const expected = Buffer.from(passwordHash, 'hex');
  const actual = Buffer.from(derivedKey);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}

export function parseCookies(req) {
  const header = req.headers.cookie;

  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf('=');

        if (separatorIndex < 0) {
          return [entry, ''];
        }

        return [
          decodeURIComponent(entry.slice(0, separatorIndex).trim()),
          decodeURIComponent(entry.slice(separatorIndex + 1).trim()),
        ];
      }),
  );
}

export function readSessionToken(req) {
  return parseCookies(req)[SESSION_COOKIE_NAME] ?? null;
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', serializeSessionCookie(token));
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', serializeExpiredSessionCookie());
}

function serializeSessionCookie(token) {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join('; ');
}

function serializeExpiredSessionCookie() {
  return [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
}
