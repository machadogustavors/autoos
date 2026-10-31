import { StyleSheet, Text, View } from 'react-native';
import type { ServiceOrderStatus } from '../api/types';
import { colors, rounded, type } from '../theme/tokens';

const statusLook: Record<
  ServiceOrderStatus,
  { label: string; bg: string; fg: string }
> = {
  open: { label: 'Aberta', bg: colors.primarySoft, fg: colors.onPrimarySoft },
  in_progress: {
    label: 'Em andamento',
    bg: colors.warnSoft,
    fg: colors.onWarn,
  },
  completed: { label: 'Concluída', bg: colors.okSoft, fg: colors.onOk },
  cancelled: {
    label: 'Cancelada',
    bg: colors.surfaceDeep,
    fg: colors.faint,
  },
};

export function StatusChip({ status }: { status: ServiceOrderStatus }) {
  const look = statusLook[status];
  return (
    <View style={[styles.chip, { backgroundColor: look.bg }]}>
      <Text style={[styles.text, { color: look.fg }]}>{look.label}</Text>
    </View>
  );
}

// DTC é sempre alerta, nunca neutro (DESIGN.md). Código em mono.
export function DtcChip({ code }: { code?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.dangerSoft }]}>
      <Text
        style={[
          styles.text,
          { color: colors.onDanger },
          code ? styles.mono : null,
        ]}
      >
        {code ?? 'DTC'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: rounded.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  text: { ...type.micro },
  mono: { fontFamily: type.telemetryUnit.fontFamily },
});
