import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CELL_CATALOG, CELL_CATALOG_SOURCE } from '../src/catalog/cells.ts';
import { agentCellCatalog, paletteCells } from '../src/services/cellCatalog.ts';
test('o catálogo contém a paleta completa do site e os seus símbolos reais', async () => {
  const icons = JSON.parse(
    await readFile(
      new URL('../src/catalog/icons.json', import.meta.url),
      'utf8',
    ),
  );
  for(const key of ['lucide:mail','lucide:plug','lucide:key','lucide:shield']) assert.ok(icons[key],key+' must preserve its connector symbol');
  assert.equal(paletteCells.length, 36);
  assert.equal(
    paletteCells.filter((cell) => cell.id.startsWith('artcraft_')).length,
    13,
  );
  assert.equal(
    new Set(CELL_CATALOG.map((cell) => cell.id)).size,
    CELL_CATALOG.length,
  );
  for (const cell of CELL_CATALOG) {
    assert.ok(cell.label && cell.description);
    assert.ok(
      icons[cell.icon]?.includes('<svg'),
      cell.id + ' must have its website icon',
    );
  }
  assert.ok(
    CELL_CATALOG_SOURCE.source.startsWith(
      'https://cell-griot.pages.dev/assets/',
    ),
  );
});
test('a disponibilidade e autorização dos Cells pertencem ao agente selecionado', () => {
  const first = {
    id: 'one',
    nodes: [
      { id: 'pdf-a', type: 'artcraft_pdf', name: 'Meu PDF' },
      { id: 'legacy', type: 'trigger', name: 'Início' },
    ],
  };
  const second = { id: 'two', nodes: [] };
  const profile = {
    grants: { executeNodes: ['pdf-a', 'node-from-another-agent'] },
  };
  const firstCatalog = agentCellCatalog(first, profile, []),
    secondCatalog = agentCellCatalog(second, profile, []);
  assert.equal(
    firstCatalog.find((item) => item.definition.id === 'artcraft_pdf')
      .authorized,
    true,
  );
  assert.equal(
    secondCatalog.find((item) => item.definition.id === 'artcraft_pdf')
      .authorized,
    false,
  );
  assert.equal(
    secondCatalog.every((item) => item.nodes.length === 0),
    true,
  );
  assert.equal(
    firstCatalog.find((item) => item.definition.id === 'source').nodes[0].id,
    'legacy',
  );
});
test('conectores personalizados mantêm o ID e o alias usados pelo site', () => {
  const custom = {
    id: 'connector-id',
    canonicalType: 'custom_connector',
    label: 'Meu conector',
    description: 'Teste',
    category: 'execution',
    icon: 'lucide:plug',
    aliases: ['custom_my-connector'],
  };
  const agent = {
    id: 'one',
    nodes: [
      { id: 'installed', type: 'custom_my-connector', name: 'Instância' },
    ],
  };
  const entry = agentCellCatalog(
    agent,
    { grants: { executeNodes: ['installed'] } },
    [custom],
  ).find((item) => item.definition.id === custom.id);
  assert.equal(entry.nodes[0].id, 'installed');
  assert.equal(entry.authorized, true);
});
