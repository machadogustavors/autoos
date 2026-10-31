import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSession } from '../state/session';
import { colors, type } from '../theme/tokens';
import { AddItemScreen } from './AddItemScreen';
import { LoginScreen } from './LoginScreen';
import { NewServiceOrderScreen } from './NewServiceOrderScreen';
import { PairingScreen } from './PairingScreen';
import { ServiceOrderDetailScreen } from './ServiceOrderDetailScreen';
import { ServiceOrdersScreen } from './ServiceOrdersScreen';
import { StockScreen } from './StockScreen';
import { VehicleHistoryScreen } from './VehicleHistoryScreen';
import { YardScreen } from './YardScreen';

export type RootStackParamList = {
  Login: undefined;
  Yard: undefined;
  ServiceOrders: undefined;
  NewServiceOrder: undefined;
  ServiceOrderDetail: { id: string };
  AddItem: { serviceOrderId: string };
  Pairing: { serviceOrderId: string; vehicleId?: string; plate: string };
  VehicleHistory: { vehicleId: string; plate: string };
  Stock: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Tema escuro fixo (DESIGN.md): canvas em toda tela, laranja só em foco/link.
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.canvas,
    card: colors.canvas,
    text: colors.ink,
    border: colors.line,
    notification: colors.primary,
  },
};

const headerOptions = {
  headerStyle: { backgroundColor: colors.canvas },
  headerTintColor: colors.ink,
  headerTitleStyle: { ...type.screenTitle },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.canvas },
} as const;

export function Navigation() {
  const { status } = useSession();

  if (status === 'booting') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={headerOptions}>
        {status === 'signedOut' ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Yard"
              component={YardScreen}
              options={{ title: 'Pátio' }}
            />
            <Stack.Screen
              name="ServiceOrders"
              component={ServiceOrdersScreen}
              options={{ title: 'Todas as OS' }}
            />
            <Stack.Screen
              name="NewServiceOrder"
              component={NewServiceOrderScreen}
              options={{ title: 'Nova OS' }}
            />
            <Stack.Screen
              name="ServiceOrderDetail"
              component={ServiceOrderDetailScreen}
              options={{ title: 'Ordem de serviço' }}
            />
            <Stack.Screen
              name="AddItem"
              component={AddItemScreen}
              options={{ title: 'Adicionar item' }}
            />
            <Stack.Screen
              name="Pairing"
              component={PairingScreen}
              options={{ title: 'Dispositivo' }}
            />
            <Stack.Screen
              name="VehicleHistory"
              component={VehicleHistoryScreen}
              options={{ title: 'Histórico do veículo' }}
            />
            <Stack.Screen
              name="Stock"
              component={StockScreen}
              options={{ title: 'Estoque' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
