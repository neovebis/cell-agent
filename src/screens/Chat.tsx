import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { MessageBubble, ThinkingBubble } from '../components/ChatMessage';
import { ChatOptions } from '../components/ChatOptions';
import { readAttachment, guessMime } from '../services/files';
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
  AgentAvatarChoice,
  AgentMessage,
  CaptureItem,
  FileAttachment,
} from '../types';

type Props = {
  agents: Agent[];
  activeAgent: Agent | null;
  messages: AgentMessage[];
  busy: boolean;
  obscured?: boolean;
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
  onError: (message: string) => void;
  runs: AgentRun[];
  primaryId: string | null;
  canSend: boolean;
  onSettings: () => void;
  onTools: () => void;
  onActivity: () => void;
  onPrimary: (agent: Agent) => Promise<void>;
  onRetry: (pendingId: string) => Promise<void>;
  onDiscard: (pendingId: string) => Promise<void>;
  onFile: (runId: string, fileId: string) => Promise<void>;
};

const NO_GENERATED_FILES: NonNullable<AgentRun['generatedFiles']> = [];
export function ChatScreen(props: Props) {
  const insets = useSafeAreaInsets();
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
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const setDraft = props.onDraftChange;
  const [showTools, setShowTools] = useState(false);
  const attachment = props.attachment;
  const setAttachment = props.onAttachmentChange;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const replying =
    props.busy ||
    props.runs.some((run) => ['queued', 'running'].includes(run.status));
  const attention = props.runs
    .filter((run) => ['waiting_approval', 'paused'].includes(run.status))
    .slice(-1)[0];

  // Animated rotation for '+' to 'x' button and smooth card entrance
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;

  const listRef = useRef<FlatList<AgentMessage>>(null);
  const followLatest = useRef(true);

  useEffect(() => {
    setShowTools(false);
    setAgentMenuOpen(false);
    followLatest.current = true;
    rotateAnim.setValue(0);
    menuAnim.setValue(0);
  }, [props.activeAgent?.id]);

  useEffect(() => {
    if (!draft) setInputHeight(40);
  }, [draft]);

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
            padding: 20,
            paddingTop: 24,
            paddingBottom: 104,
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
              size={40}
            />
          </View>

          <View style={{ gap: 12 }}>
            {props.agents.map((agent) => (
              <Pressable
                key={agent.id}
                accessibilityRole="button"
                onPress={() => props.onOpen(agent)}
                accessibilityLabel={`Abrir chat de ${agent.name}`}
              >
                <Card style={styles.agentCard}>
                  <LiveMotion
                    size={40}
                    shape={agent.avatar?.shape ?? 'circle'}
                    colorId={agent.avatar?.color ?? 'black'}
                  />
                  <View style={{ flex: 1, marginLeft: 12, gap: 3 }}>
                    <Txt weight="600" size={16}>
                      {agent.name}
                    </Txt>
                    <Txt color={C.muted} size={13} numberOfLines={1}>
                      {agent.description}
                    </Txt>
                  </View>
                </Card>
              </Pressable>
            ))}

            {props.agents.length === 0 && (
              <Card style={{ padding: 20, gap: 8 }}>
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
              padding: 20,
              paddingTop: 28,
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
      behavior="padding"
      keyboardVerticalOffset={insets.top}
    >
      <View testID="chat-header" style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar aos agentes"
          onPress={props.onBack}
          style={styles.headerTouch}
        />
        <View style={styles.headerCenter}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'Opções de ' + agent.name}
            accessibilityHint="Modelo, capacidades e tarefas"
            onPress={() => {
              Keyboard.dismiss();
              closeTools();
              setAgentMenuOpen(true);
            }}
            style={({ pressed }) => [
              styles.agentChip,
              pressed && { backgroundColor: C.surface2 },
            ]}
          >
            <LiveMotion
              size={22}
              active={!props.obscured}
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
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Opções do agente"
          onPress={() => {
            Keyboard.dismiss();
            closeTools();
            setAgentMenuOpen(true);
          }}
          style={styles.headerTouch}
        />
      </View>
      <ChatOptions
        visible={agentMenuOpen}
        agentName={agent.name}
        isPrimary={props.primaryId === agent.id}
        onClose={() => setAgentMenuOpen(false)}
        onModel={props.onSettings}
        onTools={props.onTools}
        onActivity={props.onActivity}
        onPrimary={() => void props.onPrimary(agent)}
      />

      {/* Messages List */}
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: 16,
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
        onContentSizeChange={() => {
          if (followLatest.current)
            listRef.current?.scrollToEnd({ animated: true });
        }}
        renderItem={({ item, index }) => (
          <View>
            <MessageBubble
              item={item}
              animate={index >= props.messages.length - 2}
              files={
                props.runs.find((run) => run.id === item.runId)
                  ?.generatedFiles || NO_GENERATED_FILES
              }
              onFile={props.onFile}
              onError={props.onError}
            />
            {item.pendingId && item.status === 'failed' && (
              <View style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
                <Txt size={12} color={C.error}>
                  {item.error || 'O envio não ficou confirmado.'}
                </Txt>
                <Pressable
                  accessibilityRole="button"
                  disabled={props.busy}
                  onPress={() => void props.onDiscard(item.pendingId!)}
                  style={{ padding: 12, minHeight: 44 }}
                >
                  <Txt size={12} color={C.muted}>
                    Remover envio local
                  </Txt>
                </Pressable>
              </View>
            )}
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
          <View style={{ gap: 8, paddingTop: 2 }}>
            {replying && <ThinkingBubble agentName={agent.name} />}
            {!!attention && (
              <View style={styles.attention}>
                <Txt size={13} color={C.muted}>
                  {attention.status === 'paused'
                    ? 'Este pedido está em pausa.'
                    : attention.approval?.reason ||
                      'Preciso da tua autorização para continuar.'}
                </Txt>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    attention.status === 'paused'
                      ? 'Rever pedido em pausa'
                      : 'Rever autorização'
                  }
                  onPress={props.onActivity}
                  style={{
                    alignSelf: 'flex-start',
                    justifyContent: 'center',
                    minHeight: 44,
                  }}
                >
                  <Txt size={13} weight="500">
                    {attention.status === 'paused'
                      ? 'Rever pedido'
                      : 'Rever autorização'}{' '}
                    ↗
                  </Txt>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !replying && !attention ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 40,
              }}
            >
              <LiveMotion
                size={52}
                shape={agent.avatar?.shape ?? 'circle'}
                colorId={agent.avatar?.color ?? 'black'}
              />
              <Txt size={22} weight="500" style={{ marginTop: 8 }}>
                Como posso ajudar?
              </Txt>
              <Txt
                size={13}
                color={C.muted}
                style={{
                  textAlign: 'center',
                  paddingHorizontal: 20,
                  lineHeight: 20,
                }}
              >
                {props.canSend
                  ? 'Escreve uma mensagem ou partilha um ficheiro.'
                  : 'Escolhe o modelo nas opções para começar.'}
              </Txt>
              {!props.canSend && (
                <Pressable
                  accessibilityRole="button"
                  onPress={props.onSettings}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Txt size={13} weight="600">
                    Escolher modelo
                  </Txt>
                </Pressable>
              )}
            </View>
          ) : null
        }
      />

      {/* Anexos e biblioteca */}
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
          {/* 2. Câmara */}
          <Pressable style={styles.menuItem} onPress={handleLaunchCamera}>
            <View style={styles.menuIconCircle}>
              <Icon name="camera-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={14} weight="500">
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
              <Icon name="image-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={14} weight="500">
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
              <Icon name="attach-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={14} weight="500">
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
              <Icon name="aperture-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt size={14} weight="500">
                Capture
              </Txt>
              <Txt size={12} color={C.muted}>
                Enviar conteúdo capturado
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

      <View testID="chat-composer" style={styles.composer}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ferramentas e anexos"
            hitSlop={2}
            onPress={toggleTools}
            style={[
              styles.plusButton,
              showTools && { backgroundColor: C.surface2 },
            ]}
          >
            <Icon name="add" size={21} />
          </Pressable>
        </Animated.View>
        <TextInput
          value={draft}
          onChangeText={text => { latestDraft.current = text; setDraft(text); }}
          multiline
          placeholder="Mensagem…"
          placeholderTextColor={C.muted}
          style={[styles.composeInput, { height: inputHeight }]}
          accessibilityLabel="Mensagem ao agente"
          onContentSizeChange={(event) =>
            setInputHeight(
              Math.max(
                40,
                latestDraft.current ? Math.min(116, Math.ceil(event.nativeEvent.contentSize.height)) : 40,
              ),
            )
          }
        />
        <RoundButton
          icon="arrow-up"
          label="Enviar mensagem"
          primary={Boolean(draft.trim() || attachment) && !props.busy}
          size={38}
          disabled={
            props.busy || !props.canSend || (!draft.trim() && !attachment)
          }
          onPress={async () => {
            if ((!draft.trim() && !attachment) || props.busy) return;
            const text = draft.trim();
            latestDraft.current = '';
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
    padding: 14,
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
  },
  field: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 15,
    padding: 12,
    fontSize: 14,
    color: C.ink,
  },
  blackButton: {
    backgroundColor: C.ink,
    borderRadius: R.pill,
    height: 46,
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
    minHeight: 54,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerTouch: { width: 44, height: 44 },
  headerCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  attention: { gap: 1, paddingVertical: 4, marginBottom: 6 },
  composer: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: R.composer,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  composeInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    maxHeight: 116,
    fontSize: 15,
    lineHeight: 21,
    color: C.ink,
    paddingHorizontal: 6,
    paddingVertical: 9,
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentChip: {
    minHeight: 48,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  floatingMenuCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginHorizontal: 12,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  menuIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
