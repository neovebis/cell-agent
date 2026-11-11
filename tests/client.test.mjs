import test from 'node:test';
import assert from 'node:assert/strict';
import { CellApi, SessionExpiredError } from '../src/services/api.ts';
import { CellClient } from '../src/services/client.ts';
import {
  acknowledgePending,
  recoverUnconfirmedPending,
  conversationMessages,
  scopeKey,
  trustedDownload,
  validateAttachments,
  workflowAgent,
} from '../src/services/contracts.ts';

const config = {
  apiUrl: 'https://cell.example',
  supabaseUrl: 'https://data.example',
  publishableKey: 'public-test-key',
};
const session = (overrides = {}) => ({
  userId: 'user-one',
  workspaceId: 'space-one',
  accessToken: 'access-test',
  refreshToken: 'refresh-test',
  expiresAt: Date.now() / 1000 + 3600,
  displayName: 'Teste',
  ...overrides,
});
const response = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const run = (overrides = {}) => ({
  id: 'run-one',
  workflowId: 'workflow-one',
  status: 'queued',
  message: 'Olá',
  createdAt: '2026-11-07T12:00:00Z',
  updatedAt: '2026-11-07T12:00:00Z',
  ...overrides,
});
function memoryStore() {
  const data = new Map();
  return {
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key)) : null;
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    async remove(key) {
      data.delete(key);
    },
    async removePrefix(prefix) {
      for (const key of data.keys())
        if (key.startsWith(prefix)) data.delete(key);
    },
  };
}

test('renovação concorrente usa um só refresh e conserva o workspace', async () => {
  let refreshes = 0,
    persisted = 0;
  const auth = session({ expiresAt: 1 });
  const api = new CellApi(
    config,
    async (url, init) => {
      if (url.includes('grant_type=refresh_token')) {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return response({
          access_token: 'renewed',
          refresh_token: 'rotated',
          expires_in: 3600,
          user: { id: auth.userId, email: 'test@example.invalid' },
        });
      }
      assert.equal(init.headers.Authorization, 'Bearer renewed');
      assert.equal(init.headers['x-workspace-id'], auth.workspaceId);
      return response({ ok: true });
    },
    async () => {
      persisted++;
    },
  );
  await Promise.all([
    api.request('/api/agents/profile', auth),
    api.request('/api/agents/runs', auth),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(persisted, 1);
  assert.equal(auth.refreshToken, 'rotated');
  assert.equal(auth.workspaceId, 'space-one');
});

test('logout invalida refresh em curso e impede voltar a guardar sessão', async () => {
  let release,
    persisted = 0;
  const auth = session({ expiresAt: 1 });
  const api = new CellApi(
    config,
    async () => {
      await new Promise((resolve) => {
        release = resolve;
      });
      return response({
        access_token: 'renewed',
        refresh_token: 'new',
        user: { id: auth.userId },
      });
    },
    async () => {
      persisted++;
    },
  );
  const task = api.refresh(auth);
  api.invalidate();
  release();
  await assert.rejects(task, SessionExpiredError);
  assert.equal(persisted, 0);
});

test('401 renova uma vez; erro de sessão não se transforma em lista vazia', async () => {
  let requests = 0;
  const api = new CellApi(config, async (url) => {
    if (url.includes('refresh_token'))
      return response({
        access_token: 'new',
        refresh_token: 'new-refresh',
        user: { id: 'user-one' },
      });
    requests++;
    return response({ error: 'expired' }, 401);
  });
  await assert.rejects(
    api.request('/api/agents/runs', session()),
    SessionExpiredError,
  );
  assert.equal(requests, 2);
});

test('falha de rede não repete POST; repetição explícita conserva idempotência e ficheiros', async () => {
  const requests = [],
    store = memoryStore(),
    auth = session();
  let fail = true;
  const api = new CellApi(config, async (_url, init) => {
    requests.push(JSON.parse(init.body));
    if (fail) {
      fail = false;
      throw new Error('connection lost after server accepted the run');
    }
    return response({ run: run() }, 202);
  });
  const client = new CellClient(api, store),
    file = { name: 'note.txt', mimeType: 'text/plain', data: 'SGVsbG8=' };
  await assert.rejects(client.createRun('workflow-one', 'Olá', [file], auth));
  assert.equal(requests.length, 1);
  const pending = await client.getPending('workflow-one', auth);
  assert.equal(pending[0].status, 'failed');
  await client.retryMessage('workflow-one', pending[0].id, auth);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].idempotencyKey, requests[1].idempotencyKey);
  assert.deepEqual(requests[0].files, requests[1].files);
  assert.deepEqual(
    (await client.getPending('workflow-one', auth))[0].files,
    [],
  );
});

