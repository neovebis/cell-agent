import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from 'react-native';
import type {
  Agent,
  AgentConfig,
  AgentGrants,
  AgentProfile,
  CredentialVaultItem,
  GlobalVariableItem,
} from '../types';
import { C } from '../theme';
import { Card, Pill, RoundButton, Txt } from './UI';

export const emptyGrants = (): AgentGrants => ({
  editGraph: false,
  executeCode: false,
  webSearch: false,
  teams: false,
  externalEffects: false,
  verificationRequired: true,
  executeNodes: [],
  credentialIds: [],
  variableNames: [],
});
type Props = {
  visible: boolean;
  agent: Agent;
  profile: AgentProfile | null;
  credentials: CredentialVaultItem[];
  variables: GlobalVariableItem[];
  initialTab?: 'model' | 'tools';
  onClose: () => void;
  onSave: (config: AgentConfig, grants: AgentGrants) => Promise<void>;
  onModels: (
    credentialId: string,
    provider: string,
  ) => Promise<{ id: string; name: string }[]>;
  onError: (message: string) => void;
};
export function AgentSettings({
  visible,
  agent,
  profile,
  credentials,
  variables,
  initialTab = 'model',
  onClose,
  onSave,
  onModels,
  onError,
}: Props) {
  const [tab, setTab] = useState<'model' | 'tools'>(initialTab);
  const [config, setConfig] = useState<AgentConfig>({
    provider: '',
    model: '',
  });
  const [grants, setGrants] = useState<AgentGrants>(emptyGrants);
  const modelRequest = useRef(0);
  const [saving, setSaving] = useState(false),
    [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]),
    [search, setSearch] = useState('');
  useEffect(() => {
    modelRequest.current++;
    setLoadingModels(false);
    if (!visible) return;
    setTab(initialTab);
    setConfig(
      profile?.config || {
        provider: '',
        model: '',
        role: agent.name,
        systemPrompt: agent.description,
        temperature: 0.3,
        maxModelCalls: 24,
        maxToolCalls: 32,
        maxOutputTokens: 4096,
        maxDurationSeconds: 1800,
        concurrency: 2,
      },
    );
    setGrants(profile?.grants || emptyGrants());
    setModels([]);
    return () => {
      modelRequest.current++;
    };
  }, [visible, agent.id, profile, initialTab]);
  const toggleList = (
    key: 'executeNodes' | 'credentialIds' | 'variableNames',
    id: string,
    enabled: boolean,
  ) =>
    setGrants((value) => ({
      ...value,
      [key]: enabled
        ? [...new Set([...(value[key] || []), id])]
        : (value[key] || []).filter((item) => item !== id),
    }));
  const flag = (
    label: string,
    detail: string,
    key:
      | 'editGraph'
      | 'executeCode'
      | 'webSearch'
      | 'teams'
      | 'externalEffects'
      | 'verificationRequired',
  ) => (
    <Card
      key={key}
      style={{
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Txt size={14} weight="600">
          {label}
        </Txt>
        <Txt size={12} color={C.muted}>
          {detail}
        </Txt>
      </View>
      <Switch
        accessibilityLabel={label}
        value={Boolean(grants[key])}
        onValueChange={(value) =>
          setGrants((current) => ({ ...current, [key]: value }))
        }
        trackColor={{ false: C.border, true: C.ink }}
      />
    </Card>
  );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: C.white, paddingTop: 35 }}>
        <View
          style={{
            paddingHorizontal: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <View style={{ flex: 1 }}>
            <Txt size={25} weight="700">
              Configurar agente
            </Txt>
            <Txt size={12} color={C.muted}>
              {agent.name}
            </Txt>
          </View>
          <RoundButton
            icon="close"
            label="Fechar configurações"
            onPress={onClose}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 24,
            marginBottom: 18,
          }}
        >
          <Pill
            selected={tab === 'model'}
            onPress={() => setTab('model')}
            style={{ flex: 1 }}
          >
            Modelo
          </Pill>
          <Pill
            selected={tab === 'tools'}
            onPress={() => setTab('tools')}
            style={{ flex: 1 }}
          >
            Capacidades
          </Pill>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: 45,
            gap: 16,
          }}
        >
          {tab === 'model' ? (
            <>
              <Txt weight="700" size={14}>
                Credencial do modelo
              </Txt>
              {credentials
                .filter((credential) =>
                  [
                    'google',
                    'gemini',
                    'openai',
                    'anthropic',
                    'deepseek',
                    'groq',
                    'mistral',
                    'moonshot',
                    'xai',
                    'glm',
                    'ollama',
                    'openai_compatible',
                  ].includes(credential.provider),
                )
                .map((credential) => (
                  <Pill
                    key={credential.id}
                    selected={config.credentialId === credential.id}
                    onPress={() => {
                      setConfig((value) => ({
                        ...value,
                        credentialId: credential.id,
                        provider:
                          credential.provider === 'gemini'
                            ? 'google'
                            : credential.provider,
                        model: '',
                      }));
                      modelRequest.current++;
                      setLoadingModels(false);
                      setModels([]);
                      setSearch('');
                    }}
                  >
                    {credential.name} · {credential.provider}
                  </Pill>
                ))}
              {!credentials.length && (
                <Txt size={13} color={C.muted}>
                  Não há credenciais neste espaço. As chaves são geridas no
                  cofre existente; a app recebe apenas os nomes.
                </Txt>
              )}
              <Txt size={13} weight="600">
                ID do modelo
              </Txt>
              <TextInput
                accessibilityLabel="ID do modelo"
                value={config.model}
                autoCapitalize="none"
                onChangeText={(model) =>
                  setConfig((value) => ({ ...value, model }))
                }
                placeholder="Escolhe no catálogo ou indica o ID"
                style={field}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!config.credentialId || loadingModels}
                onPress={async () => {
                  const requestId = ++modelRequest.current;
                  setLoadingModels(true);
                  try {
                    const available = await onModels(
                      config.credentialId!,
                      config.provider,
                    );
                    if (requestId === modelRequest.current)
                      setModels(available);
                  } catch (error) {
                    if (requestId === modelRequest.current)
                      onError(
                        error instanceof Error
                          ? error.message
                          : 'Falha ao consultar modelos.',
                      );
                  } finally {
                    if (requestId === modelRequest.current)
                      setLoadingModels(false);
                  }
                }}
                style={{
                  minHeight: 44,
                  justifyContent: 'center',
                  opacity: config.credentialId ? 1 : 0.4,
                }}
              >
                {loadingModels ? (
                  <ActivityIndicator color={C.ink} />
                ) : (
                  <Txt size={13} weight="600">
                    Consultar modelos disponíveis ↗
                  </Txt>
                )}
              </Pressable>
              {!!models.length && (
                <>
                  <TextInput
                    accessibilityLabel="Pesquisar modelos"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Pesquisar modelo"
                    style={field}
                  />
                  {models
                    .filter((model) =>
                      (model.id + model.name)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .slice(0, 30)
                    .map((model) => (
                      <Pill
                        key={model.id}
                        selected={config.model === model.id}
                        onPress={() =>
                          setConfig((value) => ({ ...value, model: model.id }))
                        }
                      >
                        {model.name}
                      </Pill>
                    ))}
                </>
              )}
              <Txt size={13} weight="600">
                Instruções
              </Txt>
              <TextInput
                accessibilityLabel="Instruções do agente"
                multiline
                value={config.systemPrompt || ''}
                onChangeText={(systemPrompt) =>
                  setConfig((value) => ({ ...value, systemPrompt }))
                }
                style={[field, { minHeight: 120, textAlignVertical: 'top' }]}
              />
              <Txt size={12} color={C.muted}>
                Limites: {config.maxModelCalls || 24} chamadas ao modelo ·{' '}
                {config.maxToolCalls || 32} ferramentas. O consumo depende do
                fornecedor e da tua credencial.
              </Txt>
            </>
          ) : (
            <>
              <Txt size={13} color={C.muted}>
                Autoriza as capacidades deste agente. Os Cells abaixo são
                instâncias reais do seu workflow.
              </Txt>
              {flag(
                'Pesquisa na internet',
                'Requer uma credencial Gemini autorizada.',
                'webSearch',
              )}
              {flag(
                'Executar código',
                'Usar a sandbox configurada no serviço.',
                'executeCode',
              )}
              {flag(
                'Coordenar especialistas',
                'Delegar nos agentes e modelos autorizados.',
                'teams',
              )}
              {flag(
                'Editar workflow',
                'Preparar alterações no grafo do agente.',
                'editGraph',
              )}
              {flag(
                'Alterações em serviços externos',
                'Permitir efeitos externos sem pedir aprovação a cada operação.',
                'externalEffects',
              )}
              {flag(
                'Verificação obrigatória',
                'Exigir verificações antes da conclusão.',
                'verificationRequired',
              )}
              <Txt size={15} weight="700">
                Cells e ferramentas
              </Txt>
              {!(agent.nodes || []).length && (
                <Txt size={13} color={C.muted}>
                  Este workflow ainda não tem Cells. O agente pode usar as
                  capacidades gerais autorizadas acima.
                </Txt>
              )}
              {(agent.nodes || []).map((cell) => (
                <Card
                  key={cell.id}
                  style={{
                    padding: 15,
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Txt weight="600" size={14}>
                      {cell.name}
                    </Txt>
                    <Txt color={C.muted} size={12}>
                      {cell.kind}
                    </Txt>
                    {cell.credentialId &&
                      !(grants.credentialIds || []).includes(
                        cell.credentialId,
                      ) && (
                        <Txt color={C.muted} size={11}>
                          Requer também a credencial associada.
                        </Txt>
                      )}
                  </View>
                  <Switch
                    accessibilityLabel={`Autorizar ${cell.name}`}
                    value={(grants.executeNodes || []).includes(cell.id)}
                    onValueChange={(value) =>
                      toggleList('executeNodes', cell.id, value)
                    }
                    trackColor={{ false: C.border, true: C.ink }}
                  />
                </Card>
              ))}
              <Txt size={15} weight="700">
                Credenciais autorizadas
              </Txt>
              {credentials.map((credential) => (
                <Card
                  key={credential.id}
                  style={{
                    padding: 15,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Txt size={14} weight="600">
                      {credential.name}
                    </Txt>
                    <Txt size={11} color={C.muted}>
                      {credential.provider} · chave protegida
                    </Txt>
                  </View>
                  <Switch
                    accessibilityLabel={`Autorizar credencial ${credential.name}`}
                    value={
                      credential.id === config.credentialId ||
                      (grants.credentialIds || []).includes(credential.id)
                    }
                    disabled={credential.id === config.credentialId}
                    onValueChange={(value) =>
                      toggleList('credentialIds', credential.id, value)
                    }
                    trackColor={{ false: C.border, true: C.ink }}
                  />
                </Card>
              ))}
              {!!variables.length && (
                <Txt size={15} weight="700">
                  Variáveis autorizadas
                </Txt>
              )}
              {variables.map((variable) => (
                <View
                  key={variable.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Txt style={{ flex: 1 }} size={13}>
                    {variable.name}
                  </Txt>
                  <Switch
                    accessibilityLabel={`Autorizar variável ${variable.name}`}
                    value={(grants.variableNames || []).includes(variable.name)}
                    onValueChange={(value) =>
                      toggleList('variableNames', variable.name, value)
                    }
                  />
                </View>
              ))}
            </>
          )}
          <Txt size={11} color={C.muted}>
            As configurações pertencem ao agente do workflow «{agent.name}» e
            são partilhadas entre os clientes que o utilizam.
          </Txt>
          <Pressable
            accessibilityRole="button"
            disabled={saving || !config.credentialId || !config.model.trim()}
            onPress={async () => {
              setSaving(true);
              try {
                await onSave(config, {
                  ...grants,
                  credentialIds: [
                    ...new Set([
                      ...(grants.credentialIds || []),
                      config.credentialId!,
                    ]),
                  ],
                });
                onClose();
              } catch (error) {
                onError(
                  error instanceof Error
                    ? error.message
                    : 'Não foi possível guardar.',
                );
              } finally {
                setSaving(false);
              }
            }}
            style={{
              minHeight: 52,
              backgroundColor: C.ink,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              opacity:
                saving || !config.credentialId || !config.model.trim()
                  ? 0.4
                  : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Txt color={C.white} weight="600">
                Guardar configurações
              </Txt>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
const field = {
  borderWidth: 1,
  borderColor: C.border,
  backgroundColor: C.surface,
  borderRadius: 18,
  padding: 15,
  color: C.ink,
  fontSize: 15,
} as const;
