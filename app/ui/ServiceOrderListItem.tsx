import { StyleSheet, Text, View } from 'react-native';
import type { ServiceOrderCard } from '../api/types';
import { formatDate } from '../format';
import { colors, spacing, type } from '../theme/tokens';
import { Card } from './Card';
import { DtcChip, StatusChip } from './Chip';

interface Props {
  order: ServiceOrderCard;
  onPress: () => void;
  // "Todas as OS" mostra a data de abertura; o pátio não precisa.
  showDate?: boolean;
}

// card-service-order (RF-06): placa, cliente + veículo, status e DTC.
export function ServiceOrderListItem({ order, onPress, showDate }: Props) {
  const vehicle = [order.brand, order.model].filter(Boolean).join(' ');
  return (
    <Card onPress={onPress}>
      <View style={styles.body}>
        <Text style={styles.plate} numberOfLines={1}>
          {order.plate}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[order.customerName, vehicle].filter(Boolean).join(' · ')}
        </Text>
        {showDate ? (
          <Text style={styles.date}>{formatDate(order.createdAt)}</Text>
        ) : null}
        <View style={styles.chips}>
          <StatusChip status={order.status} />
          {order.hasDtcOnLastReading ? <DtcChip /> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xxs },
  plate: { ...type.headingCard, color: colors.ink },
  meta: { ...type.bodySm, color: colors.muted },
  date: { ...type.caption, color: colors.faint },
  chips: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
});