test('agentes correspondem a workflows, com nós disponíveis como capacidades', () => {
  const agent = workflowAgent({
    id: 'workflow-one',
    workspace_id: 'space-one',
    name: 'Principal',
    graph: {
      nodes: [
        { id: 'worker-a', type: 'agent', title: 'A' },
        { id: 'worker-b', type: 'agent', title: 'B' },
        { id: 'pdf', type: 'artcraft_pdf', title: 'PDF' },
      ],
    },
  });
  assert.equal(agent.id, 'workflow-one');
  assert.equal(agent.nodes.length, 3);
  assert.equal(agent.nodes[2].type, 'artcraft_pdf');
});

test('consulta de workflows fica limitada ao workspace selecionado', async () => {
  let requestUrl;
  const client = new CellClient(
    new CellApi(config, async (url) => {
      requestUrl = url;
      return response([]);
    }),
    memoryStore(),
  );
  await client.getAgents(session());
  assert.match(requestUrl, /workspace_id=eq.space-one/);
});

test('aprovação antiga é recusada antes de qualquer POST', async () => {
  const methods = [];
  const client = new CellClient(
    new CellApi(config, async (_url, init) => {
      methods.push(init.method);
      return response({
        run: run({ status: 'waiting_approval', approvalHash: 'b'.repeat(64) }),
      });
    }),
    memoryStore(),
  );
  await assert.rejects(
    client.controlRun(
      run({ status: 'waiting_approval', approvalHash: 'a'.repeat(64) }),
      'approve',
      session(),
    ),
    /aprovação mudou/,
  );
  assert.deepEqual(methods, ['GET']);
});

test('aprovação usa o hash exato e o endpoint de controlo existente', async () => {
  const expected = run({
    status: 'waiting_approval',
    approvalHash: 'a'.repeat(64),
  });
  let submitted;
  const client = new CellClient(
    new CellApi(config, async (url, init) => {
      if (init.method === 'POST') {
        assert.equal(url, config.apiUrl + '/api/agents/control');
        submitted = JSON.parse(init.body);
      }
      return response({ run: expected });
    }),
    memoryStore(),
  );
  await client.controlRun(expected, 'approve', session());
  assert.deepEqual(submitted, {
    runId: expected.id,
    operation: 'approve',
    approvalHash: expected.approvalHash,
  });
});

test('histórico mantém mensagens iguais e deduplica apenas pelo ID real da missão', () => {
  const runs = [run(), run({ id: 'run-two' })];
  const pending = [
    {
      id: 'pending-one',
      workflowId: 'workflow-one',
      content: 'Olá',
      createdAt: runs[0].createdAt,
      files: [],
      runId: 'run-one',
      status: 'sent',
    },
  ];
  const messages = conversationMessages('workflow-one', runs, pending);
  assert.equal(messages.length, 2);
  assert.notEqual(messages[0].id, messages[1].id);
});

test('capturas e caches estão isoladas por utilizador e workspace', async () => {
  const client = new CellClient(new CellApi(config), memoryStore());
  const first = session(),
    otherUser = session({ userId: 'user-two' }),
    otherSpace = session({ workspaceId: 'space-two' });
  const capture = await client.saveCapture(
    { title: 'Nota privada', type: 'text', source: 'Texto', note: 'privado' },
    first,
  );
  assert.equal(capture.synced, false);
  assert.equal((await client.getCaptures(first)).length, 1);
  assert.deepEqual(await client.getCaptures(otherUser), []);
  assert.deepEqual(await client.getCaptures(otherSpace), []);
  await client.clearLocalAccount(first);
  assert.deepEqual(await client.getCaptures(first), []);
  assert.throws(() => scopeKey(session({ workspaceId: 'ws_default' })));
});

