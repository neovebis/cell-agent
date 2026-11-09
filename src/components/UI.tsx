import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Txt = ({
  children,
  size = 14,
  weight = '400',
  color = C.ink,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  weight?: '400' | '500' | '600' | '700' | '800';
  color?: string;
  style?: any;
  numberOfLines?: number;
}) => (
  <Text
    numberOfLines={numberOfLines}
    style={[
      { fontSize: size, color, fontWeight: weight, letterSpacing: -0.2 },
      style,
    ]}
  >
    {children}
  </Text>
);
export function Icon({
  name,
  size = 21,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} color={color} size={size} />;
}
export function RoundButton({
  icon,
  onPress,
  primary,
  size = 42,
  label,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  primary?: boolean;
  size?: number;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={Math.max(0, (44 - size) / 2)}
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
      <Icon
        name={icon}
        size={size < 42 ? 19 : 21}
        color={primary ? C.white : C.ink}
      />
    </Pressable>
  );
}
export function Pill({
  children,
  onPress,
  selected,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
      disabled={!onPress}
      style={[styles.pill, selected && { backgroundColor: C.ink }, style]}
    >
      <Txt
        weight="500"
        size={13}
        numberOfLines={1}
        color={selected ? C.white : C.ink}
        style={{ maxWidth: '100%', flexShrink: 1, textAlign: 'center' }}
      >
        {children}
      </Txt>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function PageTitle({
  kicker,
  title,
}: {
  kicker?: string;
  title: string;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      {!!kicker && (
        <Txt size={12} color={C.muted} weight="400" style={{ marginBottom: 4 }}>
          {kicker}
        </Txt>
      )}
      <Txt size={28} weight="600" style={{ letterSpacing: -0.75 }}>
        {title}
      </Txt>
    </View>
  );
}
export function Busy() {
  return (
    <View style={{ padding: 20, alignItems: 'center' }}>
      <ActivityIndicator color={C.ink} />
    </View>
  );
}
export const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.card,
    padding: 16,
  },
  pill: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.pill,
    minHeight: 36,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: {
    borderWidth: 1,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
