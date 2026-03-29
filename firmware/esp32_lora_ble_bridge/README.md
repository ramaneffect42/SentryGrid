# ESP32 BLE LoRa Bridge

This sketch turns an `ESP32 DevKit + SX1278` into a BLE UART bridge for SentryGrid.

## Arduino Libraries

Install these in Arduino IDE:

- `LoRa` by Sandeep Mistry
- `ArduinoJson` by Benoit Blanchon
- `ESP32 BLE Arduino`

## Radio Settings

- Frequency: `433 MHz`
- Spreading Factor: `SF12`
- Bandwidth: `125 kHz`
- TX Power: `20 dBm`
- Sync Word: `0x12`

## Wiring

- `VCC -> 3.3V`
- `GND -> GND`
- `SCK -> GPIO18`
- `MISO -> GPIO19`
- `MOSI -> GPIO23`
- `NSS -> GPIO5`
- `RESET -> GPIO14`
- `DIO0 -> GPIO26`

## BLE UART UUIDs

- Service: `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
- RX: `6E400002-B5A3-F393-E0A9-E50E24DCCA9E`
- TX: `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`

The React Native app scans for this service and connects to devices named like `SentryGrid LoRa Bridge` or `ESP32`.
