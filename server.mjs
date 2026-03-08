import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.API_KEY || process.env.FACTCHAT_API_KEY;
const MODEL = process.env.FACTCHAT_MODEL || 'claude-sonnet-4-6';
const BASE_URL = process.env.FACTCHAT_BASE_URL || 'https://factchat-cloud.mindlogic.ai/v1/gateway';
const DIST_DIR = path.join(__dirname, 'dist');
const MAX_HISTORY_ITEMS = 3;
const MAX_RECENT_PROJECTS = 4;
const MAX_PROJECT_SUMMARIES = 6;
const SUPPORTED_GATEWAY_CHAT_MODELS = new Set([
  'gpt-5.1-chat-latest',
  'gpt-5.1',
  'gpt-5-chat-latest',
  'gpt-5',
  'gpt-5-mini',
  'accounts/fireworks/models/gpt-oss-120b',
  'grok-3-mini',
  'grok-4',
  'google/gemma-3-27b-it',
  'accounts/fireworks/models/llama4-scout-instruct-basic',
  'accounts/fireworks/models/llama4-maverick-instruct-basic',
  'sonar-pro',
  'sonar-reasoning-pro',
]);
const SUPPORTED_GATEWAY_RESPONSE_MODELS = new Set(['gpt-5.4', 'gpt-5.4-pro']);

const systemPrompt = readTextFile(path.join(__dirname, 'docs', 'llm-system-prompt.txt'));
const dynamicTemplate = readTextFile(path.join(__dirname, 'docs', 'llm-dynamic-context-template.txt'));

const client = API_KEY
  ? new OpenAI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
    })
  : null;

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendJson(res, 400, { error: 'Missing request URL.' });
      return;
    }

    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        hasApiKey: Boolean(API_KEY),
        model: MODEL,
        baseURL: BASE_URL,
      });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/assistant/chat') {
      await handleAssistantChat(req, res);
      return;
    }

    if (req.method === 'GET') {
      serveStaticFile(requestUrl.pathname, res);
      return;
    }

    sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    console.error('[server] unexpected error', error);
    sendJson(res, 500, { error: 'Internal server error.' });
  }
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});

async function handleAssistantChat(req, res) {
  try {
    if (!client) {
      sendJson(res, 500, {
        error: 'Missing API key in .env. Add API_KEY=... or FACTCHAT_API_KEY=... to enable LLM requests.',
      });
      return;
    }

    const routeType = resolveGatewayRouteType(MODEL);

    if (routeType === 'unsupported') {
      sendJson(res, 400, {
        error: `Model "${MODEL}" is not configured for a supported Gateway generation route.`,
        detail:
          'Use a supported chat model such as gpt-5.1 or gpt-5.1-chat-latest, or add a route mapping for the model provider.',
        supportedChatModels: Array.from(SUPPORTED_GATEWAY_CHAT_MODELS),
        supportedResponseModels: Array.from(SUPPORTED_GATEWAY_RESPONSE_MODELS),
      });
      return;
    }

    const body = await readJsonBody(req);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const history = Array.isArray(body?.history) ? body.history : [];
    const workspace = body?.workspace ?? {};

    if (!message) {
      sendJson(res, 400, { error: 'message is required.' });
      return;
    }

    const dynamicContext = buildDynamicContext(workspace);
    const responseFormatPrompt = [
      'Return only valid JSON.',
      'Use this exact shape:',
      '{"message":"string","action":{"type":"none","projectId":null,"documentId":null,"path":null},"suggestions":["string"]}',
      'Allowed action.type values: "none", "navigate".',
      'Use "navigate" only when you are confident about the target project or route.',
      'When the request is ambiguous, keep action.type as "none" and ask one short clarification question.',
      'Keep message concise and action-oriented.',
    ].join('\n');

    const conversationMessages = [
      {
        role: 'system',
        content: [systemPrompt, dynamicContext, responseFormatPrompt].join('\n\n'),
      },
      ...history
        .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.text === 'string')
        .slice(-MAX_HISTORY_ITEMS)
        .map((entry) => ({
          role: entry.role,
          content: truncateText(entry.text, 240),
        })),
      {
        role: 'user',
        content: truncateText(message, 320),
      },
    ];

    const rawContent =
      routeType === 'responses'
        ? await createGatewayResponsesResponse(conversationMessages)
        : await createGatewayChatResponse(conversationMessages);

    const parsed = parseAssistantResponse(rawContent);

    sendJson(res, 200, {
      ...parsed,
      raw: rawContent,
    });
  } catch (error) {
    console.error('[assistant] upstream error', error);

    const status = typeof error?.status === 'number' ? error.status : 502;
    const message = error instanceof Error ? error.message : 'Upstream LLM request failed.';

    sendJson(res, status, {
      error: message,
      upstreamStatus: status,
    });
  }
}

function resolveGatewayRouteType(model) {
  if (SUPPORTED_GATEWAY_RESPONSE_MODELS.has(model)) {
    return 'responses';
  }

  if (SUPPORTED_GATEWAY_CHAT_MODELS.has(model)) {
    return 'chat';
  }

  return 'unsupported';
}

async function createGatewayChatResponse(messages) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 220,
    messages,
  });

  return coerceMessageContent(completion.choices[0]?.message?.content);
}

