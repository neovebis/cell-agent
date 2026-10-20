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
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 36, paddingBottom: 135 }}>
        <PageTitle kicker="Gestão da Conta & Espaço" title="Perfil" />

        {/* User Identity Card */}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 }}>
          <View style={styles.avatarCircle}>
            <Icon name="person-outline" color={C.white} size={28} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={20} weight="700">
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
        <Txt weight="700" color={C.muted} size={12} style={{ marginTop: 26, marginBottom: 10, letterSpacing: 0.5 }}>
          ESPAÇO DE TRABALHO ATIVO
        </Txt>
        <Pressable onPress={() => setWorkspaceModal(true)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 }}>
            <View style={styles.workspaceIcon}>
              <Icon name="cube-outline" size={22} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt weight="700" size={16}>
                  {currentWorkspace.name}
                </Txt>
                <View style={styles.planBadge}>
                  <Txt size={10} weight="700" color={C.white}>
                    {currentWorkspace.plan || 'PRO'}
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
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 18 }}>
              <Icon name="options-outline" />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt weight="700" size={15}>
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
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 18 }}>
              <Icon name="notifications-outline" />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt weight="700" size={15}>
                  Notificações Push
                </Txt>
                <Txt size={12} color={C.muted}>
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
        <View style={{ flex: 1, backgroundColor: C.white, padding: 24, paddingTop: 40 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <View>
              <Txt size={24} weight="700">
                Avançado
              </Txt>
              <Txt size={13} color={C.muted}>
                Cofre, segurança e endpoints técnicos
              </Txt>
            </View>
            <RoundButton icon="close" label="Fechar" onPress={() => setAdvancedModal(false)} />
          </View>

          {/* Navigation Tabs inside Advanced Modal */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
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

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* SECTION 1: GERAL (Cofre & Variáveis Globais) */}
            {activeSection === 'geral' && (
              <View style={{ gap: 18 }}>
                {/* Credential Vault */}
                <View style={{ gap: 8 }}>
                  <Txt weight="700" size={14}>
                    Cofre de Credenciais (Vault)
                  </Txt>
                  <Txt size={12} color={C.muted}>
                    Chaves de API cifradas em AES-GCM autorizadas para os teus agentes.
                  </Txt>
                  {credentials.length > 0 ? (
                    credentials.map((cred) => (
                      <Card key={cred.id} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Icon name="key-outline" size={18} />
                        <View style={{ flex: 1 }}>
                          <Txt weight="600" size={14}>
                            {cred.name}
                          </Txt>
                          <Txt size={11} color={C.muted}>
                            {cred.maskedKey || 'Chave protegida'} · {cred.provider}
                          </Txt>
                        </View>
                        <Icon name="lock-closed" size={16} color={C.muted} />
                      </Card>
                    ))
                  ) : (
                    <Card style={{ padding: 14 }}>
                      <Txt size={13} color={C.muted}>
                        Nenhuma credencial configurada neste espaço. Adiciona chaves OpenAI, Anthropic ou Gemini no painel web para ativar modelos avançados.
                      </Txt>
                    </Card>
                  )}
                </View>

                {/* Global Variables */}
                <View style={{ gap: 8 }}>
                  <Txt weight="700" size={14}>
                    Variáveis Globais ($vars)
                  </Txt>
                  <Txt size={12} color={C.muted}>
                    Constantes e parâmetros partilhados entre células e agentes.
                  </Txt>
                  {variables.length > 0 ? (
                    variables.map((v) => (
                      <Card key={v.id} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
                    <Card style={{ padding: 14 }}>
                      <Txt size={13} color={C.muted}>
                        Nenhuma variável global definida neste workspace.
                      </Txt>
                    </Card>
                  )}
                </View>
              </View>
            )}

            {/* SECTION 2: SEGURANÇA (Multi-Tenancy, RLS, HMAC) */}
            {activeSection === 'seguranca' && (
              <View style={{ gap: 12 }}>
                <Card style={{ padding: 16, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="shield-checkmark" size={18} color={C.success} />
                    <Txt weight="700" size={15}>
                      Row-Level Security (RLS) Ativo
                    </Txt>
                  </View>
                  <Txt size={13} color={C.muted}>
                    Todas as consultas no Supabase utilizam o token JWT do utilizador com isolamento estrito por workspace_id.
                  </Txt>
                </Card>

                <Card style={{ padding: 16, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="speedometer-outline" size={18} />
                    <Txt weight="700" size={15}>
                      Rate Limiting de Produção
                    </Txt>
                  </View>
                  <Txt size={13} color={C.muted}>
                    Proteção DDoS com limite de 60 requisições por minuto por IP e token de autenticação.
                  </Txt>
                </Card>

                <Card style={{ padding: 16, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="finger-print-outline" size={18} />
                    <Txt weight="700" size={15}>
                      Assinatura HMAC SHA-256
                    </Txt>
                  </View>
                  <Txt size={13} color={C.muted}>
                    Webhooks e chamadas externas são validadas criptograficamente contra falsificação.
                  </Txt>
                </Card>

                <Card style={{ padding: 16, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="globe-outline" size={18} />
                    <Txt weight="700" size={15}>
                      Filtro Anti-SSRF
                    </Txt>
                  </View>
                  <Txt size={13} color={C.muted}>
                    Bloqueio rigoroso de acessos a IPs privados, portas internas e metadados de cloud.
                  </Txt>
                </Card>
              </View>
            )}

            {/* SECTION 3: ENDPOINTS DE PRODUÇÃO */}
            {activeSection === 'endpoints' && (
              <View style={{ gap: 12 }}>
                <Card style={{ padding: 16, gap: 6 }}>
                  <Txt weight="700" size={14}>
                    Webhook Ingress URL
                  </Txt>
                  <Txt size={12} color={C.muted} numberOfLines={2}>
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
                    <Icon name="copy-outline" size={15} />
                    <Txt size={12} weight="600">
                      Ver Endpoint Completo
                    </Txt>
                  </Pressable>
                </Card>

                <Card style={{ padding: 16, gap: 6 }}>
                  <Txt weight="700" size={14}>
                    Execução Síncrona do Grafo
                  </Txt>
                  <Txt size={12} color={C.muted} numberOfLines={2}>
                    https://cell-griot.pages.dev/api/execute
                  </Txt>
                  <Pressable
                    onPress={() =>
                      handleCopyEndpoint('Execute URL', 'https://cell-griot.pages.dev/api/execute')
                    }
                    style={styles.copyBtn}
                  >
                    <Icon name="copy-outline" size={15} />
                    <Txt size={12} weight="600">
                      Ver Endpoint Completo
                    </Txt>
                  </Pressable>
                </Card>

                <Card style={{ padding: 16, gap: 6 }}>
                  <Txt weight="700" size={14}>
                    Execução de Agentes (Central Agent)
                  </Txt>
                  <Txt size={12} color={C.muted} numberOfLines={2}>
                    https://cell-griot.pages.dev/api/agents/runs
                  </Txt>
                  <Pressable
                    onPress={() =>
                      handleCopyEndpoint('Agents URL', 'https://cell-griot.pages.dev/api/agents/runs')
                    }
                    style={styles.copyBtn}
                  >
                    <Icon name="copy-outline" size={15} />
                    <Txt size={12} weight="600">
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
        <View style={{ flex: 1, backgroundColor: C.white, padding: 24, paddingTop: 40 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <View>
              <Txt size={24} weight="700">
                Espaços de Trabalho
              </Txt>
              <Txt size={13} color={C.muted}>
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
                  style={{ marginBottom: 10 }}
                >
                  <Card
                    style={[
                      { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
                      isSelected && { borderColor: C.ink, borderWidth: 2 },
                    ]}
                  >
                    <Icon name="cube-outline" size={24} color={isSelected ? C.ink : C.muted} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt weight="700" size={16}>
                        {ws.name}
                      </Txt>
                      <Txt size={12} color={C.muted}>
                        ID: {ws.id} · {ws.plan || 'Free'}
                      </Txt>
                    </View>
                    {isSelected && <Icon name="checkmark-circle" color={C.ink} size={22} />}
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
    height: 56,
    width: 56,
    borderRadius: 28,
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
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.surface2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: C.ink,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
  },
});
