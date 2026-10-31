#include <string.h>
#include <unity.h>

#include "reading.h"
#include "simulated_source.h"

void setUp() {}
void tearDown() {}

static Reading fullReading() {
  Reading r;
  r.hasMileage = true;
  r.mileage = 84213;
  r.hasRpm = true;
  r.rpm = 2150;
  r.hasEngineTemperature = true;
  r.engineTemperature = 91;
  r.hasBatteryVoltage = true;
  r.batteryVoltage = 12.6f;
  r.dtcCount = 1;
  strcpy(r.dtcCodes[0], "P0301");
  return r;
}

// Mesmo JSON do contrato (mqtt-topics.md §1.1), sem capturedAt.
void test_serializes_the_contract_payload() {
  char out[256];
  size_t n = serializeReading(fullReading(), out, sizeof out);
  TEST_ASSERT_EQUAL_STRING(
      "{\"mileage\":84213,\"rpm\":2150,\"engineTemperature\":91,"
      "\"batteryVoltage\":12.6,\"dtcCodes\":[\"P0301\"]}",
      out);
  TEST_ASSERT_EQUAL_UINT32(strlen(out), n);
}

void test_has_no_clock_so_no_capturedAt() {
  char out[256];
  serializeReading(fullReading(), out, sizeof out);
  TEST_ASSERT_NULL(strstr(out, "capturedAt"));
}

void test_dtcCodes_is_always_present_even_empty() {
  Reading r = fullReading();
  r.dtcCount = 0;
  char out[256];
  serializeReading(r, out, sizeof out);
  TEST_ASSERT_NOT_NULL(strstr(out, "\"dtcCodes\":[]"));
}

void test_unanswered_pids_are_omitted_not_zeroed() {
  Reading r;
  r.hasMileage = true;
  r.mileage = 1000;
  char out[256];
  serializeReading(r, out, sizeof out);
  TEST_ASSERT_EQUAL_STRING("{\"mileage\":1000,\"dtcCodes\":[]}", out);
}

void test_empty_reading_is_still_valid_json() {
  Reading r;
  char out[64];
  serializeReading(r, out, sizeof out);
  TEST_ASSERT_EQUAL_STRING("{\"dtcCodes\":[]}", out);
}

void test_out_of_range_is_refused() {
  char out[256];
  Reading r = fullReading();
  r.batteryVoltage = 40.0f;
  TEST_ASSERT_EQUAL_UINT32(0, serializeReading(r, out, sizeof out));
  r = fullReading();
  r.engineTemperature = 300;
  TEST_ASSERT_EQUAL_UINT32(0, serializeReading(r, out, sizeof out));
  r = fullReading();
  r.mileage = 10000000;
  TEST_ASSERT_EQUAL_UINT32(0, serializeReading(r, out, sizeof out));
}

void test_malformed_dtc_is_refused() {
  char out[256];
  Reading r = fullReading();
  strcpy(r.dtcCodes[0], "XYZ12");
  TEST_ASSERT_EQUAL_UINT32(0, serializeReading(r, out, sizeof out));
  strcpy(r.dtcCodes[0], "p0301");  // minúscula: o app rejeita
  TEST_ASSERT_EQUAL_UINT32(0, serializeReading(r, out, sizeof out));
}

void test_too_small_buffer_is_refused_never_overflows() {
  char out[16];
  memset(out, 'x', sizeof out);
  TEST_ASSERT_EQUAL_UINT32(0, serializeReading(fullReading(), out, sizeof out));
  TEST_ASSERT_EQUAL_UINT32(0, serializeReading(fullReading(), out, 0));
}

void test_worst_case_payload_fits_the_firmware_buffer() {
  Reading r = fullReading();
  r.dtcCount = kMaxDtcCodes;
  for (uint8_t i = 0; i < kMaxDtcCodes; i++) strcpy(r.dtcCodes[i], "P0301");
  char out[256];
  size_t n = serializeReading(r, out, sizeof out);
  TEST_ASSERT_GREATER_THAN_UINT32(0, n);
  TEST_ASSERT_LESS_THAN_UINT32(256, n);
}

void test_simulator_always_produces_sendable_readings() {
  SimulatedSource source;
  char out[256];
  for (uint32_t t = 0; t < 10u * 60u * 1000u; t += 1000u) {
    Reading r;
    TEST_ASSERT_TRUE(source.readAt(t, r));
    TEST_ASSERT_TRUE(isReadingInRange(r));
    TEST_ASSERT_GREATER_THAN_UINT32(0, serializeReading(r, out, sizeof out));
  }
}

void test_simulator_alternates_fault_every_minute() {
  SimulatedSource source;
  Reading r;
  source.readAt(30 * 1000u, r);
  TEST_ASSERT_EQUAL_UINT8(0, r.dtcCount);
  source.readAt(90 * 1000u, r);
  TEST_ASSERT_EQUAL_UINT8(1, r.dtcCount);
  TEST_ASSERT_EQUAL_STRING("P0301", r.dtcCodes[0]);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_serializes_the_contract_payload);
  RUN_TEST(test_has_no_clock_so_no_capturedAt);
  RUN_TEST(test_dtcCodes_is_always_present_even_empty);
  RUN_TEST(test_unanswered_pids_are_omitted_not_zeroed);
  RUN_TEST(test_empty_reading_is_still_valid_json);
  RUN_TEST(test_out_of_range_is_refused);
  RUN_TEST(test_malformed_dtc_is_refused);
  RUN_TEST(test_too_small_buffer_is_refused_never_overflows);
  RUN_TEST(test_worst_case_payload_fits_the_firmware_buffer);
  RUN_TEST(test_simulator_always_produces_sendable_readings);
  RUN_TEST(test_simulator_alternates_fault_every_minute);
  return UNITY_END();
}
