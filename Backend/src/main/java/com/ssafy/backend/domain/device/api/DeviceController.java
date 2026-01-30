package com.ssafy.backend.domain.device.api;

import com.ssafy.backend.domain.device.application.DeviceService;
import com.ssafy.backend.domain.device.application.JetsonStatusService;
import com.ssafy.backend.domain.device.application.MqttSubscriberService;
import com.ssafy.backend.domain.device.dto.DetectionRequest;
import com.ssafy.backend.domain.device.dto.DeviceStatusRequest;
import com.ssafy.backend.infrastructure.mqtt.MqttGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceService deviceService;
    private final MqttGateway mqttGateway;
    private final JetsonStatusService jetsonStatusService;

    @GetMapping("/{deviceId}/test")
    public String testMqtt(@PathVariable String deviceId, @RequestParam String msg) {
        deviceService.controlJetson(deviceId, msg);
        return "보낸 메시지: " + msg;
    }

    @PostMapping("/test/mqtt")
    public String sendTestMqtt(@RequestParam String deviceId, @RequestParam String message) {
        String topic = "robot/" + deviceId + "/command";
        mqttGateway.sendToMqtt(message, topic);
        return "MQTT 메시지 전송 시도: " + topic + " -> " + message;
    }

    @GetMapping("/{deviceId}/detection")
    public ResponseEntity<Map<String, Object>> getLatestDetection(@PathVariable String deviceId) {
        DetectionRequest latest = MqttSubscriberService.getLatestDetection(deviceId);

        Map<String, Object> response = new HashMap<>();
        response.put("deviceId", deviceId);
        response.put("latestDetection", latest != null ? latest : "No data received yet");
        response.put("timestamp", latest != null ? latest.getTimestamp() : null);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{deviceId}/status")
    public ResponseEntity<Map<String, Object>> getDeviceStatus(@PathVariable String deviceId) {
        // 1. EMQX API를 통한 단순 온라인 여부 확인
        boolean isOnline = jetsonStatusService.isJetsonOnline(deviceId);
        System.out.println("isOnline:");
        System.out.println(isOnline);
        // 2. MQTT를 통해 수집된 상세 상태 정보(CPU, GPU, 배터리 등) 가져오기
        DeviceStatusRequest details = jetsonStatusService.getDetailedStatus(deviceId);
        System.out.println(details);
        Map<String, Object> response = new HashMap<>();
        response.put("deviceId", deviceId);
        response.put("status", isOnline ? "online" : "offline");
        response.put("isOnline", isOnline);
        response.put("details", details); // 상세 정보 포함

        return ResponseEntity.ok(response);
    }
}



