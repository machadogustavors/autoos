import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { messageFor } from '../api/errors';
import type { Product } from '../api/types';
import { services } from '../state/services';
import { useOnline } from '../state/useOnline';
import { useResource } from '../state/useResource';
import { colors, spacing, type } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Screen } from '../ui/Screen';
import { EmptyState, SkeletonCards } from '../ui/States';
import { TextField } from '../ui/TextField';
import { parseStock, requiredError } from '../validation';

// RF-19/RF-20: lista simples com busca por nome, cadastro e ajuste ABSOLUTO.
export function StockScreen() {
  const online = useOnline();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const { state, reload } = useResource(
    () => services.products.list(query.trim()),
    [query],
  );

  const offline = !online || (state.status === 'ready' && state.fromCache);

  return (
    <Screen
      offline={offline}
      footer={
        adding ? undefined : (
          <Button label="Cadastrar peça" onPress={() => setAdding(true)} />
        )
      }
    >
      {adding ? (
        <NewProduct
          onDone={() => {
            setAdding(false);
            reload();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      <TextField label="Buscar peça" value={query} onChangeText={setQuery} />

      {state.status === 'loading' ? <SkeletonCards /> : null}
      {state.status === 'error' ? (
        <ErrorBanner message={state.message} onRetry={reload} />
      ) : null}
      {state.status === 'ready' && state.data.items.length === 0 ? (
        <EmptyState
          message={
            query.trim()
              ? 'Nenhuma peça com esse nome.'
              : 'Nenhuma peça cadastrada. Toque em Cadastrar peça para começar.'
          }
        />
      ) : null}
      {state.status === 'ready'
        ? state.data.items.map((product) => (
            <ProductRow key={product.id} product={product} onChanged={reload} />
          ))
        : null}
    </Screen>
  );
}

function ProductRow({
  product,
  onChanged,
}: {
  product: Product;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(product.stockQuantity));
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // RF-21: confirma antes (toque errado com a mão suja não pode apagar peça).
  function confirmRemove() {
    Alert.alert(
      'Excluir peça',
      `Excluir "${product.name}" do estoque? As OS antigas que usaram essa peça não mudam.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => void remove() },
      ],
    );
  }

  async function remove() {
    setRemoving(true);
    setRemoveError(null);
    try {
      await services.products.remove(product.id);
      onChanged();
    } catch (e) {
      setRemoveError(messageFor(e));
    } finally {
      setRemoving(false);
    }
  }

  async function save() {
    const parsed = parseStock(value);
    if (parsed.error || parsed.value === undefined) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await services.products.adjust(product.id, parsed.value);
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.quantity}>{product.stockQuantity}</Text>
      </View>
      {editing ? (
        <View style={styles.edit}>
          <TextField
            label="Nova quantidade em estoque"
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            error={error}
          />
          <Button
            label="Salvar"
            variant="secondary"
            loading={saving}
            onPress={save}
          />
          <Button
            label="Cancelar"
            variant="link"
            onPress={() => setEditing(false)}
          />
        </View>
      ) : (
        <View style={styles.rowActions}>
          {removeError ? <ErrorBanner message={removeError} /> : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                label="Ajustar"
                variant="secondary"
                onPress={() => {
                  setValue(String(product.stockQuantity));
                  setEditing(true);
                }}
              />
            </View>
            <View style={styles.action}>
              <Button
                label="Excluir"
                variant="danger"
                loading={removing}
                onPress={confirmRemove}
              />
            </View>
          </View>
        </View>
      )}
    </Card>
  );
}

function NewProduct({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function save() {
    const q = parseStock(quantity);
    const next: Record<string, string> = {};
    const nErr = requiredError(name, 'Informe o nome da peça.');
    if (nErr) next.name = nErr;
    if (q.error) next.stockQuantity = q.error;
    setErrors(next);
    if (Object.keys(next).length > 0 || q.value === undefined) return;

    setSaving(true);
    setFailure(null);
    try {
      await services.products.create({
        name: name.trim(),
        stockQuantity: q.value,
      });
      onDone();
    } catch (e) {
      setFailure(messageFor(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.edit}>
      <Text style={styles.section}>Nova peça</Text>
      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        error={errors.name}
        maxLength={200}
      />
      <TextField
        label="Quantidade inicial"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
        error={errors.stockQuantity}
      />
      {failure ? <ErrorBanner message={failure} /> : null}
      <Button label="Cadastrar peça" loading={saving} onPress={save} />
      <Button label="Cancelar" variant="link" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: { ...type.headingCard, color: colors.ink, flexShrink: 1 },
  // Mono é só de sensor (DESIGN.md); quantidade de estoque é texto comum.
  quantity: { ...type.headingCard, color: colors.ink },
  edit: { gap: spacing.sm },
  rowActions: { gap: spacing.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  section: { ...type.microUppercase, color: colors.faint },
});
