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
const RESPONSE_MAX_OUTPUT_TOKENS = 220;
const RESPONSE_RETRY_MAX_OUTPUT_TOKENS = 420;
const RESPONSE_FALLBACK_MODEL = 'gpt-5.4';
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

    const localProjectCreateResponse = resolveLocalProjectCreateResponseV2(message);
    if (localProjectCreateResponse) {
      sendJson(res, 200, localProjectCreateResponse);
      return;
    }

    const dynamicContext = buildDynamicContext(workspace);
    const responseFormatPrompt = [
      'Return only valid JSON.',
      'Use this exact shape:',
      '{"message":"string","action":{"type":"none","projectId":null,"documentId":null,"path":null,"title":null,"description":null,"status":null},"suggestions":["string"]}',
      'Allowed action.type values: "none", "navigate", "create_project".',
      'Use "navigate" only when you are confident about the target project or route.',
      'Use "create_project" only when the user explicitly asks to create a new project and the title is clear.',
      'If a near-exact existing project already matches, prefer "navigate" instead of creating a duplicate.',
      'For "create_project", fill action.title and optionally action.description/action.status. Use status "Planning" by default.',
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
    input: normalized.input,
    text: {
      verbosity: 'low',
    },
    max_output_tokens: RESPONSE_MAX_OUTPUT_TOKENS,
  };

  let payload;

  try {
    payload = await fetchResponsesWithRetry(payloadBody);
  } catch (error) {
    if (shouldFallbackResponsesModel(error, payloadBody.model)) {
      payload = await fetchResponsesWithRetry({
        ...payloadBody,
        model: RESPONSE_FALLBACK_MODEL,
      });
    } else {
      throw error;
    }
  }

  const content = coerceResponsesContent(payload);

  if (content) {
    return content;
  }

  if (shouldRetryResponsesPayload(payload)) {
    const retriedPayload = await fetchResponsesWithRetry({
      ...payloadBody,
      max_output_tokens: RESPONSE_RETRY_MAX_OUTPUT_TOKENS,
    });
    const retriedContent = coerceResponsesContent(retriedPayload);

    if (retriedContent) {
      return retriedContent;
    }
  }

  if (shouldFallbackResponsesModel(null, payloadBody.model)) {
    const fallbackPayload = await fetchResponsesWithRetry({
      ...payloadBody,
      model: RESPONSE_FALLBACK_MODEL,
      max_output_tokens: RESPONSE_MAX_OUTPUT_TOKENS,
    });
    const fallbackContent = coerceResponsesContent(fallbackPayload);

    if (fallbackContent) {
      return fallbackContent;
    }
  }

  return JSON.stringify({
    message: '응답 생성이 완료되지 않았습니다. 다시 시도해 주세요.',
    action: {
      type: 'none',
      projectId: null,
      documentId: null,
      path: null,
    },
    suggestions: ['다시 시도하기', '질문을 더 짧게 보내기'],
  });
}

