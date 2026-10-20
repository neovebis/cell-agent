import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AgentAvatar } from '../components/AgentAvatar';
import { Card, Icon, PageTitle, Pill, RoundButton, Txt } from '../components/UI';
import { C, R } from '../theme';
import type {
  Agent,
  AgentConfig,
  AgentGrants,
  AgentMessage,
  CaptureItem,
  FileAttachment,
} from '../types';

type Props = {
  agents: Agent[];
  activeAgent: Agent | null;
  messages: AgentMessage[];
  demo: boolean;
  busy: boolean;
  captures?: CaptureItem[];
  onOpen: (agent: Agent) => void;
  onBack: () => void;
  onNew: (name: string, description: string) => void;
  onSend: (content: string, attachment?: FileAttachment) => Promise<void>;
  onRefresh: () => void;
  onError: (message: string) => void;
  onClearHistory?: (agentId: string) => Promise<void>;
  onSaveAgentSettings?: (agentId: string, config: AgentConfig, grants: AgentGrants) => Promise<void>;
};

const PROVIDERS = ['google', 'openai', 'anthropic', 'groq', 'mistral', 'deepseek'] as const;
const TEMPERATURES = [
  { label: '0.2 Baixa', val: 0.2 },
  { label: '0.7 Padrão', val: 0.7 },
  { label: '1.0 Criativa', val: 1.0 },
];
const MAX_LOOPS = [16, 24, 32, 48];

function ThinkingBubble({ agentName }: { agentName: string }) {
  const dot1 = useRef(new Animated.Value(0.25)).current;
  const dot2 = useRef(new Animated.Value(0.25)).current;
  const dot3 = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0.25,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 700 - delay)),
        ])
      );
    };

    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 180);
    const a3 = pulse(dot3, 360);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={{ alignItems: 'flex-start', marginTop: 4, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7, paddingLeft: 4 }}>
        <AgentAvatar size={20} />
        <Txt size={12} weight="600" color={C.muted}>
          {agentName}
        </Txt>
      </View>
      <View
        style={{
          backgroundColor: '#F3F4F6',
          borderRadius: 20,
          borderBottomLeftRadius: 5,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Animated.View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: '#111827',
            opacity: dot1,
            transform: [
              {
                translateY: dot1.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0, -3],
                }),
              },
            ],
          }}
        />
        <Animated.View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: '#111827',
            opacity: dot2,
            transform: [
              {
                translateY: dot2.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0, -3],
                }),
              },
            ],
          }}
        />
        <Animated.View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: '#111827',
            opacity: dot3,
            transform: [
              {
                translateY: dot3.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0, -3],
                }),
              },
            ],
          }}
        />
      </View>
    </View>
  );
}

