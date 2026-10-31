import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, rounded, spacing } from '../theme/tokens';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  // card-detail usa padding lg; card-service-order usa md.
  variant?: 'list' | 'detail';
}

// Borda 1px, raio 6, sem sombra (DESIGN.md).
export function Card({ children, onPress, variant = 'list' }: Props) {
  const pad = variant === 'detail' ? spacing.lg : spacing.md;
  if (!onPress) {
    return <View style={[styles.card, { padding: pad }]}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { padding: pad },
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: { backgroundColor: colors.surfaceDeep },
});
