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
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { RunCard } from '../components/RunCard';
import { TERMINAL_STATUSES } from '../services/contracts';
import { readAttachment, guessMime } from '../services/files';
import { AgentAvatar } from '../components/AgentAvatar';
import { LiveMotion } from '../components/LiveMotion';
import {
  Card,
  Icon,
  PageTitle,
  Pill,
  RoundButton,
  Txt,
} from '../components/UI';
import { BODY_SHAPES } from '../motion/Motion';
import { PALETTE } from '../motion/core/palette';
import { C, R } from '../theme';
import type {
  Agent,
  AgentRun,
  RunOperation,
  AgentAvatarChoice,
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
  draft: string;
  attachment: FileAttachment | null;
  onDraftChange: React.Dispatch<React.SetStateAction<string>>;
  onAttachmentChange: (file: FileAttachment | null) => void;
  onOpen: (agent: Agent) => void;
  onBack: () => void;
  onNew: (
    name: string,
    description: string,
    avatar?: AgentAvatarChoice,
  ) => Promise<void> | void;
  onSend: (content: string, attachment?: FileAttachment) => Promise<void>;
  onRefresh: () => void;
  onError: (message: string) => void;
  runs: AgentRun[];
  primaryId: string | null;
  canSend: boolean;
  controlBusy: string | null;
  onSettings: () => void;
  onTools: () => void;
  onActivity: () => void;
  onPrimary: (agent: Agent) => Promise<void>;
  onRetry: (pendingId: string) => Promise<void>;
  onControl: (run: AgentRun, operation: RunOperation) => Promise<void>;
  onFile: (runId: string, fileId: string) => Promise<void>;
};

