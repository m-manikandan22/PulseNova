/*
 * PulseNova ESP32-C3 BLE Wearable Firmware
 * 
 * Hardware:
 *   - MAX30105 (PPG → HR, HRV, SpO2 proxy)
 *   - MPU6050  (Accelerometer → motion, tilt-to-wake)
 *   - SH1106   (OLED 128×64 display)
 * 
 * BLE Protocol:
 *   DATA_CHAR (Notify, 5s): {"t":UNIX,"hr":INT,"hrv":INT,"bp_sys":INT,"bp_dia":INT,"motion":FLOAT,"conf":FLOAT,"bat":INT}
 *   TIME_CHAR (Write):      {"time": UNIX_TIMESTAMP}  ← sent by app on connect
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <time.h>
#include "MAX30105.h"
#include "heartRate.h"

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
#define SDA_PIN 6
#define SCL_PIN 7
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define SERVICE_UUID   "12345678-1234-1234-1234-1234567890ab"
#define DATA_CHAR_UUID "87654321-4321-4321-4321-ba0987654321"
#define TIME_CHAR_UUID "c0ffee01-1234-1234-1234-1234567890ab"

// ─── GLOBALS ────────────────────────────────────────────────────────────────
Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
MAX30105 particleSensor;
Adafruit_MPU6050 mpu;
BLECharacteristic* pDataChar;
bool deviceConnected = false;

// Health & Power Variables
int hr = 0, hrv = 0, bp_sys = 120, bp_dia = 80, riskScore = 0, battery = 100;
float motionMag = 0.0, confidence = 1.0;
bool isDisplayOn = true, watchWasLowered = true, colonVisible = true;

// Timing
unsigned long lastSampleTime = 0, lastTransmitTime = 0, lastWakeTime = 0, lastBeatTime = 0;
uint32_t syncedTime = 0, syncedMillis = 0;

// ─── AVERAGING BUFFER ───────────────────────────────────────────────────────
struct {
    float hr_sum, hrv_sum, bp_sys_sum, bp_dia_sum, motion_sum, conf_sum;
    int count;
    void reset() { hr_sum=0; hrv_sum=0; bp_sys_sum=0; bp_dia_sum=0; motion_sum=0; conf_sum=0; count=0; }
} avgBuffer;

// ─── BLE CALLBACKS ──────────────────────────────────────────────────────────
class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* p) { deviceConnected = true; }
    void onDisconnect(BLEServer* p) { deviceConnected = false; BLEDevice::startAdvertising(); }
};

class TimeCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* p) {
        String val = p->getValue().c_str();
        StaticJsonDocument<128> doc;
        if (!deserializeJson(doc, val) && doc.containsKey("time")) {
            syncedTime = doc["time"];
            syncedMillis = millis();
            struct timeval tv = { .tv_sec = (long)syncedTime };
            settimeofday(&tv, NULL); // Sync internal RTC
        }
    }
};

// ─── SENSOR CORE ────────────────────────────────────────────────────────────
void updateSensors() {
    long ir = particleSensor.getIR();
    if (checkForBeat(ir)) {
        unsigned long delta = millis() - lastBeatTime;
        lastBeatTime = millis();
        float bpm = 60000.0 / delta;
        if (bpm > 40 && bpm < 220) { hr = (int)bpm; hrv = (int)delta; }
    }

    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    motionMag = sqrt(sq(a.acceleration.x) + sq(a.acceleration.y) + sq(a.acceleration.z));

    // Tilt-to-Wake Logic
    if (a.acceleration.y < 3.0) watchWasLowered = true;
    if (watchWasLowered && a.acceleration.y > 7.0) {
        if (!isDisplayOn) { isDisplayOn = true; lastWakeTime = millis(); watchWasLowered = false; }
    }

    // Risk & Confidence
    confidence = (ir < 50000) ? 0.0 : (motionMag > 15.0) ? 0.5 : 1.0;
    bp_sys = (hr > 0) ? 110 + (hr * 0.1) + (motionMag * 0.4) : 0;
    bp_dia = (bp_sys > 0) ? bp_sys - 40 : 0;
    riskScore = (hr > 110 && motionMag < 11.0) ? 80 : 5;
}

// ─── DISPLAY ────────────────────────────────────────────────────────────────
void drawWatch() {
    if (!isDisplayOn) return;
    display.clearDisplay();
    time_t now; struct tm timeinfo; time(&now); localtime_r(&now, &timeinfo);

    display.setTextSize(1); display.setCursor(100, 0); display.print(battery); display.print("%");
    display.setTextSize(2); display.setCursor(34, 10);
    if (timeinfo.tm_hour < 10) display.print("0");
    display.print(timeinfo.tm_hour); display.print(colonVisible ? ":" : " ");
    if (timeinfo.tm_min < 10) display.print("0");
    display.print(timeinfo.tm_min);

    display.setTextSize(1);
    long ir = particleSensor.getIR();
    display.setCursor(0, 35); display.print("HR:  "); if(ir < 50000) display.print("--"); else display.print(hr);
    display.setCursor(0, 45); display.print("HRV: "); if(ir < 50000) display.print("--"); else display.print(hrv);
    display.setCursor(0, 55); display.print("BP:  "); display.print(bp_sys); display.print("/"); display.print(bp_dia);
    display.setCursor(70, 35); display.print("MOT: "); display.print(motionMag, 1);
    display.setCursor(70, 45); display.print("RISK:"); 
    if (riskScore > 70) display.print(" HIGH"); else display.print(" LOW");

    display.drawFastHLine(0, 32, 128, SH110X_WHITE);
    display.display();
}

// ─── DATA TRANSMISSION ──────────────────────────────────────────────────────
void transmitData() {
    if (!deviceConnected || avgBuffer.count == 0) return;
    
    StaticJsonDocument<256> doc;
    doc["t"] = (syncedTime == 0) ? (millis()/1000) : (syncedTime + (millis()-syncedMillis)/1000);
    doc["hr"] = (int)(avgBuffer.hr_sum / avgBuffer.count);
    doc["hrv"] = (int)(avgBuffer.hrv_sum / avgBuffer.count);
    doc["bp_sys"] = (int)(avgBuffer.bp_sys_sum / avgBuffer.count);
    doc["bp_dia"] = (int)(avgBuffer.bp_dia_sum / avgBuffer.count);
    doc["motion"] = round((avgBuffer.motion_sum / avgBuffer.count) * 100) / 100.0;
    doc["conf"] = round((avgBuffer.conf_sum / avgBuffer.count) * 100) / 100.0;
    doc["bat"] = battery;

    char buf[256];
    size_t len = serializeJson(doc, buf);
    pDataChar->setValue((uint8_t*)buf, len);
    pDataChar->notify();
    avgBuffer.reset();
}

void setup() {
    Serial.begin(115200);
    Wire.begin(SDA_PIN, SCL_PIN);

    // BLE Setup
    BLEDevice::init("PulseNova");
    BLEServer* pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());
    BLEService* pService = pServer->createService(SERVICE_UUID);
    pDataChar = pService->createCharacteristic(DATA_CHAR_UUID, BLECharacteristic::PROPERTY_NOTIFY);
    pDataChar->addDescriptor(new BLE2902());
    BLECharacteristic* pTimeChar = pService->createCharacteristic(TIME_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
    pTimeChar->setCallbacks(new TimeCallbacks());
    pService->start();
    BLEDevice::startAdvertising();

    // Hardware Init
    display.begin(0x3C, true);
    particleSensor.begin(Wire, I2C_SPEED_FAST);
    particleSensor.setup();
    mpu.begin();
    
    avgBuffer.reset();
    lastWakeTime = millis();
}

void loop() {
    updateSensors();
    unsigned long now = millis();

    // 1s Sampling
    if (now - lastSampleTime >= 1000) {
        avgBuffer.hr_sum += hr; avgBuffer.hrv_sum += hrv; 
        avgBuffer.bp_sys_sum += bp_sys; avgBuffer.bp_dia_sum += bp_dia;
        avgBuffer.motion_sum += motionMag; avgBuffer.conf_sum += confidence;
        avgBuffer.count++;
        lastSampleTime = now;
        
        // Blink colon & Refresh screen
        if (isDisplayOn) { colonVisible = !colonVisible; drawWatch(); }
    }

    // 5s Transmit
    if (now - lastTransmitTime >= 5000) {
        transmitData();
        lastTransmitTime = now;
    }

    // Screen Timeout
    if (isDisplayOn && (now - lastWakeTime > 30000)) {
        isDisplayOn = false; display.clearDisplay(); display.display();
    }
}