test('anexos vazios, formatos não suportados e conteúdo excessivo são recusados', () => {
  assert.throws(() =>
    validateAttachments([
      { name: 'empty.txt', mimeType: 'text/plain', data: '' },
    ]),
  );
  assert.throws(() =>
    validateAttachments([
      { name: 'video.mp4', mimeType: 'video/mp4', data: 'SGVsbG8=' },
    ]),
  );
  assert.throws(() =>
    validateAttachments([
      { name: 'big.txt', mimeType: 'text/plain', data: 'AAAA'.repeat(70000) },
    ]),
  );
  assert.doesNotThrow(() =>
    validateAttachments([
      { name: 'image.png', mimeType: 'image/png', data: 'SGVsbG8=' },
    ]),
  );
});

test('downloads só abrem URLs assinadas do Storage configurado', () => {
  assert.equal(
    trustedDownload(
      'https://data.example/storage/v1/object/sign/files/id?token=short-lived',
      config.supabaseUrl,
    ),
    'https://data.example/storage/v1/object/sign/files/id?token=short-lived',
  );
  for (const target of [
    'javascript:alert(1)',
    'https://evil.example/file',
    'https://data.example/auth/v1/token',
    'https://data.example.evil.example/storage/v1/object/sign/a',
  ])
    assert.throws(() => trustedDownload(target, config.supabaseUrl));
});

test('caminhos externos e redirecionamentos não transportam o token', async () => {
  let called = false;
  const api = new CellApi(config, async (_url, init) => {
    called = true;
    assert.equal(init.redirect, 'error');
    return response({ ok: true });
  });
  await assert.rejects(api.request('//evil.example', session()));
  assert.equal(called, false);
  await api.request('/api/agents/runs', session());
  assert.equal(called, true);
});

test('resposta recebida depois do logout é descartada antes de escrever a cache', async () => {
  let release;
  const store = memoryStore();
  const api = new CellApi(config, async () => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return response([]);
  });
  const client = new CellClient(api, store),
    auth = session();
  const task = client.getAgents(auth);
  await client.clearLocalAccount(auth);
  release();
  await assert.rejects(task, SessionExpiredError);
  assert.equal(await store.get(scopeKey(auth) + 'agents'), null);
});

test('revisão de configuração alterada impede substituir permissões de outro cliente', async () => {
  const methods = [];
  const client = new CellClient(
    new CellApi(config, async (_url, init) => {
      methods.push(init.method);
      return response({
        revision: 2,
        profile: {
          provider: 'google',
          model: 'test',
          credentialId: 'test-id',
          grants: {},
        },
      });
    }),
    memoryStore(),
  );
  await assert.rejects(
    client.saveAgentProfile(
      'workflow-one',
      {
        revision: 1,
        config: { provider: 'google', model: 'test', credentialId: 'test-id' },
        grants: {
          editGraph: false,
          executeCode: false,
          teams: false,
          externalEffects: false,
        },
      },
      session(),
    ),
    /mudou noutro cliente/,
  );
  assert.deepEqual(methods, ['GET']);
});

test('rascunhos conservam o anexo e ficam isolados entre contas e espaços', async () => {
  const client = new CellClient(new CellApi(config), memoryStore()),
    auth = session();
  const draft = {
    text: 'Continuar amanhã',
    attachment: { name: 'note.txt', mimeType: 'text/plain', data: 'SGVsbG8=' },
  };
  await client.saveDraft('workflow-one', draft, auth);
  assert.deepEqual(await client.getDraft('workflow-one', auth), draft);
  assert.equal(
    await client.getDraft('workflow-one', session({ userId: 'other' })),
    null,
  );
  assert.equal(
    await client.getDraft('workflow-one', session({ workspaceId: 'other' })),
    null,
  );
  await client.clearLocalAccount(auth);
  assert.equal(await client.getDraft('workflow-one', auth), null);
});

test('histórico preserva os metadados de ficheiros gerados recebidos do serviço', async () => {
  const generatedFiles = [
    {
      id: 'file-one',
      name: 'relatorio.pdf',
      mimeType: 'application/pdf',
      size: 120,
    },
  ];
  const client = new CellClient(
    new CellApi(config, async () =>
      response({ runs: [run({ status: 'success', generatedFiles })] }),
    ),
    memoryStore(),
  );
  assert.deepEqual(
    (await client.getRuns('workflow-one', session()))[0].generatedFiles,
    generatedFiles,
  );
});