async function createGatewayResponsesResponse(messages) {
  const normalized = normalizeResponsesMessages(messages);
  const payloadBody = {
    model: MODEL,
    instructions: normalized.instructions || undefined,
    input: normalized.input,
    reasoning: {
      effort: 'low',
    },
    text: {
      format: {
        type: 'text',
      },
      verbosity: 'low',
    },
    max_output_tokens: 220,
  };

  const payload = await fetchResponsesWithRetry(payloadBody);
  return coerceResponsesContent(payload);
}

function normalizeResponsesMessages(messages) {
  const instructionParts = [];
  const input = [];

  for (const message of messages) {
    if (message.role === 'system') {
      instructionParts.push(truncateText(message.content, 2200));
      continue;
    }

    if (message.role === 'assistant') {
      instructionParts.push(`Previous assistant reply:\n${truncateText(message.content, 220)}`);
      continue;
    }

    input.push({
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: truncateText(message.content, 320),
        },
      ],
    });
  }

  return {
    instructions: instructionParts.join('\n\n').trim(),
    input: input.length > 0
      ? input
      : [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Continue.',
              },
            ],
          },
        ],
  };
}

async function fetchResponsesWithRetry(payloadBody) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${BASE_URL}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadBody),
    });

    if (response.ok) {
      return response.json();
    }

    const bodyText = await response.text();

    if (response.status === 504 && attempt === 0) {
      lastError = createUpstreamError(response.status, bodyText);
      await delay(1200);
      continue;
    }

    throw createUpstreamError(response.status, bodyText);
  }

  throw lastError ?? createUpstreamError(502, 'Unknown upstream error');
}

function createUpstreamError(status, bodyText) {
  const error = new Error(`${status} status code (${summarizeErrorBody(bodyText)})`);
  error.status = status;
  return error;
}

function summarizeErrorBody(bodyText) {
  if (!bodyText) {
    return 'no body';
  }

  const compact = bodyText.replace(/\s+/g, ' ').trim();

  if (/<html/i.test(compact)) {
    return 'HTML error page returned by upstream gateway';
  }

  return compact.slice(0, 280);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDynamicContext(workspace) {
  const recentProjectsBlock = Array.isArray(workspace.recentProjects) && workspace.recentProjects.length > 0
    ? workspace.recentProjects
        .slice(0, MAX_RECENT_PROJECTS)
        .map((project) => `- ${truncateText(project.title, 40)} (${project.id})`)
        .join('\n')
    : '- none';

  const projectSummariesBlock = Array.isArray(workspace.projectSummaries) && workspace.projectSummaries.length > 0
    ? workspace.projectSummaries
        .slice(0, MAX_PROJECT_SUMMARIES)
        .map(
          (project) =>
            `- ${truncateText(project.title, 40)} (${project.id}) | status: ${project.status} | docs: ${project.documentCount} | openTasks: ${project.openTaskCount} | reviewTasks: ${project.reviewTaskCount} | schedules: ${project.scheduleCount}`,
        )
        .join('\n')
    : '- none';

  return dynamicTemplate
    .replace('{{current_route}}', workspace.currentRoute ?? 'unknown')
    .replace('{{active_project_id}}', workspace.activeProjectId ?? 'null')
    .replace('{{active_project_title}}', workspace.activeProjectTitle ?? 'none')
    .replace('{{active_document_id}}', workspace.activeDocumentId ?? 'null')
    .replace('{{recent_projects_block}}', recentProjectsBlock)
    .replace('{{project_summaries_block}}', projectSummariesBlock);
}

function parseAssistantResponse(rawContent) {
  const fallback = {
    message: rawContent || '응답을 생성하지 못했습니다.',
    action: {
      type: 'none',
      projectId: null,
      documentId: null,
      path: null,
    },
    suggestions: [],
  };

  if (!rawContent) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(extractJsonObject(rawContent));
    return {
      message: typeof parsed.message === 'string' ? parsed.message : fallback.message,
      action: {
        type: parsed.action?.type === 'navigate' ? 'navigate' : 'none',
        projectId: typeof parsed.action?.projectId === 'string' ? parsed.action.projectId : null,
        documentId: typeof parsed.action?.documentId === 'string' ? parsed.action.documentId : null,
        path: typeof parsed.action?.path === 'string' ? parsed.action.path : null,
      },
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((item) => typeof item === 'string').slice(0, 4)
        : [],
    };
  } catch {
    return fallback;
  }
}

function extractJsonObject(content) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model response.');
  }

  return content.slice(start, end + 1);
}

function coerceMessageContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part === 'object' && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('');
  }

  return '';
}

function coerceResponsesContent(payload) {
  if (!payload || !Array.isArray(payload.output)) {
    return '';
  }

  return payload.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((part) => (part?.type === 'output_text' && typeof part.text === 'string' ? part.text : ''))
    .join('');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
    });

    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function serveStaticFile(requestPath, res) {
  if (!fs.existsSync(DIST_DIR)) {
    sendJson(res, 404, { error: 'Build output not found. Run npm run build first.' });
    return;
  }

  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const safePath = path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(DIST_DIR, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const indexPath = path.join(DIST_DIR, 'index.html');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(indexPath).pipe(res);
}

function getContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function truncateText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}
