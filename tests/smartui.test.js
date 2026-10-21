/* Parser/sanitizer tests for the smart UI. Run: node tests/smartui.test.js */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'smartui-'));
execSync(`npx tsc src/services/smartui.ts --outDir ${out} --module commonjs --target es2020 --skipLibCheck`, { stdio: 'inherit' });
const s = require(path.join(out, 'services', 'smartui.js'));
const a = require('assert');
let n = 0;
const t = (name, fn) => { fn(); n++; };

t('nexo artifact', () => {
  const nexo = { reply: 'Aqui está.', artifact: { title: 'Vendas', blocks: [
    { type: 'kpis', items: [{ label: 'Receita', value: '12k', delta: '+4%', tone: 'up' }] },
    { type: 'radar' },
    { type: 'columns', blocks: [{ type: 'steps', items: [{ title: 'A' }] }] },
    { type: 'prose', text: 'ver <b>https://evil.x</b> ok' },
  ] } };
  const r = s.parseAgentOutput(JSON.stringify(nexo));
  a.equal(r.text, 'Aqui está.');
  a.deepEqual(r.ui.blocks.map((b) => b.type), ['kpis', 'steps', 'prose']);
  a.equal(r.ui.blocks[2].text, 'ver ok');
});
t('json fence + numbers', () => {
  const r = s.parseAgentOutput('Resumo:\n```json\n' + JSON.stringify({ reply: 'x', ui: { v: 1, blocks: [{ type: 'bars', items: [{ label: 'a', value: '3,5' }] }] } }) + '\n```');
  a.equal(r.ui.blocks[0].items[0].value, 3.5);
});
t('jsonb object', () => { const r = s.parseAgentOutput({ ui: { blocks: [{ type: 'checklist', items: [{ label: 'x' }] }] }, reply: 'ok' }); a.equal(r.text, 'ok'); a.ok(r.ui); });
t('plain text fallback', () => { const r = s.parseAgentOutput('Olá {não é json'); a.equal(r.text, 'Olá {não é json'); a.equal(r.ui, undefined); });
t('answer object', () => a.equal(s.parseAgentOutput({ answer: 'texto' }).text, 'texto'));
t('invalid blocks only', () => { const r = s.parseAgentOutput(JSON.stringify({ reply: 'só', ui: { blocks: [{ type: 'weird' }] } })); a.equal(r.text, 'só'); a.equal(r.ui, undefined); });
t('null', () => a.ok(typeof s.parseAgentOutput(null).text === 'string'));

t('chart (NEXO shape)', () => {
  const ui = s.sanitizeUi({ blocks: [
    { type: 'chart', kind: 'line', xKey: 'mes', series: [{ key: 'a', label: 'A' }, { key: 'b' }], data: [{ mes: 'Jan', a: 10, b: '5' }, { mes: 'Fev', a: 'x' }] },
    { type: 'chart', kind: 'pie', xKey: 'k', series: [{ key: 'v' }, { key: 'w' }], data: [{ k: 'A', v: 1 }] },
    { type: 'chart', kind: 'radar', xKey: 'k', series: [{ key: 'v' }], data: [{ k: 'A', v: 1 }] },
  ] });
  a.equal(ui.blocks.length, 2);
  a.deepEqual(ui.blocks[0].data[1], { mes: 'Fev', a: 0, b: 0 });
  a.equal(ui.blocks[0].series[1].label, 'b');
  a.equal(ui.blocks[1].series.length, 1);
});
t('choices / confirm / form', () => {
  const ui = s.sanitizeUi({ blocks: [
    { type: 'choices', id: 'plano', multi: true, options: ['Básico', { id: 'pro', label: 'Pro <i>x</i>' }, { label: '' }] },
    { type: 'confirm', id: 'del', text: 'Apagar 3 ficheiros? http://x.y', tone: 'danger' },
    { type: 'form', id: 'dados', fields: [
      { name: 'nome', label: 'Nome', kind: 'text', required: true },
      { name: 'n', kind: 'number' },
      { name: 'cor', label: 'Cor', kind: 'select' },
      { name: 'ok', label: 'Aceito', kind: 'toggle' },
      { name: 'nome', label: 'Duplicado' },
      { name: 'x', kind: 'evil' },
    ] },
    { type: 'confirm', id: 'del', text: 'Outra' },
    { type: 'choices', options: ['A'] },
  ] });
  const [c, cf, f, cf2, c2] = ui.blocks;
  a.deepEqual(c.options, [{ id: 'o0', label: 'Básico' }, { id: 'pro', label: 'Pro x' }]);
  a.equal(c.multi, true);
  a.equal(cf.text, 'Apagar 3 ficheiros?'); a.equal(cf.tone, 'danger');
  a.deepEqual(f.fields.map((x) => `${x.name}:${x.kind}`), ['nome:text', 'n:number', 'ok:toggle', 'x:text']);
  a.equal(f.fields[0].required, true);
  a.notEqual(cf2.id, 'del'); // duplicate id made unique
  a.ok(c2.id); // missing id gets a stable fallback
});
t('stable answer key', () => {
  const ui = s.sanitizeUi({ blocks: [{ type: 'confirm', id: 'x', text: 'Ok?' }] });
  const ui2 = s.sanitizeUi({ blocks: [{ type: 'confirm', id: 'x', text: 'Ok?' }] });
  a.equal(s.answerKey(ui, 'x'), s.answerKey(ui2, 'x'));
  a.notEqual(s.answerKey(ui, 'x'), s.answerKey(s.sanitizeUi({ blocks: [{ type: 'confirm', id: 'x', text: 'Outro?' }] }), 'x'));
});
t('instruction + interaction stripping', () => {
  a.equal(s.stripUiInstruction(s.withUiInstruction('Olá')), 'Olá');
  a.equal(s.stripUiInstruction('x'), 'x');
  const m = s.buildInteractionMessage('Escolhi: Pro', 'plano', 'select', { selected: ['pro'] });
  a.equal(s.stripUiInstruction(m), 'Escolhi: Pro');
  a.equal(s.stripUiInstruction(s.withUiInstruction(m)), 'Escolhi: Pro');
  a.deepEqual(s.parseInteraction(s.withUiInstruction(m)), { blockId: 'plano', action: 'select', values: { selected: ['pro'] } });
  a.equal(s.parseInteraction('nada'), null);
});

fs.rmSync(out, { recursive: true, force: true });
console.log(`${n} smart UI tests passed · instruction ${s.UI_INSTRUCTION.length} chars`);
