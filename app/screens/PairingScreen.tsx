import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { openSystemSettings } from '../obd/permissions';
import { toSnapshot } from '../telemetry/snapshot';
import { type Failure, useDeviceSession } from '../state/useDeviceSession';
import { colors, spacing, type } from '../theme/tokens';
import { BleBadge } from '../ui/BleBadge';
import { ErrorBanner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Screen } from '../ui/Screen';
import { TelemetryPanel } from '../ui/TelemetryPanel';
import type { RootStackParamList } from './Navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Pairing'>;

const FAILURE_COPY: Record<Exclude<Failure, null>, string> = {
  connect: 'Não foi possível conectar. Tente novamente perto do veículo.',
  'bluetooth-off': 'Bluetooth desligado. Ligue o Bluetooth do aparelho.',
  permission:
    'O AutoOS precisa da permissão de Bluetooth para achar o dispositivo.',
};

// RF-12/RF-13/RF-16/RF-17. Pareamento é por sessão de OS: sair da tela
// fecha a conexão.
export function PairingScreen({ navigation, route }: Props) {
  const { serviceOrderId, vehicleId, plate } = route.params;
  const session = useDeviceSession(serviceOrderId, vehicleId);

  const live =
    session.connection === 'connected' || session.connection === 'reconnecting';
  const canAttach =
    session.connection === 'connected' &&
    session.reading !== null &&
    toSnapshot(session.reading) !== null;

  // Um primário por view: parear → (conectado) anexar leitura.
  const footer =
    session.attach.status === 'done' ? (
      <Button label="Voltar à OS" onPress={() => navigation.goBack()} />
    ) : live ? (
      <Button
        label="Anexar leitura à OS"
        onPress={() => void session.attachReading()}
        loading={session.attach.status === 'sending'}
        disabled={!canAttach}
      />
    ) : (
      <Button
        label="Parear dispositivo"
        onPress={() => void session.scan('ble')}
        loading={
          session.connection === 'scanning' && session.devices.length === 0
        }
        disabled={session.connection === 'connecting'}
      />
    );

  return (
    <Screen footer={footer}>
      <View style={styles.head}>
        <Text style={styles.plate}>{plate}</Text>
        <BleBadge status={session.connection} />
      </View>

      {session.failure ? (
        <View style={styles.block}>
          <ErrorBanner message={FAILURE_COPY[session.failure]} />
          {session.failure === 'permission' ? (
            <Button
              label="Abrir configurações"
              variant="secondary"
              onPress={openSystemSettings}
            />
          ) : null}
        </View>
      ) : null}

      {live ? (
        <View style={styles.block}>
          <TelemetryPanel
            reading={session.reading}
            waitingHint={
              session.waitingTooLong
                ? 'Aguardando leitura do veículo…'
                : undefined
            }
          />
          {session.reading && !canAttach ? (
            <Text style={styles.hint}>
              O veículo ainda não informou a quilometragem.
            </Text>
          ) : null}
          {session.attach.status === 'done' ? (
            <Text style={styles.ok}>Leitura anexada à OS.</Text>
          ) : null}
          {session.attach.status === 'error' ? (
            <ErrorBanner message={session.attach.message ?? 'Tente de novo.'} />
          ) : null}
          <Button
            label="Desconectar"
            variant="secondary"
            onPress={session.disconnect}
          />
        </View>
      ) : (
        <View style={styles.block}>
          {session.devices.map((device) => (
            <Card key={device.id} onPress={() => void session.connect(device)}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.hint}>
                {session.connectingId === device.id
                  ? 'Conectando…'
                  : device.transport === 'ble'
                    ? 'Dispositivo AutoOS'
                    : 'Adaptador comercial (ELM327)'}
              </Text>
            </Card>
          ))}
          {session.connection === 'scanning' && session.devices.length === 0 ? (
            <Text style={styles.hint}>
              Procurando dispositivos por perto. Ligue o leitor no conector
              OBD-II.
            </Text>
          ) : null}
          <Button
            label="Usar adaptador comercial"
            variant="link"
            onPress={() => void session.scan('classic')}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  plate: { ...type.heading1, color: colors.ink },
  block: { gap: spacing.sm },
  deviceName: { ...type.headingCard, color: colors.ink },
  hint: { ...type.bodySm, color: colors.muted },
  ok: { ...type.bodyMd, color: colors.onOk },
});
