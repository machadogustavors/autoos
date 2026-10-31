import { Buffer } from 'buffer';
import { registerRootComponent } from 'expo';
import App from './App';

// mqtt e ble-plx esperam Buffer global; o Hermes não tem.
const scope = globalThis as { Buffer?: typeof Buffer };
scope.Buffer ??= Buffer;

registerRootComponent(App);
