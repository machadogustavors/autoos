import { StyleSheet, Text, View } from 'react-native';
import { colors, rounded, spacing, type } from '../theme/tokens';
import { DtcChip } from './Chip';

export interface TelemetryReading {
  mileage?: number;
  engineTemperature?: number;
  batteryVoltage?: number;
  dtcCodes?: string[];
}

interface Props {
  reading: TelemetryReading | null;
  // SPEC RF-13: sem leitura nos primeiros 10s → "Aguardando leitura do veículo…"
  waitingHint?: string;
}

// Só o snapshot mais recente. Sem gráfico na V1 (série vive no LARCC).
export function TelemetryPanel({ reading, waitingHint }: Props) {
  if (!reading) {
    return (
      <View style={styles.panel}>
        <Text style={styles.waiting}>
          {waitingHint ?? 'Aguardando leitura do veículo…'}
        </Text>
      </View>
    );
  }

  const dtcs = reading.dtcCodes ?? [];
  return (
    <View style={styles.panel}>
      <View style={styles.grid}>
        <Metric
          label="Quilometragem"
          value={fmt(reading.mileage, 0)}
          unit="km"
        />
        <Metric
          label="Temperatura do motor"
          value={fmt(reading.engineTemperature, 0)}
          unit="°C"
        />
        <Metric
          label="Tensão da bateria"
          value={fmt(reading.batteryVoltage, 1)}
          unit="V"
        />
      </View>
      {dtcs.length > 0 ? (
        <View style={styles.dtcBlock}>
          <Text style={styles.label}>Códigos de falha</Text>
          <View style={styles.dtcRow}>
            {dtcs.map((code) => (
              <DtcChip key={code} code={code} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// PID que o adaptador não suporta aparece como "indisponível" (RF-17), não quebra o painel.
function fmt(value: number | undefined, digits: number): string | null {
  return value === undefined ? null : value.toFixed(digits);
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | null;
  unit: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.label}>{label}</Text>
      {value === null ? (
        <Text style={styles.unavailable}>indisponível</Text>
      ) : (
        <Text>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.unit}> {unit}</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  waiting: { ...type.bodyMd, color: colors.muted },
  grid: { gap: spacing.md },
  metric: { gap: spacing.xxs },
  label: { ...type.caption, color: colors.faint },
  value: { ...type.telemetryValue, color: colors.ink },
  unit: { ...type.telemetryUnit, color: colors.muted },
  unavailable: { ...type.bodySm, color: colors.faint },
  dtcBlock: { gap: spacing.xs },
  dtcRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
