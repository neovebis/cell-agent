import test from 'node:test';
import assert from 'node:assert/strict';
import {
  centralAgentConfig,
  centralAgentGrants,
  centralAgentPayload,
  agentProfileReady,
} from '../src/services/agentProfile.ts';
import { CellApi } from '../src/services/api.ts';
import { CellClient } from '../src/services/client.ts';
const allowedConfig = new Set([
  'provider',
  'model',
  'credentialId',
  'systemPrompt',
  'maxModelCalls',
  'maxToolCalls',
  'maxOutputTokens',
  'maxDurationSeconds',
  'concurrency',
  'grants',
]);
const allowedGrants = new Set([
  'editGraph',
  'executeCode',
  'webSearch',
  'executeNodes',
  'credentialIds',
  'variableNames',
  'teams',
  'externalEffects',
]);
const config = {
  apiUrl: 'https://cell.example',
  supabaseUrl: 'https://data.example',
  publishableKey: 'public-key',
};
const session = {
  userId: 'owner',
  workspaceId: 'space',
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: Date.now() / 1000 + 3600,
  displayName: 'Teste',
};
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const data = new Map();
const store = {
  async get(key) {
    return structuredClone(data.get(key)) || null;
  },
  async set(key, value) {
    data.set(key, structuredClone(value));
  },
  async remove(key) {
    data.delete(key);
  },
  async removePrefix() {},
};
function validate(profile) {
  if (
    Object.keys(profile).some((key) => !allowedConfig.has(key)) ||
    Object.keys(profile.grants).some((key) => !allowedGrants.has(key))
  )
    throw Error('Campo de configuração não suportado.');
  assert.ok(profile.provider && profile.model && profile.credentialId);
}
test('os campos locais que impediam guardar não entram no contrato central', () => {
  const local = {
    provider: 'google',
    model: 'gemini',
    credentialId: 'key',
    role: 'Chefe',
    temperature: 0.3,
    unexpected: true,
    systemPrompt: 'Ajuda-me',
    maxModelCalls: 24,
  };
  const grants = {
    editGraph: false,
    executeCode: false,
    teams: false,
    externalEffects: false,
    verificationRequired: true,
    executeNodes: [],
    credentialIds: ['key'],
    variableNames: [],
  };
  assert.throws(() => validate({ ...local, grants }), /Campo de configuração/);
  const payload = centralAgentPayload(local, grants);
  validate(payload);
  for (const key of ['role', 'temperature', 'unexpected'])
    assert.equal(key in payload, false);
  assert.equal('verificationRequired' in payload.grants, false);
  assert.equal(local.role, 'Chefe');
  assert.equal(grants.verificationRequired, true);
  for (const key of ['editGraph', 'executeCode', 'teams', 'externalEffects'])
    assert.equal(payload.grants[key], false);
});
test('preserva autorizações reais sem ativar capacidades por omissão', () => {
  const grants = centralAgentGrants({
    editGraph: false,
    executeCode: true,
    teams: false,
    externalEffects: false,
    executeNodes: ['pdf'],
    credentialIds: ['model'],
    variableNames: ['PARAM'],
  });
  assert.deepEqual(grants.executeNodes, ['pdf']);
  assert.deepEqual(grants.credentialIds, ['model']);
  assert.equal(grants.executeCode, true);
  assert.equal(grants.editGraph, false);
  assert.equal('webSearch' in grants, false);
  assert.deepEqual(centralAgentGrants(null), {
    editGraph: false,
    executeCode: false,
    teams: false,
    externalEffects: false,
    executeNodes: [],
    credentialIds: [],
    variableNames: [],
  });
});
test('agentes sem perfil podem guardar e enviar sem alterar o agente funcional', async () => {
  const profiles = new Map([
    [
      'working',
      {
        provider: 'google',
        model: 'working-model',
        credentialId: 'working-key',
        grants: {
          editGraph: false,
          executeCode: false,
          teams: false,
          externalEffects: false,
          executeNodes: ['pdf'],
          credentialIds: ['working-key'],
          variableNames: [],
        },
      },
    ],
  ]);
  const before = structuredClone(profiles.get('working'));
  const api = new CellApi(config, async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : {};
    if (url.startsWith(config.apiUrl + '/api/agents/profile')) {
      const id = body.workflowId || new URL(url).searchParams.get('workflowId');
      if (init.method === 'POST') {
        validate(body.profile);
        profiles.set(id, body.profile);
      }
      return response({
        profile: profiles.get(id) || null,
        revision: profiles.has(id) ? 1 : 0,
      });
    }
    assert.equal(url, config.apiUrl + '/api/agents/runs');
    assert.ok(profiles.get(body.workflowId));
    return response(
      {
        run: {
          id: 'run-' + body.workflowId,
          workflowId: body.workflowId,
          message: body.message,
          status: 'queued',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      202,
    );
  });
  const client = new CellClient(api, store);
  for (const id of ['Chefe', 'Griotinho']) {
    assert.equal(await client.getAgentProfile(id, session), null);
    await client.saveAgentProfile(
      id,
      {
        config: {
          provider: 'google',
          model: 'chosen',
          credentialId: 'model-key',
          role: id,
          temperature: 0.3,
        },
        grants: {
          editGraph: false,
          executeCode: false,
          teams: false,
          externalEffects: false,
          verificationRequired: true,
        },
      },
      session,
    );
    const profile = await client.getAgentProfile(id, session);
    assert.equal(agentProfileReady(profile.config), true);
    assert.equal(
      (await client.createRun(id, 'Olá', [], session)).workflowId,
      id,
    );
    assert.equal(profile.grants.editGraph, false);
    assert.equal(profile.grants.externalEffects, false);
  }
  assert.deepEqual(profiles.get('working'), before);
});
test('uma permissão recusada não é contornada', async () => {
  let posts = 0;
  const client = new CellClient(
    new CellApi(config, async () => {
      posts++;
      return response(
        { error: 'Credencial fora do workspace autorizado.' },
        403,
      );
    }),
    store,
  );
  await assert.rejects(
    client.saveAgentProfile(
      'Chefe',
      {
        config: { provider: 'google', model: 'chosen', credentialId: 'other' },
        grants: centralAgentGrants({}),
      },
      session,
    ),
    /fora do workspace autorizado/,
  );
  assert.equal(posts, 1);
});
test('só um perfil com modelo e credencial permite enviar', () => {
  for (const value of [
    undefined,
    centralAgentConfig({}),
    { provider: 'google', model: 'chosen' },
    { provider: 'google', model: ' ', credentialId: 'key' },
  ])
    assert.equal(agentProfileReady(value), false);
  assert.equal(
    agentProfileReady({
      provider: 'google',
      model: 'chosen',
      credentialId: 'key',
    }),
    true,
  );
});
