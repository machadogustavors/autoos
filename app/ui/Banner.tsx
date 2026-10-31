import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme/tokens';
import { Button } from './Button';

// Faixa no topo; não bloqueia a tela. Copy do SPEC §3.
export function OfflineBanner({ message }: { message?: string }) {
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <Text style={styles.offlineText}>
        {message ?? 'Sem conexão. O rascunho continua salvo.'}
      </Text>
    </View>
  );
}

// Erro da SEÇÃO que falhou. Sem código HTTP, sem JSON.
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <View style={styles.retry}>
          <Button
            label="Tentar novamente"
            variant="secondary"
            onPress={onRetry}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  offline: {
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  offlineText: { ...type.bodySm, color: colors.onPrimarySoft },
  error: {
    backgroundColor: colors.dangerSoft,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
  },
  errorText: { ...type.bodySm, color: colors.danger },
  retry: { marginTop: spacing.sm },
});