function ThinkingBubble({
  agentName,
  avatar,
}: {
  agentName: string;
  avatar?: AgentAvatarChoice;
}) {
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
        ]),
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          marginBottom: 7,
          paddingLeft: 4,
        }}
      >
        <LiveMotion
          size={20}
          shape={avatar?.shape ?? 'circle'}
          colorId={avatar?.color ?? 'black'}
        />
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
  avatar,
}: {
  item: AgentMessage;
  agentName: string;
  avatar?: AgentAvatarChoice;
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
      }, 1500);
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginBottom: 7,
            paddingLeft: 4,
          }}
        >
          <LiveMotion
            size={20}
            shape={avatar?.shape ?? 'circle'}
            colorId={avatar?.color ?? 'black'}
          />
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
  const [creationStep, setCreationStep] = useState<1 | 2>(1);
  const [avatarShape, setAvatarShape] =
    useState<AgentAvatarChoice['shape']>('circle');
  const [avatarColor, setAvatarColor] =
    useState<AgentAvatarChoice['color']>('black');
  const closeCreation = () => {
    setCreationOpen(false);
    setCreationStep(1);
  };
  const draft = props.draft;
  const setDraft = props.onDraftChange;
  const [showTools, setShowTools] = useState(false);
  const attachment = props.attachment;
  const setAttachment = props.onAttachmentChange;
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Animated rotation for '+' to 'x' button and smooth card entrance
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;

  const listRef = useRef<FlatList<AgentMessage>>(null);
  const followLatest = useRef(true);

  useEffect(() => {
    setShowTools(false);
    rotateAnim.setValue(0);
    menuAnim.setValue(0);
  }, [props.activeAgent?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (followLatest.current)
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

  const pickerError = (error: unknown) =>
    props.onError(
      error instanceof Error
        ? error.message
        : 'Não foi possível ler o ficheiro.',
    );
  const handlePickDocument = async () => {
    closeTools();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ['application/pdf', 'text/*', 'image/*', 'application/json'],
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      setAttachment(
        await readAttachment(
          asset.uri,
          asset.name,
          asset.mimeType || guessMime(asset.name),
          asset.size,
        ),
      );
    } catch (error) {
      pickerError(error);
    }
  };
  const handleLaunchCamera = async () => {
    closeTools();
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted)
        throw new Error('Permite o acesso à câmara para tirar uma fotografia.');
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0],
        name = asset.fileName || 'foto_' + Date.now() + '.jpg';
      setAttachment(
        await readAttachment(
          asset.uri,
          name,
          asset.mimeType || 'image/jpeg',
          asset.fileSize,
          asset.base64 || undefined,
        ),
      );
    } catch (error) {
      pickerError(error);
    }
  };
  const handleLaunchGallery = async () => {
    closeTools();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0],
        name = asset.fileName || 'imagem_' + Date.now() + '.jpg';
      setAttachment(
        await readAttachment(
          asset.uri,
          name,
          asset.mimeType || 'image/jpeg',
          asset.fileSize,
          asset.base64 || undefined,
        ),
      );
    } catch (error) {
      pickerError(error);
    }
  };
  const handleSelectCapture = async (item: CaptureItem) => {
    setLibraryOpen(false);
    closeTools();
    try {
      if (item.type === 'text') {
        setDraft((value) =>
          value ? value + '\n' + (item.note || '') : item.note || '',
        );
        return;
      }
      if (!item.uri)
        throw new Error('Esta captura já não contém um ficheiro disponível.');
      setAttachment(
        await readAttachment(
          item.uri,
          item.title,
          item.mimeType || guessMime(item.title),
          item.size,
          item.base64,
        ),
      );
    } catch (error) {
      pickerError(error);
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
          contentContainerStyle={{
            padding: 24,
            paddingTop: 36,
            paddingBottom: 126,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
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
                  <LiveMotion
                    size={53}
                    shape={agent.avatar?.shape ?? 'circle'}
                    colorId={agent.avatar?.color ?? 'black'}
                  />
                  <View style={{ flex: 1, marginLeft: 15, gap: 5 }}>
                    <Txt weight="700" size={19}>
                      {agent.name}
                    </Txt>
                    <Txt color={C.muted} size={13} numberOfLines={1}>
                      {agent.description}
                    </Txt>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      props.primaryId === agent.id
                        ? 'Agente principal'
                        : 'Definir como agente principal'
                    }
                    onPress={(event) => {
                      event.stopPropagation();
                      void props.onPrimary(agent);
                    }}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      name={
                        props.primaryId === agent.id ? 'star' : 'star-outline'
                      }
                      color={props.primaryId === agent.id ? C.ink : C.muted}
                      size={21}
                    />
                  </Pressable>
                </Card>
              </Pressable>
            ))}

            {props.agents.length === 0 && (
              <Card style={{ padding: 26, gap: 8 }}>
                <Txt weight="700" size={17}>
                  Nenhum agente no espaço
                </Txt>
                <Txt color={C.muted} size={14}>
                  Os fluxos e agentes reais são carregados da tua base de dados
                  Supabase. Toca no botão + acima para criar o teu primeiro
                  agente autónomo.
                </Txt>
              </Card>
            )}
          </View>
        </ScrollView>

        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={creationOpen}
          onRequestClose={() => {
            if (creationStep === 2) return setCreationStep(1);
            closeCreation();
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: C.white,
              padding: 26,
              paddingTop: 45,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 35,
              }}
            >
              <Txt size={27} weight="700">
                Tarefas
              </Txt>
              <RoundButton
                icon="close"
                label="Fechar"
                onPress={closeCreation}
              />
            </View>
            {creationStep === 1 ? (
              <>
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
                <Txt
                  size={13}
                  color={C.muted}
                  style={{ marginTop: 20, marginBottom: 10 }}
                >
                  INSTRUÇÃO OU PAPEL
                </Txt>
                <TextInput
                  value={agentDescription}
                  onChangeText={setAgentDescription}
                  placeholder="Ex.: Pesquisar e sintetizar relatórios com ferramentas autónomas"
                  multiline
                  style={[
                    styles.field,
                    { height: 110, textAlignVertical: 'top' },
                  ]}
                  placeholderTextColor={C.faint}
                />
                <Pressable
                  onPress={() => {
                    if (!agentName.trim())
                      return props.onError('Indica o nome do agente.');
                    setCreationStep(2);
                  }}
                  style={styles.blackButton}
                >
                  <Txt color={C.white} weight="700">
                    Continuar
                  </Txt>
                </Pressable>
              </>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 30 }}
                showsVerticalScrollIndicator={false}
              >
                <Txt size={13} color={C.muted} style={{ marginBottom: 10 }}>
                  AVATAR DO AGENTE
                </Txt>
                <Card
                  style={{ alignItems: 'center', paddingVertical: 26, gap: 12 }}
                >
                  <LiveMotion
                    size={150}
                    shape={avatarShape}
                    colorId={avatarColor}
                  />
                  <Txt weight="700" size={17} numberOfLines={1}>
                    {agentName.trim() || 'Agente'}
                  </Txt>
                </Card>

                <Txt
                  size={13}
                  color={C.muted}
                  style={{ marginTop: 22, marginBottom: 10 }}
                >
                  FORMA
                </Txt>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -26 }}
                  contentContainerStyle={{ paddingHorizontal: 26, gap: 8 }}
                >
                  {BODY_SHAPES.map((s) => {
                    const selected = avatarShape === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setAvatarShape(s.id)}
                        style={[
                          styles.avatarChip,
                          selected && {
                            backgroundColor: C.ink,
                            borderColor: C.ink,
                          },
                        ]}
                      >
                        <Txt
                          size={13}
                          weight="600"
                          color={selected ? C.white : C.muted}
                        >
                          {s.label}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Txt
                  size={13}
                  color={C.muted}
                  style={{ marginTop: 22, marginBottom: 10 }}
                >
                  COR
                </Txt>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
                >
                  {PALETTE.map((c) => {
                    const selected = avatarColor === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        accessibilityRole="button"
                        accessibilityLabel={c.label}
                        accessibilityState={{ selected }}
                        onPress={() => setAvatarColor(c.id)}
                        style={[
                          styles.avatarColor,
                          {
                            borderColor: selected ? C.ink : C.border,
                            borderWidth: selected ? 2 : 1,
                          },
                        ]}
                      >
                        <View
                          style={{
                            flex: 1,
                            borderRadius: 99,
                            backgroundColor: c.hex,
                          }}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  disabled={creatingAgent}
                  onPress={async () => {
                    setCreatingAgent(true);
                    try {
                      await props.onNew(
                        agentName.trim(),
                        agentDescription.trim(),
                        {
                          shape: avatarShape,
                          color: avatarColor,
                        },
                      );
                      closeCreation();
                      setAgentName('');
                      setAgentDescription('');
                      setAvatarShape('circle');
                      setAvatarColor('black');
                    } catch {
                      // Error handled in parent
                    } finally {
                      setCreatingAgent(false);
                    }
                  }}
                  style={[
                    styles.blackButton,
                    { marginTop: 28 },
                    creatingAgent && { opacity: 0.7 },
                  ]}
                >
                  {creatingAgent ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Txt color={C.white} weight="700">
                      Criar missão
                    </Txt>
                  )}
                </Pressable>
                <Pressable
                  disabled={creatingAgent}
                  onPress={() => setCreationStep(1)}
                  style={{
                    height: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 6,
                  }}
                >
                  <Txt color={C.muted} weight="600" size={14}>
                    Voltar
                  </Txt>
                </Pressable>
              </ScrollView>
            )}
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
        <RoundButton
          icon="chevron-back"
          label="Voltar aos agentes"
          onPress={props.onBack}
        />
        <LiveMotion
          size={42}
          shape={agent.avatar?.shape ?? 'circle'}
          colorId={agent.avatar?.color ?? 'black'}
        />
        <View style={{ flex: 1 }}>
          <Txt weight="700" size={18} numberOfLines={1}>
            {agent.name}
          </Txt>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 1,
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: props.busy ? '#10B981' : '#9CA3AF',
              }}
            />
            <Txt color={C.muted} size={12} numberOfLines={1}>
              {props.busy
                ? 'A enviar…'
                : props.runs.some((run) => !TERMINAL_STATUSES.has(run.status))
                  ? 'Tarefa em curso'
                  : 'Agente central do workflow'}
            </Txt>
          </View>
        </View>
        <RoundButton
          icon="ellipsis-horizontal"
          label="Definições e permissões do agente"
          onPress={props.onSettings}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 20,
          paddingBottom: 10,
        }}
      >
        <Pill onPress={props.onTools}>Capacidades</Pill>
        <Pill onPress={props.onActivity}>Tarefas</Pill>
        {!props.canSend && (
          <Pill onPress={props.onSettings}>Configurar modelo</Pill>
        )}
      </View>
      {/* Messages List */}
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 25,
          flexGrow: 1,
        }}
        data={props.messages}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } =
            event.nativeEvent;
          followLatest.current =
            contentSize.height - contentOffset.y - layoutMeasurement.height <
            160;
        }}
        scrollEventThrottle={100}
        renderItem={({ item }) => (
          <View>
            <MessageBubble
              item={item}
              agentName={agent.name}
              avatar={agent.avatar}
            />
            {item.pendingId && item.status === 'failed' && (
              <Pressable
                accessibilityRole="button"
                disabled={props.busy}
                onPress={() => void props.onRetry(item.pendingId!)}
                style={{ alignSelf: 'flex-end', padding: 12, marginBottom: 8 }}
              >
                <Txt size={12} color={C.error}>
                  Repetir envio
                </Txt>
              </Pressable>
            )}
            {item.role === 'user' &&
              item.runId &&
              (
                props.runs.find((run) => run.id === item.runId)?.files || []
              ).map((file) => (
                <Pressable
                  key={file.id}
                  accessibilityRole="button"
                  onPress={() => void props.onFile(item.runId!, file.id)}
                  style={{ padding: 12, minHeight: 44 }}
                >
                  <Txt size={12} color={C.muted}>
                    Abrir anexo · {file.name}
                  </Txt>
                </Pressable>
              ))}
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 12, paddingTop: 12 }}>
            {props.busy && (
              <ThinkingBubble agentName={agent.name} avatar={agent.avatar} />
            )}
            {props.runs
              .filter(
                (run) =>
                  !TERMINAL_STATUSES.has(run.status) ||
                  (run.generatedFiles || []).length > 0,
              )
              .slice(-8)
              .map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  busy={props.controlBusy === run.id}
                  onControl={props.onControl}
                  onFile={props.onFile}
                />
              ))}
          </View>
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
            <LiveMotion
              size={74}
              shape={agent.avatar?.shape ?? 'circle'}
              colorId={agent.avatar?.color ?? 'black'}
            />
            <Txt
              size={26}
              weight="600"
              style={{ marginTop: 10, letterSpacing: -0.5 }}
            >
              Como posso ajudar?
            </Txt>
            <Txt
              size={14}
              color={C.muted}
              style={{
                textAlign: 'center',
                paddingHorizontal: 30,
                lineHeight: 21,
              }}
            >
              Conversa com {agent.name}. Podes colocar qualquer questão ou
              partilhar ficheiros para análise.
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
              props.onActivity();
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
                Acompanhar o trabalho do agente
              </Txt>
            </View>
            <Icon name="chevron-forward" size={16} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 2. Câmara */}
          <Pressable style={styles.menuItem} onPress={handleLaunchCamera}>
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
          <Pressable style={styles.menuItem} onPress={handleLaunchGallery}>
            <View style={styles.menuIconCircle}>
              <Icon name="image-outline" size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={15} weight="700">
                Imagem
              </Txt>
              <Txt size={12} color={C.muted}>
                Da galeria
              </Txt>
            </View>
            <Icon name="chevron-forward" size={16} color={C.muted} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* 4. Ficheiros */}
          <Pressable style={styles.menuItem} onPress={handlePickDocument}>
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
              props.onTools();
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
              <Icon name="add" size={23} color={showTools ? C.white : C.ink} />
            </Pressable>
          </Animated.View>

          <View style={styles.agentChip}>
            <LiveMotion
              size={22}
              shape={agent.avatar?.shape ?? 'circle'}
              colorId={agent.avatar?.color ?? 'black'}
            />
            <Txt
              size={14}
              weight="600"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
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
            disabled={
              props.busy || !props.canSend || (!draft.trim() && !attachment)
            }
            onPress={async () => {
              if ((!draft.trim() && !attachment) || props.busy) return;
              const text = draft.trim();
              const curAtt = attachment;
              setDraft('');
              setAttachment(null);
              closeTools();
              try {
                await props.onSend(text, curAtt || undefined);
              } catch (error) {
                if (!(error as { pendingId?: string })?.pendingId) {
                  setDraft(text);
                  setAttachment(curAtt);
                }
              }
            }}
          />
        </View>
      </View>

      {/* Library Picker Modal */}
      <Modal
        visible={libraryOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLibraryOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: C.white,
            padding: 24,
            paddingTop: 40,
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
            <Txt size={24} weight="700">
              Biblioteca Capture
            </Txt>
            <RoundButton
              icon="close"
              label="Fechar"
              onPress={() => setLibraryOpen(false)}
            />
          </View>
          <ScrollView style={{ flex: 1 }}>
            {(props.captures || []).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleSelectCapture(item)}
                style={{ marginBottom: 10 }}
              >
                <Card
                  style={{
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
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
                      {item.source} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString('pt-PT')}
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
  agentCard: {
    padding: 17,
    minHeight: 91,
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  avatarChip: {
    backgroundColor: C.surface,
    borderRadius: 40,
    paddingHorizontal: 18,
    height: 43,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
  },
  avatarColor: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 4,
    backgroundColor: C.white,
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
