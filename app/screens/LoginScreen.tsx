import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SignInError, useSession } from '../state/session';
import { colors, spacing, type } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';

// RF-01. Sem cadastro self-service: o usuário já existe no servidor.
export function LoginScreen() {
  const { signIn } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPress() {
    setLoading(true);
    setError(null);
    try {
      await signIn();
    } catch (e) {
      setError(
        e instanceof SignInError
          ? e.message
          : 'Não foi possível entrar. Tente de novo.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      footer={<Button label="Entrar" onPress={onPress} loading={loading} />}
    >
      <View style={styles.hero}>
        <Text style={styles.title}>AutoOS</Text>
        <Text style={styles.subtitle}>
          Entre com a conta Google cadastrada na oficina.
        </Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: spacing.xl, gap: spacing.sm },
  title: { ...type.heading1, color: colors.ink },
  subtitle: { ...type.bodyMd, color: colors.muted },
});
