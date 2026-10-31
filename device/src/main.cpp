// Firmware AutoOS: expõe a telemetria do veículo por BLE (GATT notify).
// Contrato: contract/mqtt-topics.md §1.1. Cliente: app/obd/BleReader.ts.

#include <Arduino.h>
#include <NimBLEDevice.h>

#include "autoos_uuids.h"
#include "obd_source.h"
#include "reading.h"
#include "simulated_source.h"

namespace {

constexpr uint32_t kNotifyPeriodMs = 1000;  // 1 Hz (mqtt-topics.md §2.4)
constexpr uint16_t kWantedMtu = 185;
constexpr size_t kPayloadCapacity = 256;

NimBLEServer* gServer = nullptr;
NimBLECharacteristic* gTelemetry = nullptr;
uint16_t gConnHandle = BLE_HS_CONN_HANDLE_NONE;

#if defined(AUTOOS_SOURCE_SIMULATED)
SimulatedSource gSimulated;
ObdSource* gSource = &gSimulated;
#else
#error "Defina uma fonte de leituras (AUTOOS_SOURCE_SIMULATED ou a do MCP2515)"
#endif

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer*, NimBLEConnInfo& info) override {
    gConnHandle = info.getConnHandle();
    Serial.printf("[ble] app conectado (handle %u)\n", gConnHandle);
  }

  void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int reason) override {
    gConnHandle = BLE_HS_CONN_HANDLE_NONE;
    Serial.printf("[ble] app desconectou (motivo %d); voltando a anunciar\n", reason);
    // O app reconecta sozinho (RF-16): é preciso estar visível de novo.
    NimBLEDevice::startAdvertising();
  }
};

String deviceName() {
  // Sufixo = últimos 2 bytes do MAC de fábrica: AutoOS-A3F1.
  const uint64_t mac = ESP.getEfuseMac();
  char name[16];
  snprintf(name, sizeof name, "%s-%02X%02X", AUTOOS_NAME_PREFIX, static_cast<unsigned>((mac >> 32) & 0xFF),
           static_cast<unsigned>((mac >> 40) & 0xFF));
  return String(name);
}

// Uma notificação carrega no máximo MTU-3 bytes. O payload (~100 B) cabe em
// uma com o MTU pedido, mas se o app não negociar, o objeto vai em pedaços e
// o app junta (JsonFrameAssembler).
void notifyChunked(const char* data, size_t length) {
  const uint16_t mtu = gServer->getPeerMTU(gConnHandle);
  const size_t chunk = mtu > 23 ? static_cast<size_t>(mtu - 3) : 20;
  for (size_t offset = 0; offset < length; offset += chunk) {
    const size_t n = min(chunk, length - offset);
    gTelemetry->setValue(reinterpret_cast<const uint8_t*>(data + offset), n);
    gTelemetry->notify(gConnHandle);
    delay(5);  // dá tempo da pilha esvaziar a fila entre pedaços
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  const String name = deviceName();
  Serial.printf("\n[autoos] firmware (leituras SIMULADAS) — %s\n", name.c_str());

  NimBLEDevice::init(name.c_str());
  NimBLEDevice::setMTU(kWantedMtu);

  gServer = NimBLEDevice::createServer();
  gServer->setCallbacks(new ServerCallbacks());

  NimBLEService* service = gServer->createService(AUTOOS_SERVICE_UUID);
  gTelemetry = service->createCharacteristic(AUTOOS_TELEMETRY_CHARACTERISTIC_UUID, NIMBLE_PROPERTY::NOTIFY);
  service->start();

  // UUID de 128 bits (18 bytes) + nome não cabem juntos nos 31 bytes do
  // anúncio: UUID no anúncio, nome na resposta de scan.
  NimBLEAdvertisementData advertisement;
  advertisement.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
  advertisement.addServiceUUID(AUTOOS_SERVICE_UUID);
  NimBLEAdvertisementData scanResponse;
  scanResponse.setName(name.c_str());

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->setAdvertisementData(advertisement);
  advertising->setScanResponseData(scanResponse);
  advertising->start();
  Serial.println("[ble] anunciando");
}

void loop() {
  static uint32_t lastNotify = 0;
  const uint32_t now = millis();
  if (now - lastNotify < kNotifyPeriodMs) return;
  lastNotify = now;

  if (gConnHandle == BLE_HS_CONN_HANDLE_NONE) return;  // ninguém ouvindo

  Reading reading;
  if (!gSource->read(reading)) return;

  char payload[kPayloadCapacity];
  const size_t length = serializeReading(reading, payload, sizeof payload);
  if (length == 0) {
    Serial.println("[obd] leitura fora de faixa ou grande demais; descartada");
    return;
  }
  notifyChunked(payload, length);
  Serial.printf("[ble] %s\n", payload);
}
