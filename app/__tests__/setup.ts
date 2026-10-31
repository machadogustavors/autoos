jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual<object>(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
