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

            log.info("----- 로봇 데이터 수신 완료 -----");
            log.info("로봇 ID: {}", request.getId());
            log.info("배터리: {}%", request.getBattery());
            log.info("현재 상태: {}", request.getStatus());

            System.out.println("====================================");
            System.out.println("MQTT 수신 메시지: " + payload);
            System.out.println("====================================");
            // 여기서 비즈니스 로직 실행 (예: 배터리 20% 이하면 알림 생성 등)
            if (request.getBattery() < 20) {
                log.warn("경고: {}번 로봇의 배터리가 부족합니다!", request.getId());
            }

        } catch (Exception e) {
            log.error("메시지 변환 실패: {}", e.getMessage());
        }
    }
}