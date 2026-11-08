import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { AgentSelector } from '../components/AgentSelector';
import { Card, Icon, PageTitle, Pill, Txt } from '../components/UI';
import { C } from '../theme';
import type { Agent, AgentProfile, CredentialVaultItem } from '../types';

type Props = {
  agent: Agent | null;
  agents: Agent[];
  profile: AgentProfile | null;
  credentials: CredentialVaultItem[];
  onSelectAgent: (agent: Agent) => void;
  onConfigure: () => void;
};
export function ConnectorsScreen({
  agent,
  agents,
  profile,
  credentials,
  onSelectAgent,
  onConfigure,
}: Props) {
  const [search, setSearch] = useState(''),
    [kind, setKind] = useState('Tudo');
  const allowed = new Set(profile?.grants.executeNodes || []);
  const cells = (agent?.nodes || []).filter(
    (cell) =>
      (kind === 'Tudo' || kind === cell.kind) &&
      (cell.name + ' ' + cell.type)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const services = credentials.filter((item) =>
    (item.name + ' ' + item.provider)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const capabilities = [
    {
      name: 'Pesquisa na internet',
      enabled: profile?.grants.webSearch,
      detail: 'Consultar fontes atuais.',
    },
    {
      name: 'Código e ficheiros',
      enabled: profile?.grants.executeCode,
      detail: 'Executar na sandbox configurada.',
    },
    {
      name: 'Equipa de especialistas',
      enabled: profile?.grants.teams,
      detail: 'Delegar em agentes e modelos autorizados.',
    },
  ];
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        paddingTop: 36,
        paddingBottom: 130,
        gap: 14,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <PageTitle kicker="As ferramentas do teu agente" title="Capacidades" />
      <AgentSelector
        agents={agents}
        selected={agent?.id}
        onSelect={onSelectAgent}
      />
      {!agent ? (
        <Card>
          <Txt color={C.muted}>
            Cria ou seleciona um agente para consultar as capacidades.
          </Txt>
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt weight="700" size={17}>
                {agent.name}
              </Txt>
              <Txt color={C.muted} size={12}>
                {allowed.size} Cells autorizados neste workflow
              </Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onConfigure}
              style={{
                minHeight: 44,
                paddingHorizontal: 16,
                backgroundColor: C.ink,
                borderRadius: 24,
                justifyContent: 'center',
              }}
            >
              <Txt color={C.white} size={12} weight="600">
                Configurar
              </Txt>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Pesquisar capacidades"
            placeholder="Pesquisar Cells ou serviços"
            value={search}
            onChangeText={setSearch}
            style={{
              padding: 15,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 20,
              color: C.ink,
            }}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {['Tudo', 'Cells', 'Skills', 'Conectores'].map((value) => (
              <Pill
                key={value}
                selected={kind === value}
                onPress={() => setKind(value)}
              >
                {value}
              </Pill>
            ))}
          </ScrollView>
          {kind === 'Tudo' &&
            !search &&
            capabilities.map((item) => (
              <Card
                key={item.name}
                style={{
                  padding: 17,
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <Icon name="sparkles-outline" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt weight="600" size={15}>
                    {item.name}
                  </Txt>
                  <Txt color={C.muted} size={12}>
                    {item.detail}
                  </Txt>
                  <Txt color={item.enabled ? C.success : C.muted} size={11}>
                    {item.enabled ? 'Autorizado' : 'Não autorizado'}
                  </Txt>
                </View>
              </Card>
            ))}
          {cells.map((cell) => (
            <Card
              key={cell.id}
              style={{
                padding: 17,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <Icon
                name={
                  cell.type.startsWith('artcraft_')
                    ? 'color-palette-outline'
                    : cell.kind === 'Skills'
                      ? 'sparkles-outline'
                      : 'cube-outline'
                }
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt weight="700" size={15}>
                  {cell.name}
                </Txt>
                <Txt color={C.muted} size={12}>
                  {cell.type.startsWith('artcraft_') ? 'Artcraft' : cell.kind}
                </Txt>
                <Txt
                  size={11}
                  color={allowed.has(cell.id) ? C.success : C.muted}
                >
                  {allowed.has(cell.id)
                    ? 'Autorizado para este agente'
                    : 'Disponível no workflow · autorização necessária'}
                </Txt>
              </View>
            </Card>
          ))}
          {!cells.length && kind !== 'Conectores' && (
            <Card>
              <Txt color={C.muted} size={13}>
                Não há Cells nesta seleção. As capacidades são as instâncias já
                presentes no workflow.
              </Txt>
            </Card>
          )}
          {(kind === 'Tudo' || kind === 'Conectores') && (
            <>
              <Txt weight="700" size={15}>
                Serviços configurados
              </Txt>
              {services.map((service) => (
                <Card
                  key={service.id}
                  style={{
                    padding: 16,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <Icon name="key-outline" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt size={14} weight="600">
                      {service.name}
                    </Txt>
                    <Txt color={C.muted} size={12}>
                      {service.provider} · credencial disponível no cofre
                    </Txt>
                    <Txt color={C.muted} size={11}>
                      {(profile?.grants.credentialIds || []).includes(
                        service.id,
                      )
                        ? 'Autorizada para este agente'
                        : 'Sem autorização para este agente'}
                    </Txt>
                  </View>
                </Card>
              ))}
              {!services.length && (
                <Txt color={C.muted} size={13}>
                  Nenhuma credencial corresponde a esta seleção.
                </Txt>
              )}
            </>
          )}
          <Txt color={C.muted} size={11}>
            A disponibilidade de cada executor ou serviço é confirmada na
            execução. A app não recebe as chaves do cofre.
          </Txt>
        </>
      )}
    </ScrollView>
  );
}
