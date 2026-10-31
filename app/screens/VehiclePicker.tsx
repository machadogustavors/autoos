import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isApiError, messageFor } from '../api/errors';
import type { Customer, Vehicle } from '../api/types';
import { services } from '../state/services';
import { colors, spacing, type } from '../theme/tokens';
import { ErrorBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { TextField } from '../ui/TextField';
import {
  normalizePlate,
  parseMileage,
  parseYear,
  plateError,
} from '../validation';

interface Props {
  customer: Customer;
  selected: Vehicle | null;
  onSelect: (vehicle: Vehicle | null) => void;
}

// RF-04: busca por placa; se novo, cadastra marca/modelo/ano/cor/km ali mesmo.
export function VehiclePicker({ customer, selected, onSelect }: Props) {
  const [plate, setPlate] = useState('');
  const [found, setFound] = useState<{
    plate: string;
    items: Vehicle[];
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [form, setForm] = useState({
    brand: '',
    model: '',
    year: '',
    color: '',
    mileage: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const normalized = normalizePlate(plate);
  const plateValid = !plateError(plate);

  useEffect(() => {
    if (selected || !plateValid) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      services.vehicles
        .searchByPlate(normalized)
        .then((page) => {
          if (cancelled) return;
          setSearchError(null);
          setFound({
            plate: normalized,
            items: page.items.filter((v) => v.plate === normalized),
          });
        })
        .catch((e: unknown) => {
          if (!cancelled) setSearchError(messageFor(e));
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized, plateValid, selected]);

  const results =
    !selected && plateValid && found?.plate === normalized ? found.items : null;

  if (selected) {
    const detail = [selected.brand, selected.model].filter(Boolean).join(' ');
    return (
      <View style={styles.section}>
        <Text style={styles.section_title}>Veículo</Text>
        <Card>
          <Text style={styles.name}>{selected.plate}</Text>
          {detail ? <Text style={styles.meta}>{detail}</Text> : null}
        </Card>
        <Button
          label="Trocar veículo"
          variant="link"
          onPress={() => onSelect(null)}
        />
      </View>
    );
  }

  async function create() {
    const year = parseYear(form.year);
    const mileage = parseMileage(form.mileage);
    const next: Record<string, string> = {};
    const pErr = plateError(plate);
    if (pErr) next.plate = pErr;
    if (year.error) next.year = year.error;
    if (mileage.error) next.mileage = mileage.error;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const vehicle = await services.vehicles.create({
        customerId: customer.id,
        plate: normalized,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        year: year.value,
        color: form.color.trim() || undefined,
        referenceMileage: mileage.value,
      });
      onSelect(vehicle);
    } catch (e) {
      // 409: placa de outro cliente — pede confirmação humana, não sobrescreve (RF-04).
      setSaveError(
        isApiError(e) && e.status === 409
          ? 'Esta placa já pertence a outro cliente.'
          : messageFor(e),
      );
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof typeof form) => (text: string) =>
    setForm((f) => ({ ...f, [key]: text }));

  return (
    <View style={styles.section}>
      <Text style={styles.section_title}>Veículo</Text>
      <TextField
        label="Placa"
        value={plate}
        onChangeText={(t) => {
          setPlate(t);
          setErrors((e) => ({ ...e, plate: '' }));
        }}
        error={errors.plate || undefined}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
      />
      {searchError ? <ErrorBanner message={searchError} /> : null}
      {results?.map((vehicle) => (
        <Card key={vehicle.id} onPress={() => onSelect(vehicle)}>
          <Text style={styles.name}>{vehicle.plate}</Text>
          <Text style={styles.meta}>
            {[vehicle.brand, vehicle.model].filter(Boolean).join(' ') ||
              'Veículo cadastrado'}
          </Text>
        </Card>
      ))}
      {results !== null && results.length === 0 ? (
        <View style={styles.section}>
          <Text style={styles.meta}>
            Veículo novo. Preencha para cadastrar.
          </Text>
          <TextField
            label="Marca"
            value={form.brand}
            onChangeText={set('brand')}
          />
          <TextField
            label="Modelo"
            value={form.model}
            onChangeText={set('model')}
          />
          <TextField
            label="Ano"
            value={form.year}
            onChangeText={set('year')}
            keyboardType="number-pad"
            maxLength={4}
            error={errors.year}
          />
          <TextField
            label="Cor"
            value={form.color}
            onChangeText={set('color')}
          />
          <TextField
            label="Quilometragem atual"
            value={form.mileage}
            onChangeText={set('mileage')}
            keyboardType="number-pad"
            error={errors.mileage}
          />
          {saveError ? <ErrorBanner message={saveError} /> : null}
          <Button
            label="Cadastrar veículo"
            variant="secondary"
            loading={saving}
            onPress={create}
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
