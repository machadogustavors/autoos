import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isApiError, messageFor } from '../api/errors';
import type { Product, ServiceOrderItemType } from '../api/types';
import { newIdempotencyKey } from '../repositories/repositories';
import { services } from '../state/services';
import { useOnline } from '../state/useOnline';
import { colors, spacing, type } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Screen } from '../ui/Screen';
import { Segmented } from '../ui/Segmented';
import { TextField } from '../ui/TextField';
import { parseQuantity, requiredError } from '../validation';
import type { RootStackParamList } from './Navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AddItem'>;

// RF-11/RF-11a: peça (do estoque ou avulsa) ou serviço. Sem preço.
export function AddItemScreen({ navigation, route }: Props) {
  const { serviceOrderId } = route.params;
  const online = useOnline();
  const [itemType, setItemType] = useState<ServiceOrderItemType>('service');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Chave nova a cada tentativa NOVA; retry do mesmo envio reaproveita (RNF-06).
  const [key, setKey] = useState(newIdempotencyKey);

  function edit<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setKey(newIdempotencyKey());
      setFailure(null);
    };
  }

  async function submit() {
    const q = parseQuantity(quantity);
    const next: Record<string, string> = {};
    const dErr = requiredError(description, 'Descreva o item.');
    if (dErr) next.description = dErr;
    if (q.error) next.quantity = q.error;
    if (product && q.value === undefined) {
      next.quantity = 'Informe a quantidade para dar baixa no estoque.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setFailure(null);
    try {
      await services.serviceOrders.addItem(
        serviceOrderId,
        {
          type: itemType,
          description: description.trim(),
          productId:
            itemType === 'part' ? (product?.id ?? undefined) : undefined,
          quantity: q.value,
        },
        key,
      );
      navigation.goBack();
    } catch (e) {
      // 409 INSUFFICIENT_STOCK traz a quantidade disponível na mensagem (RF-11a).
      setFailure(
        isApiError(e) && e.status === 400
          ? 'Corrija os campos destacados.'
          : messageFor(e),
      );
      if (isApiError(e) && e.fields) setErrors(e.fields);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      offline={!online}
      footer={
        <Button label="Adicionar item" onPress={submit} loading={submitting} />
      }
    >
      <Segmented
        options={[
          { value: 'service', label: 'Serviço' },
          { value: 'part', label: 'Peça' },
        ]}
        value={itemType}
        onChange={(next) => {
          setItemType(next);
          if (next === 'service') setProduct(null);
        }}
      />

      {itemType === 'part' ? (
        <ProductPicker
          selected={product}
          onSelect={(p) => {
            setProduct(p);
            if (p) setDescription(p.name);
            setKey(newIdempotencyKey());
          }}
        />
      ) : null}

      <TextField
        label="Descrição"
        value={description}
        onChangeText={edit(setDescription)}
        error={errors.description}
        maxLength={300}
      />
      <TextField
        label={
          product ? 'Quantidade (dá baixa no estoque)' : 'Quantidade (opcional)'
        }
        value={quantity}
        onChangeText={edit(setQuantity)}
        keyboardType="decimal-pad"
        error={errors.quantity}
      />
      {failure ? <ErrorBanner message={failure} /> : null}
    </Screen>
  );
}

// RF-19 dentro do fluxo de item: busca por nome; sem escolher = peça avulsa.
function ProductPicker({
  selected,
  onSelect,
}: {
  selected: Product | null;
  onSelect: (product: Product | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{
    query: string;
    items: Product[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (selected || !term) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      services.products
        .list(term)
        .then(({ data }) => {
          if (cancelled) return;
          setError(null);
          setFound({ query: term, items: data.items });
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(messageFor(e));
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selected]);

  // Só vale o resultado do termo atual.
  const results = found?.query === query.trim() ? found.items : [];

  if (selected) {
    return (
      <View style={styles.picker}>
        <Card>
          <Text style={styles.name}>{selected.name}</Text>
          <Text style={styles.meta}>Em estoque: {selected.stockQuantity}</Text>
        </Card>
        <Button
          label="Usar peça avulsa"
          variant="link"
          onPress={() => onSelect(null)}
        />
      </View>
    );
  }

  return (
    <View style={styles.picker}>
      <TextField
        label="Buscar no estoque (opcional)"
        value={query}
        onChangeText={setQuery}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {results.map((p) => (
        <Card key={p.id} onPress={() => onSelect(p)}>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.meta}>Em estoque: {p.stockQuantity}</Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: spacing.sm },
  name: { ...type.headingCard, color: colors.ink },
  meta: { ...type.bodySm, color: colors.muted },
});
