package com.ssafy.backend.domain.device.application;

import com.ssafy.backend.domain.device.dto.DeviceStatusRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class JetsonStatusService {

    private final String EMQX_API_URL = "http://localhost:18083/api/v5/clients/";
    private final ObjectMapper objectMapper;

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
    @ServiceActivator(inputChannel = "mqttInboundChannel")
    public void handleMqttMessage(Message<String> message) {
        String payload = message.getPayload();
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