test('uma operação preparada antes do logout não pode iniciar um POST depois de sair', async () => {
  let release,
    requested = false;
  const store = memoryStore(),
    originalGet = store.get;
  store.get = async (key) => {
    if (key.includes('pending:'))
      await new Promise((resolve) => {
        release = resolve;
      });
    return originalGet(key);
  };
  const api = new CellApi(config, async () => {
    requested = true;
    return response({ run: run() });
  });
  const client = new CellClient(api, store),
    auth = session();
  const sending = client.createRun('workflow-one', 'Olá', [], auth);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  const logout = client.clearLocalAccount(auth);
  release();
  await assert.rejects(sending, SessionExpiredError);
  await logout;
  assert.equal(requested, false);
});

test('mudar de conta impede pedidos tardios da conta anterior', async () => {
  let requested = false;
  const api = new CellApi(config, async () => {
    requested = true;
    return response({ ok: true });
  });
  api.activate(session({ userId: 'user-two' }));
  await assert.rejects(
    api.request('/api/agents/runs', session()),
    SessionExpiredError,
  );
  assert.equal(requested, false);
});

test('remover um envio falhado é local e não cancela missões no serviço', async () => {
  const auth = session(),
    store = memoryStore();
  let requested = false;
  await store.set(scopeKey(auth) + 'pending:workflow-one', [
    { id: 'failed', workflowId: 'workflow-one', status: 'failed' },
  ]);
  const client = new CellClient(
    new CellApi(config, async () => {
      requested = true;
      return response({});
    }),
    store,
  );
  await client.discardPending('workflow-one', 'failed', auth);
  assert.deepEqual(await client.getPending('workflow-one', auth), []);
  assert.equal(requested, false);
});

test('o transporte funciona com o contexto exigido pelo fetch do navegador', async () => {
  function browserFetch() {
    if (this && this !== globalThis) throw new TypeError('Illegal invocation');
    return Promise.resolve(response({ ok: true }));
  }
  const result = await new CellApi(config, browserFetch).request(
    '/api/agents/runs',
    session(),
  );
  assert.equal(result.ok, true);
});

test('a conversa aguarda a resposta real sem transformar métricas numa mensagem do agente', () => {
  const base = {
    id: 'chat-flow',
    workflowId: 'workflow-one',
    message: 'Olá',
    createdAt: '2026-11-09T10:00:00Z',
    updatedAt: '2026-11-09T10:00:01Z',
    summary: '3 ferramentas usadas',
    modelCalls: 2,
    toolCalls: 3,
  };
  for (const status of ['queued', 'running', 'waiting_approval', 'paused']) {
    assert.equal(
      conversationMessages('workflow-one', [{ ...base, status }], []).filter(
        (message) => message.role === 'assistant',
      ).length,
      0,
    );
  }
  const answer = conversationMessages(
    'workflow-one',
    [{ ...base, status: 'success', answer: 'Olá, como posso ajudar?' }],
    [],
  ).find((message) => message.role === 'assistant');
  assert.equal(answer.content, 'Olá, como posso ajudar?');
  const failed = conversationMessages(
    'workflow-one',
    [{ ...base, status: 'failed' }],
    [],
  ).find((message) => message.role === 'assistant');
  assert.match(failed.content, /Não foi possível concluir/);
  assert.ok(!failed.content.includes(base.summary));
  const file = conversationMessages(
    'workflow-one',
    [
      {
        ...base,
        status: 'success',
        generatedFiles: [
          {
            id: 'file',
            name: 'resumo.pdf',
            mimeType: 'application/pdf',
            size: 100,
          },
        ],
      },
    ],
    [],
  ).find((message) => message.role === 'assistant');
  assert.equal(file.content, 'O ficheiro está pronto.');
});

