import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isApiError } from '../api/errors';
import type { Customer, Vehicle } from '../api/types';
import {
  draftStore,
  type NewServiceOrderDraft,
} from '../repositories/draftStore';
import { newIdempotencyKey } from '../repositories/repositories';
import { services } from '../state/services';
import { useOnline } from '../state/useOnline';
import { colors, spacing, type } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { CustomerPicker } from './CustomerPicker';
import type { RootStackParamList } from './Navigation';
import { VehiclePicker } from './VehiclePicker';

type Props = NativeStackScreenProps<RootStackParamList, 'NewServiceOrder'>;

// RF-07/RF-08: o rascunho é gravado a cada mudança e só some quando a OS é criada.
export function NewServiceOrderScreen({ navigation }: Props) {
  const online = useOnline();
  const [loaded, setLoaded] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [description, setDescription] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    retry: boolean;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void draftStore.load().then((draft) => {
      if (draft) {
        setCustomer(draft.customer);
        setVehicle(draft.vehicle);
        setDescription(draft.description);
        setIdempotencyKey(draft.idempotencyKey);
      }
      setLoaded(true);
    });
  }, []);

  // Muda o conteúdo → muda a chave. Mesma chave com conteúdo novo devolveria
  // a OS antiga (RNF-06). Retry sem edição reaproveita a chave.
  const update = useCallback(
    (next: Partial<Omit<NewServiceOrderDraft, 'idempotencyKey'>>) => {
      const draft: NewServiceOrderDraft = {
        customer: 'customer' in next ? (next.customer ?? null) : customer,
        vehicle: 'vehicle' in next ? (next.vehicle ?? null) : vehicle,
        description: next.description ?? description,
        idempotencyKey: newIdempotencyKey(),
      };
      setCustomer(draft.customer);
      setVehicle(draft.vehicle);
      setDescription(draft.description);
      setIdempotencyKey(draft.idempotencyKey);
      setFailure(null);
      setFieldErrors({});
      void draftStore.save(draft);
    },
    [customer, vehicle, description],
  );

  async function submit() {
    if (!customer || !vehicle) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const order = await services.serviceOrders.create(
        {
          customerId: customer.id,
          vehicleId: vehicle.id,
          description: description.trim() || undefined,
        },
        idempotencyKey,
      );
      await draftStore.clear();
      navigation.replace('ServiceOrderDetail', { id: order.id });
    } catch (e) {
      if (isApiError(e) && e.status === 409) {
        setFailure({
          message: 'Este veículo já tem uma OS em andamento.',
          retry: false,
        });
      } else if (isApiError(e) && e.status === 400) {
        setFieldErrors(e.fields ?? {});
        setFailure({ message: 'Corrija os campos destacados.', retry: false });
      } else {
        // Rede/5xx: rascunho intacto, retry reenvia a MESMA chave (RF-08).
        setFailure({
          message: 'Não foi possível criar a OS. O rascunho continua salvo.',
          retry: true,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) return <Screen>{null}</Screen>;

  return (
    <Screen
      offline={!online}
      footer={
        <Button
          label="Criar OS"
          onPress={submit}
          loading={submitting}
          disabled={!customer || !vehicle}
        />
      }
    >
      <CustomerPicker
        selected={customer}
        onSelect={(c) => update({ customer: c, vehicle: null })}
      />
      {customer ? (
        <VehiclePicker
          customer={customer}
          selected={vehicle}
          onSelect={(v) => update({ vehicle: v })}
        />
      ) : null}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Descrição</Text>
        <TextField
          label="O que o cliente relatou (opcional)"
          value={description}
          onChangeText={(text) => update({ description: text })}
          multiline
          error={fieldErrors.description}
        />
      </View>
      {failure ? (
        <ErrorBanner
          message={failure.message}
          onRetry={failure.retry ? submit : undefined}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { ...type.microUppercase, color: colors.faint },
});
