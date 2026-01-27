package com.ssafy.backend.domain.device.application;

import com.ssafy.backend.domain.device.dto.DeviceStatusRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.core.type.TypeReference;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.springframework.data.util.TypeUtils.type;

@Service
@RequiredArgsConstructor
public class JetsonStatusService {

    private final String EMQX_API_URL = "http://localhost:18083/api/v5/clients/";
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

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
            }
            Map<String, Object> dict = objectMapper.readValue(payload, new TypeReference<Map<String, Object>>() {});

            // 꺼내 쓸 때는 (타입) 으로 형변환!
            System.out.println("🤖 인식된 로봇: " + robotId);

            String destination = "/topic/robot/" + robotId;

            // 모니터링 출력
            System.out.println("✅ [데이터 수신] Robot: " + robotId + " | Status: " + dict.get("status"));

            // 클라이언트로 전송
            messagingTemplate.convertAndSend(destination, (Object) dict);

        } catch (Exception e) {
            // 저장하신 규칙: 잘못된 답(에러)이 나오면 알려달라고 하셨으므로 출력!
            System.err.println("❌ 에러 발생: readValue 메서드 실행 중 문제 발생 - " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleRobotStatus(String robotId, DeviceStatusRequest status) {
        System.out.println("📊 [STATUS] " + robotId + " - 배터리: " + status.getBattery().getPercent() + "%, 온도: " + status.getTemperature());

    }



    // 로봇 ID별 최신 상세 상태를 메모리에 저장 (캐싱)
    private final Map<String, DeviceStatusRequest> statusCache = new ConcurrentHashMap<>();

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
            ResponseEntity<Map> response = restTemplate.exchange(
                    EMQX_API_URL + clientId, HttpMethod.GET, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                Map body = response.getBody();
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