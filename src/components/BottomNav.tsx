import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { C, TAB_HEIGHT } from '../theme';
import type { Tab } from '../types';
import { Txt } from './UI';
import { ReferenceTabIcon } from './ReferenceTabIcon';
const tabs = ['Chat', 'Capture', 'Conectores', 'Atividade', 'Perfil'] as const;
export function BottomNav({ tab, onSelect }: { tab: Tab; onSelect: (tab: Tab) => void }) {
  return <View style={styles.shell}>{tabs.map(item => {
    const active = tab === item;
    return <Pressable key={item} accessibilityLabel={item} accessibilityRole="tab" accessibilityState={{selected: active}} onPress={() => onSelect(item)} style={[styles.item, active && styles.active]}>
      <ReferenceTabIcon tab={item} active={active} size={25}/>
      <Txt size={11} weight={active ? '600' : '400'} color={active ? C.ink : C.muted}>{item}</Txt>
    </Pressable>;
  })}</View>;
}
const styles = StyleSheet.create({
  shell: { position:'absolute', bottom: 10, left: 15, right: 15, height:TAB_HEIGHT, borderRadius: 34, borderWidth:1, borderColor:C.border, backgroundColor:C.surface, flexDirection:'row', padding:6, shadowColor:'#000', shadowOpacity:.14, shadowRadius:25, shadowOffset:{width:0,height:12}, elevation:13 },
  item:{flex:1, borderRadius:29, alignItems:'center',justifyContent:'center',gap:4},
  active:{backgroundColor:'#EFEFEF'}
});
