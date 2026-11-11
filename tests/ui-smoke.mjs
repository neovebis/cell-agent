// UI-only protocol fixtures. This test never contacts Cell Griot or production accounts.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = await import(
  process.env.CELL_PLAYWRIGHT_MODULE || 'playwright'
);

const root = resolve(process.env.CELL_UI_DIST || 'build/test-web');
const evidence =
  process.env.CELL_UI_EVIDENCE || join(tmpdir(), 'cell-agent-ui');
const apiOrigin = process.env.CELL_UI_API_ORIGIN || 'https://cell-api.example';
const supabaseOrigin =
  process.env.CELL_UI_SUPABASE_ORIGIN || 'https://supabase.example';
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
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CELL_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CELL_CHROMIUM_EXECUTABLE }
    : {}),
});
const verdicts = [];
const pendingFixtureReleases = new Set();
async function waitForPainted(locator) {
  await locator.waitFor();
  for (let attempt = 0; attempt < 100; attempt++) {
    const painted = await locator.evaluate((element) => {
      if (!element.getBoundingClientRect().height) return false;
      for (let current = element; current; current = current.parentElement)
        if (Number(getComputedStyle(current).opacity) < 0.99) return false;
      return true;
    });
    if (painted) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail('The response stayed transparent after its entrance animation.');
}
try {
  for (const viewport of [
    { width: 1280, height: 900, name: 'desktop' },
    { width: 390, height: 844, name: 'mobile' },
    { width: 320, height: 760, name: 'narrow' },
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
    let releaseOldModels;
    let oldModelsRequested = false;
    let releaseTick;
    let releasePost;
    let confirmationPending = false;
    let confirmationReads = 0;
    let tickRequested = false;
    const postGate = new Promise((resolve) => {
      releasePost = resolve;
      pendingFixtureReleases.add(resolve);
    });
    const tickGate = new Promise((resolve) => {
      releaseTick = resolve;
      pendingFixtureReleases.add(resolve);
    });
    const friendlyAnswer =
      'Claro. Estou aqui para te ouvir. Podemos ir com calma, sem pressa de resolver tudo de uma vez. Conta-me o que estás a sentir ou o que aconteceu hoje e vamos pensar nisso juntos.';
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
      'Access-Control-Allow-Headers':
        'authorization, apikey, content-type, x-workspace-id, prefer',
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
      if (![apiOrigin, supabaseOrigin].includes(url.origin)) {
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
      if (url.pathname === '/rest/v1/cells_custom_connectors')
        return reply([
          {
            id: 'community-one',
            slug: 'community-one',
            name: 'Conector da comunidade',
            description: 'Consulta pública de teste.',
            category: 'execution',
            icon: 'Plug',
            is_public: true,
            workspace_id: 'other-space',
          },
          {
            id: 'private-one',
            slug: 'private-one',
            name: 'Conector privado do espaço',
            description: 'Privado neste espaço.',
            category: 'execution',
            icon: 'Mail',
            is_public: false,
            workspace_id: 'space-one',
          },
          {
            id: 'private-other',
            slug: 'other',
            name: 'Privado de outro espaço',
            description: 'Não mostrar.',
            icon: 'Plug',
            is_public: false,
            workspace_id: 'other-space',
          },
        ]);
      if (url.pathname === '/rest/v1/cells_workflows')
        return reply([
          workflow,
          {
            ...workflow,
            id: 'workflow-two',
            name: 'Griotinho',
            description: 'O teu assistente pessoal',
            graph: { nodes: [], edges: [] },
          },
        ]);
      if (url.pathname === '/api/credentials')
        return reply([
          { id: 'model-key', name: 'Modelo de teste', provider: 'google' },
          { id: 'other-model-key', name: 'Outro modelo', provider: 'openai' },
          { id: 'service-key', name: 'Serviço de teste', provider: 'slack' },
        ]);
      if (url.pathname === '/api/credentials/models') {
        if (url.searchParams.get('id') === 'model-key') {
          oldModelsRequested = true;
          await new Promise((resolve) => {
            releaseOldModels = resolve;
            pendingFixtureReleases.add(resolve);
          });
          pendingFixtureReleases.delete(releaseOldModels);
          return reply({
            models: [{ id: 'old-model', name: 'Catálogo antigo' }],
          });
        }
        return reply({ models: [{ id: 'new-model', name: 'Catálogo atual' }] });
      }
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
            id:
              '00000000-0000-4000-8000-' +
              String(runs.length + 1).padStart(12, '0'),
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
          if (run.message === 'Revê o meu PDF.') {
            confirmationPending = true;
            await postGate;
            confirmationPending = false;
            pendingFixtureReleases.delete(releasePost);
          }
          return reply({ run }, 202);
        }
        if (url.searchParams.has('id'))
          return reply({
            run: runs.find((run) => run.id === url.searchParams.get('id')),
          });
        if (confirmationPending) confirmationReads++;
        return reply({ runs });
      }
      if (url.pathname === '/api/agents/tick') {
        const run = runs.find((run) => run.id === body.runId);
        if (run?.status === 'queued') {
          if (run.message === 'Revê o meu PDF.') {
            tickRequested = true;
            await tickGate;
            pendingFixtureReleases.delete(releaseTick);
            Object.assign(run, {
              status: 'waiting_approval',
              updatedAt: new Date().toISOString(),
              approvalHash: 'a'.repeat(64),
              approval: {
                reason: 'Confirma a operação neste PDF.',
                action: {
                  name: 'node.test',
                  arguments: { nodeId: 'pdf-node' },
                },
              },
              modelCalls: 1,
            });
          } else if (run.message === 'Falha controlada.') {
            Object.assign(run, {
              status: 'failed',
              updatedAt: new Date().toISOString(),
              summary: 'Detalhe técnico que pertence apenas à atividade',
              modelCalls: 1,
            });
          } else {
            Object.assign(run, {
              status: 'success',
              updatedAt: new Date().toISOString(),
              answer: friendlyAnswer,
              modelCalls: 1,
            });
          }
        }
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
          url:
            supabaseOrigin +
            '/storage/v1/object/sign/agent-native-outputs/relatorio.pdf?token=fixture',
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
    page.on('pageerror', (error) => {
      errors.push(error.message);
      console.error('UI page error:', error.message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(page.url(), origin + '/');
    assert.match(await page.title(), /CELL AGENT/i);
    await page
      .getByLabel('Email', { exact: true })
      .fill('test@example.invalid');
    await page
      .getByLabel('Palavra-passe', { exact: true })
      .fill('fixture-password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    const composer = page.getByLabel('Mensagem ao agente', { exact: true });
    await composer.waitFor({ timeout: 20000 }).catch(async (error) => {
      await page.screenshot({
        path: join(evidence, viewport.name + '-failure.png'),
      });
      console.error(
        JSON.stringify(
          {
            visibleText: await page.locator('body').innerText(),
            errors,
            unexpected,
          },
          null,
          2,
        ),
      );
      throw error;
    });
    const header = page.getByTestId('chat-header');
    const composeBar = page.getByTestId('chat-composer');
    const back = page.getByRole('button', {
      name: 'Voltar aos agentes',
      exact: true,
    });
    const options = page.getByRole('button', {
      name: 'Opções do agente',
      exact: true,
    });
    assert.equal(await back.innerText(), '');
    assert.equal(await options.innerText(), '');
    for (const zone of [back, options]) {
      const box = await zone.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
    }
    assert.equal(
      await header.getByText('Capacidades', { exact: true }).count(),
      0,
    );
    assert.equal(await header.getByText('Tarefas', { exact: true }).count(), 0);
    assert.ok(!(await composeBar.innerText()).includes('Agente principal'));
    const identityPill = page.getByRole('button', {
      name: 'Opções de Agente principal',
      exact: true,
    });
    const identityBox = await identityPill.boundingBox();
    assert.ok(identityBox.height >= 48 && identityBox.height <= 50);
    assert.ok(identityBox.width <= 190, 'Identity keeps its compact width');
    assert.ok((await header.boundingBox()).height <= 64);
    assert.ok((await composeBar.boundingBox()).height <= 64);
    await page.screenshot({
      path: join(evidence, viewport.name + '-empty.png'),
    });
    await composer.fill('Texto visível com teclado');
    await composer.focus();
    await page.setViewportSize({
      width: viewport.width,
      height: Math.max(380, viewport.height - 300),
    });
    const resizedComposer = await composeBar.boundingBox();
    assert.ok(
      resizedComposer.y + resizedComposer.height <=
        Math.max(380, viewport.height - 300) + 1,
    );
    assert.equal(await composer.inputValue(), 'Texto visível com teclado');
    await page.screenshot({
      path: join(evidence, viewport.name + '-keyboard-sized.png'),
    });
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await composer.fill('');
    await back.click();
    await page.getByText('Agentes', { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: 'Agente principal', exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole('button', {
          name: 'Definir como agente principal',
          exact: true,
        })
        .count(),
      0,
    );
    const openChat = page.getByRole('button', {
      name: 'Abrir chat de Agente principal',
      exact: true,
    });
    assert.ok((await openChat.boundingBox()).height <= 90);
    await page.getByText('Griotinho', { exact: true }).waitFor();
    await page.screenshot({
      path: join(evidence, viewport.name + '-agents.png'),
    });
    await page
      .getByRole('button', { name: 'Abrir chat de Griotinho', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Opções do agente', exact: true })
      .click();
    await page.getByRole('button', { name: 'Tarefas', exact: true }).click();
    const personalTasks = page.getByTestId('agent-task-panel');
    await personalTasks
      .getByText('Tarefas de Griotinho', { exact: true })
      .waitFor();
    assert.equal(
      await personalTasks
        .getByRole('button', { name: 'Agente principal', exact: true })
        .count(),
      0,
    );
    await page
      .getByRole('button', { name: 'Voltar à conversa', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Opções do agente', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Capacidades', exact: true })
      .click();
    const secondCatalog = page.getByTestId('agent-capability-panel');
    await secondCatalog.getByTestId('catalog-artcraft_pdf').waitFor();
    assert.ok(
      await secondCatalog
        .getByTestId('catalog-artcraft_pdf')
        .getByText('Por adicionar a este agente', { exact: true })
        .isVisible(),
    );
    await secondCatalog
      .getByLabel('Pesquisar capacidades', { exact: true })
      .fill('CAD');
    await secondCatalog
      .getByRole('button', { name: 'Detalhes de Desenho técnico', exact: true })
      .click();
    await secondCatalog
      .getByRole('button', {
        name: 'Pedir Desenho técnico ao agente',
        exact: true,
      })
      .click();
    await composer.waitFor();
    assert.match(await composer.inputValue(), /Desenho técnico/);
    await back.click();
    await openChat.click();
    assert.equal(await composer.inputValue(), '');
    await options.click();
    await page.getByTestId('chat-options-menu').waitFor();
    await page.getByRole('button', { name: 'Tarefas', exact: true }).click();
    await page.getByTestId('agent-task-panel').waitFor();
    assert.equal(await page.getByRole('tab').count(), 0);
    await page
      .getByRole('button', { name: 'Voltar à conversa', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Opções de Agente principal', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Capacidades', exact: true })
      .waitFor();
    await page.screenshot({
      path: join(evidence, viewport.name + '-menu.png'),
    });
    await page
      .getByRole('button', { name: 'Fechar opções', exact: true })
      .click();
    await composer.fill(
      'Uma mensagem com várias linhas para verificar que o campo cresce apenas quando é necessário. '.repeat(
        6,
      ),
    );
    assert.ok((await composeBar.boundingBox()).height <= 132);
    await composer.fill('');
    await page.waitForTimeout(100);
    assert.ok((await composeBar.boundingBox()).height <= 64);
    await page.evaluate(() => {
      window.__maxCopies = 0;
      const observe = () => {
        const count = [
          ...document.querySelectorAll('[data-testid="user-message"]'),
        ].filter((node) => node.textContent.includes('Revê o meu PDF.')).length;
        window.__maxCopies = Math.max(window.__maxCopies, count);
      };
      window.__messageObserver = new MutationObserver(observe);
      window.__messageObserver.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      observe();
    });
    await composer.fill('Revê o meu PDF.');
    await page
      .getByRole('button', { name: 'Enviar mensagem', exact: true })
      .click();
    await page
      .getByRole('progressbar', {
        name: 'Agente principal está a responder',
        exact: true,
      })
      .waitFor();
    assert.equal(await page.getByText('Na fila', { exact: true }).count(), 0);
    assert.equal(
      await page.getByText('A trabalhar', { exact: true }).count(),
      0,
    );
    assert.equal(await page.getByText(/ferramentas usadas/).count(), 0);
    assert.equal(
      await page.getByText('Documento preparado.', { exact: true }).count(),
      0,
    );
    const optimisticId = await page
      .getByTestId('user-message')
      .getAttribute('id');
    for (let attempt = 0; attempt < 140 && confirmationReads < 2; attempt++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.ok(
      confirmationReads >= 2,
      'The server history must be read while POST confirmation is delayed',
    );
    await page.screenshot({
      path: join(evidence, viewport.name + '-confirming.png'),
    });
    assert.equal(await page.getByTestId('user-message').count(), 1);
    assert.equal(
      tickRequested,
      false,
      'Unconfirmed local sends should not start another UI execution',
    );
    releasePost();
    for (let attempt = 0; attempt < 100 && !tickRequested; attempt++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.ok(tickRequested);
    const dotSamples = [];
    for (let sample = 0; sample < 8; sample++) {
      dotSamples.push(
        await page.getByTestId('typing-dot').evaluateAll((dots) =>
          dots.map((dot) => ({
            opacity: getComputedStyle(dot).opacity,
            transform: getComputedStyle(dot).transform,
          })),
        ),
      );
      await page.waitForTimeout(60);
    }
    assert.equal(dotSamples[0].length, 3);
    assert.ok(
      new Set(dotSamples.map(JSON.stringify)).size >= 4,
      'Typing wave must move continuously',
    );
    assert.equal(
      await page.getByTestId('user-message').getAttribute('id'),
      optimisticId,
    );
    assert.equal(await page.evaluate(() => window.__maxCopies), 1);
    await page.evaluate(() => window.__messageObserver.disconnect());
    await waitForPainted(page.getByText('Revê o meu PDF.', { exact: true }));
    await page.screenshot({
      path: join(evidence, viewport.name + '-working.png'),
    });
    const completedTickAt = Date.now();
    releaseTick();
    await page
      .getByRole('button', { name: 'Rever autorização', exact: true })
      .click();
    await page.getByText('Operação a autorizar', { exact: true }).waitFor();
    assert.ok(
      Date.now() - completedTickAt < 3000,
      'A completed tick should be reflected without the previous four-second wait',
    );
    await page
      .getByRole('button', { name: 'Aprovar operação', exact: true })
      .click();
    await page.getByText('Concluída', { exact: true }).waitFor();
    await page
      .getByRole('button', { name: 'Voltar à conversa', exact: true })
      .click();
    await waitForPainted(
      page.getByText('Documento preparado.', { exact: true }),
    );
    assert.equal(await page.getByText('Concluída', { exact: true }).count(), 0);
    assert.equal(await page.getByText(/ferramentas usadas/).count(), 0);
    assert.equal(
      await page
        .getByRole('progressbar', {
          name: 'Agente principal está a responder',
          exact: true,
        })
        .count(),
      0,
    );
    await page
      .getByRole('button', { name: 'Descarregar relatorio.pdf', exact: true })
      .waitFor();
    await page.screenshot({
      path: join(evidence, viewport.name + '-files.png'),
    });
    await composer.fill('Rascunho preservado');
    await page
      .getByRole('button', { name: 'Opções do agente', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Capacidades', exact: true })
      .click();
    await page.getByTestId('agent-capability-panel').waitFor();
    const pdfCell = page.getByTestId('catalog-artcraft_pdf');
    await pdfCell.waitFor();
    await pdfCell
      .getByRole('button', { name: 'Detalhes de PDF', exact: true })
      .click();
    await page.getByText('PDF de trabalho', { exact: true }).waitFor();
    assert.equal(await pdfCell.getByTestId('cell-icon').count(), 1);
    assert.equal(await page.getByRole('tab').count(), 0);
    const catalogSearch = page.getByLabel('Pesquisar capacidades', {
      exact: true,
    });
    await catalogSearch.fill('CAD');
    await page.getByTestId('catalog-artcraft_cadcraft').waitFor();
    assert.equal(
      await page
        .getByTestId('catalog-artcraft_cadcraft')
        .getByTestId('cell-icon')
        .count(),
      1,
    );
    await catalogSearch.fill('Conector');
    await page.getByText('Conector da comunidade', { exact: true }).waitFor();
    await page
      .getByText('Conector privado do espaço', { exact: true })
      .waitFor();
    assert.equal(
      await page.getByText('Privado de outro espaço', { exact: true }).count(),
      0,
    );
    await catalogSearch.fill('');
    await page
      .getByRole('button', {
        name: 'Configurar capacidades de Agente principal',
        exact: true,
      })
      .click();
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
    await page
      .getByRole('button', {
        name: 'Configurar capacidades de Agente principal',
        exact: true,
      })
      .click();
    await page.getByText('Modelo', { exact: true }).click();
    const modelsButton = page.getByRole('button', {
      name: 'Consultar modelos disponíveis ↗',
      exact: true,
    });
    await modelsButton.click();
    for (let attempt = 0; attempt < 100 && !oldModelsRequested; attempt++)
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(oldModelsRequested);
    await page.getByText('Outro modelo · openai', { exact: true }).click();
    assert.equal(await modelsButton.isEnabled(), true);
    await modelsButton.click();
    await page.getByText('Catálogo atual', { exact: true }).waitFor();
    const oldResponse = page.waitForResponse((response) =>
      response.url().includes('/api/credentials/models?id=model-key&'),
    );
    releaseOldModels();
    await oldResponse;
    await page.waitForTimeout(100);
    assert.equal(
      await page.getByText('Catálogo antigo', { exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByText('Catálogo atual', { exact: true }).count(),
      1,
    );
    await page
      .getByRole('button', { name: 'Fechar configurações', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Voltar à conversa', exact: true })
      .click();
    await back.click();
    await page.getByRole('tab', { name: 'Perfil', exact: true }).click();
    await page.getByText('Avançado', { exact: true }).click();
    for (const label of ['Cofre & Vars', 'Segurança', 'Endpoints']) {
      const tabText = page
        .getByRole('button', { name: label, exact: true })
        .getByText(label, { exact: true });
      await tabText.scrollIntoViewIfNeeded();
      const box = await tabText.boundingBox();
      assert.ok(box.height < 25, label + ' should stay on one line');
      assert.ok(
        box.x >= 0 && box.x + box.width <= viewport.width,
        label + ' should fit the viewport',
      );
    }
    await page.screenshot({
      path: join(evidence, viewport.name + '-advanced.png'),
    });
    await page.getByText('Segurança', { exact: true }).click();
    await page
      .getByText('Dados separados por conta', { exact: true })
      .waitFor();
    await page.getByText('Endpoints', { exact: true }).click();
    await page
      .getByText(apiOrigin + '/api/agents/runs', { exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('tab', { name: 'Chat', exact: true }).click();
    await openChat.click();
    await composer.waitFor();
    assert.equal(await composer.inputValue(), 'Rascunho preservado');
    await page
      .getByRole('button', { name: 'Descarregar relatorio.pdf', exact: true })
      .click();
    for (let attempt = 0; attempt < 20 && !downloadRequests; attempt++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(downloadRequests, 1);
    await composer.fill('Quero conversar um pouco.');
    await page
      .getByRole('button', { name: 'Enviar mensagem', exact: true })
      .click();
    await page
      .getByText(friendlyAnswer, { exact: true })
      .waitFor({ timeout: 20000 });
    await waitForPainted(page.getByText(friendlyAnswer, { exact: true }));
    assert.equal(await page.getByText('Na fila', { exact: true }).count(), 0);
    assert.equal(await page.getByText(/ferramentas usadas/).count(), 0);
    assert.ok(
      await page
        .getByTestId('agent-message')
        .last()
        .evaluate((node) =>
          [...node.children].some(
            (child) =>
              getComputedStyle(child).backgroundColor === 'rgb(242, 242, 242)',
          ),
        ),
      'Assistant text must remain inside its light bubble',
    );
    await page.screenshot({
      path: join(evidence, viewport.name + '-chat.png'),
    });
    await composer.fill('Falha controlada.');
    await page
      .getByRole('button', { name: 'Enviar mensagem', exact: true })
      .click();
    await page
      .getByText(
        'Não foi possível concluir este pedido. Tenta novamente ou consulta os detalhes em Tarefas.',
        { exact: true },
      )
      .waitFor({ timeout: 20000 });
    assert.equal(
      await page
        .getByRole('progressbar', {
          name: 'Agente principal está a responder',
          exact: true,
        })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByText('Detalhe técnico que pertence apenas à atividade', {
          exact: true,
        })
        .count(),
      0,
    );
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    );
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
      modelCatalogRace: true,
      configuredEndpoints: true,
      delayedConfirmationStable: true,
      compactChat: true,
      agentScopedPanels: true,
      completeCatalogWithIcons: true,
      keyboardSizedViewport: true,
      smoothTypingMotion: true,
      assistantBubbleRestored: true,
      hiddenHeaderActions: true,
      noOperationalCardsInChat: true,
      approvalStillExplicit: true,
      failureVisible: true,
      advancedTabsSingleLine: true,
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
  for (const release of pendingFixtureReleases) release();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
