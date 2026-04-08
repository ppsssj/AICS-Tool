import { createAccount, createSession, deleteSession, getAccountByEmail, getSession } from '../data/auth-store.mjs';
import { hashPassword, readSessionToken, verifyPassword } from '../lib/auth.mjs';
import { HttpError } from '../lib/http.mjs';
import { labRepository } from '../repositories/lab-repository.mjs';

export async function registerUser(payload) {
  const existingAccount = await getAccountByEmail(payload.email);

  if (existingAccount) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const existingUser = await labRepository.getUserByEmail(payload.email);
  if (existingUser) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const user = await labRepository.createUser({
    name: payload.name,
    email: payload.email.toLowerCase(),
    title: payload.title,
    role: 'Member',
  });

  const credential = await hashPassword(payload.password);
  await createAccount({
    userId: user.id,
    email: user.email,
    passwordHash: credential.passwordHash,
    salt: credential.salt,
  });

  const session = await createSession(user.id);

  return {
    user,
    sessionToken: session.token,
  };
}

export async function loginUser(payload) {
  const account = await getAccountByEmail(payload.email);

  if (!account) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const isValid = await verifyPassword(payload.password, account.passwordHash, account.salt);
  if (!isValid) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const user = await labRepository.getUser(account.userId);
  if (!user) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const session = await createSession(user.id);

  return {
    user,
    sessionToken: session.token,
  };
}

export async function getAuthenticatedUser(req) {
  const sessionToken = readSessionToken(req);

  if (!sessionToken) {
    return null;
  }

  const session = await getSession(sessionToken);
  if (!session) {
    return null;
  }

  return labRepository.getUser(session.userId);
}

export async function requireAuthenticatedUser(req) {
  const user = await getAuthenticatedUser(req);

  if (!user) {
    throw new HttpError(401, 'Authentication required.');
  }

  return user;
}

export async function logoutUser(req) {
  const sessionToken = readSessionToken(req);

  if (!sessionToken) {
    return false;
  }

  return deleteSession(sessionToken);
}
