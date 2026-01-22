package com.ssafy.backend.infrastructure.mqtt;

import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.stereotype.Component;

import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.integration.mqtt.support.MqttHeaders;

@MessagingGateway(defaultRequestChannel = "mqttOutboundChannel")
public interface MqttGateway {
    // 이 메서드를 호출하면 지정된 토픽으로 메시지가 날아갑니다.
    void sendToMqtt(String data, @Header(MqttHeaders.TOPIC) String topic);
}
