package com.ssafy.backend.domain.signaling.handler;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class BasicWebSocketHandler extends TextWebSocketHandler {

    // sessionId -> roomId
    private final ConcurrentHashMap<String, String> sessionRoom = new ConcurrentHashMap<>();

    // roomId -> sessions
    private final ConcurrentHashMap<String, CopyOnWriteArraySet<WebSocketSession>> rooms =
            new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        System.out.println("[WS] CONNECTED: " + session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        // join 처리
        if (payload.contains("\"type\":\"join\"")) {
            String roomId = extract("roomId", payload);
            if (roomId == null || roomId.isBlank()) return;

            sessionRoom.put(session.getId(), roomId);
            rooms.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>())
                    .add(session);

            System.out.println("[WS] JOIN " + session.getId() + " -> " + roomId);
            return;
        }

        // join 안 한 세션 차단
        String roomId = sessionRoom.get(session.getId());
        if (roomId == null) {
            System.out.println("[WS] IGNORE (no room): " + session.getId());
            return;
        }

        // 같은 room에만 릴레이
        for (WebSocketSession peer : rooms.get(roomId)) {
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

    //MVP용 단순 파서
    private String extract(String key, String json) {
        int idx = json.indexOf("\"" + key + "\"");
        if (idx < 0) return null;
        int colon = json.indexOf(":", idx);
        int q1 = json.indexOf("\"", colon);
        int q2 = json.indexOf("\"", q1 + 1);
        return (q1 < 0 || q2 < 0) ? null : json.substring(q1 + 1, q2);
    }
}
