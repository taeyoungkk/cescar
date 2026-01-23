package com.ssafy.backend.domain.device.api;

import com.ssafy.backend.domain.device.application.DeviceService;
import com.ssafy.backend.domain.device.application.JetsonStatusService;
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
    public String testMqtt(@RequestParam String message) {
        mqttGateway.sendToMqtt(message, "jetson/command");

        return "MQTT 메시지 전송 시도: " + message;
    }

    @GetMapping("/{deviceId}/status")
    public ResponseEntity<Map<String, Object>> getDeviceStatus(@PathVariable String deviceId) {
        boolean isOnline = jetsonStatusService.isJetsonOnline(deviceId);

        Map<String, Object> response = new HashMap<>();
        response.put("deviceId", deviceId);
        response.put("status", isOnline ? "online" : "offline");
        response.put("isOnline", isOnline); // 프론트에서 조건문 쓰기 편하게 boolean도 포함

        return ResponseEntity.ok(response);
    }
}
