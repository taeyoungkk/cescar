package com.ssafy.backend.domain.detection.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Slf4j
@Component
@RequiredArgsConstructor // Lombok 생성자 주입
public class DetectionWebSocketHandler extends TextWebSocketHandler implements DetectionWsBroadcaster {

    private final ObjectMapper objectMapper;

    // Session ID -> Room ID
    private final Map<String, String> sessionRoom = new ConcurrentHashMap<>();
    // Room ID -> Set<WebSocketSession>
    private final Map<String, CopyOnWriteArraySet<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // 연결 직후에는 아직 Room 정보를 무르는 상태
        log.info("[WS][DETECTION] Connected: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        // 간단한 프로토콜: {"type": "join", "roomId": "..."}
        try {
            var node = objectMapper.readTree(payload);
            String type = node.path("type").asText();
            String roomId = node.path("roomId").asText();

            if ("join".equals(type) && roomId != null && !roomId.isBlank()) {
                sessionRoom.put(session.getId(), roomId);
                rooms.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);
                log.info("[WS][DETECTION] Session {} joined room {}", session.getId(), roomId);
            }
        } catch (Exception e) {
            log.warn("[WS][DETECTION] Invalid message from {}: {}", session.getId(), payload);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String roomId = sessionRoom.remove(session.getId());
        if (roomId != null) {
            var sessions = rooms.get(roomId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    rooms.remove(roomId);
                }
            }
        }
        log.info("[WS][DETECTION] Disconnected: {}", session.getId());
    }

    // DetectionWsBroadcaster 구현
    @Override
    public void broadcastToRoom(String roomId, String jsonPayload) {
        var sessions = rooms.get(roomId);
        if (sessions == null || sessions.isEmpty()) {
            // 해당 room에 보고 있는 사람이 없으면 패스
            return;
        }

        TextMessage message = new TextMessage(jsonPayload);
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(message);
                } catch (IOException e) {
                    log.error("[WS][DETECTION] Failed to send to session {}", session.getId(), e);
                }
            }
        }
    }
}
