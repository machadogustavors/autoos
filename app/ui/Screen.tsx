import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, contentMaxWidth, spacing } from '../theme/tokens';
import { OfflineBanner } from './Banner';

interface Props {
  children: ReactNode;
  offline?: boolean;
  // false quando a tela já tem lista rolável própria (FlatList).
  scroll?: boolean;
  // Botão primário fixo no rodapé; sobe com o teclado (DESIGN.md).
  footer?: ReactNode;
}

// Fundo canvas em toda tela, gutter 16, conteúdo até 560 no tablet.
export function Screen({ children, offline, scroll = true, footer }: Props) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.column}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill]}>
      <View style={[styles.column, styles.fill]}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
      {offline ? <OfflineBanner /> : null}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
        {footer ? (
          <View style={styles.footer}>
            <View style={styles.column}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenGutter,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  column: { width: '100%', maxWidth: contentMaxWidth, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.screenGutter,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.canvas,
  },
});
