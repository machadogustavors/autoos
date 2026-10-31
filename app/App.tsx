import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from './state/session';
import { Navigation } from './screens/Navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Navigation />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
