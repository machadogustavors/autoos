import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatDate } from '../format';
import { services } from '../state/services';
import { useOnline } from '../state/useOnline';
import { useResource } from '../state/useResource';
import { colors, spacing, type } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { Card } from '../ui/Card';
import { DtcChip, StatusChip } from '../ui/Chip';
import { Screen } from '../ui/Screen';
import { EmptyState, SkeletonCards } from '../ui/States';
import type { RootStackParamList } from './Navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VehicleHistory'>;

// RF-18: OS anteriores da placa, só transacional (a série bruta fica no LARCC).
export function VehicleHistoryScreen({ navigation, route }: Props) {
  const { vehicleId, plate } = route.params;
  const online = useOnline();
  const { state, reload } = useResource(
    () => services.vehicles.history(vehicleId),
    [vehicleId],
  );

  return (
    <Screen offline={!online || (state.status === 'ready' && state.fromCache)}>
      <Text style={styles.plate}>{plate}</Text>
      {state.status === 'loading' ? <SkeletonCards /> : null}
      {state.status === 'error' ? (
        <ErrorBanner message={state.message} onRetry={reload} />
      ) : null}
      {state.status === 'ready' && state.data.items.length === 0 ? (
        <EmptyState message="Nenhuma OS registrada para este veículo." />
      ) : null}
      {state.status === 'ready'
        ? state.data.items.map((order) => (
            <Card
              key={order.id}
              onPress={() =>
                navigation.navigate('ServiceOrderDetail', { id: order.id })
              }
            >
              <View style={styles.body}>
                <Text style={styles.date}>{formatDate(order.createdAt)}</Text>
                <View style={styles.chips}>
                  <StatusChip status={order.status} />
                  {order.hasDtcOnLastReading ? <DtcChip /> : null}
                </View>
              </View>
            </Card>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  plate: { ...type.heading1, color: colors.ink },
  body: { gap: spacing.xs },
  date: { ...type.headingCard, color: colors.ink },
  chips: { flexDirection: 'row', gap: spacing.xs },
});
