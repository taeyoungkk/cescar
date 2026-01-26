package com.ssafy.backend.domain.device.application;

import com.ssafy.backend.domain.device.dto.DeviceStatusRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class MqttSubscriberService {

    private final ObjectMapper objectMapper; // Spring이 기본 제공하는 JSON 변환기

    @ServiceActivator(inputChannel = "mqttInboundChannel")
    public void handleMessage(Message<?> message) {
        String payload = (String) message.getPayload();

        try {
            // REST의 @RequestBody 처럼 JSON 문자열을 객체로 변환
            DeviceStatusRequest request = objectMapper.readValue(payload, DeviceStatusRequest.class);

            String topic = (String) message.getHeaders().get("mqtt_receivedTopic");
            String robotId = topic != null ? topic.split("/")[1] : "unknown";

            log.info("----- 로봇 데이터 수신 완료 -----");
            log.info("로봇 ID: {}", robotId);
            log.info("CPU 사용량: {}%", request.getCpu_usage());
            log.info("배터리: {}%", request.getBattery() != null ? request.getBattery().getPercent() : "N/A");
            log.info("온도: {}°C", request.getTemperature());

            System.out.println("====================================");
            System.out.println("MQTT 수신 메시지 (" + robotId + "): " + payload);
            System.out.println("====================================");

            if (request.getBattery() != null && request.getBattery().getPercent() < 20) {
                log.warn("경고: {}번 로봇의 배터리가 부족합니다!", robotId);
            }

        } catch (Exception e) {
            log.error("메시지 변환 실패: {}", e.getMessage());
        }
    }
}