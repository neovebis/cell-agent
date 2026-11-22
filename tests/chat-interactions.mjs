import assert from 'node:assert/strict';
import { join } from 'node:path';

async function drag(page, x, y, dx, dy = 0) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
    await page.waitForTimeout(22);
  }
  await page.mouse.up();
}
export async function checkLiveActivity(page) {
  await page.getByTestId('run-activity-bar').last().click();
  const sheet = page.getByTestId('run-activity-sheet');
  await sheet.waitFor();
  await sheet
    .getByText('Sem registos adicionais para este pedido.', { exact: true })
    .waitFor();
  assert.equal(
    await sheet.getByText('Executou um comando', { exact: true }).count(),
    0,
  );
  await sheet
    .getByRole('button', { name: 'Fechar detalhes da atividade', exact: true })
    .click();
  await sheet.waitFor({ state: 'hidden' });
}
export async function checkRunActivity(
  page,
  { composer, openChat, viewport, evidence, friendlyAnswer },
) {
  const draft = 'Rascunho da atividade';
  await composer.fill(draft);
  const bar = page.getByTestId('run-activity-bar').last();
  const shape = await bar.evaluate((el) => {
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const body = el
      .closest('[data-testid="agent-message"]')
      .querySelector('[data-testid="agent-message-body"]')
      .getBoundingClientRect();
    return {
      left: s.borderBottomLeftRadius,
      right: s.borderBottomRightRadius,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      bodyX: body.x,
      bodyBottom: body.bottom,
      bodyWidth: body.width,
    };
  });
  assert.equal(shape.left, '0px');
  assert.ok(parseFloat(shape.right) > 0);
  assert.ok(
    Math.abs(shape.x - shape.bodyX) < 1,
    'Activity footer aligns with its message',
  );
  assert.ok(
    shape.width < shape.bodyWidth && shape.width >= shape.bodyWidth - 16,
    'Activity footer is slightly narrower than its message',
  );
  assert.ok(
    shape.y < shape.bodyBottom && shape.y >= shape.bodyBottom - 7,
    'Activity footer tucks behind the bubble',
  );
  assert.ok(
    shape.height <= 36 && shape.y + shape.height > shape.bodyBottom + 20,
    'Footer stays visually slim',
  );
  await bar.click();
  const sheet = page.getByTestId('run-activity-sheet');
  await sheet.waitFor();
  await sheet.getByText('Executou um comando', { exact: true }).click();
  await sheet.getByText(/Verificação concluída/).waitFor();
  const text = await sheet.textContent();
  assert.equal(text.includes('fixture-secret'), false);
  assert.equal(text.includes('INTERNAL_REASONING'), false);
  assert.equal(text.includes('private-source.example'), false);
  assert.ok(text.includes('[oculto]'));
  await page.screenshot({
    path: join(evidence, viewport.name + '-activity-detail.png'),
  });
  const popup = page.context().waitForEvent('page');
  await sheet
    .getByRole('link', { name: 'Abrir fonte: Fonte verificada', exact: true })
    .click();
  const source = await popup;
  await source.waitForLoadState('domcontentloaded');
  assert.equal(new URL(source.url()).hostname, 'sources.example');
  await source.close();
  await sheet
    .getByRole('button', { name: 'Fechar detalhes da atividade', exact: true })
    .click();
  await sheet.waitFor({ state: 'hidden' });
  assert.equal(await composer.inputValue(), draft);
  assert.equal(
    await page.getByText('Executou um comando', { exact: true }).count(),
    0,
    'Tool details stay inside the activity sheet',
  );
  const overlay = page.getByTestId('chat-composer-overlay');
  const overlayStyle = await overlay.evaluate((el) => ({
    position: getComputedStyle(el).position,
    background: getComputedStyle(el).backgroundColor,
  }));
  assert.equal(overlayStyle.position, 'absolute');
  assert.equal(overlayStyle.background, 'rgba(0, 0, 0, 0)');
  // Typing and selecting text inside the input must never trigger navigation.
  const input = await composer.boundingBox();
  await drag(
    page,
    input.x + 10,
    input.y + input.height / 2,
    Math.min(110, input.width - 20),
  );
  await page.getByTestId('chat-swipe-frame').waitFor();
  assert.equal(await composer.inputValue(), draft);
  const frame = await page.getByTestId('chat-swipe-frame').boundingBox();
  const y = frame.y + Math.min(160, frame.height * 0.4);
  await drag(page, frame.x + 35, y, 40);
  await page.waitForTimeout(450);
  assert.ok(
    Math.abs(
      (await page.getByTestId('chat-swipe-frame').boundingBox()).x - frame.x,
    ) < 1,
    'Short drags return to the chat',
  );
  await drag(page, frame.x + Math.min(frame.width - 40, 240), y, -100);
  await page.getByTestId('chat-swipe-frame').waitFor();
  await drag(page, frame.x + 24, y, frame.width * 0.55);
  await page.getByText('Agentes', { exact: true }).waitFor();
  await openChat.click();
  await composer.waitFor();
  assert.equal(
    await composer.inputValue(),
    draft,
    'Swipe back preserves the agent draft',
  );
  // Another agent must not see the first agent's operations or sources.
  await page
    .getByRole('button', { name: 'Voltar aos agentes', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Abrir chat de Griotinho', exact: true })
    .click();
  await page.getByTestId('run-activity-bar').last().click();
  await page.getByTestId('run-activity-sheet').waitFor();
  const other = await page.getByTestId('run-activity-sheet').textContent();
  assert.equal(other.includes('Fonte verificada'), false);
  assert.equal(other.includes('Executou um comando'), false);
  await page
    .getByRole('button', { name: 'Fechar detalhes da atividade', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Voltar aos agentes', exact: true })
    .click();
  await openChat.click();
  await composer.waitFor();
  assert.equal(await composer.inputValue(), draft);
  await composer.fill('');
}
