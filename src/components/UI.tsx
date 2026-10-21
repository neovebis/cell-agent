import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Txt = ({ children, size = 16, weight = '400', color = C.ink, style, numberOfLines }: { children: React.ReactNode; size?: number; weight?: '400'|'500'|'600'|'700'|'800'; color?: string; style?: any; numberOfLines?: number }) =>
  <Text numberOfLines={numberOfLines} style={[{ fontSize: size, color, fontWeight: weight, letterSpacing: -0.4 }, style]}>{children}</Text>;
export function Icon({ name, size = 23, color = C.ink }: { name: IconName; size?: number; color?: string }) { return <Ionicons name={name} color={color} size={size}/>; }
export function RoundButton({ icon, onPress, primary, size = 48, label, disabled }: { icon: IconName; onPress: () => void; primary?: boolean; size?: number; label: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.round,
        {
          width: size,
          height: size,
          backgroundColor: primary ? C.ink : C.surface2,
          borderColor: primary ? C.ink : C.border,
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Icon name={icon} color={primary ? C.white : C.ink} />
    </Pressable>
  );
}
export function Pill({ children, onPress, selected, style }: { children: React.ReactNode; onPress?: () => void; selected?: boolean; style?: ViewStyle }) {
  return <Pressable onPress={onPress} disabled={!onPress} style={[styles.pill, selected && { backgroundColor: C.ink }, style]}><Txt weight="600" size={15} color={selected ? C.white : C.ink}>{children}</Txt></Pressable>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[styles.card, style]}>{children}</View>; }
export function PageTitle({ kicker, title }: { kicker?: string; title: string }) {
  return <View style={{ marginBottom: 30 }}>
    {!!kicker && <Txt size={14} color={C.muted} weight="500" style={{marginBottom: 4}}>{kicker}</Txt>}
    <Txt size={36} weight="700" style={{letterSpacing: -1.25}}>{title}</Txt>
  </View>;
}
export function Busy() { return <View style={{padding: 20,alignItems:'center'}}><ActivityIndicator color={C.ink}/></View> }
export const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: R.card, padding: 22 },
  pill: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, borderRadius: R.pill, minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  round: { borderWidth: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
});
