import { CELL_CATALOG } from '../catalog/cells.ts';
import type {
  Agent,
  AgentCell,
  AgentProfile,
  CellCatalogEntry,
} from '../types';
export const paletteCells = CELL_CATALOG.filter(
  (cell) => cell.id === cell.canonicalType,
);
const byType = new Map(CELL_CATALOG.map((cell) => [cell.id, cell]));
export const cellDefinition = (type: string) => byType.get(type);
export function agentCellCatalog(
  agent: Agent,
  profile: AgentProfile | null,
  custom: readonly CellCatalogEntry[],
) {
  const definitions = new Map(
    [...paletteCells, ...custom].map((cell) => [cell.id, cell]),
  );
  for (const node of agent.nodes) {
    const known = cellDefinition(node.type);
    const customDefinition = custom.find(
      (cell) => cell.id === node.type || cell.aliases?.includes(node.type),
    );
    const key = customDefinition?.id || known?.canonicalType || node.type;
    if (!definitions.has(key))
      definitions.set(
        key,
        known || {
          id: key,
          canonicalType: key,
          label: node.name,
          description: 'Cell deste agente.',
          category: 'execution',
          icon: 'lucide:circle-dot',
        },
      );
  }
  const allowed = new Set(profile?.grants.executeNodes || []);
  return [...definitions.values()]
    .map((definition) => {
      const nodes = agent.nodes.filter(
        (node) =>
          node.type === definition.id ||
          definition.aliases?.includes(node.type) ||
          cellDefinition(node.type)?.canonicalType === definition.id,
      );
      return {
        definition,
        nodes,
        authorized: nodes.some((node) => allowed.has(node.id)),
      };
    })
    .sort((a, b) => Number(b.nodes.length > 0) - Number(a.nodes.length > 0));
}
