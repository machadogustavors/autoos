import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isApiError, messageFor } from '../api/errors';
import type {
  ServiceOrderDetail,
  ServiceOrderItem,
  ServiceOrderStatus,
} from '../api/types';
import { services } from '../state/services';
import { useOnline } from '../state/useOnline';
import { useReloadOnFocus } from '../state/useReloadOnFocus';
import { useResource } from '../state/useResource';
import { colors, spacing, type } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusChip } from '../ui/Chip';
import { Screen } from '../ui/Screen';
import { SkeletonCards } from '../ui/States';
import { TelemetryPanel } from '../ui/TelemetryPanel';
import type { RootStackParamList } from './Navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceOrderDetail'>;

// RF-09: detalhe com itens e o painel de telemetria (última leitura).
export function ServiceOrderDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const online = useOnline();
  const { state, reload } = useResource(
    () => services.serviceOrders.detail(id),
    [id],
  );
  useReloadOnFocus(reload);

  const [changing, setChanging] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function setStatus(status: ServiceOrderStatus) {
    setChanging(true);
    setActionError(null);
    try {
      await services.serviceOrders.setStatus(id, status);
      reload();
    } catch (e) {
      // 409 (transição inválida) vem explicado do servidor, em português.
      setActionError(messageFor(e));
    } finally {
      setChanging(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <Screen offline={!online}>
        <SkeletonCards count={2} />
      </Screen>
    );
  }
  if (state.status === 'error') {
    return (
      <Screen offline={!online}>
        <ErrorBanner message={state.message} onRetry={reload} />
      </Screen>
    );
  }

  const order = state.data;
  const active = order.status === 'open' || order.status === 'in_progress';
  // Um primário por view: o próximo passo da OS (open → in_progress → completed).
  const primary =
    order.status === 'open'
      ? { label: 'Iniciar atendimento', next: 'in_progress' as const }
      : order.status === 'in_progress'
        ? { label: 'Concluir OS', next: 'completed' as const }
        : null;

  return (
    <Screen
      offline={!online || state.fromCache}
      footer={
        primary ? (
          <Button
            label={primary.label}
            loading={changing}
            // Escrita não finge sucesso offline: a API responde ou falha.
            onPress={() => void setStatus(primary.next)}
          />
        ) : undefined
      }
    >
      <Header order={order} />

      <Section title="Telemetria">
        <TelemetryPanel reading={order.lastTelemetry ?? null} />
        {active ? (
          <Button
            label="Parear dispositivo"
            variant="secondary"
            onPress={() =>
              navigation.navigate('Pairing', {
                serviceOrderId: order.id,
                vehicleId: order.vehicleId,
                plate: order.plate,
              })
            }
          />
        ) : null}
      </Section>

      <Section title="Itens">
        {(order.items ?? []).length === 0 ? (
          <Text style={styles.muted}>Nenhum item registrado.</Text>
        ) : (
          order.items?.map((item) => (
            <ItemRow
              key={item.id}
              orderId={order.id}
              item={item}
              removable={active}
              onRemoved={reload}
            />
          ))
        )}
        {active ? (
          <Button
            label="Adicionar item"
            variant="secondary"
            onPress={() =>
              navigation.navigate('AddItem', { serviceOrderId: order.id })
            }
          />
        ) : null}
      </Section>

      <Button
        label="Histórico do veículo"
        variant="link"
        onPress={() =>
          navigation.navigate('VehicleHistory', {
            vehicleId: order.vehicleId,
            plate: order.plate,
          })
        }
      />

      {actionError ? <ErrorBanner message={actionError} /> : null}

      {active ? (
        <Button
          label="Cancelar OS"
          variant="danger"
          onPress={() => void setStatus('cancelled')}
        />
      ) : null}
    </Screen>
  );
}

function Header({ order }: { order: ServiceOrderDetail }) {
  const vehicle = [order.brand, order.model].filter(Boolean).join(' ');
  return (
    <Card variant="detail">
      <View style={styles.header}>
        <Text style={styles.plate}>{order.plate}</Text>
        <Text style={styles.meta}>
          {[order.customerName, vehicle].filter(Boolean).join(' · ')}
        </Text>
        <StatusChip status={order.status} />
        {order.description ? (
          <Text style={styles.description}>{order.description}</Text>
        ) : null}
      </View>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ItemRow({
  orderId,
  item,
  removable,
  onRemoved,
}: {
  orderId: string;
  item: ServiceOrderItem;
  removable: boolean;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setRemoving(true);
    setError(null);
    try {
      await services.serviceOrders.removeItem(orderId, item.id);
      onRemoved();
    } catch (e) {
      setError(isApiError(e) ? messageFor(e) : 'Não foi possível remover.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card>
      <Text style={styles.itemType}>
        {item.type === 'part' ? 'PEÇA' : 'SERVIÇO'}
        {item.quantity !== undefined && item.quantity !== null
          ? ` · ${item.quantity}`
          : ''}
      </Text>
      <Text style={styles.itemDescription}>{item.description}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {removable ? (
        <Button
          label="Remover item"
          variant="link"
          loading={removing}
          onPress={() => void remove()}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  plate: { ...type.heading1, color: colors.ink },
  meta: { ...type.bodyMd, color: colors.muted },
  description: { ...type.bodyMd, color: colors.ink, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitle: { ...type.microUppercase, color: colors.faint },
  muted: { ...type.bodyMd, color: colors.muted },
  itemType: { ...type.microUppercase, color: colors.faint },
  itemDescription: { ...type.bodyMd, color: colors.ink },
  error: { ...type.caption, color: colors.danger },
});
