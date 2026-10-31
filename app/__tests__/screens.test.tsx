import type { ReactElement } from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../api/errors';
import type { ServiceOrderCard, ServiceOrderDetail } from '../api/types';
import { draftStore } from '../repositories/draftStore';
import { AddItemScreen } from '../screens/AddItemScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NewServiceOrderScreen } from '../screens/NewServiceOrderScreen';
import { PairingScreen } from '../screens/PairingScreen';
import { ServiceOrderDetailScreen } from '../screens/ServiceOrderDetailScreen';
import { YardScreen } from '../screens/YardScreen';

// Renderiza as telas de verdade (nunca rodaram em aparelho) com os serviços
// trocados por fakes: pega crash de render e confere os estados do SPEC §3.

let mockKeyCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `key-${++mockKeyCounter}`,
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => undefined },
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => undefined,
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {},
  isErrorWithCode: () => false,
  isSuccessResponse: () => true,
}));

const mockSignIn = jest.fn();
jest.mock('../state/session', () => ({
  useSession: () => ({ signIn: mockSignIn, signOut: jest.fn() }),
  SignInError: class SignInError extends Error {},
}));

const mockServices = {
  serviceOrders: {
    yard: jest.fn(),
    detail: jest.fn(),
    create: jest.fn(),
    setStatus: jest.fn(),
    addItem: jest.fn(),
    removeItem: jest.fn(),
    postTelemetry: jest.fn(),
  },
  customers: { search: jest.fn(), create: jest.fn() },
  vehicles: { searchByPlate: jest.fn(), create: jest.fn(), history: jest.fn() },
  products: { list: jest.fn() },
};
jest.mock('../state/services', () => ({
  get services() {
    return mockServices;
  },
  onSessionExpired: () => undefined,
}));

