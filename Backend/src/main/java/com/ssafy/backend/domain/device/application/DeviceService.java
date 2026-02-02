package com.ssafy.backend.domain.device.application;

import com.ssafy.backend.infrastructure.mqtt.MqttGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeviceService {

    private final MqttGateway mqttGateway;
    private final MqttInboundService mqttInboundService;

    public void controlJetson(String deviceId, String command) {
        // 1. Jetson 온라인 상태 확인
        if (!mqttInboundService.isJetsonOnline(deviceId)) {
            throw new RuntimeException("Device " + deviceId + " is offline.");
        }

        // 2. 기존 로직 (토픽 생성 및 MQTT 메시지 발송)
        String topic = "robot/" + deviceId + "/command";
        mqttGateway.sendToMqtt(command, topic);

        System.out.println("MQTT 전송 완료: " + topic + " -> " + command);
    }
}
