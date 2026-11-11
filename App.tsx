import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BottomNav } from './src/components/BottomNav';
import { LiveMotion } from './src/components/LiveMotion';
import { AgentSettings } from './src/components/AgentSettings';
import { AgentPanel } from './src/components/AgentPanel';
import { PageTitle, RoundButton, Txt } from './src/components/UI';
import { ActivityScreen } from './src/screens/Activity';
import { CaptureScreen } from './src/screens/Capture';
import { ChatScreen } from './src/screens/Chat';
import { ConnectorsScreen } from './src/screens/Connectors';
import { ProfileScreen } from './src/screens/Profile';
import { useAgentApp } from './src/hooks/useAgentApp';
import { C } from './src/theme';
import type { Tab } from './src/types';

function Login({
  onSubmit,
  busy,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
  busy: boolean;
}) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: 30,
        backgroundColor: C.white,
      }}
    >
      <View style={{ alignItems: 'center', marginBottom: 35 }}>
        <LiveMotion size={86} shape="circle" colorId="black" />
      </View>
      <PageTitle kicker="O teu agente, as tuas ferramentas" title="Bem-vindo" />
      <Txt
        color={C.muted}
        size={14}
        style={{ marginBottom: 28, lineHeight: 21 }}
      >
        Entra com a tua conta CELL para conversar com os teus agentes e
        acompanhar as suas tarefas.
      </Txt>
      <TextInput
        accessibilityLabel="Email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholderTextColor={C.muted}
      />
      <TextInput
        accessibilityLabel="Palavra-passe"
        secureTextEntry
        autoComplete="current-password"
        placeholder="Palavra-passe"
        value={password}
        onChangeText={setPassword}
        style={[styles.input, { marginTop: 12 }]}
        placeholderTextColor={C.muted}
        onSubmitEditing={() => {
          if (!busy) void onSubmit(email, password);
        }}
      />
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={async () => {
          await onSubmit(email, password);
          setPassword('');
        }}
        style={styles.loginButton}
      >
        {busy ? (
          <ActivityIndicator color={C.white} />
        ) : (
          <Txt color={C.white} weight="700">
            Entrar
          </Txt>
        )}
      </Pressable>
      <Txt color={C.muted} size={11} style={{ marginTop: 20, lineHeight: 18 }}>
        A ligação à tua conta é cifrada. As chaves dos fornecedores permanecem
        no cofre do serviço.
      </Txt>
    </ScrollView>
  );
}

