import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  EMPTY_BY_FILTER,
  ORDER_FILTERS,
  type OrderFilter,
} from '../repositories/orderFilters';
import { useOnline } from '../state/useOnline';
import { useOrderList } from '../state/useOrderList';
import { useReloadOnFocus } from '../state/useReloadOnFocus';
import { colors, contentMaxWidth, spacing } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { FilterBar } from '../ui/FilterBar';
import { Screen } from '../ui/Screen';
import { ServiceOrderListItem } from '../ui/ServiceOrderListItem';
import { EmptyState, SkeletonCards } from '../ui/States';
import type { RootStackParamList } from './Navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceOrders'>;

// RF-22: o que já foi feito (e o que está aberto), com filtro por status.
// Sem primário: é consulta; criar OS continua no pátio.
export function ServiceOrdersScreen({ navigation }: Props) {
  const online = useOnline();
  const [filter, setFilter] = useState<OrderFilter>('all');
  const list = useOrderList(filter);
  useReloadOnFocus(list.reload);

  const { state } = list;
  const offline = !online || (state.status === 'ready' && state.fromCache);

  return (
    <Screen scroll={false} offline={offline}>
      <FilterBar options={ORDER_FILTERS} value={filter} onChange={setFilter} />

      {state.status === 'loading' ? <SkeletonCards /> : null}

      {state.status === 'error' ? (
        <ErrorBanner message={state.message} onRetry={list.reload} />
      ) : null}

      {state.status === 'ready' && list.items.length === 0 ? (
        <EmptyState message={EMPTY_BY_FILTER[filter]} />
      ) : null}

      {state.status === 'ready' && list.items.length > 0 ? (
        <FlatList
          testID="orders-list"
          data={list.items}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ServiceOrderListItem
              order={item}
              showDate
              onPress={() =>
                navigation.navigate('ServiceOrderDetail', { id: item.id })
              }
            />
          )}
          onEndReached={() => void list.loadMore()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <View style={styles.footer}>
              {list.loadingMore ? (
                <ActivityIndicator color={colors.primary} />
              ) : null}
              {list.moreError ? (
                <ErrorBanner
                  message={list.moreError}
                  onRetry={() => void list.loadMore()}
                />
              ) : null}
            </View>
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    width: '100%',
    maxWidth: contentMaxWidth,
  },
  footer: { paddingVertical: spacing.md },
});
