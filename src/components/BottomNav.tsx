import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { C, TAB_HEIGHT } from '../theme';
import type { Tab } from '../types';
import { Txt } from './UI';
import { ReferenceTabIcon } from './ReferenceTabIcon';
const tabs = ['Chat', 'Capture', 'Conectores', 'Atividade', 'Perfil'] as const;
export function BottomNav({
  tab,
  onSelect,
}: {
  tab: Tab;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <View style={styles.shell}>
      {tabs.map((item) => {
        const active = tab === item;
        return (
          <Pressable
            key={item}
            accessibilityLabel={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item)}
            style={[styles.item, active && styles.active]}
          >
            <ReferenceTabIcon tab={item} active={active} size={22} />
            <Txt
              size={10}
              numberOfLines={1}
              weight={active ? '500' : '400'}
              color={active ? C.ink : C.muted}
            >
              {item}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    height: TAB_HEIGHT,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    flexDirection: 'row',
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  item: {
    flex: 1,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  active: { backgroundColor: '#EFEFEF' },
});
