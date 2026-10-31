import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, rounded, spacing, touchHeight, type } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}

// Um primário por view (DESIGN.md). Botão é verbo. Sem pílula: raio 6.
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: Props) {
  const inactive = disabled || loading;

  if (variant === 'link') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={inactive}
        hitSlop={12}
        style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
      >
        <Text style={styles.linkText}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && variant === 'primary' && styles.primaryPressed,
        disabled && variant === 'primary' && styles.primaryDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} />
      ) : (
        <Text style={[styles.label, { color: textColor[variant] }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const textColor: Record<Exclude<ButtonVariant, 'link'>, string> = {
  primary: colors.onPrimary,
  secondary: colors.ink,
  danger: colors.danger,
};

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  danger: { backgroundColor: colors.dangerSoft },
});

const styles = StyleSheet.create({
  base: {
    height: touchHeight,
    borderRadius: rounded.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.buttonMd },
  primaryPressed: { backgroundColor: colors.primaryDeep },
  primaryDisabled: { opacity: 0.4 },
  link: { minHeight: touchHeight, justifyContent: 'center' },
  linkPressed: { opacity: 0.7 },
  linkText: { ...type.bodyMdMedium, color: colors.link },
});
