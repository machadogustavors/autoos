#include "reading.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

namespace {

// Acumula em `out` sem nunca passar de `capacity`. `ok` cai para false no
// primeiro estouro e a serialização inteira é rejeitada.
struct Writer {
  char* out;
  size_t capacity;
  size_t length = 0;
  bool ok = true;

  void append(const char* text) {
    size_t n = strlen(text);
    if (!ok || length + n + 1 > capacity) {
      ok = false;
      return;
    }
    memcpy(out + length, text, n);
    length += n;
    out[length] = '\0';
  }
};

// [PCBU][0-3][0-9A-F]{3} — mesmo padrão do app.
bool isValidDtc(const char* code) {
  if (strlen(code) != kDtcLength) return false;
  if (!strchr("PCBU", code[0])) return false;
  if (code[1] < '0' || code[1] > '3') return false;
  for (size_t i = 2; i < kDtcLength; i++) {
    if (!isxdigit(static_cast<unsigned char>(code[i])) || islower(static_cast<unsigned char>(code[i])))
      return false;
  }
  return true;
}

}  // namespace

bool isReadingInRange(const Reading& r) {
  if (r.hasMileage && r.mileage > 9999999u) return false;
  if (r.hasRpm && r.rpm > 16383u) return false;
  if (r.hasEngineTemperature && (r.engineTemperature < -40 || r.engineTemperature > 215)) return false;
  if (r.hasBatteryVoltage && (r.batteryVoltage < 0.0f || r.batteryVoltage > 32.0f)) return false;
  if (r.dtcCount > kMaxDtcCodes) return false;
  for (uint8_t i = 0; i < r.dtcCount; i++) {
    if (!isValidDtc(r.dtcCodes[i])) return false;
  }
  return true;
}

size_t serializeReading(const Reading& r, char* out, size_t capacity) {
  if (capacity == 0 || !isReadingInRange(r)) return 0;

  Writer w{out, capacity};
  out[0] = '\0';
  char number[24];

  w.append("{");
  bool first = true;
  auto field = [&](const char* name, const char* value) {
    if (!first) w.append(",");
    first = false;
    w.append("\"");
    w.append(name);
    w.append("\":");
    w.append(value);
  };

  if (r.hasMileage) {
    snprintf(number, sizeof number, "%lu", static_cast<unsigned long>(r.mileage));
    field("mileage", number);
  }
  if (r.hasRpm) {
    snprintf(number, sizeof number, "%u", static_cast<unsigned>(r.rpm));
    field("rpm", number);
  }
  if (r.hasEngineTemperature) {
    snprintf(number, sizeof number, "%d", static_cast<int>(r.engineTemperature));
    field("engineTemperature", number);
  }
  if (r.hasBatteryVoltage) {
    snprintf(number, sizeof number, "%.1f", static_cast<double>(r.batteryVoltage));
    field("batteryVoltage", number);
  }

  // Sempre presente, mesmo vazio (contrato).
  if (!first) w.append(",");
  w.append("\"dtcCodes\":[");
  for (uint8_t i = 0; i < r.dtcCount; i++) {
    if (i > 0) w.append(",");
    w.append("\"");
    w.append(r.dtcCodes[i]);
    w.append("\"");
  }
  w.append("]}");

  return w.ok ? w.length : 0;
}
