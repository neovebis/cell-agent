import React, { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { apiBaseUrl, supabaseUrl } from '../services/gateway';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Card,
  Icon,
  PageTitle,
  Pill,
  RoundButton,
  Txt,
} from '../components/UI';
import { C, R } from '../theme';
import type {
  CredentialVaultItem,
  GlobalVariableItem,
  Session,
  WorkspaceInfo,
} from '../types';

export function ProfileScreen({
  session,
  demo,
  workspaces,
  credentials,
  variables,
  onSwitchWorkspace,
  onNotifications,
  onSignOut,
  onInfo,
}: {
  session: Session | null;
  demo: boolean;
  workspaces: WorkspaceInfo[];
  credentials: CredentialVaultItem[];
  variables: GlobalVariableItem[];
  onSwitchWorkspace: (workspaceId: string) => Promise<void>;
  onNotifications: () => void;
  onSignOut: () => void;
  onInfo: (message: string) => void;
}) {
  const [workspaceModal, setWorkspaceModal] = useState(false);
  const [advancedModal, setAdvancedModal] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'geral' | 'seguranca' | 'endpoints'
  >('geral');

  const currentWorkspace = workspaces.find(
    (w) => w.id === session?.workspaceId,
  ) || {
    id: session?.workspaceId || 'ws_default',
    name: 'Espaço ativo',
    plan: '',
  };

  const handleCopyEndpoint = (label: string, url: string) => {
    void Clipboard.setStringAsync(url)
      .then(() => onInfo(label + ' copiado.'))
      .catch(() => onInfo('Não foi possível copiar.'));
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 24,
          paddingBottom: 104,
        }}
      >
        <PageTitle kicker="Gestão da Conta & Espaço" title="Perfil" />

        {/* User Identity Card */}
        <Card
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            padding: 20,
          }}
        >
          <View style={styles.avatarCircle}>
            <Icon name="person-outline" color={C.white} size={28} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={20} weight="600">
              {session?.displayName ?? 'Utilizador'}
            </Txt>
            <Txt size={12} color={C.muted}>
              {session?.email ?? 'Sem sessão ativa'}
            </Txt>
            {session?.userId && (
              <Txt size={10} color={C.faint}>
                UID: {session.userId.slice(0, 18)}...
              </Txt>
            )}
          </View>
        </Card>

        {/* WORKSPACE BAR (Active Workspace Switcher) */}
        <Txt
          weight="600"
          color={C.muted}
          size={12}
          style={{ marginTop: 26, marginBottom: 10, letterSpacing: 0.5 }}
        >
          ESPAÇO DE TRABALHO ATIVO
        </Txt>
        <Pressable onPress={() => setWorkspaceModal(true)}>
          <Card
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
              gap: 14,
            }}
          >
            <View style={styles.workspaceIcon}>
              <Icon name="cube-outline" size={22} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Txt weight="600" size={16}>
                  {currentWorkspace.name}
                </Txt>
                <View style={styles.planBadge}>
                  <Txt size={10} weight="600" color={C.white}>
                    {currentWorkspace.plan || 'CELL'}
                  </Txt>
                </View>
              </View>
              <Txt size={12} color={C.muted}>
                ID: {currentWorkspace.id}
              </Txt>
            </View>
            <Icon name="swap-horizontal" color={C.ink} size={20} />
          </Card>
        </Pressable>

        {/* Opções e Ações no fim do Perfil */}
        <View style={{ marginTop: 28, gap: 12 }}>
          {/* Card Avançado com Cofre, Segurança e Endpoints */}
          <Pressable onPress={() => setAdvancedModal(true)}>
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                padding: 12,
              }}
            >
              <Icon name="options-outline" />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt weight="600" size={15}>
                  Avançado
                </Txt>
                <Txt size={12} color={C.muted}>
                  Cofre de credenciais, variáveis, segurança e endpoints
                </Txt>
              </View>
              <Icon name="chevron-forward" color={C.muted} />
            </Card>
          </Pressable>

          <Pressable onPress={onNotifications}>
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                padding: 12,
              }}
            >
              <Icon name="notifications-outline" />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt weight="600" size={15}>
                  Alertas de tarefas
                </Txt>
                <Txt size={12} color={C.muted}>
                  Consultar a disponibilidade de notificações
                </Txt>
              </View>
              <Icon name="chevron-forward" color={C.muted} />
            </Card>
          </Pressable>

          {!demo && (
            <Pressable onPress={onSignOut} style={styles.logoutButton}>
              <Txt color={C.white} weight="600">
                Sair e limpar dados locais
              </Txt>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* ADVANCED MODAL (Cofre, Segurança & Endpoints) */}
      <Modal
        visible={advancedModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAdvancedModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: C.white,
            padding: 20,
            paddingTop: 28,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={22} weight="600">
                Avançado
              </Txt>
              <Txt size={13} color={C.muted}>
                Credenciais, segurança e ligações
              </Txt>
            </View>
            <RoundButton
              icon="close"
              label="Fechar"
              onPress={() => setAdvancedModal(false)}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: 14 }}
            contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
          >
            <Pill
              selected={activeSection === 'geral'}
              onPress={() => setActiveSection('geral')}
              style={{ minWidth: 88 }}
            >
              Cofre & Vars
            </Pill>
            <Pill
              selected={activeSection === 'seguranca'}
              onPress={() => setActiveSection('seguranca')}
              style={{ minWidth: 88 }}
            >
              Segurança
            </Pill>
            <Pill
              selected={activeSection === 'endpoints'}
              onPress={() => setActiveSection('endpoints')}
              style={{ minWidth: 88 }}
            >
              Endpoints
            </Pill>
          </ScrollView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* SECTION 1: GERAL (Cofre & Variáveis Globais) */}
            {activeSection === 'geral' && (
              <View style={{ gap: 18 }}>
                {/* Credential Vault */}
                <View style={{ gap: 8 }}>
                  <Txt weight="600" size={14}>
                    Cofre de Credenciais (Vault)
                  </Txt>
                  <Txt size={12} color={C.muted}>
                    Credenciais disponíveis no cofre deste espaço. A app recebe
                    apenas metadados, nunca as chaves.
                  </Txt>
                  {credentials.length > 0 ? (
                    credentials.map((cred) => (
                      <Card
                        key={cred.id}
                        style={{
                          padding: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <Icon name="key-outline" size={18} />
                        <View style={{ flex: 1 }}>
                          <Txt weight="600" size={14}>
                            {cred.name}
                          </Txt>
                          <Txt size={11} color={C.muted}>
                            {cred.maskedKey || 'Chave protegida'} ·{' '}
                            {cred.provider}
                          </Txt>
                        </View>
                        <Icon name="lock-closed" size={16} color={C.muted} />
                      </Card>
                    ))
                  ) : (
                    <Card style={{ padding: 12 }}>
                      <Txt size={13} color={C.muted}>
                        Nenhuma credencial configurada neste espaço. Adiciona
                        chaves OpenAI, Anthropic ou Gemini no painel web para
                        ativar modelos avançados.
                      </Txt>
                    </Card>
                  )}
                </View>

                {/* Global Variables */}
                <View style={{ gap: 8 }}>
                  <Txt weight="600" size={14}>
                    Variáveis Globais ($vars)
                  </Txt>
                  <Txt size={12} color={C.muted}>
                    Constantes e parâmetros partilhados entre células e agentes.
                  </Txt>
                  {variables.length > 0 ? (
                    variables.map((v) => (
                      <Card
                        key={v.id}
                        style={{
                          padding: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <Icon name="code-slash-outline" size={18} />
                        <View style={{ flex: 1 }}>
                          <Txt weight="600" size={14}>
                            ${v.key}
                          </Txt>
                          <Txt size={11} color={C.muted}>
                            {v.maskedValue || '••••••••'}
                          </Txt>
                        </View>
                      </Card>
                    ))
                  ) : (
                    <Card style={{ padding: 12 }}>
                      <Txt size={13} color={C.muted}>
                        Nenhuma variável global definida neste workspace.
                      </Txt>
                    </Card>
                  )}
                </View>
              </View>
            )}

            {/* Proteções do cliente e autorizações no serviço */}
            {activeSection === 'seguranca' && (
              <View style={{ gap: 12 }}>
                {(
                  [
                    {
                      title: 'Sessão renovável',
                      icon: 'lock-closed-outline',
                      text: 'Os tokens ficam no armazenamento protegido do dispositivo. No preview web, a sessão fica limitada a este separador.',
                    },
                    {
                      title: 'Dados separados por conta',
                      icon: 'person-circle-outline',
                      text: 'Conversas, rascunhos e capturas ficam associados ao utilizador e ao espaço selecionado. Sair limpa os dados locais desta conta.',
                    },
                    {
                      title: 'Autorizações no serviço',
                      icon: 'shield-checkmark-outline',
                      text: 'Os pedidos incluem a sessão e o workspace. O serviço verifica as permissões antes de executar ferramentas ou usar credenciais.',
                    },
                    {
                      title: 'Downloads privados',
                      icon: 'document-lock-outline',
                      text: 'A app pede uma ligação assinada ao abrir um ficheiro e aceita apenas o Storage configurado. As ligações temporárias não são guardadas na cache.',
                    },
                  ] as const
                ).map((item) => (
                  <Card key={item.title} style={{ padding: 16, gap: 8 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Icon name={item.icon} size={19} />
                      <Txt size={15} weight="600">
                        {item.title}
                      </Txt>
                    </View>
                    <Txt size={13} color={C.muted}>
                      {item.text}
                    </Txt>
                  </Card>
                ))}
              </View>
            )}
            {/* SECTION 3: ENDPOINTS DE PRODUÇÃO */}
            {activeSection === 'endpoints' && (
              <View style={{ gap: 12 }}>
                {[
                  ['Serviço CELL', apiBaseUrl],
                  ['Autenticação e dados', supabaseUrl],
                  ['Tarefas', apiBaseUrl + '/api/agents/runs'],
                  [
                    'Configuração do agente',
                    apiBaseUrl + '/api/agents/profile',
                  ],
                  ['Controlo de tarefas', apiBaseUrl + '/api/agents/control'],
                ].map(([label, url]) => (
                  <Card key={label} style={{ padding: 16, gap: 8 }}>
                    <Txt size={14} weight="600">
                      {label}
                    </Txt>
                    <Txt size={12} color={C.muted}>
                      {url}
                    </Txt>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleCopyEndpoint(label, url)}
                      style={{
                        minHeight: 44,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Icon name="copy-outline" size={16} />
                      <Txt size={12} weight="600">
                        Copiar endereço
                      </Txt>
                    </Pressable>
                  </Card>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* WORKSPACE SELECTION MODAL */}
      <Modal
        visible={workspaceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWorkspaceModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: C.white,
            padding: 20,
            paddingTop: 28,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={22} weight="600">
                Espaços de Trabalho
              </Txt>
              <Txt size={13} color={C.muted}>
                Seleciona o espaço ativo da tua organização
              </Txt>
            </View>
            <RoundButton
              icon="close"
              label="Fechar"
              onPress={() => setWorkspaceModal(false)}
            />
          </View>

          <ScrollView style={{ flex: 1 }}>
            {workspaces.map((ws) => {
              const isSelected = ws.id === currentWorkspace.id;
              return (
                <Pressable
                  key={ws.id}
                  disabled={switching}
                  onPress={async () => {
                    setSwitching(true);
                    try {
                      await onSwitchWorkspace(ws.id);
                      setWorkspaceModal(false);
                    } catch {
                      onInfo('Não foi possível alternar para este espaço.');
                    } finally {
                      setSwitching(false);
                    }
                  }}
                  style={{ marginBottom: 10 }}
                >
                  <Card
                    style={[
                      {
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                      },
                      isSelected && { borderColor: C.ink, borderWidth: 2 },
                    ]}
                  >
                    <Icon
                      name="cube-outline"
                      size={24}
                      color={isSelected ? C.ink : C.muted}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt weight="600" size={16}>
                        {ws.name}
                      </Txt>
                      <Txt size={12} color={C.muted}>
                        ID: {ws.id} · {ws.plan || 'Free'}
                      </Txt>
                    </View>
                    {isSelected && (
                      <Icon name="checkmark-circle" color={C.ink} size={22} />
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarCircle: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadge: {
    backgroundColor: C.ink,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logoutButton: {
    backgroundColor: C.ink,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
  },
});
