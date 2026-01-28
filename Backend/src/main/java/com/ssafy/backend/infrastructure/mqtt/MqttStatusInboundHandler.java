package com.ssafy.backend.infrastructure.mqtt;

import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class MqttStatusInboundHandler {

    @ServiceActivator(inputChannel = "mqttStatusChannel")
    public void handle(Message<?> message) {
        Object payload = message.getPayload();
        log.info("[MQTT][STATUS] payload={}", payload);
    }
}
