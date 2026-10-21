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
  Share,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AgentAvatar } from '../components/AgentAvatar';
import { SmartUiView } from '../components/blocks/SmartBlocks';
import { ModelPicker } from '../components/ModelPicker';
import { defaultModelFor, isKnownModel } from '../services/models';
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
    <View style={{ alignItems: 'flex-start', marginTop: 4, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: 4 }}>
        <AgentAvatar size={18} />
        <Txt size={11} weight="600" color={C.muted}>
          {agentName}
        </Txt>
      </View>
      <View
        style={{
          backgroundColor: '#F3F4F6',
          borderRadius: 20,
          borderBottomLeftRadius: 5,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <Animated.View
          style={{
            width: 6,
            height: 6,
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
            width: 6,
            height: 6,
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
            width: 6,
            height: 6,
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
      await Share.share({
        message: item.content,
      });
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowCopyOption(false);
      }, 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Animated.View
      style={{
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 14,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      {!isUser && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: 4 }}>
          <AgentAvatar size={18} />
          <Txt size={11} weight="600" color={C.muted}>
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
              size={12}
              color={C.white}
            />
            <Txt size={11} weight="600" color={C.white}>
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
          size={13}
          color={isUser ? C.white : '#111827'}
          style={{ lineHeight: 19 }}
        >
          {item.content}
        </Txt>

        {!isUser && item.ui && item.ui.blocks.length > 0 && <SmartUiView ui={item.ui} />}

        {item.attachments && item.attachments.length > 0 && (
          <View style={{ marginTop: 7, gap: 4 }}>
            {item.attachments.map((att, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: isUser ? 'rgba(255,255,255,0.18)' : C.white,
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Icon
                  name="document-attach-outline"
                  size={12}
                  color={isUser ? C.white : C.muted}
                />
                <Txt
                  size={11}
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
            <Txt color="#EF4444" size={10} weight="600">
              Não entregue
            </Txt>
          ) : (
            <Txt
              size={9}
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
          contentContainerStyle={{ padding: 21, paddingTop: 32, paddingBottom: 111 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <PageTitle kicker="Espaço de Trabalho Ativo" title="Agentes" />
            <RoundButton
              icon="add"
              label="Criar novo agente"
              onPress={() => setCreationOpen(true)}
              size={46}
            />
          </View>

          <View style={{ gap: 11 }}>
            {props.agents.map((agent) => (
              <Pressable
                key={agent.id}
                onPress={() => props.onOpen(agent)}
                accessibilityLabel={`Abrir chat de ${agent.name}`}
              >
                <Card style={styles.agentCard}>
                  <AgentAvatar size={47} />
                  <View style={{ flex: 1, marginLeft: 13, gap: 4 }}>
                    <Txt weight="700" size={17}>
                      {agent.name}
                    </Txt>
                    <Txt color={C.muted} size={11} numberOfLines={1}>
                      {agent.description}
                    </Txt>
                  </View>
                  <Icon name="chevron-forward" color={C.muted} size={18} />
                </Card>
              </Pressable>
            ))}

            {props.agents.length === 0 && (
              <Card style={{ padding: 23, gap: 7 }}>
                <Txt weight="700" size={15}>
                  Nenhum agente no espaço
                </Txt>
                <Txt color={C.muted} size={12}>
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
          <View style={{ flex: 1, backgroundColor: C.white, padding: 23, paddingTop: 40 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 31,
              }}
            >
              <Txt size={24} weight="700">
                Criar missão
              </Txt>
              <RoundButton icon="close" label="Fechar" onPress={() => setCreationOpen(false)} />
            </View>
            <Txt size={11} color={C.muted} style={{ marginBottom: 9 }}>
              NOME DO AGENTE / MISSÃO
            </Txt>
            <TextInput
              value={agentName}
              onChangeText={setAgentName}
              placeholder="Ex.: Eliot"
              style={styles.field}
              placeholderTextColor={C.faint}
            />
            <Txt size={11} color={C.muted} style={{ marginTop: 18, marginBottom: 9 }}>
              INSTRUÇÃO OU PAPEL
            </Txt>
            <TextInput
              value={agentDescription}
              onChangeText={setAgentDescription}
              placeholder="Ex.: Pesquisar e sintetizar relatórios com ferramentas autónomas"
              multiline
              style={[styles.field, { height: 97, textAlignVertical: 'top' }]}
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
        <AgentAvatar size={37} />
        <View style={{ flex: 1 }}>
          <Txt weight="700" size={16} numberOfLines={1}>
            {agent.name}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3.5,
                backgroundColor: props.busy ? '#10B981' : '#9CA3AF',
              }}
            />
            <Txt color={C.muted} size={11} numberOfLines={1}>
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
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 22, flexGrow: 1 }}
        data={props.messages}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <MessageBubble item={item} agentName={agent.name} />}
        ListFooterComponent={
          props.busy ? <ThinkingBubble agentName={agent.name} /> : <View style={{ height: 11 }} />
        }
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              marginBottom: 62,
            }}
          >
            <AgentAvatar size={65} />
            <Txt size={23} weight="600" style={{ marginTop: 9, letterSpacing: -0.5 }}>
              Como posso ajudar?
            </Txt>
            <Txt size={12} color={C.muted} style={{ textAlign: 'center', paddingHorizontal: 26, lineHeight: 18 }}>
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
              <Icon name="sparkles-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={13} weight="700">
                Criar missão
              </Txt>
              <Txt size={11} color={C.muted}>
                Missão autónoma no projeto
              </Txt>
            </View>
            <Icon name="chevron-forward" size={14} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 2. Câmara */}
          <Pressable
            style={styles.menuItem}
            onPress={handleLaunchCamera}
          >
            <View style={styles.menuIconCircle}>
              <Icon name="camera-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={13} weight="700">
                Câmara
              </Txt>
              <Txt size={11} color={C.muted}>
                Tirar foto agora
              </Txt>
            </View>
            <Icon name="chevron-forward" size={14} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 3. Imagem ou vídeo */}
          <Pressable
            style={styles.menuItem}
            onPress={handleLaunchGallery}
          >
            <View style={styles.menuIconCircle}>
              <Icon name="image-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={13} weight="700">
                Imagem ou vídeo
              </Txt>
              <Txt size={11} color={C.muted}>
                Da galeria
              </Txt>
            </View>
            <Icon name="chevron-forward" size={14} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 4. Ficheiros */}
          <Pressable
            style={styles.menuItem}
            onPress={handlePickDocument}
          >
            <View style={styles.menuIconCircle}>
              <Icon name="attach-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={13} weight="700">
                Ficheiros
              </Txt>
              <Txt size={11} color={C.muted}>
                Documentos e dados
              </Txt>
            </View>
            <Icon name="chevron-forward" size={14} color={C.muted} />
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
              <Icon name="aperture-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={13} weight="700">
                Capture
              </Txt>
              <Txt size={11} color={C.muted}>
                Enviar conteúdo capturado
              </Txt>
            </View>
            <Icon name="chevron-forward" size={14} color={C.muted} />
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
              <Icon name="extension-puzzle-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={13} weight="700">
                Plugins
              </Txt>
              <Txt size={11} color={C.muted}>
                Agentes e integrações
              </Txt>
            </View>
            <Icon name="chevron-forward" size={14} color={C.muted} />
          </Pressable>
        </Animated.View>
      )}

      {/* Attachment Chip Preview */}
      {attachment && (
        <View style={styles.attachmentChip}>
          <Icon name="attach-outline" size={14} color={C.ink} />
          <Txt size={11} weight="600" numberOfLines={1} style={{ flex: 1 }}>
            {attachment.name}
          </Txt>
          <Pressable onPress={() => setAttachment(null)}>
            <Icon name="close-circle" size={16} color={C.muted} />
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                size={20}
                color={showTools ? C.white : C.ink}
              />
            </Pressable>
          </Animated.View>

          <View style={styles.agentChip}>
            <AgentAvatar size={19} />
            <Txt size={12} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
              {agent.name}
            </Txt>
            <Icon name="chevron-down" size={15} color={C.muted} />
          </View>
          <View style={{ flex: 1 }} />
          <RoundButton
            icon="arrow-up"
            label="Enviar mensagem"
            primary={Boolean(draft.trim() || attachment) && !props.busy}
            size={42}
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
        <View style={{ flex: 1, backgroundColor: C.white, padding: 21, paddingTop: 35 }}>
          {/* Sheet Header */}
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
                {agent.name}
              </Txt>
              <Txt size={11} color={C.muted}>
                Configurações & Permissões do Agente
              </Txt>
            </View>
            <RoundButton icon="close" label="Fechar" onPress={() => setSettingsOpen(false)} />
          </View>

          {/* Segmented Switcher */}
          <View style={{ flexDirection: 'row', gap: 7, marginBottom: 18 }}>
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

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 35 }}>
            {settingsTab === 'model' ? (
              <View style={{ gap: 14 }}>
                {/* Provider Selector */}
                <View>
                  <Txt size={11} weight="700" color={C.muted} style={{ marginBottom: 7 }}>
                    PROVEDOR DE IA
                  </Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 7 }}>
                    {PROVIDERS.map((p) => (
                      <Pill
                        key={p}
                        selected={provider === p}
                        onPress={() => {
                          if (p === provider) return;
                          setProvider(p);
                          // Model IDs are provider-specific: reset to that provider's default
                          if (!isKnownModel(p, model)) setModel(defaultModelFor(p));
                        }}
                        style={{ marginRight: 7, minHeight: 35 }}
                      >
                        {p.toUpperCase()}
                      </Pill>
                    ))}
                  </ScrollView>
                </View>

                {/* Model ID Input */}
                <View>
                  <Txt size={11} weight="700" color={C.muted} style={{ marginBottom: 7 }}>
                    MODELO
                  </Txt>
                  <ModelPicker provider={provider} value={model} onChange={setModel} />
                </View>

                {/* System Prompt Input */}
                <View>
                  <Txt size={11} weight="700" color={C.muted} style={{ marginBottom: 7 }}>
                    PROMPT DO SISTEMA / INSTRUÇÃO CENTRAL
                  </Txt>
                  <TextInput
                    value={systemPrompt}
                    onChangeText={setSystemPrompt}
                    multiline
                    placeholder="Instruções de personalidade, restrições e objetivos do agente..."
                    style={[styles.field, { height: 88, textAlignVertical: 'top' }]}
                    placeholderTextColor={C.faint}
                  />
                </View>

                {/* Temperature Selector */}
                <View>
                  <Txt size={11} weight="700" color={C.muted} style={{ marginBottom: 7 }}>
                    TEMPERATURA
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 7 }}>
                    {TEMPERATURES.map((t) => (
                      <Pill
                        key={t.val}
                        selected={temperature === t.val}
                        onPress={() => setTemperature(t.val)}
                        style={{ flex: 1, minHeight: 35 }}
                      >
                        {t.label}
                      </Pill>
                    ))}
                  </View>
                </View>

                {/* Max Loops Selector */}
                <View>
                  <Txt size={11} weight="700" color={C.muted} style={{ marginBottom: 7 }}>
                    ITERAÇÕES MÁXIMAS (LOOPS DE FERRAMENTAS)
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 7 }}>
                    {MAX_LOOPS.map((l) => (
                      <Pill
                        key={l}
                        selected={maxIterations === l}
                        onPress={() => setMaxIterations(l)}
                        style={{ flex: 1, minHeight: 35 }}
                      >
                        {l}
                      </Pill>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Txt size={11} color={C.muted} style={{ marginBottom: 4 }}>
                  Controle estrito de governança e permissões de execução (AgentGrants) no CELL SYSTEM.
                </Txt>

                <Card style={styles.grantRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="600" size={13}>
                      Editar Grafo Circular
                    </Txt>
                    <Txt size={11} color={C.muted}>
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
                    <Txt weight="600" size={13}>
                      Executar Código (Sandbox)
                    </Txt>
                    <Txt size={11} color={C.muted}>
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
                    <Txt weight="600" size={13}>
                      Pesquisa Web em Tempo Real
                    </Txt>
                    <Txt size={11} color={C.muted}>
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
                    <Txt weight="600" size={13}>
                      Efeitos Externos (APIs / Webhooks)
                    </Txt>
                    <Txt size={11} color={C.muted}>
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
                    <Txt weight="600" size={13}>
                      Equipa Multi-Agente
                    </Txt>
                    <Txt size={11} color={C.muted}>
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
                    <Txt weight="600" size={13}>
                      Verificação Obrigatória
                    </Txt>
                    <Txt size={11} color={C.muted}>
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
            <View style={{ marginTop: 25, gap: 11 }}>
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
        <View style={{ flex: 1, backgroundColor: C.white, padding: 21, paddingTop: 35 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
            }}
          >
            <Txt size={21} weight="700">
              Biblioteca Capture
            </Txt>
            <RoundButton icon="close" label="Fechar" onPress={() => setLibraryOpen(false)} />
          </View>
          <ScrollView style={{ flex: 1 }}>
            {(props.captures || []).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleSelectCapture(item)}
                style={{ marginBottom: 9 }}
              >
                <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Icon
                    name={
                      item.type === 'image'
                        ? 'image-outline'
                        : item.type === 'document'
                        ? 'document-outline'
                        : 'text-outline'
                    }
                    size={21}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt weight="600" size={13}>
                      {item.title}
                    </Txt>
                    <Txt color={C.muted} size={11}>
                      {item.source} · {new Date(item.createdAt).toLocaleDateString('pt-PT')}
                    </Txt>
                  </View>
                  <Icon name="arrow-forward" size={16} color={C.muted} />
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
  agentCard: { padding: 15, minHeight: 80, flexDirection: 'row', alignItems: 'center' },
  field: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 14,
    fontSize: 13,
    color: C.ink,
  },
  blackButton: {
    backgroundColor: C.ink,
    borderRadius: R.pill,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderColor: '#F1F1F1',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 11,
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
    marginBottom: 5,
    alignSelf: 'flex-end',
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.ink,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  composer: {
    marginHorizontal: 15,
    marginBottom: 11,
    borderRadius: R.composer,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 11,
    paddingTop: 14,
    paddingBottom: 10,
  },
  composeInput: {
    minHeight: 38,
    maxHeight: 132,
    fontSize: 15,
    color: C.ink,
    paddingHorizontal: 7,
    textAlignVertical: 'top',
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 23,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentChip: {
    height: 39,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    maxWidth: 148,
  },
  floatingMenuCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginHorizontal: 15,
    marginBottom: 9,
    paddingVertical: 5,
    paddingHorizontal: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
    paddingHorizontal: 9,
    borderRadius: 16,
  },
  menuIconCircle: {
    width: 33,
    height: 33,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 9,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.surface2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginHorizontal: 15,
    marginBottom: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  grantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
});
