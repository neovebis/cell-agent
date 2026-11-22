import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activityLabel,
  activitySourceUrl,
  buildRunActivity,
  publicActivityText,
} from '../src/services/runActivity.ts';
const run = (extra = {}) => ({
  id: 'one',
  workflowId: 'agent-one',
  status: 'success',
  message: 'Pedido',
  createdAt: '2026-11-22T10:00:00Z',
  updatedAt: '2026-11-22T10:01:00Z',
  ...extra,
});

test('atividade mantém operações reais, saídas e progresso com os tempos publicados', () => {
  const value = buildRunActivity(
    run({
      observations: [
        {
          step: 1,
          tool: 'project.command',
          success: true,
          result: {
            command: 'node --test',
            stdout: 'Passaram 3 testes',
            exitCode: 0,
          },
        },
        {
          step: 2,
          tool: 'project.read',
          success: false,
          error: 'Ficheiro inexistente',
        },
      ],
      events: [
        { summary: 'Terminou', created_at: '2026-11-22T10:01:00Z' },
        { summary: 'A preparar', createdAt: '2026-11-22T10:00:01Z' },
      ],
    }),
  );
  assert.equal(value.entries[0].title, 'Executou um comando');
  assert.match(value.entries[0].detail, /node --test/);
  assert.match(value.entries[0].detail, /Passaram 3 testes/);
  assert.equal(value.entries[0].time, undefined);
  assert.equal(value.entries[1].failed, true);
  assert.equal(value.entries[2].title, 'A preparar');
  assert.equal(value.entries[3].time, '2026-11-22T10:01:00Z');
});

test('fontes vêm das pesquisas e ferramentas sem duplicar nem abrir ligações privadas', () => {
  const sources = buildRunActivity(
    run({
      searches: [
        {
          query: 'consulta',
          sources: [
            { title: 'Fonte oficial', url: 'https://docs.example/page#top' },
            { title: 'Segunda fonte', url: 'https://other.example/article' },
          ],
        },
      ],
      observations: [
        {
          tool: 'web.search',
          success: true,
          result: {
            sources: [
              { url: 'https://docs.example/page', title: 'Fonte oficial' },
              { url: 'https://secret.example/?token=private' },
              { url: 'javascript:alert(1)' },
            ],
            reasoning: { url: 'https://hidden.example' },
          },
        },
      ],
    }),
  ).sources;
  assert.deepEqual(
    sources.map((s) => s.url),
    ['https://docs.example/page', 'https://other.example/article'],
  );
  for (const url of [
    'data:text/html,hi',
    'file:///private',
    'https://user:pass@host.example',
    'https://data.example/storage/v1/object/sign/a?token=x',
    'https://a.example/?%74oken=hidden',
    'https://a.example/?X-Amz-Signature=private',
  ])
    assert.equal(activitySourceUrl(url), undefined);
});

test('atividade remove segredos e não expande raciocínio interno nem ambiente', () => {
  const model = buildRunActivity(
    run({
      observations: [
        {
          tool: 'project.command',
          result: {
            stdout:
              'Authorization: Bearer secret-value\nAPI_KEY="another-secret"\ntoken=private-token',
            reasoning: 'INTERNAL_REASONING',
            env: { PASSWORD: 'private-password' },
            headers: { Authorization: 'secret-header' },
          },
        },
      ],
    }),
  );
  const text = JSON.stringify(model);
  for (const privateValue of [
    'secret-value',
    'another-secret',
    'private-token',
    'INTERNAL_REASONING',
    'private-password',
    'secret-header',
  ])
    assert.equal(text.includes(privateValue), false, privateValue);
  assert.match(text, /\[oculto\]/);
  const json = publicActivityText(
    JSON.stringify({ password: 'json-secret', token: 'json-token' }),
  );
  assert.equal(json.includes('json-secret'), false);
  assert.equal(json.includes('json-token'), false);
  assert.equal(publicActivityText(42), '');
});

test('fontes funcionam com o URL nativo sem iteradores nem setter de hash', () => {
  const OriginalURL = globalThis.URL;
  class NativeURL {
    constructor(value) {
      this.parsed = new OriginalURL(value);
    }
    get protocol() {
      return this.parsed.protocol;
    }
    get username() {
      return this.parsed.username;
    }
    get password() {
      return this.parsed.password;
    }
    get pathname() {
      return this.parsed.pathname;
    }
    get hostname() {
      return this.parsed.hostname;
    }
    get search() {
      return this.parsed.search;
    }
    get hash() {
      return this.parsed.hash;
    }
    get searchParams() {
      throw Error('Not implemented by legacy native URL');
    }
  }
  try {
    globalThis.URL = NativeURL;
    assert.equal(
      activitySourceUrl('https://docs.example/page?q=real#source'),
      'https://docs.example/page?q=real',
    );
  } finally {
    globalThis.URL = OriginalURL;
  }
});

test('não inventa ferramentas, comandos ou fontes quando não foram partilhados', () => {
  assert.deepEqual(buildRunActivity(run()), { entries: [], sources: [] });
  const record = buildRunActivity(
    run({
      observations: [
        { tool: 'project.command', success: true, result: { ok: true } },
      ],
    }),
  );
  assert.equal(record.entries[0].detail, undefined);
  assert.equal(activityLabel(run()), 'Ver atividade');
  assert.equal(
    activityLabel(run({ status: 'waiting_approval' })),
    'Aguarda a tua autorização',
  );
});

test('cache é isolada por execução e atualiza resultados novos sem percorrer objetos ilimitados', () => {
  const first = run({
    observations: [
      { tool: 'project.read', result: { content: 'Apenas do primeiro' } },
    ],
  });
  assert.equal(buildRunActivity(first), buildRunActivity(first));
  assert.equal(
    JSON.stringify(buildRunActivity(run({ id: 'two' }))).includes(
      'Apenas do primeiro',
    ),
    false,
  );
  const cycle = {};
  cycle.self = cycle;
  assert.doesNotThrow(() =>
    buildRunActivity(run({ observations: [{ tool: 'test', result: cycle }] })),
  );
  const changed = {
    ...first,
    observations: [
      ...first.observations,
      { tool: 'project.write', result: { path: 'file.txt' } },
    ],
  };
  assert.equal(buildRunActivity(changed).entries.length, 2);
});