// Sem BLE/Bluetooth Classic reais: um DeviceSession controlável.
const mockDevice = {
  state: undefined as ((s: string) => void) | undefined,
  reading: undefined as ((r: unknown) => void) | undefined,
  scan: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
};
jest.mock('../repositories/deviceSession', () => ({
  DeviceSession: class {
    onState(l: (s: string) => void) {
      mockDevice.state = l;
      return () => undefined;
    }
    onReading(l: (r: unknown) => void) {
      mockDevice.reading = l;
      return () => undefined;
    }
    scan = mockDevice.scan;
    connect = mockDevice.connect;
    disconnect = mockDevice.disconnect;
  },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const ui = (element: ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>{element}</SafeAreaProvider>,
  );

const nav = () => ({
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
});
// As telas só usam estes quatro métodos; o cast evita montar o tipo completo.
const asProps = <T,>(navigation: ReturnType<typeof nav>, route?: unknown): T =>
  ({ navigation, route }) as T;

const card = (over: Partial<ServiceOrderCard> = {}): ServiceOrderCard => ({
  id: 'os-1',
  status: 'open',
  vehicleId: 'v-1',
  plate: 'ABC1D23',
  customerName: 'Wilson Machado',
  brand: 'Fiat',
  model: 'Uno',
  hasDtcOnLastReading: false,
  createdAt: '2026-10-14T13:05:00-03:00',
  ...over,
});

const detail = (
  over: Partial<ServiceOrderDetail> = {},
): ServiceOrderDetail => ({
  ...card(),
  description: 'Luz da bateria acesa',
  items: [],
  ...over,
});

beforeEach(async () => {
  // Só os nossos mocks: resetAllMocks zeraria também o mock do AsyncStorage.
  for (const group of Object.values(mockServices)) {
    Object.values(group).forEach((fn) => fn.mockReset());
  }
  mockSignIn.mockReset();
  mockDevice.scan.mockReset();
  mockDevice.connect.mockReset();
  mockDevice.disconnect.mockReset();
  mockKeyCounter = 0;
  await draftStore.clear();
});

describe('Pátio (RF-05/RF-06)', () => {
  const props = () => asProps<Parameters<typeof YardScreen>[0]>(nav());

  it('shows the skeleton first, then the card with plate, customer and status', async () => {
    let release!: (value: unknown) => void;
    mockServices.serviceOrders.yard.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    await ui(<YardScreen {...props()} />);

    // Carregando: esqueleto, nenhum card ainda.
    expect(screen.getByLabelText('Carregando')).toBeTruthy();
    expect(screen.queryByText('ABC1D23')).toBeNull();

    release({
      data: { items: [card()], paging: { hasMore: false } },
      fromCache: false,
    });
    expect(await screen.findByText('ABC1D23')).toBeTruthy();
    expect(screen.getByText('Wilson Machado · Fiat Uno')).toBeTruthy();
    expect(screen.getByText('Aberta')).toBeTruthy();
    expect(screen.queryByText('DTC')).toBeNull();
  });

  it('flags a card whose last reading had a fault code', async () => {
    mockServices.serviceOrders.yard.mockResolvedValue({
      data: {
        items: [card({ hasDtcOnLastReading: true, status: 'in_progress' })],
        paging: { hasMore: false },
      },
      fromCache: false,
    });
    await ui(<YardScreen {...props()} />);

    expect(await screen.findByText('DTC')).toBeTruthy();
    expect(screen.getByText('Em andamento')).toBeTruthy();
  });

  it('empty yard: direct phrase and a Nova OS primary (never a blank screen)', async () => {
    mockServices.serviceOrders.yard.mockResolvedValue({
      data: { items: [], paging: { hasMore: false } },
      fromCache: false,
    });
    await ui(<YardScreen {...props()} />);

    expect(
      await screen.findByText(
        'Nenhuma OS aberta. Toque em Nova OS para começar.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Nova OS')).toBeTruthy();
  });

  it('error: section banner without HTTP code, and retry loads again', async () => {
    mockServices.serviceOrders.yard
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'boom'))
      .mockResolvedValueOnce({
        data: { items: [card()], paging: { hasMore: false } },
        fromCache: false,
      });
    await ui(<YardScreen {...props()} />);

    expect(
      await screen.findByText('Não foi possível carregar. Tente de novo.'),
    ).toBeTruthy();
    expect(screen.queryByText(/500|boom/)).toBeNull();

    await fireEvent.press(screen.getByText('Tentar novamente'));
    expect(await screen.findByText('ABC1D23')).toBeTruthy();
  });

  it('served from cache: shows the offline banner and still lists the OS', async () => {
    mockServices.serviceOrders.yard.mockResolvedValue({
      data: { items: [card()], paging: { hasMore: false } },
      fromCache: true,
    });
    await ui(<YardScreen {...props()} />);

    expect(await screen.findByText('ABC1D23')).toBeTruthy();
    expect(
      screen.getByText('Sem conexão. O rascunho continua salvo.'),
    ).toBeTruthy();
  });

  it('tapping the card opens the detail', async () => {
    mockServices.serviceOrders.yard.mockResolvedValue({
      data: { items: [card()], paging: { hasMore: false } },
      fromCache: false,
    });
    const navigation = nav();
    await ui(
      <YardScreen {...asProps<Parameters<typeof YardScreen>[0]>(navigation)} />,
    );

    await fireEvent.press(await screen.findByText('ABC1D23'));
    expect(navigation.navigate).toHaveBeenCalledWith('ServiceOrderDetail', {
      id: 'os-1',
    });
  });
});

describe('Detalhe da OS (RF-09/RF-10/RF-11)', () => {
  const open = (data: ServiceOrderDetail, fromCache = false) => {
    mockServices.serviceOrders.detail.mockResolvedValue({ data, fromCache });
    const navigation = nav();
    return {
      navigation,
      view: ui(
        <ServiceOrderDetailScreen
          {...asProps<Parameters<typeof ServiceOrderDetailScreen>[0]>(
            navigation,
            { params: { id: 'os-1' } },
          )}
        />,
      ),
    };
  };

  it('open: primary is "Iniciar atendimento" and it moves the OS to in_progress', async () => {
    mockServices.serviceOrders.setStatus.mockResolvedValue(detail());
    const { view } = open(detail());
    await view;

    await fireEvent.press(await screen.findByText('Iniciar atendimento'));
    await waitFor(() =>
      expect(mockServices.serviceOrders.setStatus).toHaveBeenCalledWith(
        'os-1',
        'in_progress',
      ),
    );
  });

  it('in_progress: primary is "Concluir OS"', async () => {
    await open(detail({ status: 'in_progress' })).view;
    expect(await screen.findByText('Concluir OS')).toBeTruthy();
    expect(screen.queryByText('Iniciar atendimento')).toBeNull();
  });

  it('completed: no primary, no add-item, no cancel', async () => {
    await open(detail({ status: 'completed' })).view;
    await screen.findByText('Concluída');
    expect(screen.queryByText('Concluir OS')).toBeNull();
    expect(screen.queryByText('Adicionar item')).toBeNull();
    expect(screen.queryByText('Parear dispositivo')).toBeNull();
    expect(screen.queryByText('Cancelar OS')).toBeNull();
  });

  it('shows the last reading in the telemetry panel with the DTC chip', async () => {
    await open(
      detail({
        lastTelemetry: {
          id: 't1',
          mileage: 84213,
          engineTemperature: 91,
          batteryVoltage: 12.6,
          dtcCodes: ['P0301'],
          capturedAt: '2026-10-14T14:32:01-03:00',
        },
      }),
    ).view;

    expect(await screen.findByText('84213')).toBeTruthy();
    expect(screen.getByText('91')).toBeTruthy();
    expect(screen.getByText('12.6')).toBeTruthy();
    expect(screen.getByText('P0301')).toBeTruthy();
  });

  it('no reading yet: waiting copy, not a blank panel', async () => {
    await open(detail()).view;
    expect(
      await screen.findByText('Aguardando leitura do veículo…'),
    ).toBeTruthy();
  });

  it('a 409 (invalid transition) is explained in Portuguese, not as raw code', async () => {
    mockServices.serviceOrders.setStatus.mockRejectedValue(
      new ApiError(
        409,
        'INVALID_TRANSITION',
        'Esta OS não pode mudar para esse status.',
      ),
    );
    await open(detail()).view;

    await fireEvent.press(await screen.findByText('Iniciar atendimento'));
    expect(
      await screen.findByText('Esta OS não pode mudar para esse status.'),
    ).toBeTruthy();
    expect(screen.queryByText(/INVALID_TRANSITION/)).toBeNull();
  });

  it('lists items and offers to add one', async () => {
    const { navigation, view } = open(
      detail({
        items: [
          {
            id: 'i1',
            type: 'part',
            description: 'Bateria 60Ah',
            quantity: 1,
            createdAt: '2026-10-14T14:00:00-03:00',
          },
        ],
      }),
    );
    await view;

    expect(await screen.findByText('Bateria 60Ah')).toBeTruthy();
    await fireEvent.press(screen.getByText('Adicionar item'));
    expect(navigation.navigate).toHaveBeenCalledWith('AddItem', {
      serviceOrderId: 'os-1',
    });
  });
});

describe('Nova OS (RF-07/RF-08)', () => {
  const customer = {
    id: 'c-1',
    name: 'Wilson Machado',
    createdAt: '2026-10-01T10:00:00-03:00',
  };
  const vehicle = {
    id: 'v-1',
    customerId: 'c-1',
    plate: 'ABC1D23',
    createdAt: '2026-10-01T10:00:00-03:00',
  };

  const open = () => {
    const navigation = nav();
    return {
      navigation,
      view: ui(
        <NewServiceOrderScreen
          {...asProps<Parameters<typeof NewServiceOrderScreen>[0]>(navigation)}
        />,
      ),
    };
  };

  it('restores a saved draft (customer, vehicle and description)', async () => {
    await draftStore.save({
      customer,
      vehicle,
      description: 'barulho na suspensão',
      idempotencyKey: 'saved-key',
    });
    await open().view;

    expect(await screen.findByText('Wilson Machado')).toBeTruthy();
    expect(screen.getByText('ABC1D23')).toBeTruthy();
    expect(screen.getByDisplayValue('barulho na suspensão')).toBeTruthy();
  });

  it('network failure keeps the draft and retry resends the SAME Idempotency-Key', async () => {
    await draftStore.save({
      customer,
      vehicle,
      description: 'barulho',
      idempotencyKey: 'saved-key',
    });
    mockServices.serviceOrders.create
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Sem conexão.'))
      .mockResolvedValueOnce(detail({ id: 'os-9' }));
    const { navigation, view } = open();
    await view;

    await fireEvent.press(await screen.findByText('Criar OS'));
    expect(
      await screen.findByText(
        'Não foi possível criar a OS. O rascunho continua salvo.',
      ),
    ).toBeTruthy();
    expect((await draftStore.load())?.description).toBe('barulho');

    await fireEvent.press(screen.getByText('Tentar novamente'));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('ServiceOrderDetail', {
        id: 'os-9',
      }),
    );

    const calls = mockServices.serviceOrders.create.mock.calls as [
      unknown,
      string,
    ][];
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[1]).toBe('saved-key');
    expect(calls[1]?.[1]).toBe('saved-key');
    // Criou: o rascunho some.
    expect(await draftStore.load()).toBeNull();
  });

  it('editing the description after a failure generates a NEW key', async () => {
    await draftStore.save({
      customer,
      vehicle,
      description: 'barulho',
      idempotencyKey: 'saved-key',
    });
    await open().view;

    await fireEvent.changeText(
      await screen.findByDisplayValue('barulho'),
      'barulho forte',
    );
    await waitFor(async () => {
      const saved = await draftStore.load();
      expect(saved?.description).toBe('barulho forte');
      expect(saved?.idempotencyKey).not.toBe('saved-key');
    });
  });

  it('409 says the vehicle already has an active OS, with no retry offered', async () => {
    await draftStore.save({
      customer,
      vehicle,
      description: '',
      idempotencyKey: 'k',
    });
    mockServices.serviceOrders.create.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'x'),
    );
    await open().view;

    await fireEvent.press(await screen.findByText('Criar OS'));
    expect(
      await screen.findByText('Este veículo já tem uma OS em andamento.'),
    ).toBeTruthy();
    expect(screen.queryByText('Tentar novamente')).toBeNull();
  });

  it('cannot submit without customer and vehicle', async () => {
    await open().view;
    await fireEvent.press(await screen.findByText('Criar OS'));
    expect(mockServices.serviceOrders.create).not.toHaveBeenCalled();
  });
});

