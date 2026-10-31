import { StyleSheet, Text, View } from 'react-native';
import { colors, rounded, type } from '../theme/tokens';

export type BleStatus =
  'disconnected' | 'scanning' | 'connecting' | 'connected' | 'reconnecting';

const look: Record<BleStatus, { label: string; bg: string; fg: string }> = {
  connected: { label: 'Conectado', bg: colors.okSoft, fg: colors.onOk },
  connecting: { label: 'Conectando…', bg: colors.warnSoft, fg: colors.onWarn },
  reconnecting: {
    label: 'Reconectando…',
    bg: colors.warnSoft,
    fg: colors.onWarn,
  },
  scanning: { label: 'Procurando…', bg: colors.warnSoft, fg: colors.onWarn },
  disconnected: {
    label: 'Desconectado',
    bg: colors.surfaceDeep,
    fg: colors.faint,
  },
};

// A única pílula do app (rounded.full é só do badge BLE — DESIGN.md).
export function BleBadge({ status }: { status: BleStatus }) {
  const { label, bg, fg } = look[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: rounded.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  dot: { width: 8, height: 8, borderRadius: rounded.full },
  text: { ...type.micro },
});
