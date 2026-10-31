import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, rounded, spacing, touchHeight, type } from '../theme/tokens';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  multiline?: boolean;
}

// text-input: 48 de altura; foco 2px laranja; erro 2px vermelho + caption.
export function TextField({ label, error, multiline, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primary
      : colors.lineStrong;
  const borderWidth = error || focused ? 2 : 1;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        placeholderTextColor={colors.faint}
        style={[
          styles.input,
          multiline && styles.area,
          { borderColor, borderWidth },
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  label: { ...type.caption, color: colors.muted },
  input: {
    ...type.bodyMd,
    height: touchHeight,
    backgroundColor: colors.surface,
    color: colors.ink,
    borderRadius: rounded.sm,
    paddingHorizontal: spacing.md,
  },
  area: {
    height: undefined,
    minHeight: 120,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
  },
  error: { ...type.caption, color: colors.danger },
});
