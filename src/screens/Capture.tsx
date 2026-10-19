import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { AgentAvatar } from '../components/AgentAvatar';
import { Card, Icon, PageTitle, RoundButton, Txt } from '../components/UI';
import { C, R } from '../theme';
import type { Agent, CaptureItem } from '../types';

type Draft = Omit<CaptureItem, 'id' | 'createdAt' | 'synced'>;

const options = [
  ['Foto', 'camera-outline'],
  ['Galeria', 'images-outline'],
  ['Documento', 'document-text-outline'],
  ['Texto', 'text-outline'],
  ['Vídeo', 'videocam-outline'],
  ['Áudio', 'mic-outline'],
  ['Ecrã', 'phone-portrait-outline'],
  ['Localização', 'location-outline'],
] as const;

export function CaptureScreen({
  items,
  agents,
  demo,
  onSave,
  onSendToAgent,
  onError,
}: {
  items: CaptureItem[];
  agents: Agent[];
  demo: boolean;
  onSave: (draft: Draft) => Promise<void>;
  onSendToAgent: (item: CaptureItem, agent: Agent) => void;
  onError: (message: string) => void;
}) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [note, setNote] = useState('');
  const [textValue, setTextValue] = useState('');
  const [textOpen, setTextOpen] = useState(false);
  const [selected, setSelected] = useState<CaptureItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);

  const save = async (draft: Draft) => {
    setSaving(true);
    try {
      await onSave(draft);
      setCaptureOpen(false);
      setTextOpen(false);
      setNote('');
      setTextValue('');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao guardar captura.');
    } finally {
      setSaving(false);
    }
  };

  const choose = async (kind: string) => {
    try {
      if (kind === 'Texto') {
        setCaptureOpen(false);
        setTextOpen(true);
        return;
      }
      if (['Áudio', 'Ecrã', 'Localização'].includes(kind)) {
        onError(
          `A captura de ${kind.toLowerCase()} exige permissão de dispositivo adicional nesta versão.`
        );
        return;
      }
      if (kind === 'Documento') {
        const result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (result.canceled || !result.assets.length) return;
        const a = result.assets[0];

        // Read base64
        let base64 = '';
        try {
          const res = await fetch(a.uri);
          const blob = await res.blob();
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const str = reader.result as string;
              resolve(str.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch {
          base64 = '';
        }

        await save({
          title: a.name,
          source: 'Documento',
          type: 'document',
          uri: a.uri,
          base64,
          note,
        });
        return;
      }

      let result: ImagePicker.ImagePickerResult;
      if (kind === 'Galeria') {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          quality: 0.85,
          base64: true,
        });
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          onError('Acesso à câmara negado.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: kind === 'Vídeo' ? ['videos'] : ['images'],
          quality: 0.85,
          base64: true,
        });
      }

      if (result.canceled || !result.assets.length) return;
      const a = result.assets[0];
      const type = a.type === 'video' ? 'video' : 'image';

      await save({
        title: a.fileName || `${type === 'video' ? 'Vídeo' : 'Imagem'} ${new Date().toLocaleDateString('pt-PT')}`,
        source: kind,
        type,
        uri: a.uri,
        base64: a.base64 || undefined,
        note,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Não foi possível capturar o conteúdo.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 36, paddingBottom: 135 }}>
        <PageTitle kicker="O mundo físico entra aqui" title="Capture" />

        {/* Capture Trigger Card */}
        <Pressable
          onPress={() => setCaptureOpen(true)}
          accessibilityLabel="Capturar novo conteúdo"
          style={styles.captureCard}
        >
          <View style={styles.cameraCircle}>
            <Icon name="camera-outline" size={40} color={C.white} />
          </View>
          <Txt weight="700" size={29} style={{ marginTop: 28 }}>
            Capturar
          </Txt>
          <Txt color={C.muted} size={16} style={{ marginTop: 8 }}>
            Foto, Documento, Galeria ou Texto
          </Txt>
        </Pressable>

        <Txt
          weight="700"
          color={C.muted}
          size={13}
          style={{ marginTop: 29, marginBottom: 19, letterSpacing: 0.5 }}
        >
          RECENTES NA BIBLIOTECA
        </Txt>

        {items.length === 0 ? (
          <Card style={{ gap: 6 }}>
            <Txt weight="600" size={16}>
              Nenhum conteúdo capturado ainda
            </Txt>
            <Txt color={C.muted} size={13}>
              Toca no cartão Capturar acima para recolher fotos, documentos ou apontamentos. Podes
              enviá-los diretamente para os teus agentes.
            </Txt>
          </Card>
        ) : (
          items.map((item) => (
            <Pressable key={item.id} onPress={() => setSelected(item)} style={{ marginBottom: 10 }}>
              <Card style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.itemIconCircle}>
                  <Icon
                    name={
                      item.type === 'image'
                        ? 'image-outline'
                        : item.type === 'video'
                        ? 'videocam-outline'
                        : item.type === 'document'
                        ? 'document-text-outline'
                        : 'text-outline'
                    }
                    size={22}
                  />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Txt weight="600" size={16} numberOfLines={1}>
                    {item.title}
                  </Txt>
                  <Txt color={C.muted} size={12}>
                    {item.source} · {new Date(item.createdAt).toLocaleDateString('pt-PT')}
                  </Txt>
                </View>
                <View style={styles.source}>
                  <Txt size={11} weight="600" color={C.muted}>
                    {item.type.toUpperCase()}
                  </Txt>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Capture Options Bottom Sheet */}
      <Modal
        transparent
        animationType="slide"
        visible={captureOpen}
        onRequestClose={() => setCaptureOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setCaptureOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrab} />
            <Txt size={18} weight="700">
              Nova Captura
            </Txt>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Nota ou contexto para o agente (opcional)"
              placeholderTextColor={C.muted}
              multiline
              style={styles.noteInput}
            />
            <View style={styles.optionGrid}>
              {options.map(([label, icon]) => (
                <Pressable
                  disabled={saving}
                  key={label}
                  style={styles.option}
                  onPress={() => choose(label)}
                >
                  <Icon name={icon} size={19} />
                  <Txt size={15} weight="600">
                    {label}
                  </Txt>
                </Pressable>
              ))}
            </View>
            {saving && (
              <View style={{ alignItems: 'center', padding: 8 }}>
                <ActivityIndicator color={C.ink} />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Text Capture Modal */}
      <Modal
        visible={textOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTextOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: C.white, padding: 25, paddingTop: 45 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt weight="700" size={27}>
              Capturar texto
            </Txt>
            <RoundButton icon="close" label="Fechar" onPress={() => setTextOpen(false)} />
          </View>
          <TextInput
            multiline
            value={textValue}
            onChangeText={setTextValue}
            placeholder="Escreve uma nota, instrução ou apontamento para o agente..."
            style={[styles.noteInput, { marginTop: 28, flex: 1, textAlignVertical: 'top', borderRadius: 25 }]}
            placeholderTextColor={C.muted}
          />
          <Pressable
            disabled={saving || !textValue.trim()}
            onPress={() =>
              save({
                type: 'text',
                source: 'Texto',
                title: textValue.trim().slice(0, 45),
                note: textValue.trim(),
              })
            }
            style={[styles.saveButton, (saving || !textValue.trim()) && { opacity: 0.4 }]}
          >
            {saving ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Txt color={C.white} weight="700">
                Guardar na biblioteca
              </Txt>
            )}
          </Pressable>
        </View>
      </Modal>

      {/* Selected Item Detail & Send Modal */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelected(null)} />
          <View style={styles.sheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Txt size={20} weight="700" numberOfLines={1} style={{ flex: 1 }}>
                {selected?.title}
              </Txt>
              <RoundButton icon="close" label="Fechar" onPress={() => setSelected(null)} />
            </View>

            {selected?.type === 'image' && !!selected.uri ? (
              <Image
                resizeMode="contain"
                source={{ uri: selected.uri }}
                style={{ width: '100%', height: 240, borderRadius: 20, backgroundColor: C.surface2 }}
              />
            ) : selected?.type === 'text' ? (
              <Card style={{ maxHeight: 200 }}>
                <ScrollView>
                  <Txt size={15} style={{ lineHeight: 22 }}>
                    {selected.note}
                  </Txt>
                </ScrollView>
              </Card>
            ) : (
              <Card style={{ gap: 6 }}>
                <Txt color={C.muted}>Tipo: {selected?.type}</Txt>
                <Txt color={C.muted}>Origem: {selected?.source}</Txt>
                {!!selected?.note && <Txt size={14}>{selected.note}</Txt>}
              </Card>
            )}

            {/* ACTION: Enviar para o Agente */}
            <Pressable
              onPress={() => setAgentPickerOpen(true)}
              style={styles.sendAgentButton}
            >
              <Icon name="paper-plane-outline" color={C.white} size={20} />
              <Txt color={C.white} weight="700" size={16}>
                Enviar para o Agente
              </Txt>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Target Agent Picker Modal */}
      <Modal
        visible={agentPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAgentPickerOpen(false)}
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
                Escolher Agente
              </Txt>
              <Txt size={13} color={C.muted}>
                Enviar este anexo para execução
              </Txt>
            </View>
            <RoundButton icon="close" label="Fechar" onPress={() => setAgentPickerOpen(false)} />
          </View>

          <ScrollView style={{ flex: 1 }}>
            {agents.map((ag) => (
              <Pressable
                key={ag.id}
                onPress={() => {
                  if (selected) {
                    setAgentPickerOpen(false);
                    setSelected(null);
                    onSendToAgent(selected, ag);
                  }
                }}
                style={{ marginBottom: 12 }}
              >
                <Card style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <AgentAvatar size={44} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt weight="700" size={17}>
                      {ag.name}
                    </Txt>
                    <Txt color={C.muted} size={12} numberOfLines={1}>
                      {ag.description}
                    </Txt>
                  </View>
                  <Icon name="arrow-forward" color={C.ink} size={20} />
                </Card>
              </Pressable>
            ))}

            {agents.length === 0 && (
              <Card>
                <Txt color={C.muted}>
                  Ainda não tens agentes criados. Cria um agente no separador Chat primeiro.
                </Txt>
              </Card>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  captureCard: {
    height: 310,
    borderRadius: R.card,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCircle: {
    width: 96,
    height: 96,
    borderRadius: 100,
    backgroundColor: C.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  source: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.39)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: C.surface,
    paddingHorizontal: 23,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 16,
  },
  sheetGrab: {
    width: 44,
    height: 5,
    backgroundColor: C.border,
    borderRadius: 5,
    alignSelf: 'center',
    marginBottom: 4,
  },
  noteInput: {
    minHeight: 80,
    borderRadius: 24,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    fontSize: 16,
    padding: 16,
    color: C.ink,
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 10 },
  option: {
    height: 54,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.white,
  },
  saveButton: {
    height: 56,
    backgroundColor: C.ink,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  sendAgentButton: {
    height: 54,
    backgroundColor: C.ink,
    borderRadius: R.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
});
