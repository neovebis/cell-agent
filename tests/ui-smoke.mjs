// UI-only protocol fixtures. This test never contacts Cell Griot or production accounts.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const root = resolve(process.env.CELL_UI_DIST || 'build/test-web');
const evidence =
  process.env.CELL_UI_EVIDENCE || join(tmpdir(), 'cell-agent-ui');
await mkdir(evidence, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const server = createServer(async (request, response) => {
  try {
    const path = resolve(
      root,
      '.' +
        decodeURIComponent(new URL(request.url, 'http://localhost').pathname),
    );
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    let file = path;
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(root, 'index.html');
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(500);
    response.end('Preview failed');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true });
const verdicts = [];
try {
  for (const viewport of [
    { width: 1280, height: 900, name: 'desktop' },
    { width: 390, height: 844, name: 'mobile' },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: 'block',
    });
    const errors = [],
      unexpected = [],
      runs = [],
      submissions = [];
    let profileRevision = 1,
      downloadRequests = 0;
    let profile = {
      provider: 'google',
      model: 'fixture-model',
      credentialId: 'model-key',
      role: 'Agente principal',
      systemPrompt: 'Instruções de teste',
      maxModelCalls: 8,
      maxToolCalls: 12,
      grants: {
        editGraph: false,
        executeCode: false,
        webSearch: true,
        teams: false,
        externalEffects: false,
        verificationRequired: false,
        executeNodes: ['pdf-node'],
        credentialIds: ['model-key', 'service-key'],
        variableNames: ['PARAM'],
      },
    };
    const workflow = {
      id: 'workflow-one',
      workspace_id: 'space-one',
      name: 'Agente principal',
      description: 'Revisão de documentos',
      is_active: true,
      graph: {
        nodes: [
          { id: 'pdf-node', type: 'artcraft_pdf', title: 'PDF de trabalho' },
          { id: 'worker', type: 'agent', title: 'Especialista' },
        ],
        edges: [],
      },
    };
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
    await context.route('**/*', async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (
        url.origin === origin ||
        url.protocol === 'data:' ||
        url.protocol === 'blob:'
      ) {
        await route.continue();
        return;
      }
      if (
        !['https://cell-api.example', 'https://supabase.example'].includes(
          url.origin,
        )
      ) {
        unexpected.push(request.url());
        await route.abort();
        return;
      }
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      const body = request.postDataJSON() || {};
      const reply = (value, status = 200) =>
        route.fulfill({ status, headers, body: JSON.stringify(value) });
      if (url.pathname.startsWith('/auth/v1/token'))
        return reply({
          access_token: 'fixture-access',
          refresh_token: 'fixture-refresh',
          expires_in: 3600,
          user: { id: 'user-one', email: 'test@example.invalid' },
        });
      if (url.pathname === '/rest/v1/cells_workspaces')
        return reply([
          { id: 'space-one', name: 'Espaço de teste', tier: 'free' },
        ]);
      if (url.pathname === '/rest/v1/cells_workflows') return reply([workflow]);
      if (url.pathname === '/api/credentials')
        return reply([
          { id: 'model-key', name: 'Modelo de teste', provider: 'google' },
          { id: 'service-key', name: 'Serviço de teste', provider: 'slack' },
        ]);
      if (url.pathname === '/api/variables')
        return reply([{ id: 'parameter', name: 'PARAM' }]);
      if (url.pathname === '/api/agents/profile') {
        if (request.method() === 'POST') {
          profile = body.profile;
          profileRevision++;
          submissions.push(body);
        }
        return reply({ profile, revision: profileRevision });
      }
      if (url.pathname === '/api/agents/runs') {
        if (request.method() === 'POST') {
          assert.ok(body.idempotencyKey);
          const existing = runs.find((run) => run.key === body.idempotencyKey);
          if (existing) return reply({ run: existing }, 202);
          const time = new Date().toISOString();
          const run = {
            id: '00000000-0000-4000-8000-000000000001',
            workflowId: 'workflow-one',
            key: body.idempotencyKey,
            message: body.message,
            status: 'queued',
            createdAt: time,
            updatedAt: time,
            modelCalls: 0,
            toolCalls: 0,
            files: [],
          };
          runs.push(run);
          return reply({ run }, 202);
        }
        if (url.searchParams.has('id'))
          return reply({
            run: runs.find((run) => run.id === url.searchParams.get('id')),
          });
        return reply({ runs });
      }
      if (url.pathname === '/api/agents/tick') {
        const run = runs.find((run) => run.id === body.runId);
        if (run?.status === 'queued')
          Object.assign(run, {
            status: 'waiting_approval',
            updatedAt: new Date().toISOString(),
            approvalHash: 'a'.repeat(64),
            approval: {
              reason: 'Confirma a operação neste PDF.',
              action: { name: 'node.test', arguments: { nodeId: 'pdf-node' } },
            },
            modelCalls: 1,
          });
        return reply({ run }, 202);
      }
      if (url.pathname === '/api/agents/control') {
        const run = runs.find((run) => run.id === body.runId);
        assert.ok(run);
        if (body.operation === 'approve') {
          assert.equal(body.approvalHash, run.approvalHash);
          Object.assign(run, {
            status: 'success',
            answer: 'Documento preparado.',
            updatedAt: new Date().toISOString(),
            toolCalls: 1,
            generatedFiles: [
              {
                id: '00000000-0000-4000-8000-000000000002',
                name: 'relatorio.pdf',
                mimeType: 'application/pdf',
                size: 120,
              },
            ],
          });
        }
        return reply({ run });
      }
      if (url.pathname === '/api/agents/attachments') {
        downloadRequests++;
        return reply({
          url: 'https://supabase.example/storage/v1/object/sign/agent-native-outputs/relatorio.pdf?token=fixture',
        });
      }
      if (url.pathname.startsWith('/storage/'))
        return route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="relatorio.pdf"',
          },
          body: '%PDF-1.4\n% UI test fixture only\n%%EOF',
        });
      unexpected.push(url.href);
      return reply({ error: 'Unexpected test request' }, 500);
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page
      .getByLabel('Email', { exact: true })
      .fill('test@example.invalid');
    await page
      .getByLabel('Palavra-passe', { exact: true })
      .fill('fixture-password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    const composer = page.getByLabel('Mensagem ao agente', { exact: true });
    await composer.waitFor({ timeout: 20000 });
    await composer.fill('Revê o meu PDF.');
    await page
      .getByRole('button', { name: 'Enviar mensagem', exact: true })
      .click();
    const approve = page.getByRole('button', {
      name: 'Aprovar operação',
      exact: true,
    });
    await approve.waitFor({ timeout: 20000 });
    await approve.click();
    await page
      .getByText('Documento preparado.', { exact: true })
      .waitFor({ timeout: 20000 });
    await page
      .getByRole('button', { name: 'Descarregar relatorio.pdf', exact: true })
      .waitFor();
    await page.screenshot({
      path: join(evidence, viewport.name + '-chat.png'),
    });
    await composer.fill('Rascunho preservado');
    await page.getByText('Capacidades', { exact: true }).click();
    await page.getByText('PDF de trabalho', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Configurar', exact: true }).click();
    const cellSwitch = page.getByRole('switch', {
      name: 'Autorizar PDF de trabalho',
      exact: true,
    });
    await cellSwitch.scrollIntoViewIfNeeded();
    assert.equal(await cellSwitch.isChecked(), true);
    await cellSwitch.click();
    await page
      .getByRole('button', { name: 'Guardar configurações', exact: true })
      .click();
    await page
      .getByText('Configurar agente', { exact: true })
      .waitFor({ state: 'hidden' });
    assert.equal(submissions.length, 1);
    assert.deepEqual(submissions[0].profile.grants.executeNodes, []);
    assert.deepEqual(submissions[0].profile.grants.credentialIds, [
      'model-key',
      'service-key',
    ]);
    assert.equal(submissions[0].profile.grants.externalEffects, false);
    assert.deepEqual(submissions[0].profile.grants.variableNames, ['PARAM']);
    await page.screenshot({
      path: join(evidence, viewport.name + '-capabilities.png'),
    });
    await page.getByText('Chat', { exact: true }).click();
    await composer.waitFor();
    assert.equal(await composer.inputValue(), 'Rascunho preservado');
    await page
      .getByRole('button', { name: 'Descarregar relatorio.pdf', exact: true })
      .click();
    for (let attempt = 0; attempt < 20 && !downloadRequests; attempt++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(downloadRequests, 1);
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
    verdicts.push({
      viewport: viewport.name,
      login: true,
      send: true,
      approval: true,
      generatedFile: true,
      grantsPreserved: true,
      draftPreserved: true,
      consoleErrors: errors.length,
    });
    await context.close();
  }
  console.log(
    JSON.stringify(
      {
        browserPlugin: 'Browser plugin not available',
        fixtureOnly: true,
        productionRequests: 0,
        results: verdicts,
        evidence,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
