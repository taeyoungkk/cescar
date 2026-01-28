package com.ssafy.backend.global.config;

import com.ssafy.backend.domain.signaling.handler.BasicWebSocketHandler;
import com.ssafy.backend.domain.detection.ws.DetectionWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final BasicWebSocketHandler webrtcHandler;
    private final DetectionWebSocketHandler detectionHandler;

    public WebSocketConfig(BasicWebSocketHandler webrtcHandler, DetectionWebSocketHandler detectionHandler) {
        this.webrtcHandler = webrtcHandler;
        this.detectionHandler = detectionHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(webrtcHandler, "/ws/webrtc")
                .setAllowedOrigins("*");

        registry.addHandler(detectionHandler, "/ws/detections")
                .setAllowedOrigins("*");
    }
}