function Root() {
  const app = useAgentApp();
  const [agentPanel, setAgentPanel] = useState<{
    id: string;
    kind: 'tasks' | 'tools';
  } | null>(null);
  const [tab, setTab] = useState<Tab>('Chat');
  const [settingsOpen, setSettingsOpen] = useState(false),
    [settingsTab, setSettingsTab] = useState<'model' | 'tools'>('model');
  const settings = (initial: 'model' | 'tools' = 'model') => {
    setSettingsTab(initial);
    setSettingsOpen(true);
  };
  useEffect(() => {
    setSettingsOpen(false);
    setAgentPanel(null);
    setTab('Chat');
  }, [app.session?.userId, app.session?.workspaceId]);
  useEffect(() => setAgentPanel(null), [app.activeAgent?.id]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (settingsOpen) {
          setSettingsOpen(false);
          return true;
        }
        if (agentPanel) {
          setAgentPanel(null);
          return true;
        }
        if (tab !== 'Chat') {
          setTab('Chat');
          return true;
        }
        if (app.activeAgent && !app.showAgents) {
          app.setShowAgents(true);
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [tab, settingsOpen, agentPanel, app.activeAgent?.id, app.showAgents]);
  if (!app.loaded)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.ink} />
      </View>
    );
  const message = app.notice || (app.session ? app.connectionError : '');
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      {!!message && (
        <View
          accessibilityRole="alert"
          style={{
            paddingHorizontal: 16,
            paddingVertical: 9,
            backgroundColor: '#FFF4ED',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Txt size={12} color={C.ink} style={{ flex: 1 }}>
            {message}
          </Txt>
          {app.session && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Atualizar dados"
              onPress={app.refresh}
              style={{ padding: 9 }}
            >
              <Txt size={12} weight="700">
                Atualizar
              </Txt>
            </Pressable>
          )}
          {!!app.notice && (
            <RoundButton
              icon="close"
              size={40}
              label="Fechar aviso"
              onPress={() => app.setNotice('')}
            />
          )}
        </View>
      )}
      {!app.session ? (
        <Login busy={app.loginBusy} onSubmit={app.login} />
      ) : (
        <View style={{flex:1,position:'relative'}}>
          {tab === 'Chat' && (
            <View
              style={{ flex: 1 }}
              accessibilityElementsHidden={Boolean(agentPanel)}
              importantForAccessibility={
                agentPanel ? 'no-hide-descendants' : 'auto'
              }
            >
              <ChatScreen
              key={app.showAgents ? 'agents' : app.activeAgent?.id || 'chat'}
                agents={app.agents}
                activeAgent={app.showAgents ? null : app.activeAgent}
                messages={app.messages}
                busy={app.sending}
                obscured={Boolean(agentPanel)}
                captures={app.captures}
                draft={app.draft}
                attachment={app.attachment}
                onDraftChange={app.changeDraft}
                onAttachmentChange={app.changeAttachment}
                runs={app.runs}
                primaryId={app.primaryId}
                canSend={app.profileKnown && Boolean(app.profile)}
                onOpen={app.openAgent}
                onBack={() => {
                  Keyboard.dismiss();
                  app.setShowAgents(true);
                }}
                onNew={async (name, description, avatar) => {
                  await app.createAgent(name, description, avatar);
                  settings();
                }}
                onSend={async (content, attachment) => {
                  if (!app.profileKnown || !app.profile) {
                    settings();
                    throw new Error('Configura o modelo antes de enviar.');
                  }
                  await app.send(content, attachment);
                }}
                onError={app.setNotice}
                onSettings={() => settings()}
                onTools={() => {
                  if (app.activeAgent)
                    setAgentPanel({ id: app.activeAgent.id, kind: 'tools' });
                }}
                onActivity={() => {
                  if (app.activeAgent)
                    setAgentPanel({ id: app.activeAgent.id, kind: 'tasks' });
                }}
                onPrimary={app.makePrimary}
                onRetry={app.retry}
                onDiscard={app.discardPending}
                onFile={app.openFile}
              />
            </View>
          )}
          {tab === 'Capture' && (
            <CaptureScreen
              items={app.captures}
              agents={app.agents}
              demo={false}
              onSave={app.saveCapture}
              onSendToAgent={(item, target) => {
                setTab('Chat');
                void app.sendCapture(item, target);
              }}
              onError={app.setNotice}
            />
          )}
          {tab === 'Conectores' && (
            <ConnectorsScreen
              agent={app.activeAgent}
              agents={app.agents}
              profile={app.profile}
              credentials={app.credentials}
              customCells={app.customCells}
              catalogError={app.catalogError}
              onRefresh={app.refresh}
              onSelectAgent={app.openAgent}
              onConfigure={() => settings('tools')}
            />
          )}
          {tab === 'Atividade' && (
            <ActivityScreen
              runs={app.runs}
              agent={app.activeAgent}
              agents={app.agents}
              onSelectAgent={app.openAgent}
              onRefresh={app.refresh}
              busyId={app.controlBusy}
              onControl={app.control}
              onFile={app.openFile}
            />
          )}
          {tab === 'Perfil' && (
            <ProfileScreen
              session={app.session}
              demo={false}
              workspaces={app.workspaces}
              credentials={app.credentials}
              variables={app.variables}
              onSwitchWorkspace={app.switchWorkspace}
              onNotifications={() =>
                app.setNotice(
                  'O serviço atual ainda não disponibiliza notificações remotas para esta app. Podes acompanhar as tarefas em Atividade.',
                )
              }
              onSignOut={() => void app.logout()}
              onInfo={app.setNotice}
            />
          )}
          {!(tab === 'Chat' && app.activeAgent && !app.showAgents) && (
            <BottomNav
              tab={tab}
              onSelect={(next) => {
                Keyboard.dismiss();
                setTab(next);
              }}
            />
          )}
          {!!agentPanel && app.activeAgent?.id === agentPanel.id && (
            <AgentPanel
              agent={app.activeAgent}
              kind={agentPanel.kind}
              onClose={() => setAgentPanel(null)}
            >
              {agentPanel.kind === 'tasks' ? (
                <ActivityScreen
                  scoped
                  runs={app.runs}
                  agent={app.activeAgent}
                  agents={[]}
                  onSelectAgent={app.openAgent}
                  onRefresh={app.refresh}
                  busyId={app.controlBusy}
                  onControl={app.control}
                  onFile={app.openFile}
                />
              ) : (
                <ConnectorsScreen
                  scoped
                  agent={app.activeAgent}
                  agents={[]}
                  profile={app.profile}
                  credentials={app.credentials}
                  customCells={app.customCells}
                  catalogError={app.catalogError}
                  onRefresh={app.refresh}
                  onSelectAgent={app.openAgent}
                  onConfigure={() => settings('tools')}
                  onRequestCell={(cell) => {
                    app.changeDraft(
                      (value) =>
                        (value ? value + '\n' : '') +
                        'Adiciona o Cell ' +
                        cell.label +
                        ' a este agente e explica a configuração necessária.',
                    );
                    setAgentPanel(null);
                  }}
                />
              )}
            </AgentPanel>
          )}
          {!!app.activeAgent && app.profileKnown && (
            <AgentSettings
              visible={settingsOpen}
              initialTab={settingsTab}
              agent={app.activeAgent}
              profile={app.profile}
              credentials={app.credentials}
              variables={app.variables}
              onClose={() => setSettingsOpen(false)}
              onSave={app.saveProfile}
              onModels={app.getModels}
              onError={app.setNotice}
            />
          )}
          {settingsOpen && !app.profileKnown && (
            <View
              style={{
                position: 'absolute',
                bottom: 110,
                alignSelf: 'center',
                padding: 18,
                backgroundColor: C.surface,
                borderRadius: 20,
              }}
            >
              <ActivityIndicator color={C.ink} />
              <Txt size={12} color={C.muted} style={{ marginTop: 8 }}>
                A carregar configurações…
              </Txt>
              <Pressable
                onPress={() => setSettingsOpen(false)}
                style={{ padding: 12 }}
              >
                <Txt size={12}>Fechar</Txt>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
          <StatusBar barStyle="dark-content" backgroundColor={C.white} />
          <Root />
        </SafeAreaView>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  input: {
    borderRadius: 24,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 56,
    padding: 16,
    fontSize: 16,
    color: C.ink,
  },
  loginButton: {
    backgroundColor: C.ink,
    borderRadius: 30,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
});
