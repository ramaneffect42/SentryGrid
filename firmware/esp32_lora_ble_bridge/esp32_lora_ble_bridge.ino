#include <Arduino.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <LoRa.h>

static const char *DEVICE_NAME = "SentryGrid LoRa Bridge";
static const char *SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *RX_CHARACTERISTIC_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *TX_CHARACTERISTIC_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

static const long LORA_FREQUENCY = 433E6;
static const int LORA_SS = 5;
static const int LORA_RST = 14;
static const int LORA_DIO0 = 26;
static const int LORA_SCK = 18;
static const int LORA_MISO = 19;
static const int LORA_MOSI = 23;
static const int LORA_SPREADING_FACTOR = 12;
static const long LORA_BANDWIDTH = 125E3;
static const int LORA_TX_POWER = 20;
static const byte LORA_SYNC_WORD = 0x12;

static const size_t JSON_CAPACITY = 768;
static const size_t SEEN_CACHE_SIZE = 64;
static const char *BRIDGE_NODE_ID = "esp32-lora-bridge";

BLECharacteristic *txCharacteristic = nullptr;
bool bleClientConnected = false;
String bleBuffer;
String seenPacketIds[SEEN_CACHE_SIZE];
size_t seenPacketIndex = 0;

bool hasSeenPacket(const String &packetId) {
  for (size_t index = 0; index < SEEN_CACHE_SIZE; index++) {
    if (seenPacketIds[index] == packetId) {
      return true;
    }
  }

  return false;
}

void rememberPacket(const String &packetId) {
  seenPacketIds[seenPacketIndex] = packetId;
  seenPacketIndex = (seenPacketIndex + 1) % SEEN_CACHE_SIZE;
}

void notifyPhone(const String &jsonLine) {
  if (!bleClientConnected || txCharacteristic == nullptr) {
    return;
  }

  txCharacteristic->setValue((uint8_t *)jsonLine.c_str(), jsonLine.length());
  txCharacteristic->notify();
}

void forwardPacketToPhone(JsonDocument &packet) {
  StaticJsonDocument<JSON_CAPACITY> wrapper;
  wrapper["kind"] = "mesh-packet";
  wrapper["packet"] = packet;

  String encoded;
  serializeJson(wrapper, encoded);
  encoded += "\n";
  notifyPhone(encoded);
}

void transmitPacketOverLoRa(JsonDocument &packet) {
  String packetId = packet["id"] | "";

  if (packetId.isEmpty() || hasSeenPacket(packetId)) {
    return;
  }

  rememberPacket(packetId);

  String payload;
  serializeJson(packet, payload);

  LoRa.beginPacket();
  LoRa.print(payload);
  LoRa.endPacket();
}

void relayPacketIfAllowed(JsonDocument &packet) {
  int hopCount = packet["hopCount"] | 0;
  int maxHops = packet["maxHops"] | 5;

  if (hopCount >= maxHops) {
    return;
  }

  JsonArray route = packet["route"].is<JsonArray>() ? packet["route"].as<JsonArray>() : packet.createNestedArray("route");
  bool bridgeAlreadyInRoute = false;

  for (JsonVariant item : route) {
    if (String(item.as<const char *>()) == BRIDGE_NODE_ID) {
      bridgeAlreadyInRoute = true;
      break;
    }
  }

  if (!bridgeAlreadyInRoute) {
    route.add(BRIDGE_NODE_ID);
  }

  packet["hopCount"] = hopCount + 1;
  packet["transport"] = "LoRa";

  transmitPacketOverLoRa(packet);
}

void processBridgeLine(const String &line) {
  StaticJsonDocument<JSON_CAPACITY> document;
  DeserializationError error = deserializeJson(document, line);

  if (error) {
    Serial.print("Invalid BLE JSON: ");
    Serial.println(error.c_str());
    return;
  }

  const char *kind = document["kind"] | "";
  JsonVariant packetVariant = document["packet"];

  if (strcmp(kind, "mesh-packet") == 0 && !packetVariant.isNull()) {
    StaticJsonDocument<JSON_CAPACITY> packet;
    packet.set(packetVariant);
    transmitPacketOverLoRa(packet);
    return;
  }

  if (strcmp(kind, "lora-text") == 0) {
    StaticJsonDocument<JSON_CAPACITY> packet;
    packet["id"] = String(millis()) + "-lora-text";
    packet["senderId"] = BRIDGE_NODE_ID;
    packet["eventType"] = "RELAY";
    packet["message"] = document["message"] | "";
    packet["hopCount"] = 0;
    packet["maxHops"] = 5;
    JsonArray route = packet.createNestedArray("route");
    route.add(BRIDGE_NODE_ID);
    packet["transport"] = "LoRa";
    packet["createdAt"] = "1970-01-01T00:00:00.000Z";
    JsonObject metadata = packet.createNestedObject("metadata");
    metadata["source"] = "esp32-ble-bridge";
    transmitPacketOverLoRa(packet);
  }
}

class BridgeServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    bleClientConnected = true;
    server->getAdvertising()->stop();
    Serial.println("BLE client connected");
  }

  void onDisconnect(BLEServer *server) override {
    bleClientConnected = false;
    server->startAdvertising();
    Serial.println("BLE client disconnected");
  }
};

class BridgeRxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    String chunk = String(characteristic->getValue().c_str());
    bleBuffer += chunk;

    int newlineIndex = bleBuffer.indexOf('\n');

    while (newlineIndex >= 0) {
      String line = bleBuffer.substring(0, newlineIndex);
      bleBuffer = bleBuffer.substring(newlineIndex + 1);
      line.trim();

      if (!line.isEmpty()) {
        processBridgeLine(line);
      }

      newlineIndex = bleBuffer.indexOf('\n');
    }
  }
};

void setupBleBridge() {
  BLEDevice::init(DEVICE_NAME);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new BridgeServerCallbacks());

  BLEService *service = server->createService(SERVICE_UUID);

  BLECharacteristic *rxCharacteristic = service->createCharacteristic(
    RX_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  rxCharacteristic->setCallbacks(new BridgeRxCallbacks());

  txCharacteristic = service->createCharacteristic(
    TX_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  txCharacteristic->addDescriptor(new BLE2902());

  service->start();
  server->getAdvertising()->addServiceUUID(SERVICE_UUID);
  server->startAdvertising();
}

void setupLoRaRadio() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("LoRa init failed");
    while (true) {
      delay(1000);
    }
  }

  LoRa.setSpreadingFactor(LORA_SPREADING_FACTOR);
  LoRa.setSignalBandwidth(LORA_BANDWIDTH);
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.setTxPower(LORA_TX_POWER);
  Serial.println("LoRa radio ready");
}

void handleIncomingLoRa() {
  int packetSize = LoRa.parsePacket();

  if (!packetSize) {
    return;
  }

  String payload;

  while (LoRa.available()) {
    payload += (char)LoRa.read();
  }

  StaticJsonDocument<JSON_CAPACITY> packet;
  DeserializationError error = deserializeJson(packet, payload);

  if (error) {
    Serial.print("Invalid LoRa JSON: ");
    Serial.println(error.c_str());
    return;
  }

  String packetId = packet["id"] | "";

  if (packetId.isEmpty() || hasSeenPacket(packetId)) {
    return;
  }

  rememberPacket(packetId);
  forwardPacketToPhone(packet);
  relayPacketIfAllowed(packet);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  setupLoRaRadio();
  setupBleBridge();
  Serial.println("SentryGrid ESP32 BLE LoRa bridge ready");
}

void loop() {
  handleIncomingLoRa();
  delay(10);
}
