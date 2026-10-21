import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { Icon, Pill, RoundButton, Txt } from './UI';
import { C } from '../theme';
import { modelsFor } from '../services/models';
import type { ModelCatalog } from '../types';

const field = {
  backgroundColor: C.surface,
  borderColor: C.border,
  borderWidth: 1,
  borderRadius: 20,
  paddingHorizontal: 14,
  minHeight: 46,
  fontSize: 13,
  color: C.ink,
} as const;

/** Tappable model field + sheet listing the models of the selected provider. */
export function ModelPicker({
  provider,
  value,
  onChange,
  loadModels,
}: {
  provider: string;
  value: string;
  onChange: (model: string) => void;
  /** Live catalog loader (backend, per vault key). Falls back to the fixed list. */
  loadModels?: (provider: string) => Promise<ModelCatalog>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [custom, setCustom] = useState('');
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const live = catalog?.source === 'live' && catalog.models.length > 0;
  const models = live ? catalog!.models : modelsFor(provider);
  const fixedKnown = modelsFor(provider).find((m) => m.id === value);
  const known = models.find((m) => m.id === value) || fixedKnown;
  // Saved ID that isn't in the list being shown (live or fixed)
  const notListed = !!value && !models.some((m) => m.id === value);
  const isCustom = !!value && !known;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? models.filter((m) => m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)) : models;
  }, [models, query]);

  const fetchCatalog = () => {
    if (!loadModels) return;
    setLoading(true);
    loadModels(provider)
      .then((c) => setCatalog(c))
      .catch(() => setCatalog({ source: 'fixed', models: modelsFor(provider), note: 'Sem ligação ao catálogo: lista padrão.' }))
      .finally(() => setLoading(false));
  };
  // Provider changed: drop the old catalog
  React.useEffect(() => {
    setCatalog(null);
  }, [provider]);

  const show = () => {
    if (!catalog || catalog.source !== 'live') fetchCatalog();
    setQuery('');
    setCustomMode(isCustom);
    setCustom(isCustom ? value : '');
    setOpen(true);
  };
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel="Escolher modelo"
        style={[field, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
      >
        <View style={{ flex: 1 }}>
          <Txt size={13} weight="600" numberOfLines={1}>
            {known ? known.label : value || 'Escolher modelo'}
          </Txt>
          <Txt size={10} color={C.muted} numberOfLines={1}>
            {isCustom ? 'Personalizado' : known ? known.id : provider.toUpperCase()}
          </Txt>
        </View>
        <Icon name="chevron-down" size={16} color={C.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} onPress={() => setOpen(false)} />
        <View
          style={{
            backgroundColor: C.white,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 18,
            paddingBottom: 30,
            maxHeight: '75%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View>
              <Txt size={17} weight="700">Modelo</Txt>
              <Txt size={11} color={C.muted}>{provider.toUpperCase()}</Txt>
            </View>
            <RoundButton icon="close" label="Fechar" size={36} onPress={() => setOpen(false)} />
          </View>

          {models.length > 6 && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Pesquisar modelo"
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              autoCorrect={false}
              style={[field, { marginBottom: 9 }]}
            />
          )}

          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <ActivityIndicator size="small" color={C.ink} />
              <Txt size={11} color={C.muted}>A carregar modelos da tua API…</Txt>
            </View>
          ) : live ? (
            <Txt size={11} color={C.success} style={{ marginBottom: 8 }}>
              {`Disponíveis para a tua API · ${models.length} modelos`}
            </Txt>
          ) : catalog?.note ? (
            <Txt size={11} color={C.muted} style={{ marginBottom: 8 }}>{catalog.note}</Txt>
          ) : null}

          {notListed && !loading && (
            <Pressable
              onPress={() => pick(value)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 14, backgroundColor: C.surface2, marginBottom: 4 }}
            >
              <View style={{ flex: 1 }}>
                <Txt size={13} weight="700" numberOfLines={1}>{value}</Txt>
                <Txt size={10} color={C.error}>
                  {live ? 'Guardado · não aparece no catálogo da tua API' : 'Guardado · personalizado'}
                </Txt>
              </View>
              <Icon name="checkmark" size={18} />
            </Pressable>
          )}

          <FlatList
            data={loading ? [] : filtered}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0 }}
            ListEmptyComponent={
              loading ? null :
              <Txt size={12} color={C.muted} style={{ paddingVertical: 9 }}>
                Nenhum modelo encontrado.
              </Txt>
            }
            renderItem={({ item }) => {
              const selected = item.id === value;
              return (
                <Pressable
                  onPress={() => pick(item.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 9,
                    paddingVertical: 9,
                    paddingHorizontal: 11,
                    borderRadius: 14,
                    backgroundColor: selected ? C.surface2 : 'transparent',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Txt size={13} weight={selected ? '700' : '500'}>{item.label}</Txt>
                    <Txt size={10} color={C.muted} numberOfLines={1}>
                      {item.note ? `${item.id} · ${item.note}` : live ? `${item.id} · disponível` : item.id}
                    </Txt>
                  </View>
                  {selected && <Icon name="checkmark" size={18} />}
                </Pressable>
              );
            }}
          />

          <View style={{ borderTopWidth: 1, borderColor: C.border, marginTop: 9, paddingTop: 11 }}>
            {customMode ? (
              <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
                <TextInput
                  value={custom}
                  onChangeText={setCustom}
                  placeholder="ID do modelo personalizado"
                  placeholderTextColor={C.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  style={[field, { flex: 1 }]}
                />
                <Pill
                  selected
                  onPress={custom.trim() ? () => pick(custom.trim()) : undefined}
                  style={{ minHeight: 40 }}
                >
                  Usar
                </Pill>
              </View>
            ) : (
              <Pressable
                onPress={() => setCustomMode(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}
              >
                <Icon name="create-outline" size={18} color={C.muted} />
                <Txt size={13} weight="600">Personalizado</Txt>
                {isCustom && (
                  <Txt size={10} color={C.muted} numberOfLines={1} style={{ flex: 1 }}>
                    {value}
                  </Txt>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