function normalizeResponsesMessages(messages) {
  const developerParts = [];
  const transcriptParts = [];

  for (const message of messages) {
    if (message.role === 'system' || message.role === 'developer') {
      developerParts.push(truncateText(message.content, 2200));
      continue;
    }

    if (message.role === 'assistant') {
      transcriptParts.push(`Assistant: ${truncateText(message.content, 220)}`);
      continue;
    }

    transcriptParts.push(`User: ${truncateText(message.content, 320)}`);
  }

  const input = [];

  if (developerParts.length > 0) {
    input.push({
      role: 'developer',
      content: [
        {
          type: 'input_text',
          text: developerParts.join('\n\n'),
        },
      ],
    });
  }

  if (transcriptParts.length > 0) {
    input.push({
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: transcriptParts.join('\n\n'),
        },
      ],
    });
  }

  return {
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
    const response = await fetch(`${BASE_URL}/responses/`, {
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

  try {
    const parsed = JSON.parse(compact);
    const nestedMessage = parsed?.detail?.message ?? parsed?.error?.message ?? parsed?.detail ?? parsed?.message;

    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage.trim().slice(0, 280);
    }
  } catch {
    // Fall through to the compact text return below.
  }

  return compact.slice(0, 280);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveLocalProjectCreateResponse(message) {
  const normalizedMessage = message.trim();

  if (!isExplicitProjectCreateIntent(normalizedMessage)) {
    return null;
  }

  const title = extractProjectTitleFromCreateIntent(normalizedMessage);

  if (!title) {
    return {
      message: '만들 프로젝트 이름을 알려주세요.',
      action: {
        type: 'none',
        projectId: null,
        documentId: null,
        path: null,
        title: null,
        description: null,
        status: null,
      },
      suggestions: ['예: AI 테스트 프로젝트 만들어줘', '예: 제목은 샘플 프로젝트'],
      raw: '',
    };
  }

  return {
    message: `새 프로젝트 "${title}"를 만들게요.`,
    action: {
      type: 'create_project',
      projectId: null,
      documentId: null,
      path: null,
      title,
      description: extractProjectDescriptionFromCreateIntent(normalizedMessage, title),
      status: 'Planning',
    },
    suggestions: ['프로젝트 열기', '작업 보드 보기'],
    raw: '',
  };
}

function isExplicitProjectCreateIntent(message) {
  return /(프로젝트).*(만들|생성|추가)|(?:만들|생성|추가).*(프로젝트)/i.test(message);
}

function extractProjectTitleFromCreateIntent(message) {
  const titledPatterns = [
    /(?:제목|이름)\s*(?:은|는|:)\s*["'“”‘’]?(.+?)["'“”‘’]?(?:[,.]|$)/i,
    /프로젝트\s*(?:제목|이름)?\s*(?:은|는|:)\s*["'“”‘’]?(.+?)["'“”‘’]?(?:[,.]|$)/i,
  ];

  for (const pattern of titledPatterns) {
    const match = message.match(pattern);
    const value = match?.[1]?.trim();

    if (value) {
      return cleanupProjectTitle(value);
    }
  }

  const suffixPattern = /["'“”‘’]?(.+?)["'“”‘’]?\s*프로젝트(?:를|를요|를 새로| 새로)?\s*(?:만들|생성|추가)/i;
  const suffixMatch = message.match(suffixPattern);
  const suffixValue = suffixMatch?.[1]?.trim();

  if (suffixValue) {
    return cleanupProjectTitle(suffixValue);
  }

  const prefixPattern = /(?:만들|생성|추가)\s*(?:해줘|해주세요|해 줘|해 주세요)?\s*["'“”‘’]?(.+?)["'“”‘’]?\s*프로젝트/i;
  const prefixMatch = message.match(prefixPattern);
  const prefixValue = prefixMatch?.[1]?.trim();

  if (prefixValue) {
    return cleanupProjectTitle(prefixValue);
  }

  return null;
}

function extractProjectDescriptionFromCreateIntent(message, title) {
  const match = message.match(/설명\s*(?:은|는|:)\s*["'“”‘’]?(.+?)["'“”‘’]?(?:$)/i);
  const explicitDescription = match?.[1]?.trim();

  if (explicitDescription) {
    return explicitDescription;
  }

  return `${title} 프로젝트 작업 공간입니다.`;
}

function cleanupProjectTitle(value) {
  return value
    .replace(/\s*(설명|상태)\s*(?:은|는|:).*$/i, '')
    .replace(/[.,"'“”‘’]+$/g, '')
    .trim();
}

function resolveLocalProjectCreateResponseV2(message) {
  const normalizedMessage = message.trim();

  if (!isExplicitProjectCreateIntentV2(normalizedMessage)) {
    return null;
  }

  const title = extractProjectTitleFromCreateIntentV2(normalizedMessage);

  if (!title) {
    return {
      message: '\uB9CC\uB4E4 \uD504\uB85C\uC81D\uD2B8 \uC774\uB984\uC744 \uC54C\uB824\uC8FC\uC138\uC694.',
      action: {
        type: 'none',
        projectId: null,
        documentId: null,
        path: null,
        title: null,
        description: null,
        status: null,
      },
      suggestions: [
        '\uC608: AI \uD14C\uC2A4\uD2B8 \uD504\uB85C\uC81D\uD2B8 \uB9CC\uB4E4\uC5B4\uC918',
        '\uC608: \uC81C\uBAA9\uC740 \uC0D8\uD50C \uD504\uB85C\uC81D\uD2B8',
      ],
      raw: '',
    };
  }

  return {
    message: `\uC0C8 \uD504\uB85C\uC81D\uD2B8 "${title}"\uB97C \uB9CC\uB4E4\uAC8C\uC694.`,
    action: {
      type: 'create_project',
      projectId: null,
      documentId: null,
      path: null,
      title,
      description: extractProjectDescriptionFromCreateIntentV2(normalizedMessage, title),
      status: 'Planning',
    },
    suggestions: [
      '\uD504\uB85C\uC81D\uD2B8 \uC5F4\uAE30',
      '\uC791\uC5C5 \uBCF4\uB4DC \uBCF4\uAE30',
    ],
    raw: '',
  };
}

function isExplicitProjectCreateIntentV2(message) {
  const createHints = ['\uB9CC\uB4E4', '\uC0DD\uC131', '\uCD94\uAC00'];
  return message.includes('\uD504\uB85C\uC81D\uD2B8') && createHints.some((hint) => message.includes(hint));
}

function extractProjectTitleFromCreateIntentV2(message) {
  const titleMatch = message.match(/(?:\uC81C\uBAA9|\uC774\uB984)\s*(?:\uC740|\uB294|:)\s*["']?(.+?)["']?(?:[,.]|$)/i);
  if (titleMatch?.[1]) {
    return cleanupProjectTitleV2(titleMatch[1]);
  }

  const beforeProjectMatch = message.match(/["']?(.+?)["']?\s*\uD504\uB85C\uC81D\uD2B8\s*(?:\uB97C|\uB97C\s*\uC0C8\uB85C|\uC0C8\uB85C)?\s*(?:\uB9CC\uB4E4|\uC0DD\uC131|\uCD94\uAC00)/i);
  if (beforeProjectMatch?.[1]) {
    return cleanupProjectTitleV2(beforeProjectMatch[1]);
  }

  return null;
}

function extractProjectDescriptionFromCreateIntentV2(message, title) {
  const descriptionMatch = message.match(/\uC124\uBA85\s*(?:\uC740|\uB294|:)\s*["']?(.+?)["']?(?:$)/i);
  if (descriptionMatch?.[1]) {
    return descriptionMatch[1].trim();
  }

  return `${title} \uD504\uB85C\uC81D\uD2B8 \uC791\uC5C5 \uACF5\uAC04\uC785\uB2C8\uB2E4.`;
}

function cleanupProjectTitleV2(value) {
  return value
    .replace(/\s*(?:\uC124\uBA85|\uC0C1\uD0DC)\s*(?:\uC740|\uB294|:).*$/i, '')
    .replace(/[.,"']+$/g, '')
    .trim();
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

  let candidates = [];

  try {
    candidates = extractJsonObjects(rawContent);
  } catch {
    return fallback;
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        message: typeof parsed.message === 'string' ? parsed.message : fallback.message,
        action: {
          type:
            parsed.action?.type === 'navigate'
              ? 'navigate'
              : parsed.action?.type === 'create_project'
                ? 'create_project'
                : 'none',
          projectId: typeof parsed.action?.projectId === 'string' ? parsed.action.projectId : null,
          documentId: typeof parsed.action?.documentId === 'string' ? parsed.action.documentId : null,
          path: typeof parsed.action?.path === 'string' ? parsed.action.path : null,
          title: typeof parsed.action?.title === 'string' ? parsed.action.title.trim() : null,
          description: typeof parsed.action?.description === 'string' ? parsed.action.description.trim() : null,
          status: normalizeProjectStatus(parsed.action?.status),
        },
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.filter((item) => typeof item === 'string').slice(0, 4)
          : [],
      };
    } catch {
      // Try the next JSON candidate.
    }
  }

  return fallback;
}

function normalizeProjectStatus(value) {
  if (value === 'Planning' || value === 'Active' || value === 'Done' || value === 'Archived') {
    return value;
  }

  return null;
}

function extractJsonObjects(content) {
  const candidates = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === '\\') {
        isEscaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      if (depth === 0) {
        start = index;
      }

      depth += 1;
      continue;
    }

    if (character === '}') {
      if (depth === 0) {
        continue;
      }

      depth -= 1;

      if (depth === 0 && start !== -1) {
        candidates.push(content.slice(start, index + 1));
        start = -1;
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error('No JSON object found in model response.');
  }

  return candidates;
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

function shouldRetryResponsesPayload(payload) {
  return Boolean(
    payload &&
      payload.status === 'incomplete' &&
      payload.incomplete_details?.reason === 'max_output_tokens',
  );
}

function shouldFallbackResponsesModel(error, model) {
  if (model !== 'gpt-5.4-pro') {
    return false;
  }

  if (!error) {
    return true;
  }

  return error.status === 504;
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
