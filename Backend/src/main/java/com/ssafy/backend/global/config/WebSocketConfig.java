package com.ssafy.backend.global.config;

import com.ssafy.backend.domain.signaling.handler.BasicWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final BasicWebSocketHandler handler;

    public WebSocketConfig(BasicWebSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/webrtc")
                .setAllowedOrigins("*"); // Story 1: 전부 허용
    }
}