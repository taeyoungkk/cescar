package com.ssafy.backend.domain.signaling.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.domain.signaling.dto.SignalMessage;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class BasicWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final ConcurrentHashMap<String, String> sessionRoom = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CopyOnWriteArraySet<WebSocketSession>> rooms =
            new ConcurrentHashMap<>();

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {

        SignalMessage signal = objectMapper.readValue(message.getPayload(), SignalMessage.class);

        String type = signal.getType();
        String roomId = signal.getRoomId();

        // 0) type 없으면 무시
        if (type == null || type.isBlank()) {
            System.out.println("[WS] IGNORE (missing type)");
            return;
        }

        // 1) join 처리
        if ("join".equals(type)) {
            if (roomId == null || roomId.isBlank()) {
                System.out.println("[WS] IGNORE join (missing roomId)");
                return;
            }

            sessionRoom.put(session.getId(), roomId);
            rooms.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);

            System.out.println("[WS] JOIN " + session.getId() + " -> " + roomId);
            return;
        }

        // 2) join 안 한 세션 차단
        String joinedRoom = sessionRoom.get(session.getId());
        if (joinedRoom == null) {
            System.out.println("[WS] IGNORE (not joined)");
            return;
        }

        // 3) 메시지에 roomId가 없으면 joinedRoom로 보정(클라이언트 실수 방지)
        if (roomId == null || roomId.isBlank()) {
            roomId = joinedRoom;
        }

        // 4) join한 room이랑 다르면 차단
        if (!joinedRoom.equals(roomId)) {
            System.out.println("[WS] IGNORE (room mismatch) joined=" + joinedRoom + " msg=" + roomId);
            return;
        }

        // 5) 같은 room에만 릴레이
        CopyOnWriteArraySet<WebSocketSession> peers = rooms.get(roomId);
        if (peers == null || peers.isEmpty()) {
            System.out.println("[WS] IGNORE (room empty): " + roomId);
            return;
        }

        for (WebSocketSession peer : peers) {
            if (peer.isOpen() && !peer.getId().equals(session.getId())) {
                peer.sendMessage(message);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = sessionRoom.remove(session.getId());

        if (roomId != null) {
            var set = rooms.get(roomId);
            if (set != null) {
                set.remove(session);
                if (set.isEmpty()) {
                    rooms.remove(roomId);
                }
            }
        }

        System.out.println("[WS] DISCONNECTED: " + session.getId());
    }
}
