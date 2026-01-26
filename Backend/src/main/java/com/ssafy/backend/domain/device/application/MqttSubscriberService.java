package com.ssafy.backend.domain.device.application;

import com.ssafy.backend.domain.device.dto.DetectionRequest;
import com.ssafy.backend.domain.device.dto.DeviceStatusRequest;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class MqttSubscriberService {

    private final ObjectMapper objectMapper; // Spring이 기본 제공하는 JSON 변환기


    // 테스트를 위한 최신 데이터 저장소 (로봇ID별)
    private static final Map<String, DeviceStatusRequest> statusCache = new ConcurrentHashMap<>();
    private static final Map<String, DetectionRequest> detectionCache = new ConcurrentHashMap<>();

    public static DeviceStatusRequest getLatestStatus(String robotId) {
        return statusCache.get(robotId);
    }

    public static DetectionRequest getLatestDetection(String robotId) {
        return detectionCache.get(robotId);
    }

    @ServiceActivator(inputChannel = "mqttInboundChannel")
    public void handleMessage(Message<?> message) {
        String payload = (String) message.getPayload();
        String topic = (String) message.getHeaders().get("mqtt_receivedTopic");

        if (topic == null)
            return;

        try {
            System.out.println("\n" + "🚀".repeat(25));
            System.out.println("📬 [MQTT INCOMING] Topic: " + topic);
            System.out.println("📦 Payload: " + payload);
            System.out.println("-".repeat(50));

            if (topic.endsWith("/status")) {
                handleStatusMessage(payload, topic);
            } else if (topic.endsWith("/detection")) {
                handleDetectionMessage(payload, topic);
            }
            System.out.println("🚀".repeat(25) + "\n");
        } catch (Exception e) {
            log.error("메시지 처리 실패: {}", e.getMessage());
        }
    }

    private void handleStatusMessage(String payload, String topic) throws Exception {
        DeviceStatusRequest request = objectMapper.readValue(payload, DeviceStatusRequest.class);
        String robotId = topic.split("/")[1];
        statusCache.put(robotId, request);

        System.out.println("📊 [STATUS UPDATE] Robot: " + robotId);
        System.out.println("   - CPU: " + request.getCpu_usage() + "%");
        System.out.println("   - Temp: " + request.getTemperature() + "°C");
        System.out.println(
                "   - Battery: " + (request.getBattery() != null ? request.getBattery().getPercent() : "N/A") + "%");

        if (request.getBattery() != null && request.getBattery().getPercent() < 20) {
            log.warn("경고: {}번 로봇의 배터리가 부족합니다!", robotId);
        }
    }

    private void handleDetectionMessage(String payload, String topic) throws Exception {
        DetectionRequest request = objectMapper.readValue(payload, DetectionRequest.class);
        String robotId = topic.split("/")[1];
        detectionCache.put(robotId, request);

        System.out.println("🚨 [DETECTION ALERT] Robot: " + robotId);
        System.out.println("   - Object: " + request.getObject_type());
        System.out.println("   - Confidence: " + (request.getConfidence() * 100) + "%");
        System.out.println("   - Note: " + request.getNote());

        log.info("[DETECTION] 로봇 ID: {}, 객체: {}, 신뢰도: {}",
                robotId, request.getObject_type(), request.getConfidence());
    }
}