test('a confirmação conserva a identidade da mensagem sem apagar pedidos iguais', () => {
  const first = {
    id: 'local-one',
    workflowId: 'workflow-one',
    content: 'Olá',
    createdAt: '2026-11-09T10:00:00Z',
    files: [{ name: 'a.txt', mimeType: 'text/plain', data: 'YQ==' }],
    status: 'sending',
  };
  const second = { ...first, id: 'local-two', files: [] };
  const confirmedRun = run({ id: 'confirmed', message: 'Olá' });
  const pending = acknowledgePending([first, second], first.id, confirmedRun);
  const history = conversationMessages('workflow-one', [confirmedRun], pending);
  assert.equal(history.filter((message) => message.role === 'user').length, 2);
  assert.equal(
    history.find((message) => message.runId === 'confirmed').id,
    first.id,
  );
  assert.equal(pending[0].status, 'sent');
  assert.deepEqual(pending[0].files, []);
  assert.equal(first.status, 'sending');
  assert.equal(second.status, 'sending');
});
test('envios interrompidos voltam com confirmação explícita e a mesma chave', () => {
  const original = {
    id: 'stable-key',
    workflowId: 'workflow-one',
    content: 'Olá',
    createdAt: '2026-11-09T10:00:00Z',
    files: [],
    status: 'sending',
  };
  const recovered = recoverUnconfirmedPending([original]);
  assert.equal(recovered[0].status, 'failed');
  assert.equal(recovered[0].id, original.id);
  assert.match(recovered[0].error, /sem confirmação/);
  assert.equal(original.status, 'sending');
});
test('remover um envio sem confirmação limpa a caixa local e conserva mensagens confirmadas', async () => {
  const store = memoryStore(),
    auth = session();
  const key = scopeKey(auth) + 'pending:workflow-one';
  const interrupted = {
    id: 'interrupted',
    workflowId: 'workflow-one',
    content: 'Olá',
    createdAt: '2026-11-09T10:00:00Z',
    files: [],
    status: 'sending',
  };
  const sent = {
    ...interrupted,
    id: 'confirmed',
    runId: 'run-one',
    status: 'sent',
  };
  await store.set(key, [interrupted, sent]);
  const client = new CellClient(
    new CellApi(config, async () => {
      assert.fail('Discarding a local pending message must not send a request');
    }),
    store,
  );
  await client.discardPending('workflow-one', interrupted.id, auth);
  await client.discardPending('workflow-one', sent.id, auth);
  assert.deepEqual(await client.getPending('workflow-one', auth), [sent]);
});
test('a conversa não mostra mensagens de outro workflow durante a mudança de agente', () => {
  assert.deepEqual(
    conversationMessages(
      'other-workflow',
      [run({ answer: 'Resposta de outro agente' })],
      [],
    ),
    [],
  );
});

test('a execução devolve a resposta final sem aguardar outra consulta de histórico', async () => {
  const expected = run({ status: 'success', answer: 'Resposta imediata' });
  const client = new CellClient(
    new CellApi(config, async (url, init) => {
      assert.equal(url, config.apiUrl + '/api/agents/tick');
      assert.equal(init.method, 'POST');
      return response({ run: expected }, 202);
    }),
    memoryStore(),
  );
  assert.deepEqual(await client.advanceRun(expected.id, session()), expected);
});
test('o catálogo consulta só metadados e exclui conectores privados de outro espaço', async () => {
  const store = memoryStore(),
    auth = session();
  let requests = 0;
  const client = new CellClient(
    new CellApi(config, async (url, init) => {
      requests++;
      const parsed = new URL(url);
      assert.equal(
        parsed.searchParams.get('or'),
        '(is_public.eq.true,workspace_id.eq.space-one)',
      );
      assert.ok(
        !/http_config|script_config|config_fields/.test(
          parsed.searchParams.get('select'),
        ),
      );
      assert.equal(init.headers.Authorization, 'Bearer access-test');
      return response([
        {
          id: 'public',
          name: 'Público',
          is_public: true,
          workspace_id: 'other',
        },
        {
          id: 'private',
          slug: 'mine',
          name: 'Meu',
          is_public: false,
          workspace_id: 'space-one',
        },
        {
          id: 'foreign',
          name: 'Outro',
          is_public: false,
          workspace_id: 'space-two',
        },
      ]);
    }),
    store,
  );
  const cells = await client.getCustomCells(auth);
  assert.equal(requests, 1);
  assert.deepEqual(
    cells.map((cell) => cell.id),
    ['public', 'private'],
  );
  assert.deepEqual(cells[1].aliases, ['custom_mine']);
  assert.equal(
    (await client.getCachedCustomCells(session({ workspaceId: 'space-two' })))
      .length,
    0,
  );
});
