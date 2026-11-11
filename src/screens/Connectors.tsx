import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { AgentSelector } from '../components/AgentSelector';
import { CellIcon } from '../components/CellIcon';
import { Card, Icon, PageTitle, Pill, Txt } from '../components/UI';
import { agentCellCatalog } from '../services/cellCatalog';
import { C } from '../theme';
import type {
  Agent,
  AgentProfile,
  CellCatalogEntry,
  CredentialVaultItem,
} from '../types';
type Props = {
  agent: Agent | null;
  agents: Agent[];
  profile: AgentProfile | null;
  credentials: CredentialVaultItem[];
  customCells?: CellCatalogEntry[];
  catalogError?: string;
  scoped?: boolean;
  onSelectAgent: (agent: Agent) => void;
  onConfigure: () => void;
  onRefresh?: () => void;
  onRequestCell?: (cell: CellCatalogEntry) => void;
};
const NO_CUSTOM: CellCatalogEntry[] = [];
const connectors = new Set([
  'stripe',
  'telegram',
  'google_sheets',
  'discord',
  'slack',
  'github',
  'supabase_db',
  'http',
  'custom_connector',
]);
export function ConnectorsScreen({
  agent,
  agents,
  profile,
  credentials,
  customCells = NO_CUSTOM,
  catalogError = '',
  scoped = false,
  onSelectAgent,
  onConfigure,
  onRefresh,
  onRequestCell,
}: Props) {
  const [search, setSearch] = useState(''),
    [kind, setKind] = useState('Tudo'),
    [expanded, setExpanded] = useState<string | null>(null);
  const catalog = useMemo(
    () => (agent ? agentCellCatalog(agent, profile, customCells) : []),
    [agent, profile, customCells],
  );
  const query = search.toLocaleLowerCase('pt-PT').trim();
  const visible = catalog.filter((item) => {
    const definition = item.definition;
    const group =
      definition.canonicalType === 'skill'
        ? 'Skills'
        : connectors.has(definition.canonicalType)
          ? 'Conectores'
          : 'Cells';
    return (
      (kind === 'Tudo' ||
        kind === group ||
        (kind === 'Neste agente' && item.nodes.length > 0)) &&
      (
        definition.label +
        ' ' +
        definition.id +
        ' ' +
        definition.description +
        ' ' +
        item.nodes.map((node) => node.name).join(' ')
      )
        .toLocaleLowerCase('pt-PT')
        .includes(query)
    );
  });
  const services = credentials.filter((item) =>
    (item.name + ' ' + item.provider)
      .toLocaleLowerCase('pt-PT')
      .includes(query),
  );
  const capabilities = [
    ['Pesquisa na internet', profile?.grants.webSearch],
    ['Código e ficheiros', profile?.grants.executeCode],
    ['Equipa de especialistas', profile?.grants.teams],
  ] as const;
  return (
    <FlatList
      testID="cell-catalog"
      data={visible}
      keyExtractor={(item) => item.definition.id}
      style={{ flex: 1 }}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={5}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 20,
        paddingTop: scoped ? 12 : 24,
        paddingBottom: scoped ? 24 : 110,
        gap: 10,
      }}
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 4 }}>
          <PageTitle
            kicker={scoped ? agent?.name : 'As ferramentas do teu agente'}
            title="Capacidades"
          />
          {!scoped && (
            <AgentSelector
              agents={agents}
              selected={agent?.id}
              onSelect={onSelectAgent}
            />
          )}
          {agent ? (
            <>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt size={13} weight="600">
                    {catalog.filter((item) => item.nodes.length > 0).length}{' '}
                    Cells neste agente
                  </Txt>
                  <Txt size={12} color={C.muted}>
                    {catalog.length} no catálogo completo
                  </Txt>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={'Configurar capacidades de ' + agent.name}
                  onPress={onConfigure}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                    borderRadius: 24,
                    backgroundColor: C.ink,
                  }}
                >
                  <Txt size={12} color={C.white}>
                    Configurar
                  </Txt>
                </Pressable>
              </View>
              <TextInput
                accessibilityLabel="Pesquisar capacidades"
                placeholder="Pesquisar todos os Cells"
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={C.muted}
                style={{
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: C.ink,
                }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 7 }}
              >
                {['Tudo', 'Neste agente', 'Cells', 'Skills', 'Conectores'].map(
                  (value) => (
                    <Pill
                      key={value}
                      selected={kind === value}
                      onPress={() => setKind(value)}
                    >
                      {value}
                    </Pill>
                  ),
                )}
              </ScrollView>
              {kind === 'Tudo' && !query && (
                <View style={{ gap: 3 }}>
                  {capabilities.map(([name, enabled]) => (
                    <View
                      key={name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 9,
                        minHeight: 29,
                      }}
                    >
                      <Icon
                        name={
                          enabled
                            ? 'checkmark-circle-outline'
                            : 'ellipse-outline'
                        }
                        size={15}
                        color={enabled ? C.success : C.muted}
                      />
                      <Txt size={12} color={C.muted}>
                        {name}
                      </Txt>
                      <Txt size={11} color={C.muted}>
                        {enabled ? 'Autorizado' : 'Por autorizar'}
                      </Txt>
                    </View>
                  ))}
                </View>
              )}
              {!!catalogError && (
                <Card style={{ gap: 6, padding: 12 }}>
                  <Txt size={12} color={C.error}>
                    {catalogError}
                  </Txt>
                  {onRefresh && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={onRefresh}
                      style={{ minHeight: 44, justifyContent: 'center' }}
                    >
                      <Txt size={12} weight="600">
                        Atualizar catálogo
                      </Txt>
                    </Pressable>
                  )}
                </Card>
              )}
            </>
          ) : (
            <Card>
              <Txt size={13} color={C.muted}>
                Seleciona um agente para consultar os seus Cells.
              </Txt>
            </Card>
          )}
        </View>
      }
      renderItem={({ item }) => {
        const { definition, nodes, authorized } = item,
          open = expanded === definition.id;
        return (
          <Card
            testID={'catalog-' + definition.id}
            style={{ padding: 0, overflow: 'hidden' }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={'Detalhes de ' + definition.label}
              accessibilityState={{ expanded: open }}
              onPress={() => setExpanded(open ? null : definition.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 13,
                minHeight: 78,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CellIcon
                  type={definition.id}
                  icon={definition.icon}
                  provider={nodes[0]?.provider}
                  size={34}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt size={14} weight="600">
                  {definition.label}
                </Txt>
                <Txt numberOfLines={1} size={11} color={C.muted}>
                  {definition.description}
                </Txt>
                <Txt size={11} color={authorized ? C.success : C.muted}>
                  {authorized
                    ? 'Autorizado neste agente'
                    : nodes.length
                      ? 'Neste agente · por autorizar'
                      : 'Por adicionar a este agente'}
                </Txt>
              </View>
              <Icon
                name={open ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={C.muted}
              />
            </Pressable>
            {open && (
              <View
                style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 9 }}
              >
                <Txt size={12} color={C.muted} style={{ lineHeight: 18 }}>
                  {definition.description}
                </Txt>
                {nodes.map((node) => (
                  <Txt key={node.id} size={12}>
                    {node.name}
                  </Txt>
                ))}
                {nodes.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onConfigure}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <Txt size={13} weight="600">
                      Gerir autorizações
                    </Txt>
                  </Pressable>
                ) : (
                  onRequestCell && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        'Pedir ' + definition.label + ' ao agente'
                      }
                      onPress={() => onRequestCell(definition)}
                      style={{ minHeight: 44, justifyContent: 'center' }}
                    >
                      <Txt size={13} weight="600">
                        Pedir ao agente para adicionar
                      </Txt>
                    </Pressable>
                  )
                )}
              </View>
            )}
          </Card>
        );
      }}
      ListEmptyComponent={
        agent ? (
          <Card>
            <Txt size={13} color={C.muted}>
              Nenhum Cell corresponde à pesquisa.
            </Txt>
          </Card>
        ) : null
      }
      ListFooterComponent={
        (kind === 'Tudo' || kind === 'Conectores') && agent ? (
          <View style={{ gap: 10, paddingTop: 12 }}>
            <Txt size={14} weight="600">
              Serviços configurados
            </Txt>
            {services.map((service) => (
              <Card
                key={service.id}
                style={{
                  padding: 13,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                }}
              >
                <Icon name="key-outline" size={20} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt size={13} weight="600">
                    {service.name}
                  </Txt>
                  <Txt size={11} color={C.muted}>
                    {service.provider} ·{' '}
                    {(profile?.grants.credentialIds || []).includes(service.id)
                      ? 'Autorizada neste agente'
                      : 'Sem autorização neste agente'}
                  </Txt>
                </View>
              </Card>
            ))}
            {!services.length && (
              <Txt size={12} color={C.muted}>
                Nenhuma credencial nesta seleção.
              </Txt>
            )}
            <Txt size={11} color={C.muted} style={{ lineHeight: 17 }}>
              As chaves permanecem no cofre. Um Cell do catálogo só fica ativo
              depois de adicionado e autorizado neste agente.
            </Txt>
          </View>
        ) : null
      }
    />
  );
}
