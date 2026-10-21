import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Card, Icon, PageTitle, Pill, RoundButton, Txt } from '../components/UI';
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
  const [activeSection, setActiveSection] = useState<'geral' | 'seguranca' | 'endpoints'>('geral');

  const currentWorkspace =
    workspaces.find((w) => w.id === session?.workspaceId) || {
      id: session?.workspaceId || 'ws_default',
      name: 'Espaço Pessoal (Padrão)',
      plan: 'Pro',
    };

  const handleCopyEndpoint = (label: string, url: string) => {
    Alert.alert(label, url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <ScrollView contentContainerStyle={{ padding: 21, paddingTop: 32, paddingBottom: 119 }}>
        <PageTitle kicker="Gestão da Conta & Espaço" title="Perfil" />

        {/* User Identity Card */}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 }}>
          <View style={styles.avatarCircle}>
            <Icon name="person-outline" color={C.white} size={25} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={18} weight="700">
              {session?.displayName ?? 'Utilizador'}
            </Txt>
            <Txt size={11} color={C.muted}>
              {session?.email ?? 'Sem sessão ativa'}
            </Txt>
            {session?.userId && (
              <Txt size={9} color={C.faint}>
                UID: {session.userId.slice(0, 18)}...
              </Txt>
            )}
          </View>
        </Card>

        {/* WORKSPACE BAR (Active Workspace Switcher) */}
        <Txt weight="700" color={C.muted} size={11} style={{ marginTop: 23, marginBottom: 9, letterSpacing: 0.5 }}>
          ESPAÇO DE TRABALHO ATIVO
        </Txt>
        <Pressable onPress={() => setWorkspaceModal(true)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
            <View style={styles.workspaceIcon}>
              <Icon name="cube-outline" size={19} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Txt weight="700" size={14}>
                  {currentWorkspace.name}
                </Txt>
                <View style={styles.planBadge}>
                  <Txt size={9} weight="700" color={C.white}>
                    {currentWorkspace.plan || 'PRO'}
                  </Txt>
                </View>
              </View>
              <Txt size={11} color={C.muted}>
                ID: {currentWorkspace.id}
              </Txt>
            </View>
            <Icon name="swap-horizontal" color={C.ink} size={18} />
          </Card>
        </Pressable>

        {/* Opções e Ações no fim do Perfil */}
        <View style={{ marginTop: 25, gap: 11 }}>
          {/* Card Avançado com Cofre, Segurança e Endpoints */}
          <Pressable onPress={() => setAdvancedModal(true)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16 }}>
              <Icon name="options-outline" />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt weight="700" size={13}>
                  Avançado
                </Txt>
                <Txt size={11} color={C.muted}>
                  Cofre de credenciais, variáveis, segurança e endpoints
                </Txt>
              </View>
              <Icon name="chevron-forward" color={C.muted} />
            </Card>
          </Pressable>

          <Pressable onPress={onNotifications}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16 }}>
              <Icon name="notifications-outline" />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt weight="700" size={13}>
                  Notificações Push
                </Txt>
                <Txt size={11} color={C.muted}>
                  Receber alertas de conclusões e missões
                </Txt>
              </View>
              <Icon name="chevron-forward" color={C.muted} />
            </Card>
          </Pressable>

          {!demo && (
            <Pressable onPress={onSignOut} style={styles.logoutButton}>
              <Txt color={C.white} weight="700">
                Terminar sessão
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
        <View style={{ flex: 1, backgroundColor: C.white, padding: 21, paddingTop: 35 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
            }}
          >
            <View>
              <Txt size={21} weight="700">
                Avançado
              </Txt>
              <Txt size={11} color={C.muted}>
                Cofre, segurança e endpoints técnicos
              </Txt>
            </View>
            <RoundButton icon="close" label="Fechar" onPress={() => setAdvancedModal(false)} />
          </View>

          {/* Navigation Tabs inside Advanced Modal */}
          <View style={{ flexDirection: 'row', gap: 7, marginBottom: 16 }}>
            <Pill
              selected={activeSection === 'geral'}
              onPress={() => setActiveSection('geral')}
              style={{ flex: 1 }}
            >
              Cofre & Vars
            </Pill>
            <Pill
              selected={activeSection === 'seguranca'}
              onPress={() => setActiveSection('seguranca')}
              style={{ flex: 1 }}
            >
              Segurança
            </Pill>
            <Pill
              selected={activeSection === 'endpoints'}
              onPress={() => setActiveSection('endpoints')}
              style={{ flex: 1 }}
            >
              Endpoints
            </Pill>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 35 }}>
            {/* SECTION 1: GERAL (Cofre & Variáveis Globais) */}
            {activeSection === 'geral' && (
              <View style={{ gap: 16 }}>
                {/* Credential Vault */}
                <View style={{ gap: 7 }}>
                  <Txt weight="700" size={12}>
                    Cofre de Credenciais (Vault)
                  </Txt>
                  <Txt size={11} color={C.muted}>
                    Chaves de API cifradas em AES-GCM autorizadas para os teus agentes.
                  </Txt>
                  {credentials.length > 0 ? (
                    credentials.map((cred) => (
                      <Card key={cred.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                        <Icon name="key-outline" size={16} />
                        <View style={{ flex: 1 }}>
                          <Txt weight="600" size={12}>
                            {cred.name}
                          </Txt>
                          <Txt size={10} color={C.muted}>
                            {cred.maskedKey || 'Chave protegida'} · {cred.provider}
                          </Txt>
                        </View>
                        <Icon name="lock-closed" size={14} color={C.muted} />
                      </Card>
                    ))
                  ) : (
                    <Card style={{ padding: 12 }}>
                      <Txt size={11} color={C.muted}>
                        Nenhuma credencial configurada neste espaço. Adiciona chaves OpenAI, Anthropic ou Gemini no painel web para ativar modelos avançados.
                      </Txt>
                    </Card>
                  )}
                </View>

                {/* Global Variables */}
                <View style={{ gap: 7 }}>
                  <Txt weight="700" size={12}>
                    Variáveis Globais ($vars)
                  </Txt>
                  <Txt size={11} color={C.muted}>
                    Constantes e parâmetros partilhados entre células e agentes.
                  </Txt>
                  {variables.length > 0 ? (
                    variables.map((v) => (
                      <Card key={v.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                        <Icon name="code-slash-outline" size={16} />
                        <View style={{ flex: 1 }}>
                          <Txt weight="600" size={12}>
                            ${v.key}
                          </Txt>
                          <Txt size={10} color={C.muted}>
                            {v.maskedValue || '••••••••'}
                          </Txt>
                        </View>
                      </Card>
                    ))
                  ) : (
                    <Card style={{ padding: 12 }}>
                      <Txt size={11} color={C.muted}>
                        Nenhuma variável global definida neste workspace.
                      </Txt>
                    </Card>
                  )}
                </View>
              </View>
            )}

            {/* SECTION 2: SEGURANÇA (Multi-Tenancy, RLS, HMAC) */}
            {activeSection === 'seguranca' && (
              <View style={{ gap: 11 }}>
                <Card style={{ padding: 14, gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Icon name="shield-checkmark" size={16} color={C.success} />
                    <Txt weight="700" size={13}>
                      Row-Level Security (RLS) Ativo
                    </Txt>
                  </View>
                  <Txt size={11} color={C.muted}>
                    Todas as consultas no Supabase utilizam o token JWT do utilizador com isolamento estrito por workspace_id.
                  </Txt>
                </Card>

                <Card style={{ padding: 14, gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Icon name="speedometer-outline" size={16} />
                    <Txt weight="700" size={13}>
                      Rate Limiting de Produção
                    </Txt>
                  </View>
                  <Txt size={11} color={C.muted}>
                    Proteção DDoS com limite de 60 requisições por minuto por IP e token de autenticação.
                  </Txt>
                </Card>

                <Card style={{ padding: 14, gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Icon name="finger-print-outline" size={16} />
                    <Txt weight="700" size={13}>
                      Assinatura HMAC SHA-256
                    </Txt>
                  </View>
                  <Txt size={11} color={C.muted}>
                    Webhooks e chamadas externas são validadas criptograficamente contra falsificação.
                  </Txt>
                </Card>

                <Card style={{ padding: 14, gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Icon name="globe-outline" size={16} />
                    <Txt weight="700" size={13}>
                      Filtro Anti-SSRF
                    </Txt>
                  </View>
                  <Txt size={11} color={C.muted}>
                    Bloqueio rigoroso de acessos a IPs privados, portas internas e metadados de cloud.
                  </Txt>
                </Card>
              </View>
            )}

            {/* SECTION 3: ENDPOINTS DE PRODUÇÃO */}
            {activeSection === 'endpoints' && (
              <View style={{ gap: 11 }}>
                <Card style={{ padding: 14, gap: 5 }}>
                  <Txt weight="700" size={12}>
                    Webhook Ingress URL
                  </Txt>
                  <Txt size={11} color={C.muted} numberOfLines={2}>
                    https://cell-griot.pages.dev/api/webhooks/{currentWorkspace.id}
                  </Txt>
                  <Pressable
                    onPress={() =>
                      handleCopyEndpoint(
                        'Webhook URL',
                        `https://cell-griot.pages.dev/api/webhooks/${currentWorkspace.id}`
                      )
                    }
                    style={styles.copyBtn}
                  >
                    <Icon name="copy-outline" size={13} />
                    <Txt size={11} weight="600">
                      Ver Endpoint Completo
                    </Txt>
                  </Pressable>
                </Card>

                <Card style={{ padding: 14, gap: 5 }}>
                  <Txt weight="700" size={12}>
                    Execução Síncrona do Grafo
                  </Txt>
                  <Txt size={11} color={C.muted} numberOfLines={2}>
                    https://cell-griot.pages.dev/api/execute
                  </Txt>
                  <Pressable
                    onPress={() =>
                      handleCopyEndpoint('Execute URL', 'https://cell-griot.pages.dev/api/execute')
                    }
                    style={styles.copyBtn}
                  >
                    <Icon name="copy-outline" size={13} />
                    <Txt size={11} weight="600">
                      Ver Endpoint Completo
                    </Txt>
                  </Pressable>
                </Card>

                <Card style={{ padding: 14, gap: 5 }}>
                  <Txt weight="700" size={12}>
                    Execução de Agentes (Central Agent)
                  </Txt>
                  <Txt size={11} color={C.muted} numberOfLines={2}>
                    https://cell-griot.pages.dev/api/agents/runs
                  </Txt>
                  <Pressable
                    onPress={() =>
                      handleCopyEndpoint('Agents URL', 'https://cell-griot.pages.dev/api/agents/runs')
                    }
                    style={styles.copyBtn}
                  >
                    <Icon name="copy-outline" size={13} />
                    <Txt size={11} weight="600">
                      Ver Endpoint Completo
                    </Txt>
                  </Pressable>
                </Card>
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
        <View style={{ flex: 1, backgroundColor: C.white, padding: 21, paddingTop: 35 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
            }}
          >
            <View>
              <Txt size={21} weight="700">
                Espaços de Trabalho
              </Txt>
              <Txt size={11} color={C.muted}>
                Seleciona o espaço ativo da tua organização
              </Txt>
            </View>
            <RoundButton icon="close" label="Fechar" onPress={() => setWorkspaceModal(false)} />
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
                  style={{ marginBottom: 9 }}
                >
                  <Card
                    style={[
                      { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
                      isSelected && { borderColor: C.ink, borderWidth: 2 },
                    ]}
                  >
                    <Icon name="cube-outline" size={21} color={isSelected ? C.ink : C.muted} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt weight="700" size={14}>
                        {ws.name}
                      </Txt>
                      <Txt size={11} color={C.muted}>
                        ID: {ws.id} · {ws.plan || 'Free'}
                      </Txt>
                    </View>
                    {isSelected && <Icon name="checkmark-circle" color={C.ink} size={19} />}
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
    height: 49,
    width: 49,
    borderRadius: 28,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceIcon: {
    width: 37,
    height: 37,
    borderRadius: 21,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadge: {
    backgroundColor: C.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: C.surface2,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: C.ink,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
});
