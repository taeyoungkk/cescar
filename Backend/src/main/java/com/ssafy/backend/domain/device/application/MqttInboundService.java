package com.ssafy.backend.domain.device.application;

import com.ssafy.backend.domain.car.dao.CarRepository;
import com.ssafy.backend.domain.car.domain.Car;
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
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class MqttInboundService {

    private final String EMQX_API_URL = "http://localhost:18083/api/v5/clients/";
    private final ObjectMapper objectMapper;
    private final FcmService fcmService;
    private final CarRepository carRepository;

    @ServiceActivator(inputChannel = "mqttInboundChannel")
    public void handleDeviceStatus(Message<byte[]> message) {
        try {
            // byte[]를 String으로 변환
            String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
            // 해결 포인트: TypeReference를 정확히 명시해야 합니다.

            Map<String, Object> headerDict = new HashMap<>(message.getHeaders());
            System.out.println("header:" + headerDict.get("mqtt_receivedTopic").getClass().getName());
            String fullTopic = (String) headerDict.get("mqtt_receivedTopic");
            String[] topicParts = fullTopic.split("/");
            System.out.println(Arrays.toString(topicParts));

            String robotId = topicParts[1];
            System.out.println("robot " + robotId);

            String command = topicParts[2];
            System.out.println("command " + command);

            switch (command) {
                case "status":
                    DeviceStatusRequest statusDto = objectMapper.readValue(payload, DeviceStatusRequest.class);
                    handleRobotStatus(robotId, statusDto);
                    break;

                case "detection":
                    DetectionRequest detectionDto = objectMapper.readValue(payload, DetectionRequest.class);
                    handleRobotDetection(robotId, detectionDto);
                    break;
            }
            // 🤖 인식된 로봇: robotId
            System.out.println("🤖 인식된 로봇: " + robotId);
            System.out.println("✅ [데이터 수신] Robot: " + robotId + " | Payload: " + payload);

        } catch (Exception e) {
            // 저장하신 규칙: 잘못된 답(에러)이 나오면 알려달라고 하셨으므로 출력!
            System.err.println("❌ 에러 발생: readValue 메서드 실행 중 문제 발생 - " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleRobotStatus(String robotId, DeviceStatusRequest status) {
        System.out.println("📊 [STATUS] " + robotId + " - 배터리: " + status.getBattery().getPercent() + "%, 온도: "
                + status.getTemperature());

        // 캐시 업데이트
        statusCache.put(robotId, status);
    }

    private void handleRobotDetection(String robotId, DetectionRequest detect) {
        System.out.println("🔍 [DETECTION] " + robotId + " - 감지된 물체: " + detect.getObject_type()
                + " (신뢰도: " + detect.getConfidence() + "%)");

        detectionCache.put(robotId, detect);

        // 🎯 FCM 브로드캐스트 전송
        String title = "🚨 [" + robotId + "] 물체 감지!";
        String body = String.format("%s 물체가 %.1f%% 확률로 감지되었습니다.",
                detect.getObject_type(), detect.getConfidence());

        Car car = carRepository.findByDeviceId(robotId).orElse(null);
        if (car == null || car.getOwner() == null) {
            System.out.println("⚠️ 등록된 소유자가 없어 알림을 보내지 않았습니다. deviceId=" + robotId);
            return;
        }

        fcmService.sendToMember(car.getOwner().getId(), title, body);
        System.out.println("🚀 [FCM Alert Sent] " + title);
    }

    // 로봇 ID별 최신 상세 상태를 메모리에 저장 (캐싱)
    private final Map<String, DeviceStatusRequest> statusCache = new ConcurrentHashMap<>();
    private final Map<String, DetectionRequest> detectionCache = new ConcurrentHashMap<>();

    /**
     * EMQX API를 통해 클라이언트가 현재 네트워크에 연결되어 있는지 확인
     */
    public boolean isJetsonOnline(String clientId) {
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        // EMQX 대시보드에서 생성한 API Key/Secret
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

    /**
     * 캐시된 상세 상태 정보(CPU, GPU, 배터리 등) 가져오기
     */
    public DeviceStatusRequest getDetailedStatus(String deviceId) {
        return statusCache.get(deviceId);
    }

    public DetectionRequest getLatestDetection(String deviceId) {
        return detectionCache.get(deviceId);
    }

    /**
     * MQTT로 들어오는 실시간 상태 메시지 처리 및 캐시 업데이트
     */
    public void handleMqttMessage(Message<?> message) {
        Object rawPayload = message.getPayload();
        String payload;

        if (rawPayload instanceof byte[]) {
            payload = new String((byte[]) rawPayload, java.nio.charset.StandardCharsets.UTF_8);
        } else {
            payload = rawPayload.toString();
        }

        String topic = (String) message.getHeaders().get("mqtt_receivedTopic");

        try {
            // 토픽 구조: robot/{robotId}/status
            String robotId = (topic != null && topic.contains("/")) ? topic.split("/")[1] : "unknown";

            // JSON 파싱 후 캐시에 저장
            DeviceStatusRequest status = objectMapper.readValue(payload, DeviceStatusRequest.class);
            statusCache.put(robotId, status);

        } catch (Exception e) {
            System.err.println("MQTT 메시지 파싱 오류: " + e.getMessage());
        }
    }
}
