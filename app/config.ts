// Tudo que o app lê do ambiente (EXPO_PUBLIC_*), num lugar só.
// `process.env` chega sem tipo do Metro; normaliza para string aqui.
function env(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

export const config = {
  apiUrl: env(process.env.EXPO_PUBLIC_API_URL, 'http://10.0.2.2:3000/v1'),
  googleWebClientId: env(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  larccMqttUrl: env(process.env.EXPO_PUBLIC_LARCC_MQTT_URL),
  workshopId: env(process.env.EXPO_PUBLIC_WORKSHOP_ID, 'wm'),
  vehicleHashKey: env(process.env.EXPO_PUBLIC_VEHICLE_HASH_KEY),
};
