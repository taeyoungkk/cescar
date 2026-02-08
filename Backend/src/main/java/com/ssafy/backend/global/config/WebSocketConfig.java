package com.ssafy.backend.global.config;

import com.ssafy.backend.domain.car.ws.CarStatusWebSocketHandler;
import com.ssafy.backend.domain.detection.ws.DetectionWebSocketHandler;
import com.ssafy.backend.domain.signaling.handler.BasicWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final DetectionWebSocketHandler detectionHandler;
    private final CarStatusWebSocketHandler carStatusHandler;
    private final BasicWebSocketHandler webrtcHandler;

    public WebSocketConfig(BasicWebSocketHandler webrtcHandler,
            DetectionWebSocketHandler detectionHandler,
            CarStatusWebSocketHandler carStatusHandler) {
        this.detectionHandler = detectionHandler;
        this.carStatusHandler = carStatusHandler;
        this.webrtcHandler = webrtcHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(webrtcHandler, "/ws/webrtc")
                .setAllowedOriginPatterns("*");

        registry.addHandler(detectionHandler, "/ws/detections")
                .setAllowedOriginPatterns("*");

        registry.addHandler(carStatusHandler, "/ws/car-status")
                .setAllowedOriginPatterns("*");
    }
}
