import { StyleSheet, Text, View } from 'react-native';
import { colors, rounded, spacing, type } from '../theme/tokens';
import { Button } from './Button';

// Vazio: frase direta + um primário. Nunca tela em branco (RNF-03).
export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

// Primeiro load: 3 esqueletos de ~96px no pátio.
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.skeletons} accessibilityLabel="Carregando">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.skeleton} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  emptyText: { ...type.bodyMd, color: colors.muted },
  skeletons: { gap: spacing.sm },
  skeleton: {
    height: 96,
    backgroundColor: colors.surface,
    borderRadius: rounded.sm,
  },
});
