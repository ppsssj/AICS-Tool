export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

export function sendEmpty(res, status = 204) {
  res.writeHead(status);
  res.end();
}

export async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

export function handleApiError(res, error) {
  if (error instanceof HttpError) {
    sendJson(res, error.status, {
      error: error.message,
      details: error.details,
    });
    return;
  }

  console.error('[backend] unexpected error', error);
  sendJson(res, 500, { error: 'Internal server error.' });
}
