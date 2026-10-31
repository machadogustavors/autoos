import { useLayoutEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { services } from '../state/services';
import { useSession } from '../state/session';
import { useOnline } from '../state/useOnline';
import { useReloadOnFocus } from '../state/useReloadOnFocus';
import { useResource } from '../state/useResource';
import { contentMaxWidth, spacing } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { ServiceOrderListItem } from '../ui/ServiceOrderListItem';
import { EmptyState, SkeletonCards } from '../ui/States';
import type { RootStackParamList } from './Navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Yard'>;

// RF-05/RF-06: pátio = OS open + in_progress, mais recente primeiro.
export function YardScreen({ navigation }: Props) {
  const { signOut } = useSession();
  const online = useOnline();
  const { state, reload } = useResource(
    () => services.serviceOrders.yard(),
    [],
  );
  useReloadOnFocus(reload);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Button
            label="Todas"
            variant="link"
            onPress={() => navigation.navigate('ServiceOrders')}
          />
          <Button
            label="Estoque"
            variant="link"
            onPress={() => navigation.navigate('Stock')}
          />
          <Button label="Sair" variant="link" onPress={() => void signOut()} />
        </View>
      ),
    });
  }, [navigation, signOut]);

  const newOrder = () => navigation.navigate('NewServiceOrder');
  const offline = !online || (state.status === 'ready' && state.fromCache);

  if (state.status === 'loading') {
    return (
      <Screen offline={!online}>
        <SkeletonCards />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen
        offline={!online}
        footer={<Button label="Nova OS" onPress={newOrder} />}
      >
        <ErrorBanner message={state.message} onRetry={reload} />
      </Screen>
    );
  }

  const items = state.data.items;
  return (
    <Screen
      scroll={false}
      offline={offline}
      footer={<Button label="Nova OS" onPress={newOrder} />}
    >
      {items.length === 0 ? (
        <EmptyState message="Nenhuma OS aberta. Toque em Nova OS para começar." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ServiceOrderListItem
              order={item}
              onPress={() =>
                navigation.navigate('ServiceOrderDetail', { id: item.id })
              }
            />
          )}
          onRefresh={reload}
          refreshing={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: spacing.md },
  list: {
    gap: spacing.sm,
    width: '100%',
    maxWidth: contentMaxWidth,
  },
});