describe('Adicionar item (RF-11)', () => {
  const open = () => {
    const navigation = nav();
    return {
      navigation,
      view: ui(
        <AddItemScreen
          {...asProps<Parameters<typeof AddItemScreen>[0]>(navigation, {
            params: { serviceOrderId: 'os-1' },
          })}
        />,
      ),
    };
  };

  it('requires a description (field error, no request)', async () => {
    await open().view;
    await fireEvent.press(screen.getByText('Adicionar item'));
    expect(await screen.findByText('Descreva o item.')).toBeTruthy();
    expect(mockServices.serviceOrders.addItem).not.toHaveBeenCalled();
  });

  it('adds a service and goes back', async () => {
    mockServices.serviceOrders.addItem.mockResolvedValue({});
    const { navigation, view } = open();
    await view;

    await fireEvent.changeText(
      screen.getByLabelText('Descrição'),
      'Teste do alternador',
    );
    await fireEvent.press(screen.getByText('Adicionar item'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockServices.serviceOrders.addItem).toHaveBeenCalledWith(
      'os-1',
      expect.objectContaining({
        type: 'service',
        description: 'Teste do alternador',
      }),
      expect.any(String),
    );
  });

  it('INSUFFICIENT_STOCK shows the server message with the available quantity', async () => {
    mockServices.serviceOrders.addItem.mockRejectedValue(
      new ApiError(
        409,
        'INSUFFICIENT_STOCK',
        'Estoque insuficiente. Disponível: 2.',
      ),
    );
    await open().view;

    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Bateria');
    await fireEvent.press(screen.getByText('Adicionar item'));

    expect(
      await screen.findByText('Estoque insuficiente. Disponível: 2.'),
    ).toBeTruthy();
  });
});

describe('Pareamento (RF-12/RF-13/RF-16)', () => {
  const open = () => {
    const navigation = nav();
    return ui(
      <PairingScreen
        {...asProps<Parameters<typeof PairingScreen>[0]>(navigation, {
          params: {
            serviceOrderId: 'os-1',
            vehicleId: 'v-1',
            plate: 'ABC1D23',
          },
        })}
      />,
    );
  };

  it('starts disconnected with "Parear dispositivo" as the single primary', async () => {
    await open();
    expect(screen.getByText('Desconectado')).toBeTruthy();
    expect(screen.getByText('Parear dispositivo')).toBeTruthy();
    expect(screen.getByText('Usar adaptador comercial')).toBeTruthy();
  });

  it('permission denied: explains and offers the system settings', async () => {
    const { ObdError } =
      jest.requireActual<typeof import('../obd/types')>('../obd/types');
    mockDevice.scan.mockRejectedValue(
      new ObdError('PERMISSION_DENIED', 'negada'),
    );
    await open();

    await fireEvent.press(screen.getByText('Parear dispositivo'));
    expect(
      await screen.findByText(/precisa da permissão de Bluetooth/),
    ).toBeTruthy();
    expect(screen.getByText('Abrir configurações')).toBeTruthy();
  });

  it('connect failure: the SPEC copy, back to the list', async () => {
    mockDevice.scan.mockImplementation(
      async (onFound: (d: unknown) => void) => {
        onFound({ id: 'AA:BB', name: 'AutoOS-A3F1', transport: 'ble' });
      },
    );
    mockDevice.connect.mockRejectedValue(new Error('timeout'));
    await open();

    await fireEvent.press(screen.getByText('Parear dispositivo'));
    await fireEvent.press(await screen.findByText('AutoOS-A3F1'));
    expect(
      await screen.findByText(
        'Não foi possível conectar. Tente novamente perto do veículo.',
      ),
    ).toBeTruthy();
  });

  it('connected: shows the live reading and attaches it to the OS on confirm', async () => {
    mockDevice.scan.mockImplementation(
      async (onFound: (d: unknown) => void) => {
        onFound({ id: 'AA:BB', name: 'AutoOS-A3F1', transport: 'ble' });
      },
    );
    mockDevice.connect.mockImplementation(async () => {
      mockDevice.state?.('connected');
    });
    mockServices.serviceOrders.postTelemetry.mockResolvedValue({ id: 't' });
    await open();

    await fireEvent.press(screen.getByText('Parear dispositivo'));
    await fireEvent.press(await screen.findByText('AutoOS-A3F1'));
    expect(await screen.findByText('Conectado')).toBeTruthy();
    expect(screen.getByText('Aguardando leitura do veículo…')).toBeTruthy();

    mockDevice.reading?.({
      mileage: 84213,
      engineTemperature: 91,
      batteryVoltage: 12.6,
      dtcCodes: ['P0301'],
      capturedAt: '2026-10-14T14:32:01-03:00',
    });
    expect(await screen.findByText('84213')).toBeTruthy();
    expect(screen.getByText('P0301')).toBeTruthy();

    await fireEvent.press(screen.getByText('Anexar leitura à OS'));
    expect(await screen.findByText('Leitura anexada à OS.')).toBeTruthy();
    expect(mockServices.serviceOrders.postTelemetry).toHaveBeenCalledWith(
      'os-1',
      expect.objectContaining({ mileage: 84213, dtcCodes: ['P0301'] }),
    );
  });

  it('reading without mileage (ELM327 w/o odometer): shown as unavailable, never posted', async () => {
    mockDevice.scan.mockImplementation(
      async (onFound: (d: unknown) => void) => {
        onFound({ id: 'AA:BB', name: 'AutoOS-A3F1', transport: 'ble' });
      },
    );
    mockDevice.connect.mockImplementation(async () => {
      mockDevice.state?.('connected');
    });
    await open();

    await fireEvent.press(screen.getByText('Parear dispositivo'));
    await fireEvent.press(await screen.findByText('AutoOS-A3F1'));
    await screen.findByText('Conectado');
    mockDevice.reading?.({
      engineTemperature: 88,
      dtcCodes: [],
      capturedAt: '2026-10-14T14:32:01-03:00',
    });

    expect(await screen.findByText('88')).toBeTruthy();
    // quilometragem e tensão não vieram
    expect(screen.getAllByText('indisponível')).toHaveLength(2);
    await fireEvent.press(screen.getByText('Anexar leitura à OS'));
    expect(mockServices.serviceOrders.postTelemetry).not.toHaveBeenCalled();
  });

  it('shows "Reconectando…" while the link is being re-established', async () => {
    mockDevice.scan.mockImplementation(
      async (onFound: (d: unknown) => void) => {
        onFound({ id: 'AA:BB', name: 'AutoOS-A3F1', transport: 'ble' });
      },
    );
    mockDevice.connect.mockImplementation(async () => {
      mockDevice.state?.('connected');
    });
    await open();
    await fireEvent.press(screen.getByText('Parear dispositivo'));
    await fireEvent.press(await screen.findByText('AutoOS-A3F1'));
    await screen.findByText('Conectado');

    mockDevice.state?.('reconnecting');
    expect(await screen.findByText('Reconectando…')).toBeTruthy();
  });
});

describe('Login (RF-01)', () => {
  it('calls signIn and shows the error copy on failure', async () => {
    // A MESMA classe que a tela usa no instanceof (a do módulo mockado).
    const { SignInError } =
      jest.requireMock<typeof import('../state/session')>('../state/session');
    mockSignIn.mockRejectedValue(
      new SignInError(
        'Este e-mail não está cadastrado no AutoOS. Fale com a oficina.',
      ),
    );
    await ui(<LoginScreen />);

    await fireEvent.press(screen.getByText('Entrar'));
    expect(
      await screen.findByText(
        'Este e-mail não está cadastrado no AutoOS. Fale com a oficina.',
      ),
    ).toBeTruthy();
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });
});
