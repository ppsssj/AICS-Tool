import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedLabData } from './seed.mjs';
import { generateSessionToken, hashPassword } from '../lib/auth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DATA_FILE = path.join(__dirname, 'auth-data.json');

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function createSeedAccounts() {
  const seededAt = now();
  const accounts = await Promise.all(
    seedLabData.users.map(async (user) => {
      const credential = await hashPassword('password');

      return {
        userId: user.id,
        email: user.email.toLowerCase(),
        passwordHash: credential.passwordHash,
        salt: credential.salt,
        createdAt: seededAt,
      };
    }),
  );

  return {
    meta: {
      version: 1,
      seededAt,
    },
    accounts,
    sessions: [],
  };
}

async function ensureAuthDataFile() {
  fs.mkdirSync(__dirname, { recursive: true });

  if (!fs.existsSync(AUTH_DATA_FILE)) {
    writeStore(await createSeedAccounts());
    return;
  }

  const store = JSON.parse(fs.readFileSync(AUTH_DATA_FILE, 'utf8'));
  let hasChanged = false;

  if (!Array.isArray(store.accounts)) {
    store.accounts = [];
    hasChanged = true;
  }

  if (!Array.isArray(store.sessions)) {
    store.sessions = [];
    hasChanged = true;
  }

  store.sessions = store.sessions.filter((session) => {
    if (!session || typeof session !== 'object') {
      hasChanged = true;
      return false;
    }

    if (typeof session.expiresAt !== 'string' || new Date(session.expiresAt).getTime() <= Date.now()) {
      hasChanged = true;
      return false;
    }

    return true;
  });

  if (hasChanged) {
    writeStore(store);
  }
}

async function readStore() {
  await ensureAuthDataFile();
  return JSON.parse(fs.readFileSync(AUTH_DATA_FILE, 'utf8'));
}

function writeStore(store) {
  fs.writeFileSync(AUTH_DATA_FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function getAccountByEmail(email) {
  const store = await readStore();
  return clone(store.accounts.find((account) => account.email === email.toLowerCase()) ?? null);
}

export async function createAccount({ userId, email, passwordHash, salt }) {
  const store = await readStore();
  const normalizedEmail = email.toLowerCase();

  if (store.accounts.some((account) => account.email === normalizedEmail)) {
    return null;
  }

  const account = {
    userId,
    email: normalizedEmail,
    passwordHash,
    salt,
    createdAt: now(),
  };

  store.accounts.push(account);
  writeStore(store);

  return clone(account);
}

export async function createSession(userId) {
  const store = await readStore();
  const token = generateSessionToken();
  const session = {
    token,
    userId,
    createdAt: now(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  };

  store.sessions = store.sessions.filter((entry) => entry.userId !== userId);
  store.sessions.push(session);
  writeStore(store);

  return clone(session);
}

export async function getSession(token) {
  const store = await readStore();
  const session = store.sessions.find((entry) => entry.token === token);

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    store.sessions = store.sessions.filter((entry) => entry.token !== token);
    writeStore(store);
    return null;
  }

  return clone(session);
}

export async function deleteSession(token) {
  const store = await readStore();
  const nextSessions = store.sessions.filter((entry) => entry.token !== token);

  if (nextSessions.length === store.sessions.length) {
    return false;
  }

  store.sessions = nextSessions;
  writeStore(store);
  return true;
}
