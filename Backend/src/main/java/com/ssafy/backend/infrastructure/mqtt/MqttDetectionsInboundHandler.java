package com.ssafy.backend.infrastructure.mqtt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.domain.detection.ws.DetectionWsBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttDetectionsInboundHandler {

    private final ObjectMapper objectMapper;
    private final DetectionWsBroadcaster broadcaster;

    @ServiceActivator(inputChannel = "mqttDetectionsChannel")
    public void handle(Message<?> message) {
        try {
            Object payloadObj = message.getPayload();
            String payload;
            if (payloadObj instanceof byte[] bytes) {
                payload = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
            } else {
                payload = String.valueOf(payloadObj);
            }

            // 토픽 로깅 (디버깅용)
            String topic = (String) message.getHeaders().getOrDefault("mqtt_receivedTopic", "unknown");

            JsonNode root = objectMapper.readTree(payload);

            String roomId = root.path("roomId").asText(null);
            if (roomId == null || roomId.isBlank()) {
                log.warn("[MQTT][DETECTIONS] roomId missing. topic={}, payload={}", topic, payload);
                return;
            }

            broadcaster.broadcastToRoom(roomId, payload);
        } catch (Exception e) {
            log.error("[MQTT][DETECTIONS] parse/broadcast failed", e);
        }
    }
}