function MessageBubble({
  item,
  agentName,
}: {
  item: AgentMessage;
  agentName: string;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(6)).current;
  const [showCopyOption, setShowCopyOption] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const isUser = item.role === 'user';

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  const handleCopyMessage = async () => {
    try {
      await Clipboard.setStringAsync(item.content);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowCopyOption(false);
      }, 1400);
    } catch {
      // ignore
    }
  };

  return (
    <Animated.View
      style={{
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      {!isUser && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7, paddingLeft: 4 }}>
          <AgentAvatar size={20} />
          <Txt size={12} weight="600" color={C.muted}>
            {agentName}
          </Txt>
        </View>
      )}

      {/* Floating Copy Option Pill when user message is clicked */}
      {isUser && showCopyOption && (
        <View style={styles.copyPillContainer}>
          <Pressable onPress={handleCopyMessage} style={styles.copyPill}>
            <Icon
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={14}
              color={C.white}
            />
            <Txt size={12} weight="600" color={C.white}>
              {copied ? 'Copiado!' : 'Copiar'}
            </Txt>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={() => {
          if (isUser) {
            setShowCopyOption((prev) => !prev);
          }
        }}
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Txt
          size={15}
          color={isUser ? C.white : '#111827'}
          style={{ lineHeight: 22 }}
        >
          {item.content}
        </Txt>

        {item.attachments && item.attachments.length > 0 && (
          <View style={{ marginTop: 8, gap: 4 }}>
            {item.attachments.map((att, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isUser ? 'rgba(255,255,255,0.18)' : C.white,
                  borderRadius: 12,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                }}
              >
                <Icon
                  name="document-attach-outline"
                  size={14}
                  color={isUser ? C.white : C.muted}
                />
                <Txt
                  size={12}
                  weight="600"
                  color={isUser ? C.white : C.ink}
                  numberOfLines={1}
                >
                  {att.name}
                </Txt>
              </View>
            ))}
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 4,
            marginTop: 4,
          }}
        >
          {item.status === 'failed' ? (
            <Txt color="#EF4444" size={11} weight="600">
              Não entregue
            </Txt>
          ) : (
            <Txt
              size={10}
              color={isUser ? 'rgba(255,255,255,0.55)' : '#9CA3AF'}
            >
              {formatTime(item.createdAt)}
            </Txt>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ChatScreen(props: Props) {
  const [creationOpen, setCreationOpen] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [draft, setDraft] = useState('');
  const [showTools, setShowTools] = useState(false);
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Animated rotation for '+' to 'x' button and smooth card entrance
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;

  // Agent Settings & Grants Modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'model' | 'grants'>('model');
  const [savingSettings, setSavingSettings] = useState(false);

  // Configuration state
  const [provider, setProvider] = useState<string>('google');
  const [model, setModel] = useState('gemini-1.5-pro');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxIterations, setMaxIterations] = useState(24);

  // Grants state
  const [grants, setGrants] = useState<AgentGrants>({
    editGraph: false,
    executeCode: true,
    webSearch: true,
    teams: false,
    externalEffects: false,
    verificationRequired: false,
  });

  const listRef = useRef<FlatList<AgentMessage>>(null);

  useEffect(() => {
    setDraft('');
    setShowTools(false);
    rotateAnim.setValue(0);
    menuAnim.setValue(0);
    setAttachment(null);
    if (props.activeAgent) {
      const cfg = props.activeAgent.config;
      if (cfg) {
        setProvider(cfg.provider || 'google');
        setModel(cfg.model || 'gemini-1.5-pro');
        setSystemPrompt(cfg.systemPrompt || '');
        setTemperature(cfg.temperature ?? 0.7);
        setMaxIterations(cfg.maxModelCalls ?? 24);
      }
      if (props.activeAgent.grants) {
        setGrants({
          editGraph: Boolean(props.activeAgent.grants.editGraph),
          executeCode: Boolean(props.activeAgent.grants.executeCode),
          webSearch: Boolean(props.activeAgent.grants.webSearch),
          teams: Boolean(props.activeAgent.grants.teams),
          externalEffects: Boolean(props.activeAgent.grants.externalEffects),
          verificationRequired: Boolean(props.activeAgent.grants.verificationRequired),
        });
      }
    }
  }, [props.activeAgent?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [props.messages.length, props.busy]);

  const toggleTools = () => {
    if (showTools) {
      Animated.parallel([
        Animated.spring(rotateAnim, {
          toValue: 0,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(menuAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowTools(false);
      });
    } else {
      setShowTools(true);
      Animated.parallel([
        Animated.spring(rotateAnim, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.spring(menuAnim, {
          toValue: 1,
          friction: 7,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const closeTools = () => {
    if (!showTools) return;
    Animated.parallel([
      Animated.spring(rotateAnim, {
        toValue: 0,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowTools(false);
    });
  };

  const handlePickDocument = async () => {
    closeTools();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];

      let base64 = '';
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const b64 = dataUrl.split(',')[1] || '';
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        base64 = '';
      }

      setAttachment({
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
        data: base64,
        uri: asset.uri,
        size: asset.size,
      });
    } catch {
      props.onError('Não foi possível carregar o documento.');
    }
  };

  const handleLaunchCamera = async () => {
    closeTools();
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        props.onError('Permissão de acesso à câmara necessária.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      setAttachment({
        name: `foto_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        data: asset.base64 || '',
        uri: asset.uri,
      });
    } catch {
      props.onError('Não foi possível tirar a fotografia.');
    }
  };

  const handleLaunchGallery = async () => {
    closeTools();
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        props.onError('Permissão de fotos necessária.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      setAttachment({
        name: asset.fileName || `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
        mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        data: asset.base64 || '',
        uri: asset.uri,
      });
    } catch {
      props.onError('Não foi possível carregar a imagem ou vídeo.');
    }
  };

  const handleSelectCapture = (item: CaptureItem) => {
    setLibraryOpen(false);
    closeTools();
    setAttachment({
      name: item.title,
      mimeType: item.type === 'image' ? 'image/jpeg' : 'text/plain',
      data: item.base64 || '',
      uri: item.uri,
    });
  };

  const handleSaveSettings = async () => {
    if (!props.activeAgent) return;
    setSavingSettings(true);
    try {
      const updatedConfig: AgentConfig = {
        provider,
        model,
        role: props.activeAgent.name,
        systemPrompt,
        temperature,
        maxModelCalls: maxIterations,
      };
      if (props.onSaveAgentSettings) {
        await props.onSaveAgentSettings(props.activeAgent.id, updatedConfig, grants);
      }
      setSettingsOpen(false);
    } catch (e: any) {
      props.onError(e?.message || 'Falha ao guardar definições do agente.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleClearHistory = async () => {
    if (!props.activeAgent || !props.onClearHistory) return;
    try {
      await props.onClearHistory(props.activeAgent.id);
      setSettingsOpen(false);
    } catch {
      props.onError('Falha ao limpar histórico.');
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  // Agent List View (No Active Agent)
  if (!props.activeAgent) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 24, paddingTop: 36, paddingBottom: 126 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <PageTitle kicker="Espaço de Trabalho Ativo" title="Agentes" />
            <RoundButton
              icon="add"
              label="Criar novo agente"
              onPress={() => setCreationOpen(true)}
              size={52}
            />
          </View>

          <View style={{ gap: 12 }}>
            {props.agents.map((agent) => (
              <Pressable
                key={agent.id}
                onPress={() => props.onOpen(agent)}
                accessibilityLabel={`Abrir chat de ${agent.name}`}
              >
                <Card style={styles.agentCard}>
                  <AgentAvatar size={53} />
                  <View style={{ flex: 1, marginLeft: 15, gap: 5 }}>
                    <Txt weight="700" size={19}>
                      {agent.name}
                    </Txt>
                    <Txt color={C.muted} size={13} numberOfLines={1}>
                      {agent.description}
                    </Txt>
                  </View>
                  <Icon name="chevron-forward" color={C.muted} size={21} />
                </Card>
              </Pressable>
            ))}

            {props.agents.length === 0 && (
              <Card style={{ padding: 26, gap: 8 }}>
                <Txt weight="700" size={17}>
                  Nenhum agente no espaço
                </Txt>
                <Txt color={C.muted} size={14}>
                  Os fluxos e agentes reais são carregados da tua base de dados Supabase. Toca no
                  botão + acima para criar o teu primeiro agente autónomo.
                </Txt>
              </Card>
            )}
          </View>
        </ScrollView>

        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={creationOpen}
          onRequestClose={() => setCreationOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: C.white, padding: 26, paddingTop: 45 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 35,
              }}
            >
              <Txt size={27} weight="700">
                Criar missão
              </Txt>
              <RoundButton icon="close" label="Fechar" onPress={() => setCreationOpen(false)} />
            </View>
            <Txt size={13} color={C.muted} style={{ marginBottom: 10 }}>
              NOME DO AGENTE / MISSÃO
            </Txt>
            <TextInput
              value={agentName}
              onChangeText={setAgentName}
              placeholder="Ex.: Eliot"
              style={styles.field}
              placeholderTextColor={C.faint}
            />
            <Txt size={13} color={C.muted} style={{ marginTop: 20, marginBottom: 10 }}>
              INSTRUÇÃO OU PAPEL
            </Txt>
            <TextInput
              value={agentDescription}
              onChangeText={setAgentDescription}
              placeholder="Ex.: Pesquisar e sintetizar relatórios com ferramentas autónomas"
              multiline
              style={[styles.field, { height: 110, textAlignVertical: 'top' }]}
              placeholderTextColor={C.faint}
            />
            <Pressable
              disabled={creatingAgent}
              onPress={async () => {
                if (!agentName.trim()) return props.onError('Indica o nome do agente.');
                setCreatingAgent(true);
                try {
                  await props.onNew(agentName.trim(), agentDescription.trim());
                  setCreationOpen(false);
                  setAgentName('');
                  setAgentDescription('');
                } catch {
                  // Error handled in parent
                } finally {
                  setCreatingAgent(false);
                }
              }}
              style={[styles.blackButton, creatingAgent && { opacity: 0.7 }]}
            >
              {creatingAgent ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Txt color={C.white} weight="700">
                  Criar missão
                </Txt>
              )}
            </Pressable>
          </View>
        </Modal>
      </View>
    );
  }

  // Active Agent Chat View
  const agent = props.activeAgent;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Chat Header */}
      <View style={styles.header}>
        <RoundButton icon="chevron-back" label="Voltar aos agentes" onPress={props.onBack} />
        <AgentAvatar size={42} />
        <View style={{ flex: 1 }}>
          <Txt weight="700" size={18} numberOfLines={1}>
            {agent.name}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: props.busy ? '#10B981' : '#9CA3AF',
              }}
            />
            <Txt color={C.muted} size={12} numberOfLines={1}>
              {props.busy ? 'A pensar...' : (agent.config?.role || `${provider.toUpperCase()} · ${model}`)}
            </Txt>
          </View>
        </View>
        <RoundButton
          icon="ellipsis-horizontal"
          label="Definições e permissões do agente"
          onPress={() => setSettingsOpen(true)}
        />
      </View>

      {/* Messages List */}
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 25, flexGrow: 1 }}
        data={props.messages}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <MessageBubble item={item} agentName={agent.name} />}
        ListFooterComponent={
          props.busy ? <ThinkingBubble agentName={agent.name} /> : <View style={{ height: 12 }} />
        }
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 70,
            }}
          >
            <AgentAvatar size={74} />
            <Txt size={26} weight="600" style={{ marginTop: 10, letterSpacing: -0.5 }}>
              Como posso ajudar?
            </Txt>
            <Txt size={14} color={C.muted} style={{ textAlign: 'center', paddingHorizontal: 30, lineHeight: 21 }}>
              Conversa com {agent.name}. Podes colocar qualquer questão ou partilhar ficheiros para análise.
            </Txt>
          </View>
        }
      />

      {/* Floating Action Menu Card matching design (Criar missão, Câmara, Imagem ou vídeo, Ficheiros, Capture, Plugins) */}
      {showTools && (
        <Animated.View
          style={[
            styles.floatingMenuCard,
            {
              opacity: menuAnim,
              transform: [
                {
                  translateY: menuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
                {
                  scale: menuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* 1. Criar missão */}
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              closeTools();
              setCreationOpen(true);
            }}
          >
            <View style={styles.menuIconCircle}>
              <Icon name="sparkles-outline" size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={15} weight="700">
                Criar missão
              </Txt>
              <Txt size={12} color={C.muted}>
                Missão autónoma no projeto
              </Txt>
            </View>
            <Icon name="chevron-forward" size={16} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 2. Câmara */}
          <Pressable
            style={styles.menuItem}
            onPress={handleLaunchCamera}
          >
            <View style={styles.menuIconCircle}>
              <Icon name="camera-outline" size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={15} weight="700">
                Câmara
              </Txt>
              <Txt size={12} color={C.muted}>
                Tirar foto agora
              </Txt>
            </View>
            <Icon name="chevron-forward" size={16} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 3. Imagem ou vídeo */}
          <Pressable
            style={styles.menuItem}
            onPress={handleLaunchGallery}
          >
            <View style={styles.menuIconCircle}>
              <Icon name="image-outline" size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={15} weight="700">
                Imagem ou vídeo
              </Txt>
              <Txt size={12} color={C.muted}>
                Da galeria
              </Txt>
            </View>
            <Icon name="chevron-forward" size={16} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 4. Ficheiros */}
          <Pressable
            style={styles.menuItem}
            onPress={handlePickDocument}
          >
            <View style={styles.menuIconCircle}>
              <Icon name="attach-outline" size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={15} weight="700">
                Ficheiros
              </Txt>
              <Txt size={12} color={C.muted}>
                Documentos e dados
              </Txt>
            </View>
            <Icon name="chevron-forward" size={16} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 5. Capture */}
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              closeTools();
              setLibraryOpen(true);
            }}
          >
            <View style={styles.menuIconCircle}>
              <Icon name="aperture-outline" size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={15} weight="700">
                Capture
              </Txt>
              <Txt size={12} color={C.muted}>
                Enviar conteúdo capturado
              </Txt>
            </View>
            <Icon name="chevron-forward" size={16} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 6. Plugins */}
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              closeTools();
              setSettingsOpen(true);
            }}
          >
            <View style={styles.menuIconCircle}>
              <Icon name="extension-puzzle-outline" size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={15} weight="700">
                Plugins
              </Txt>
              <Txt size={12} color={C.muted}>
                Agentes e integrações
              </Txt>
            </View>
            <Icon name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
        </Animated.View>
      )}

      {/* Attachment Chip Preview */}
      {attachment && (
        <View style={styles.attachmentChip}>
          <Icon name="attach-outline" size={16} color={C.ink} />
          <Txt size={13} weight="600" numberOfLines={1} style={{ flex: 1 }}>
            {attachment.name}
          </Txt>
          <Pressable onPress={() => setAttachment(null)}>
            <Icon name="close-circle" size={18} color={C.muted} />
          </Pressable>
        </View>
      )}

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder={`Conversar com ${agent.name}...`}
          placeholderTextColor={C.muted}
          style={styles.composeInput}
          accessibilityLabel="Mensagem ao agente"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          {/* Animated Rotate Button: '+' spins 45deg to 'x' */}
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ferramentas e anexos"
              onPress={toggleTools}
              style={[
                styles.plusButton,
                showTools && { backgroundColor: C.ink, borderColor: C.ink },
              ]}
            >
              <Icon
                name="add"
                size={23}
                color={showTools ? C.white : C.ink}
              />
            </Pressable>
          </Animated.View>

          <View style={styles.agentChip}>
            <AgentAvatar size={22} />
            <Txt size={14} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
              {agent.name}
            </Txt>
            <Icon name="chevron-down" size={17} color={C.muted} />
          </View>
          <View style={{ flex: 1 }} />
          <RoundButton
            icon="arrow-up"
            label="Enviar mensagem"
            primary={Boolean(draft.trim() || attachment) && !props.busy}
            size={48}
            disabled={props.busy || (!draft.trim() && !attachment)}
            onPress={async () => {
              if ((!draft.trim() && !attachment) || props.busy) return;
              const text = draft.trim();
              const curAtt = attachment;
              setDraft('');
              setAttachment(null);
              closeTools();
              try {
                await props.onSend(text, curAtt || undefined);
              } catch {
                setDraft(text);
                setAttachment(curAtt);
              }
            }}
          />
        </View>
      </View>

      {/* 3-DOTS AGENT CONFIG & PERMISSIONS MODAL */}
      <Modal
        visible={settingsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: C.white, padding: 24, paddingTop: 40 }}>
          {/* Sheet Header */}
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
                {agent.name}
              </Txt>
              <Txt size={13} color={C.muted}>
                Configurações & Permissões do Agente
              </Txt>
            </View>
            <RoundButton icon="close" label="Fechar" onPress={() => setSettingsOpen(false)} />
          </View>

          {/* Segmented Switcher */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <Pill
              selected={settingsTab === 'model'}
              onPress={() => setSettingsTab('model')}
              style={{ flex: 1 }}
            >
              IA & Modelo
            </Pill>
            <Pill
              selected={settingsTab === 'grants'}
              onPress={() => setSettingsTab('grants')}
              style={{ flex: 1 }}
            >
              Permissões
            </Pill>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
            {settingsTab === 'model' ? (
              <View style={{ gap: 16 }}>
                {/* Provider Selector */}
                <View>
                  <Txt size={12} weight="700" color={C.muted} style={{ marginBottom: 8 }}>
                    PROVEDOR DE IA
                  </Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
                    {PROVIDERS.map((p) => (
                      <Pill
                        key={p}
                        selected={provider === p}
                        onPress={() => setProvider(p)}
                        style={{ marginRight: 8, minHeight: 40 }}
                      >
                        {p.toUpperCase()}
                      </Pill>
                    ))}
                  </ScrollView>
                </View>

                {/* Model ID Input */}
                <View>
                  <Txt size={12} weight="700" color={C.muted} style={{ marginBottom: 8 }}>
                    ID DO MODELO
                  </Txt>
                  <TextInput
                    value={model}
                    onChangeText={setModel}
                    placeholder="ex.: gemini-1.5-pro, gpt-4o, claude-3-5-sonnet"
                    style={styles.field}
                    placeholderTextColor={C.faint}
                  />
                </View>

                {/* System Prompt Input */}
                <View>
                  <Txt size={12} weight="700" color={C.muted} style={{ marginBottom: 8 }}>
                    PROMPT DO SISTEMA / INSTRUÇÃO CENTRAL
                  </Txt>
                  <TextInput
                    value={systemPrompt}
                    onChangeText={setSystemPrompt}
                    multiline
                    placeholder="Instruções de personalidade, restrições e objetivos do agente..."
                    style={[styles.field, { height: 100, textAlignVertical: 'top' }]}
                    placeholderTextColor={C.faint}
                  />
                </View>

                {/* Temperature Selector */}
                <View>
                  <Txt size={12} weight="700" color={C.muted} style={{ marginBottom: 8 }}>
                    TEMPERATURA
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {TEMPERATURES.map((t) => (
                      <Pill
                        key={t.val}
                        selected={temperature === t.val}
                        onPress={() => setTemperature(t.val)}
                        style={{ flex: 1, minHeight: 40 }}
                      >
                        {t.label}
                      </Pill>
                    ))}
                  </View>
                </View>

                {/* Max Loops Selector */}
                <View>
                  <Txt size={12} weight="700" color={C.muted} style={{ marginBottom: 8 }}>
                    ITERAÇÕES MÁXIMAS (LOOPS DE FERRAMENTAS)
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {MAX_LOOPS.map((l) => (
                      <Pill
                        key={l}
                        selected={maxIterations === l}
                        onPress={() => setMaxIterations(l)}
                        style={{ flex: 1, minHeight: 40 }}
                      >
                        {l}
                      </Pill>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                <Txt size={13} color={C.muted} style={{ marginBottom: 4 }}>
                  Controle estrito de governança e permissões de execução (AgentGrants) no CELL SYSTEM.
                </Txt>

                <Card style={styles.grantRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="600" size={15}>
                      Editar Grafo Circular
                    </Txt>
                    <Txt size={12} color={C.muted}>
                      Permitir adicionar ou alterar nós no fluxo circular.
                    </Txt>
                  </View>
                  <Switch
                    value={grants.editGraph}
                    onValueChange={(val) => setGrants((g) => ({ ...g, editGraph: val }))}
                    thumbColor={C.white}
                    trackColor={{ false: C.border, true: C.ink }}
                  />
                </Card>

                <Card style={styles.grantRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="600" size={15}>
                      Executar Código (Sandbox)
                    </Txt>
                    <Txt size={12} color={C.muted}>
                      Ambiente isolado Python / JavaScript.
                    </Txt>
                  </View>
                  <Switch
                    value={grants.executeCode}
                    onValueChange={(val) => setGrants((g) => ({ ...g, executeCode: val }))}
                    thumbColor={C.white}
                    trackColor={{ false: C.border, true: C.ink }}
                  />
                </Card>

                <Card style={styles.grantRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="600" size={15}>
                      Pesquisa Web em Tempo Real
                    </Txt>
                    <Txt size={12} color={C.muted}>
                      Aceder a páginas e notícias recentes via Internet.
                    </Txt>
                  </View>
                  <Switch
                    value={grants.webSearch}
                    onValueChange={(val) => setGrants((g) => ({ ...g, webSearch: val }))}
                    thumbColor={C.white}
                    trackColor={{ false: C.border, true: C.ink }}
                  />
                </Card>

                <Card style={styles.grantRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="600" size={15}>
                      Efeitos Externos (APIs / Webhooks)
                    </Txt>
                    <Txt size={12} color={C.muted}>
                      Chamar serviços externos e persistir alterações.
                    </Txt>
                  </View>
                  <Switch
                    value={grants.externalEffects}
                    onValueChange={(val) => setGrants((g) => ({ ...g, externalEffects: val }))}
                    thumbColor={C.white}
                    trackColor={{ false: C.border, true: C.ink }}
                  />
                </Card>

                <Card style={styles.grantRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="600" size={15}>
                      Equipa Multi-Agente
                    </Txt>
                    <Txt size={12} color={C.muted}>
                      Subdividir missões em trabalhadores especializados.
                    </Txt>
                  </View>
                  <Switch
                    value={grants.teams}
                    onValueChange={(val) => setGrants((g) => ({ ...g, teams: val }))}
                    thumbColor={C.white}
                    trackColor={{ false: C.border, true: C.ink }}
                  />
                </Card>

                <Card style={styles.grantRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="600" size={15}>
                      Verificação Obrigatória
                    </Txt>
                    <Txt size={12} color={C.muted}>
                      Exigir checkpoints e asserções antes da conclusão.
                    </Txt>
                  </View>
                  <Switch
                    value={grants.verificationRequired}
                    onValueChange={(val) => setGrants((g) => ({ ...g, verificationRequired: val }))}
                    thumbColor={C.white}
                    trackColor={{ false: C.border, true: C.ink }}
                  />
                </Card>
              </View>
            )}

            {/* Bottom Actions */}
            <View style={{ marginTop: 28, gap: 12 }}>
              <Pressable
                disabled={savingSettings}
                onPress={handleSaveSettings}
                style={styles.blackButton}
              >
                {savingSettings ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <Txt color={C.white} weight="700">
                    Guardar alterações
                  </Txt>
                )}
              </Pressable>

              <Pressable
                onPress={handleClearHistory}
                style={[styles.blackButton, { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }]}
              >
                <Txt color={C.error} weight="600">
                  Limpar Histórico da Conversa
                </Txt>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Library Picker Modal */}
      <Modal
        visible={libraryOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLibraryOpen(false)}
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
            <Txt size={24} weight="700">
              Biblioteca Capture
            </Txt>
            <RoundButton icon="close" label="Fechar" onPress={() => setLibraryOpen(false)} />
          </View>
          <ScrollView style={{ flex: 1 }}>
            {(props.captures || []).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleSelectCapture(item)}
                style={{ marginBottom: 10 }}
              >
                <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Icon
                    name={
                      item.type === 'image'
                        ? 'image-outline'
                        : item.type === 'document'
                        ? 'document-outline'
                        : 'text-outline'
                    }
                    size={24}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt weight="600" size={15}>
                      {item.title}
                    </Txt>
                    <Txt color={C.muted} size={12}>
                      {item.source} · {new Date(item.createdAt).toLocaleDateString('pt-PT')}
                    </Txt>
                  </View>
                  <Icon name="arrow-forward" size={18} color={C.muted} />
                </Card>
              </Pressable>
            ))}
            {(!props.captures || props.captures.length === 0) && (
              <Card>
                <Txt color={C.muted}>Nenhum item capturado na biblioteca.</Txt>
              </Card>
            )}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  agentCard: { padding: 17, minHeight: 91, flexDirection: 'row', alignItems: 'center' },
  field: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 16,
    fontSize: 15,
    color: C.ink,
  },
  blackButton: {
    backgroundColor: C.ink,
    borderRadius: R.pill,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F1F1',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#111111',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  copyPillContainer: {
    marginBottom: 6,
    alignSelf: 'flex-end',
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.ink,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  composer: {
    marginHorizontal: 17,
    marginBottom: 12,
    borderRadius: R.composer,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 11,
  },
  composeInput: {
    minHeight: 43,
    maxHeight: 150,
    fontSize: 17,
    color: C.ink,
    paddingHorizontal: 8,
    textAlignVertical: 'top',
  },
  plusButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentChip: {
    height: 44,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    maxWidth: 168,
  },
  floatingMenuCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginHorizontal: 17,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 10,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginHorizontal: 17,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  grantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
});
