// Read-only import of the public Cell Griot palette. Never executes downloaded JavaScript.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const origin = 'https://cell-griot.pages.dev';
const modules = new Map();
function literal(n) {
  if (!n) return undefined;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
    return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
  if (ts.isObjectLiteralExpression(n))
    return Object.fromEntries(
      n.properties
        .filter(ts.isPropertyAssignment)
        .map((p) => [p.name.text, literal(p.initializer)]),
    );
  return undefined;
}
async function load(relative) {
  const url = new URL(relative, origin);
  if (url.origin !== origin) throw Error('External catalog origin refused');
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw Error(
      'Catalog source unavailable: ' + response.status + ' ' + url.pathname,
    );
  const text = await response.text();
  if (text.length > 2000000) throw Error('Catalog resource exceeds limit');
  return text;
}
async function parse(relative) {
  const url = new URL(relative, origin).href;
  if (modules.has(url)) return modules.get(url);
  const text = await load(url);
  const ast = ts.createSourceFile(
    url,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const declarations = new Map(),
    imports = new Map(),
    exports = new Map();
  function walk(n) {
    if (ts.isVariableStatement(n))
      for (const d of n.declarationList.declarations)
        if (ts.isIdentifier(d.name))
          declarations.set(d.name.text, d.initializer);
    if (
      ts.isImportDeclaration(n) &&
      n.importClause?.namedBindings &&
      ts.isNamedImports(n.importClause.namedBindings)
    ) {
      for (const item of n.importClause.namedBindings.elements)
        imports.set(item.name.text, {
          source: new URL(n.moduleSpecifier.text, url).href,
          name: (item.propertyName || item.name).text,
        });
    }
    if (
      ts.isExportDeclaration(n) &&
      n.exportClause &&
      ts.isNamedExports(n.exportClause)
    ) {
      for (const item of n.exportClause.elements)
        exports.set(item.name.text, (item.propertyName || item.name).text);
    }
  }
  ast.statements.forEach(walk);
  const result = { url, text, ast, declarations, imports, exports };
  modules.set(url, result);
  return result;
}
const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
async function icon(module, symbol, depth = 0) {
  if (depth > 5) throw Error('Icon import cycle');
  const node = module.declarations.get(symbol);
  if (node && ts.isIdentifier(node)) return icon(module, node.text, depth + 1);
  if (
    node &&
    ts.isCallExpression(node) &&
    node.arguments.length >= 2 &&
    ts.isArrayLiteralExpression(node.arguments[1])
  ) {
    const name = literal(node.arguments[0]),
      shapes = literal(node.arguments[1]);
    if (typeof name !== 'string' || !Array.isArray(shapes))
      throw Error('Invalid icon literal');
    const content = shapes
      .map((shape) => {
        const [tag, attributes] = shape;
        if (
          ![
            'path',
            'circle',
            'rect',
            'line',
            'polyline',
            'polygon',
            'ellipse',
          ].includes(tag)
        )
          throw Error('Unsupported SVG element');
        const attrs = Object.entries(attributes)
          .filter(([key]) => key !== 'key')
          .map(
            ([key, value]) =>
              key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) +
              '="' +
              escapeXml(value) +
              '"',
          )
          .join(' ');
        return '<' + tag + ' ' + attrs + '/>';
      })
      .join('');
    return {
      key: 'lucide:' + name,
      xml:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
        content +
        '</svg>',
    };
  }
  const imported = module.imports.get(symbol);
  if (!imported)
    throw Error('Missing icon symbol ' + symbol + ' in ' + module.url);
  const next = await parse(imported.source);
  const local = next.exports.get(imported.name);
  if (!local) throw Error('Missing icon export ' + imported.name);
  return icon(next, local, depth + 1);
}
async function main() {
  const html = await load('/');
  const name = html.match(
    /(?:\/assets\/)?public-navigation-[A-Za-z0-9_-]+\.js/,
  )?.[0];
  if (!name) throw Error('Public catalog module not found');
  const module = await parse(name.startsWith('/') ? name : '/assets/' + name);
  const catalogNode = [...module.declarations.values()].find(
    (n) =>
      n &&
      ts.isObjectLiteralExpression(n) &&
      n.properties.some((p) => p.name?.text === 'artcraft_pdf') &&
      n.properties.some((p) => p.name?.text === 'source'),
  );
  if (!catalogNode) throw Error('Catalog object not found');
  const iconNode = [...module.declarations.values()].find(
    (n) =>
      n &&
      ts.isObjectLiteralExpression(n) &&
      n.properties.some((p) => p.name?.text === 'artcraft_wordcraft') &&
      n.properties.some((p) => p.name?.text === 'source') &&
      n.properties.every(
        (p) => !ts.isPropertyAssignment(p) || ts.isIdentifier(p.initializer),
      ),
  );
  const symbolNode = [...module.declarations.values()].find(
    (n) =>
      n &&
      ts.isObjectLiteralExpression(n) &&
      n.properties.some(
        (p) => p.name?.text === 'source' && literal(p.initializer) === 'fonte',
      ),
  );
  if (!iconNode || !symbolNode) throw Error('Website icon maps not found');
  const iconSymbols = Object.fromEntries(
    iconNode.properties.map((p) => [p.name.text, p.initializer.text]),
  );
  const symbols = literal(symbolNode);
  const cells = catalogNode.properties
    .filter(ts.isPropertyAssignment)
    .map((p) => literal(p.initializer));
  const generated = [
    ['wordcraft', 'Documento', 'WordCraft'],
    ['gridcraft', 'Folha de cálculo', 'GridCraft'],
    ['deckcraft', 'Apresentação', 'DeckCraft'],
  ];
  cells.unshift(
    ...generated.map(([id, label, engine]) => ({
      id: 'artcraft_' + id,
      canonicalType: 'artcraft_' + id,
      label,
      category: 'compute',
      badge: id === 'wordcraft' ? 'DOC' : id === 'gridcraft' ? 'GRID' : 'DECK',
      accentColor: '#356f5e',
      description:
        'Inspeciona, converte ou edita documentos com o motor ' +
        engine +
        '. Requer executor nativo configurado; até 1 MiB.',
    })),
  );
  const icons = {};
  const fallbackSymbol = [...module.declarations].find(
    ([, n]) =>
      n && ts.isCallExpression(n) && literal(n.arguments[0]) === 'circle-dot',
  )?.[0];
  const fallback = await icon(module, fallbackSymbol);
  icons[fallback.key] = fallback.xml;
  for (const value of cells) {
    if (!value.id || !value.label || !value.canonicalType)
      throw Error('Incomplete cell metadata');
    if (symbols[value.canonicalType]) {
      const key = 'cell:' + symbols[value.canonicalType];
      if (!icons[key])
        icons[key] = await load(
          '/cell-icons/' + symbols[value.canonicalType] + '.svg',
        );
      value.icon = key;
    } else if (value.canonicalType === 'model') value.icon = 'model:openai';
    else if (iconSymbols[value.id]) {
      const resolved = await icon(module, iconSymbols[value.id]);
      icons[resolved.key] = resolved.xml;
      value.icon = resolved.key;
    } else value.icon = fallback.key;
  }
  const namedIcons = [...module.declarations.values()].find(
    (n) =>
      n &&
      ts.isObjectLiteralExpression(n) &&
      n.properties.some((p) => p.name?.text === 'FileText') &&
      n.properties.some((p) => p.name?.text === 'Plug'),
  );
  if (namedIcons)
    for (const property of namedIcons.properties) {
      const resolved = await icon(module, property.initializer.text);
      icons[resolved.key] = resolved.xml;
    }
  for (const brand of [
    'openai',
    'claude',
    'deepseek',
    'ollama',
    'gemini',
    'openrouter',
    'groq',
    'grok',
  ])
    icons['model:' + brand] = await load('/model-logos/' + brand + '.svg');
  icons['model:griot-neural'] = await load(
    '/griot-logo.svg?v=symbol-dark-20261011',
  );
  for (const xml of Object.values(icons))
    if (/<script|<foreignObject|\bon[a-z]+\s*=/i.test(xml))
      throw Error('Active SVG content refused');
  const metadata = cells.map(
    ({
      id,
      canonicalType,
      label,
      category,
      badge,
      accentColor,
      description,
      icon,
    }) => ({
      id,
      canonicalType,
      label,
      category,
      badge,
      accentColor,
      description,
      icon,
    }),
  );
  const provenance = {
    source: module.url,
    sha256: crypto.createHash('sha256').update(module.text).digest('hex'),
    synchronizedAt: new Date().toISOString(),
    visibleCount: metadata.filter((c) => c.id === c.canonicalType).length,
  };
  const root = path.resolve(__dirname, '..');
  await fs.mkdir(path.join(root, 'src/catalog'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'src/catalog/cells.ts'),
    '/* Public website catalog snapshot. Refresh with scripts/sync-cell-catalog.cjs. */\nimport type { CellCatalogEntry } from "../types";\nexport const CELL_CATALOG_SOURCE = ' +
      JSON.stringify(provenance, null, 2) +
      ';\nexport const CELL_CATALOG: readonly CellCatalogEntry[] = ' +
      JSON.stringify(metadata, null, 2) +
      ';\n',
  );
  await fs.writeFile(
    path.join(root, 'src/catalog/icons.json'),
    JSON.stringify(icons),
  );
  console.log(
    JSON.stringify({
      cells: metadata.length,
      palette: provenance.visibleCount,
      icons: Object.keys(icons).length,
      source: provenance.source,
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
