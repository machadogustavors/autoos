import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { messageFor } from '../api/errors';
import type { Customer } from '../api/types';
import { services } from '../state/services';
import { colors, spacing, type } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { TextField } from '../ui/TextField';
import { requiredError } from '../validation';

interface Props {
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
}

// RF-03: busca por nome/telefone; se não achar, cadastra ali mesmo.
export function CustomerPicker({ selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{
    query: string;
    items: Customer[];
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (selected || !term) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      services.customers
        .search(term)
        .then((page) => {
          if (cancelled) return;
          setSearchError(null);
          setFound({ query: term, items: page.items });
        })
        .catch((e: unknown) => {
          if (!cancelled) setSearchError(messageFor(e));
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selected]);

  // Só vale o resultado do termo atual (evita lista velha enquanto digita).
  const results =
    !selected && found?.query === query.trim() ? found.items : null;

  if (selected) {
    return (
      <View style={styles.section}>
        <Text style={styles.section_title}>Cliente</Text>
        <Card>
          <Text style={styles.name}>{selected.name}</Text>
          {selected.phone ? (
            <Text style={styles.meta}>{selected.phone}</Text>
          ) : null}
        </Card>
        <Button
          label="Trocar cliente"
          variant="link"
          onPress={() => onSelect(null)}
        />
      </View>
    );
  }

  async function create() {
    const error = requiredError(query, 'Informe o nome do cliente.');
    setNameError(error);
    if (error) return;
    setSaving(true);
    setSaveError(null);
    try {
      const customer = await services.customers.create({
        name: query.trim(),
        phone: phone.trim() || undefined,
      });
      setCreating(false);
      setQuery('');
      setPhone('');
      onSelect(customer);
    } catch (e) {
      setSaveError(messageFor(e));
    } finally {
      setSaving(false);
    }
  }

  const showCreate = results !== null && results.length === 0;

  return (
    <View style={styles.section}>
      <Text style={styles.section_title}>Cliente</Text>
      <TextField
        label="Nome ou telefone"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setNameError(undefined);
        }}
        error={nameError}
        autoCapitalize="words"
      />
      {searchError ? <ErrorBanner message={searchError} /> : null}
      {results?.map((customer) => (
        <Card key={customer.id} onPress={() => onSelect(customer)}>
          <Text style={styles.name}>{customer.name}</Text>
          {customer.phone ? (
            <Text style={styles.meta}>{customer.phone}</Text>
          ) : null}
        </Card>
      ))}
      {(showCreate || creating) && query.trim() ? (
        <View style={styles.section}>
          {!creating ? (
            <Text style={styles.meta}>Nenhum cliente encontrado.</Text>
          ) : null}
          {creating ? (
            <TextField
              label="Telefone (opcional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          ) : null}
          {saveError ? <ErrorBanner message={saveError} /> : null}
          <Button
            label={
              creating ? 'Cadastrar cliente' : `Cadastrar “${query.trim()}”`
            }
            variant="secondary"
            loading={saving}
            onPress={creating ? create : () => setCreating(true)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  section_title: { ...type.microUppercase, color: colors.faint },
  name: { ...type.headingCard, color: colors.ink },
  meta: { ...type.bodySm, color: colors.muted },
});
