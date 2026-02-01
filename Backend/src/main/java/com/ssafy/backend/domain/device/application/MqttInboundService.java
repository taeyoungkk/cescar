package com.ssafy.backend.domain.device.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.domain.car.dao.CarRepository;
import com.ssafy.backend.domain.car.domain.Car;
import com.ssafy.backend.domain.detection.ws.DetectionWsBroadcaster;
import com.ssafy.backend.domain.device.dto.DetectionRequest;
import com.ssafy.backend.domain.device.dto.DeviceStatusRequest;
import com.ssafy.backend.domain.notification.application.FcmService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class MqttInboundService {

    private static final String EMQX_API_URL = "http://localhost:18083/api/v5/clients/";
    private final ObjectMapper objectMapper;
    private final FcmService fcmService;
    private final CarRepository carRepository;
    private final DetectionWsBroadcaster detectionWsBroadcaster;

    // 로봇 ID별 최신 상태/탐지 캐시
    private final Map<String, DeviceStatusRequest> statusCache = new ConcurrentHashMap<>();
    private final Map<String, DetectionRequest> detectionCache = new ConcurrentHashMap<>();

    @ServiceActivator(inputChannel = "mqttInboundChannel")
    public void handleDeviceStatus(Message<byte[]> message) {
        try {
            // MQTT payload → String 변환
            String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
            Map<String, Object> headerDict = new HashMap<>(message.getHeaders());
            String fullTopic = (String) headerDict.get("mqtt_receivedTopic");

            if (fullTopic == null) {
                // 토픽이 없으면 처리 불가
                System.out.println("MQTT topic missing");
                return;
            }

            String[] topicParts = fullTopic.split("/");
            if (topicParts.length < 3) {
                // robot/{robotId}/{command} 형식만 허용
                System.out.println("Invalid MQTT topic: " + fullTopic);
                return;
            }

            String robotId = topicParts[1];
            String command = topicParts[2];

            switch (command) {
                case "status":
                    // 상태 메시지 처리
                    DeviceStatusRequest statusDto = objectMapper.readValue(payload, DeviceStatusRequest.class);
                    handleRobotStatus(robotId, statusDto);
                    break;
                case "detection":
                    // 탐지 메시지 처리
                    DetectionRequest detectionDto = objectMapper.readValue(payload, DetectionRequest.class);
                    handleRobotDetection(robotId, detectionDto, payload, fullTopic);
                    break;
                default:
                    // 알 수 없는 command는 로그만 남김
                    System.out.println("Unknown command: " + command + " (topic=" + fullTopic + ")");
                    break;
            }

            System.out.println("[MQTT] Robot: " + robotId + " | Payload: " + payload);
        } catch (Exception e) {
            System.err.println("MQTT parse error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleRobotStatus(String robotId, DeviceStatusRequest status) {
        Integer battery = status.getBattery() != null ? status.getBattery().getPercent() : null;
        System.out.println("[STATUS] " + robotId + " - battery=" + battery + "%, temp=" + status.getTemperature());
        // 최신 상태 캐시
        statusCache.put(robotId, status);
    }

    private void handleRobotDetection(String robotId, DetectionRequest detect, String payload, String topic) {
        System.out.println("[DETECTION] " + robotId + " - object=" + detect.getObject_type()
                + " (confidence=" + detect.getConfidence() + ")");

        // 최신 탐지 캐시
        detectionCache.put(robotId, detect);
        // 탐지 데이터는 WS로 브로드캐스트
        broadcastDetection(payload, topic, robotId);

        // 탐지 시 FCM 알림 전송
        String title = "[" + robotId + "] Detection";
        String body = String.format("%s detected (%.1f%%)", detect.getObject_type(), detect.getConfidence());

        Car car = carRepository.findByDeviceId(robotId).orElse(null);
        if (car == null || car.getOwner() == null) {
            // 소유자 없으면 알림 스킵
            System.out.println("No owner for deviceId=" + robotId + ", skip FCM");
            return;
        }

        fcmService.sendToMember(car.getOwner().getId(), title, body);
        System.out.println("[FCM] Sent: " + title);
    }

    private void broadcastDetection(String payload, String topic, String robotId) {
        try {
            // roomId 결정 우선순위: payload.roomId → payload.robotId/robot_id → robotId → topic
            JsonNode root = objectMapper.readTree(payload);
            String roomId = root.path("roomId").asText(null);

            if (roomId == null || roomId.isBlank()) {
                roomId = root.path("robotId").asText(null);
            }
            if (roomId == null || roomId.isBlank()) {
                roomId = root.path("robot_id").asText(null);
            }
            if ((roomId == null || roomId.isBlank()) && robotId != null && !robotId.isBlank()) {
                roomId = robotId;
            }
            if ((roomId == null || roomId.isBlank()) && topic != null) {
                String[] parts = topic.split("/");
                if (parts.length >= 2) {
                    roomId = parts[1];
                }
            }

            if (roomId != null && !roomId.isBlank()) {
                // WS 방으로 브로드캐스트
                detectionWsBroadcaster.broadcastToRoom(roomId, payload);
            } else {
                System.out.println("[MQTT][detection] roomId missing. topic=" + topic);
            }
        } catch (Exception e) {
            System.err.println("Failed to parse detection payload for WS broadcast: " + e.getMessage());
        }
    }

    // EMQX API로 현재 MQTT 클라이언트 연결 여부 확인
    public boolean isJetsonOnline(String clientId) {
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth("bdad3b84eb0fec45", "BlodPLv9BiKEPkJrImPhYzlgwc0I8tgDPBoxHa0sczIF");
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    EMQX_API_URL + clientId, HttpMethod.GET, entity,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (response.getStatusCode().is2xxSuccessful()) {
                Map<String, Object> body = response.getBody();
                return body != null && (boolean) body.get("connected");
            }
        } catch (HttpClientErrorException.NotFound e) {
            return false;
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    // 최신 상태/탐지 조회용 (캐시 기반)
    public DeviceStatusRequest getDetailedStatus(String deviceId) {
        return statusCache.get(deviceId);
    }

    public DetectionRequest getLatestDetection(String deviceId) {
        return detectionCache.get(deviceId);
    }

    // (참고) status 전용 처리 메서드: 외부에서 직접 호출하는 경우를 대비
    public void handleMqttMessage(Message<?> message) {
        Object rawPayload = message.getPayload();
        String payload;

        if (rawPayload instanceof byte[]) {
            payload = new String((byte[]) rawPayload, StandardCharsets.UTF_8);
        } else {
            payload = rawPayload.toString();
        }

        String topic = (String) message.getHeaders().get("mqtt_receivedTopic");

        try {
            String robotId = (topic != null && topic.contains("/")) ? topic.split("/")[1] : "unknown";
            DeviceStatusRequest status = objectMapper.readValue(payload, DeviceStatusRequest.class);
            statusCache.put(robotId, status);
        } catch (Exception e) {
            System.err.println("MQTT status parse error: " + e.getMessage());
        }
    }
}
