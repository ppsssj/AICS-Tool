import { clearSessionCookie, setSessionCookie } from '../lib/auth.mjs';
import { handleApiError, HttpError, readJsonBody, sendEmpty, sendJson } from '../lib/http.mjs';
import { validateLoginInput, validateRegisterInput } from '../lib/validation.mjs';
import {
  getAuthenticatedUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../services/auth-service.mjs';

export async function handleAuthApiRequest(req, res, requestUrl) {
  if (!requestUrl.pathname.startsWith('/api/auth')) {
    return false;
  }

  try {
    if (req.method === 'GET' && requestUrl.pathname === '/api/auth/session') {
      const user = await getAuthenticatedUser(req);

      if (!user) {
        throw new HttpError(401, 'No active session.');
      }

      sendJson(res, 200, { user });
      return true;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/auth/login') {
      const payload = validateLoginInput(await readJsonBody(req));
      const result = await loginUser(payload);
      setSessionCookie(res, result.sessionToken);
      sendJson(res, 200, { user: result.user });
      return true;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/auth/register') {
      const payload = validateRegisterInput(await readJsonBody(req));
      const result = await registerUser(payload);
      setSessionCookie(res, result.sessionToken);
      sendJson(res, 201, { user: result.user });
      return true;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/auth/logout') {
      await logoutUser(req);
      clearSessionCookie(res);
      sendEmpty(res);
      return true;
    }

    throw new HttpError(404, 'Not found.');
  } catch (error) {
    handleApiError(res, error);
    return true;
  }
}
