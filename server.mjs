import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import OpenAI from 'openai';
import { handleAuthApiRequest } from './backend/routes/auth-api.mjs';
import { handleLabApiRequest } from './backend/routes/lab-api.mjs';
import { getAuthenticatedUser } from './backend/services/auth-service.mjs';

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

    if (await handleAuthApiRequest(req, res, requestUrl)) {
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/assistant/chat') {
      const sessionUser = await getAuthenticatedUser(req);
      if (!sessionUser) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }

      await handleAssistantChat(req, res);
      return;
    }

    if (await handleLabApiRequest(req, res, requestUrl)) {
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

    const localTaskCreateResponse = resolveLocalTaskCreateResponseV1(message, workspace);
    if (localTaskCreateResponse) {
      sendJson(res, 200, localTaskCreateResponse);
      return;
    }

    const localTaskStatusResponse = resolveLocalTaskStatusResponseV1(message, workspace);
    if (localTaskStatusResponse) {
      sendJson(res, 200, localTaskStatusResponse);
      return;
    }

    const localTaskDeleteResponse = resolveLocalTaskDeleteResponseV1(message, workspace);
    if (localTaskDeleteResponse) {
      sendJson(res, 200, localTaskDeleteResponse);
      return;
    }

    const localDocumentDeleteResponse = resolveLocalDocumentDeleteResponseV1(message, workspace);
    if (localDocumentDeleteResponse) {
      sendJson(res, 200, localDocumentDeleteResponse);
      return;
    }

    const localDocumentCreateResponse = resolveLocalDocumentCreateResponseV1(message, workspace);
    if (localDocumentCreateResponse) {
      sendJson(res, 200, localDocumentCreateResponse);
      return;
    }

    const localScheduleCreateResponse = resolveLocalScheduleCreateResponseV1(message, workspace);
    if (localScheduleCreateResponse) {
      sendJson(res, 200, localScheduleCreateResponse);
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
      '{"message":"string","action":{"type":"none","projectId":null,"documentId":null,"taskId":null,"path":null,"title":null,"description":null,"body":null,"status":null,"priority":null,"dueDate":null,"tags":null,"scheduleType":null,"taskStatus":null,"day":null,"startTime":null,"endTime":null,"location":null,"note":null},"suggestions":["string"]}',
      'Allowed action.type values: "none", "navigate", "create_project", "create_task", "create_document", "create_schedule", "update_task_status", "confirm_delete_task", "confirm_delete_document".',
      'Use "navigate" only when you are confident about the target project or route.',
      'Use "create_project" only when the user explicitly asks to create a new project and the title is clear.',
      'If a near-exact existing project already matches, prefer "navigate" instead of creating a duplicate.',
      'For "create_project", fill action.title and optionally action.description/action.status. Use status "Planning" by default.',
      'Use "create_task" only when the user explicitly asks to add or create a task and the task title is clear.',
      'For "create_task", set action.projectId to the resolved project. Prefer the active project when the user says "current project" or gives no other project name.',
      'For "create_task", fill action.title and optionally action.description/action.priority/action.dueDate. Use ISO date format YYYY-MM-DD for dueDate.',
      'Use "create_document" only when the user explicitly asks to create or add a document and the document title is clear.',
      'For "create_document", set action.projectId to the resolved project and fill action.title. Optionally fill action.body and action.tags.',
      'Use "create_schedule" only when the user explicitly asks to create, add, or register a schedule and the core fields are clear.',
      'For "create_schedule", set action.projectId to the resolved project, action.scheduleType to "Project", action.day to a weekday enum, and action.startTime/action.endTime to HH:MM.',
      'For "create_schedule", optionally fill action.location and action.note.',
      'Use "update_task_status" only when the target task and target status are both clear.',
      'For "update_task_status", fill action.taskId, action.projectId, and action.taskStatus.',
      'Use "confirm_delete_task" or "confirm_delete_document" for destructive delete requests. Do not delete immediately.',
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

function resolveLocalTaskCreateResponseV1(message, workspace) {
  const normalizedMessage = message.trim();

  if (!isExplicitTaskCreateIntentV1(normalizedMessage)) {
    return null;
  }

  const resolvedProject = resolveTaskProjectFromWorkspaceV1(normalizedMessage, workspace);
  if (!resolvedProject) {
    const recentProjectSuggestions = Array.isArray(workspace?.recentProjects)
      ? workspace.recentProjects.slice(0, 3).map((project) => `${project.title} \uC791\uC5C5 \uCD94\uAC00`)
      : [];

    return {
      message: '\uC5B4\uB290 \uD504\uB85C\uC81D\uD2B8\uC5D0 \uC791\uC5C5\uC744 \uB9CC\uB4E4\uAE4C\uC694?',
      action: {
        type: 'none',
        projectId: null,
        documentId: null,
        path: null,
        title: null,
        description: null,
        status: null,
        priority: null,
        dueDate: null,
      },
      suggestions: recentProjectSuggestions.length > 0 ? recentProjectSuggestions : ['\uD604\uC7AC \uD504\uB85C\uC81D\uD2B8 \uC5F4\uAE30'],
      raw: '',
    };
  }

  const title = extractTaskTitleFromCreateIntentV1(normalizedMessage);
  if (!title) {
    return {
      message: '\uB9CC\uB4E4 \uC791\uC5C5 \uC81C\uBAA9\uC744 \uC54C\uB824\uC8FC\uC138\uC694.',
      action: {
        type: 'none',
        projectId: resolvedProject.id,
        documentId: null,
        path: null,
        title: null,
        description: null,
        status: null,
        priority: null,
        dueDate: null,
      },
      suggestions: [
        `${resolvedProject.title} \uC5D0 \uC791\uC5C5 \uCD94\uAC00. \uC81C\uBAA9\uC740 \uC2E4\uD5D8 \uAE30\uB85D \uC815\uB9AC`,
        '\uC81C\uBAA9\uC740 \uB370\uC774\uD130 \uAC80\uD1A0',
      ],
      raw: '',
    };
  }

  return {
    message: `"${resolvedProject.title}"\uC5D0 \uC791\uC5C5 "${title}"\uB97C \uCD94\uAC00\uD560\uAC8C\uC694.`,
    action: {
      type: 'create_task',
      projectId: resolvedProject.id,
      documentId: null,
      path: `/projects/${resolvedProject.id}/tasks`,
      title,
      description: extractTaskDescriptionFromCreateIntentV1(normalizedMessage, title),
      status: null,
      priority: extractTaskPriorityFromCreateIntentV1(normalizedMessage),
      dueDate: extractTaskDueDateFromCreateIntentV1(normalizedMessage),
    },
    suggestions: [
      `${resolvedProject.title} \uC791\uC5C5 \uBCF4\uB4DC \uBCF4\uAE30`,
      '\uB2E4\uB978 \uC791\uC5C5 \uCD94\uAC00',
    ],
    raw: '',
  };
}

function isExplicitTaskCreateIntentV1(message) {
  const taskWord = '\uC791\uC5C5';
  const createHints = ['\uB9CC\uB4E4', '\uCD94\uAC00', '\uB4F1\uB85D', '\uC0DD\uC131'];
  return message.includes(taskWord) && createHints.some((hint) => message.includes(hint));
}

function resolveTaskProjectFromWorkspaceV1(message, workspace) {
  if (workspace?.activeProjectId && /(현재 프로젝트|이 프로젝트|\uD604\uC7AC \uD504\uB85C\uC81D\uD2B8|\uC774 \uD504\uB85C\uC81D\uD2B8)/i.test(message)) {
    return {
      id: workspace.activeProjectId,
      title: workspace.activeProjectTitle ?? workspace.activeProjectId,
    };
  }

  const summaries = Array.isArray(workspace?.projectSummaries) ? workspace.projectSummaries : [];
  const normalizedMessage = normalizeProjectLookupTextV1(message);

  const matched = summaries.find((project) =>
    normalizeProjectLookupTextV1(project.title).length > 0 &&
    normalizedMessage.includes(normalizeProjectLookupTextV1(project.title)),
  );

  if (matched) {
    return {
      id: matched.id,
      title: matched.title,
    };
  }

  if (workspace?.activeProjectId) {
    return {
      id: workspace.activeProjectId,
      title: workspace.activeProjectTitle ?? workspace.activeProjectId,
    };
  }

  return null;
}

function normalizeProjectLookupTextV1(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function extractTaskTitleFromCreateIntentV1(message) {
  const titleMatch = message.match(/(?:제목|작업명|이름)\s*(?:은|는|:)\s*["']?(.+?)["']?(?:[,.]|$)/i);
  if (titleMatch?.[1]) {
    return cleanupTaskTitleV1(titleMatch[1]);
  }

  const quotedTaskMatch = message.match(/["'](.+?)["']\s*작업/i);
  if (quotedTaskMatch?.[1]) {
    return cleanupTaskTitleV1(quotedTaskMatch[1]);
  }

  return null;
}

function extractTaskDescriptionFromCreateIntentV1(message, title) {
  const descriptionMatch = message.match(/설명\s*(?:은|는|:)\s*["']?(.+?)["']?(?:$)/i);
  if (descriptionMatch?.[1]) {
    return descriptionMatch[1]
      .replace(/\s*,?\s*(?:우선순위|마감일)\s*(?:은|는|:).*$/i, '')
      .trim();
  }

  return `${title} 작업입니다.`;
}

function extractTaskPriorityFromCreateIntentV1(message) {
  if (/urgent|긴급/i.test(message)) return 'Urgent';
  if (/high|높음|높은/i.test(message)) return 'High';
  if (/low|낮음|낮은/i.test(message)) return 'Low';
  if (/medium|보통|중간/i.test(message)) return 'Medium';
  return null;
}

function extractTaskDueDateFromCreateIntentV1(message) {
  const isoMatch = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return isoMatch?.[1] ?? null;
}

function cleanupTaskTitleV1(value) {
  return value
    .replace(/\s*(?:설명|우선순위|마감일)\s*(?:은|는|:).*$/i, '')
    .replace(/[.,"']+$/g, '')
    .trim();
}

function resolveLocalDocumentCreateResponseV1(message, workspace) {
  const normalizedMessage = message.trim();

  if (!isExplicitDocumentCreateIntentV1(normalizedMessage)) {
    return null;
  }

  const resolvedProject = resolveTaskProjectFromWorkspaceV1(normalizedMessage, workspace);
  if (!resolvedProject) {
    const recentProjectSuggestions = Array.isArray(workspace?.recentProjects)
      ? workspace.recentProjects.slice(0, 3).map((project) => `${project.title} 문서 추가`)
      : [];

    return {
      message: '어느 프로젝트에 문서를 만들까요?',
      action: {
        type: 'none',
        projectId: null,
        documentId: null,
        path: null,
        title: null,
        description: null,
        body: null,
        status: null,
        priority: null,
        dueDate: null,
        tags: null,
      },
      suggestions: recentProjectSuggestions.length > 0 ? recentProjectSuggestions : ['현재 프로젝트 문서 만들기'],
      raw: '',
    };
  }

  const title = extractDocumentTitleFromCreateIntentV1(normalizedMessage);
  if (!title) {
    return {
      message: '만들 문서 제목을 알려주세요.',
      action: {
        type: 'none',
        projectId: resolvedProject.id,
        documentId: null,
        path: null,
        title: null,
        description: null,
        body: null,
        status: null,
        priority: null,
        dueDate: null,
        tags: null,
      },
      suggestions: [
        `${resolvedProject.title} 문서 추가. 제목은 실험 메모`,
        '제목은 회의록 초안',
      ],
      raw: '',
    };
  }

  return {
    message: `"${resolvedProject.title}"에 문서 "${title}"를 만들게요.`,
    action: {
      type: 'create_document',
      projectId: resolvedProject.id,
      documentId: null,
      path: `/projects/${resolvedProject.id}/docs`,
      title,
      description: null,
      body: extractDocumentBodyFromCreateIntentV1(normalizedMessage, title),
      status: null,
      priority: null,
      dueDate: null,
      tags: extractDocumentTagsFromCreateIntentV1(normalizedMessage),
    },
    suggestions: [
      `${resolvedProject.title} 문서 보기`,
      '다른 문서 추가',
    ],
    raw: '',
  };
}

function isExplicitDocumentCreateIntentV1(message) {
  const createHints = ['만들', '생성', '추가', '작성'];
  return message.includes('문서') && createHints.some((hint) => message.includes(hint));
}

function extractDocumentTitleFromCreateIntentV1(message) {
  const titleMatch = message.match(/(?:제목|문서명|이름)\s*(?:은|는|:)\s*["']?(.+?)["']?(?:[,.]|$)/i);
  if (titleMatch?.[1]) {
    return cleanupDocumentTitleV1(titleMatch[1]);
  }

  const quotedDocumentMatch = message.match(/["'](.+?)["']\s*문서/i);
  if (quotedDocumentMatch?.[1]) {
    return cleanupDocumentTitleV1(quotedDocumentMatch[1]);
  }

  return null;
}

function extractDocumentBodyFromCreateIntentV1(message, title) {
  const bodyMatch = message.match(/(?:본문|내용|초안)\s*(?:은|는|:)\s*["']?(.+?)["']?(?:$)/i);
  if (bodyMatch?.[1]) {
    return bodyMatch[1]
      .replace(/\s*,?\s*태그\s*(?:는|은|:).*$/i, '')
      .trim();
  }

  return `${title} 문서 초안입니다.`;
}

function extractDocumentTagsFromCreateIntentV1(message) {
  const tagsMatch = message.match(/태그\s*(?:는|은|:)\s*["']?(.+?)["']?(?:$)/i);
  if (!tagsMatch?.[1]) {
    return null;
  }

  return tagsMatch[1]
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function cleanupDocumentTitleV1(value) {
  return value
    .replace(/\s*(?:본문|내용|태그)\s*(?:은|는|:).*$/i, '')
    .replace(/[.,"']+$/g, '')
    .trim();
}

function resolveLocalScheduleCreateResponseV1(message, workspace) {
  const normalizedMessage = message.trim();

  if (!isExplicitScheduleCreateIntentV1(normalizedMessage)) {
    return null;
  }

  const resolvedProject = resolveTaskProjectFromWorkspaceV1(normalizedMessage, workspace);
  if (!resolvedProject) {
    const recentProjectSuggestions = Array.isArray(workspace?.recentProjects)
      ? workspace.recentProjects.slice(0, 3).map((project) => `${project.title} 일정 추가`)
      : [];

    return {
      message: '어느 프로젝트에 일정을 만들까요?',
      action: {
        type: 'none',
        projectId: null,
        documentId: null,
        path: null,
        title: null,
        description: null,
        body: null,
        status: null,
        priority: null,
        dueDate: null,
        tags: null,
        scheduleType: null,
        day: null,
        startTime: null,
        endTime: null,
        location: null,
        note: null,
      },
      suggestions: recentProjectSuggestions.length > 0 ? recentProjectSuggestions : ['현재 프로젝트 일정 만들기'],
      raw: '',
    };
  }

  const title = extractScheduleTitleFromCreateIntentV1(normalizedMessage);
  const day = extractWeekdayFromScheduleIntentV1(normalizedMessage);
  const timeRange = extractTimeRangeFromScheduleIntentV1(normalizedMessage);

  if (!title || !day || !timeRange) {
    return {
      message: '일정 제목, 요일, 시작/종료 시간을 알려주세요.',
      action: {
        type: 'none',
        projectId: resolvedProject.id,
        documentId: null,
        path: null,
        title: null,
        description: null,
        body: null,
        status: null,
        priority: null,
        dueDate: null,
        tags: null,
        scheduleType: null,
        day: null,
        startTime: null,
        endTime: null,
        location: null,
        note: null,
      },
      suggestions: [
        `${resolvedProject.title} 일정 추가. 제목은 주간 미팅, 화요일 14:00-15:00`,
        '제목은 실험 점검, 수요일 오후 2시부터 3시',
      ],
      raw: '',
    };
  }

  return {
    message: `"${resolvedProject.title}"에 일정 "${title}"를 추가할게요.`,
    action: {
      type: 'create_schedule',
      projectId: resolvedProject.id,
      documentId: null,
      path: `/projects/${resolvedProject.id}/schedule`,
      title,
      description: null,
      body: null,
      status: null,
      priority: null,
      dueDate: null,
      tags: null,
      scheduleType: 'Project',
      day,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      location: extractScheduleLocationFromIntentV1(normalizedMessage),
      note: extractScheduleNoteFromIntentV1(normalizedMessage),
    },
    suggestions: [
      `${resolvedProject.title} 일정 보기`,
      '다른 일정 추가',
    ],
    raw: '',
  };
}

function isExplicitScheduleCreateIntentV1(message) {
  const createHints = ['만들', '생성', '추가', '등록'];
  return message.includes('일정') && createHints.some((hint) => message.includes(hint));
}

function extractScheduleTitleFromCreateIntentV1(message) {
  const titleMatch = message.match(/(?:제목|일정명|이름)\s*(?:은|는|:)\s*["']?(.+?)["']?(?:[,.]|$)/i);
  if (titleMatch?.[1]) {
    return cleanupScheduleTitleV1(titleMatch[1]);
  }

  const quotedMatch = message.match(/["'](.+?)["']\s*일정/i);
  if (quotedMatch?.[1]) {
    return cleanupScheduleTitleV1(quotedMatch[1]);
  }

  return null;
}

function cleanupScheduleTitleV1(value) {
  return value
    .replace(/\s*(?:장소|메모)\s*(?:은|는|:).*$/i, '')
    .trim()
    .replace(/[.,"']+$/g, '');
}

function extractWeekdayFromScheduleIntentV1(message) {
  const weekdayMap = [
    ['월요일', 'Monday'],
    ['화요일', 'Tuesday'],
    ['수요일', 'Wednesday'],
    ['목요일', 'Thursday'],
    ['금요일', 'Friday'],
    ['토요일', 'Saturday'],
    ['일요일', 'Sunday'],
    ['monday', 'Monday'],
    ['tuesday', 'Tuesday'],
    ['wednesday', 'Wednesday'],
    ['thursday', 'Thursday'],
    ['friday', 'Friday'],
    ['saturday', 'Saturday'],
    ['sunday', 'Sunday'],
  ];

  const lowered = message.toLowerCase();
  const matched = weekdayMap.find(([token]) => lowered.includes(token));
  return matched ? matched[1] : null;
}

function extractTimeRangeFromScheduleIntentV1(message) {
  const rangeMatch = message.match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
  if (rangeMatch?.[1] && rangeMatch?.[2]) {
    return {
      startTime: padTimeValueV1(rangeMatch[1]),
      endTime: padTimeValueV1(rangeMatch[2]),
    };
  }

  const meridiemRangeMatch = message.match(/(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?(?:부터|에서)?\s*(?:\s*)(오전|오후)?\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
  if (meridiemRangeMatch) {
    const startTime = convertMeridiemToTimeV1(meridiemRangeMatch[1], meridiemRangeMatch[2], meridiemRangeMatch[3]);
    const endTime = convertMeridiemToTimeV1(
      meridiemRangeMatch[4] || meridiemRangeMatch[1],
      meridiemRangeMatch[5],
      meridiemRangeMatch[6],
    );

    return startTime && endTime ? { startTime, endTime } : null;
  }

  return null;
}

function padTimeValueV1(value) {
  const [hours, minutes] = value.split(':');
  return `${hours.padStart(2, '0')}:${minutes}`;
}

function convertMeridiemToTimeV1(meridiem, hourValue, minuteValue) {
  let hours = Number(hourValue);
  const minutes = String(Number(minuteValue ?? '0')).padStart(2, '0');

  if (Number.isNaN(hours)) {
    return null;
  }

  if (meridiem === '오후' && hours < 12) {
    hours += 12;
  }

  if (meridiem === '오전' && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function extractScheduleLocationFromIntentV1(message) {
  const locationMatch = message.match(/장소\s*(?:은|는|:)\s*["']?(.+?)["']?(?:[,.]|$)/i);
  return locationMatch?.[1]?.trim() ?? '';
}

function extractScheduleNoteFromIntentV1(message) {
  const noteMatch = message.match(/(?:메모|비고)\s*(?:은|는|:)\s*["']?(.+?)["']?(?:$)/i);
  return noteMatch?.[1]?.trim() ?? '';
}

function resolveLocalTaskStatusResponseV1(message, workspace) {
  const normalizedMessage = message.trim();
  const taskStatus = extractRequestedTaskStatusV1(normalizedMessage);

  if (!taskStatus) {
    return null;
  }

  const taskSummaries = Array.isArray(workspace?.taskSummaries) ? workspace.taskSummaries : [];
  if (taskSummaries.length === 0) {
    return null;
  }

  const resolvedProject = resolveTaskProjectFromWorkspaceV1(normalizedMessage, workspace);
  const scopedTasks = resolvedProject
    ? taskSummaries.filter((task) => task.projectId === resolvedProject.id)
    : taskSummaries;
  const matchedTask = findTaskSummaryByMessageV1(normalizedMessage, scopedTasks);

  if (!matchedTask) {
    return {
      message: '어떤 작업 상태를 바꿀지 알려주세요.',
      action: {
        type: 'none',
        projectId: resolvedProject?.id ?? null,
        documentId: null,
        taskId: null,
        path: null,
        title: null,
        description: null,
        body: null,
        status: null,
        priority: null,
        dueDate: null,
        tags: null,
        scheduleType: null,
        taskStatus: null,
        day: null,
        startTime: null,
        endTime: null,
        location: null,
        note: null,
      },
      suggestions: scopedTasks.slice(0, 3).map((task) => `${task.title} 완료로 변경`),
      raw: '',
    };
  }

  return {
    message: `"${matchedTask.title}" 작업 상태를 ${taskStatus}로 바꿀게요.`,
    action: {
      type: 'update_task_status',
      projectId: matchedTask.projectId,
      documentId: null,
      taskId: matchedTask.id,
      path: `/projects/${matchedTask.projectId}/tasks`,
      title: null,
      description: null,
      body: null,
      status: null,
      priority: null,
      dueDate: null,
      tags: null,
      scheduleType: null,
      taskStatus,
      day: null,
      startTime: null,
      endTime: null,
      location: null,
      note: null,
    },
    suggestions: [`${matchedTask.projectTitle} 작업 보드 보기`],
    raw: '',
  };
}

function extractRequestedTaskStatusV1(message) {
  if (/완료|끝내|done|complete/i.test(message)) return 'Done';
  if (/(리뷰|검토|review)/i.test(message)) return 'Review';
  if (/진행중|진행 중|in progress/i.test(message)) return 'In Progress';
  if (/할일|할 일|todo/i.test(message)) return 'Todo';
  return null;
}

function findTaskSummaryByMessageV1(message, taskSummaries) {
  const normalizedMessage = normalizeProjectLookupTextV1(message);

  return (
    taskSummaries.find((task) => normalizedMessage.includes(normalizeProjectLookupTextV1(task.title))) ??
    taskSummaries.find((task) => normalizeProjectLookupTextV1(task.title).includes(normalizedMessage))
  );
}

function resolveLocalTaskDeleteResponseV1(message, workspace) {
  if (!isExplicitDeleteIntentV1(message) || !message.includes('작업')) {
    return null;
  }

  const taskSummaries = Array.isArray(workspace?.taskSummaries) ? workspace.taskSummaries : [];
  if (taskSummaries.length === 0) {
    return null;
  }

  const resolvedProject = resolveTaskProjectFromWorkspaceV1(message, workspace);
  const scopedTasks = resolvedProject
    ? taskSummaries.filter((task) => task.projectId === resolvedProject.id)
    : taskSummaries;
  const matchedTask = findTaskSummaryByMessageV1(message, scopedTasks);

  if (!matchedTask) {
    return {
      message: '어떤 작업을 삭제할지 알려주세요.',
      action: emptyAssistantAction(),
      suggestions: scopedTasks.slice(0, 3).map((task) => `${task.title} 작업 삭제`),
      raw: '',
    };
  }

  return {
    message: `"${matchedTask.title}" 작업을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    action: {
      ...emptyAssistantAction(),
      type: 'confirm_delete_task',
      projectId: matchedTask.projectId,
      taskId: matchedTask.id,
      path: `/projects/${matchedTask.projectId}/tasks`,
      title: matchedTask.title,
    },
    suggestions: ['삭제 진행', '취소'],
    raw: '',
  };
}

function resolveLocalDocumentDeleteResponseV1(message, workspace) {
  if (!isExplicitDeleteIntentV1(message) || !message.includes('문서')) {
    return null;
  }

  const documentSummaries = Array.isArray(workspace?.documentSummaries) ? workspace.documentSummaries : [];
  if (documentSummaries.length === 0) {
    return null;
  }

  const resolvedProject = resolveTaskProjectFromWorkspaceV1(message, workspace);
  const scopedDocuments = resolvedProject
    ? documentSummaries.filter((document) => document.projectId === resolvedProject.id)
    : documentSummaries;
  const matchedDocument = findDocumentSummaryByMessageV1(message, scopedDocuments);

  if (!matchedDocument) {
    return {
      message: '어떤 문서를 삭제할지 알려주세요.',
      action: emptyAssistantAction(),
      suggestions: scopedDocuments.slice(0, 3).map((document) => `${document.title} 문서 삭제`),
      raw: '',
    };
  }

  return {
    message: `"${matchedDocument.title}" 문서를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    action: {
      ...emptyAssistantAction(),
      type: 'confirm_delete_document',
      projectId: matchedDocument.projectId,
      documentId: matchedDocument.id,
      path: `/projects/${matchedDocument.projectId}/docs`,
      title: matchedDocument.title,
    },
    suggestions: ['삭제 진행', '취소'],
    raw: '',
  };
}

function isExplicitDeleteIntentV1(message) {
  return /(삭제|지워|없애|remove|delete)/i.test(message);
}

function findDocumentSummaryByMessageV1(message, documentSummaries) {
  const normalizedMessage = normalizeProjectLookupTextV1(message);

  return (
    documentSummaries.find((document) => normalizedMessage.includes(normalizeProjectLookupTextV1(document.title))) ??
    documentSummaries.find((document) => normalizeProjectLookupTextV1(document.title).includes(normalizedMessage))
  );
}

function emptyAssistantAction() {
  return {
    type: 'none',
    projectId: null,
    documentId: null,
    taskId: null,
    path: null,
    title: null,
    description: null,
    body: null,
    status: null,
    priority: null,
    dueDate: null,
    tags: null,
    scheduleType: null,
    taskStatus: null,
    day: null,
    startTime: null,
    endTime: null,
    location: null,
    note: null,
  };
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
                : parsed.action?.type === 'create_task'
                  ? 'create_task'
                  : parsed.action?.type === 'create_document'
                    ? 'create_document'
                    : parsed.action?.type === 'create_schedule'
                      ? 'create_schedule'
                      : parsed.action?.type === 'update_task_status'
                        ? 'update_task_status'
                        : parsed.action?.type === 'confirm_delete_task'
                          ? 'confirm_delete_task'
                          : parsed.action?.type === 'confirm_delete_document'
                            ? 'confirm_delete_document'
                : 'none',
          projectId: typeof parsed.action?.projectId === 'string' ? parsed.action.projectId : null,
          documentId: typeof parsed.action?.documentId === 'string' ? parsed.action.documentId : null,
          taskId: typeof parsed.action?.taskId === 'string' ? parsed.action.taskId : null,
          path: typeof parsed.action?.path === 'string' ? parsed.action.path : null,
          title: typeof parsed.action?.title === 'string' ? parsed.action.title.trim() : null,
          description: typeof parsed.action?.description === 'string' ? parsed.action.description.trim() : null,
          body: typeof parsed.action?.body === 'string' ? parsed.action.body.trim() : null,
          status: normalizeProjectStatus(parsed.action?.status),
          priority: normalizeTaskPriority(parsed.action?.priority),
          dueDate: normalizeIsoDate(parsed.action?.dueDate),
          tags: Array.isArray(parsed.action?.tags)
            ? parsed.action.tags.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 6)
            : null,
          scheduleType: normalizeScheduleType(parsed.action?.scheduleType),
          taskStatus: normalizeTaskStatus(parsed.action?.taskStatus),
          day: normalizeWeekday(parsed.action?.day),
          startTime: normalizeTimeValue(parsed.action?.startTime),
          endTime: normalizeTimeValue(parsed.action?.endTime),
          location: typeof parsed.action?.location === 'string' ? parsed.action.location.trim() : null,
          note: typeof parsed.action?.note === 'string' ? parsed.action.note.trim() : null,
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

function normalizeTaskPriority(value) {
  if (value === 'Low' || value === 'Medium' || value === 'High' || value === 'Urgent') {
    return value;
  }

  return null;
}

function normalizeIsoDate(value) {
  if (typeof value !== 'string') {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
}

function normalizeScheduleType(value) {
  if (value === 'Personal' || value === 'Lab' || value === 'Project') {
    return value;
  }

  return null;
}

function normalizeTaskStatus(value) {
  if (value === 'Todo' || value === 'In Progress' || value === 'Review' || value === 'Done') {
    return value;
  }

  return null;
}

function normalizeWeekday(value) {
  if (
    value === 'Monday' ||
    value === 'Tuesday' ||
    value === 'Wednesday' ||
    value === 'Thursday' ||
    value === 'Friday' ||
    value === 'Saturday' ||
    value === 'Sunday'
  ) {
    return value;
  }

  return null;
}

function normalizeTimeValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim()) ? value.trim() : null;
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
