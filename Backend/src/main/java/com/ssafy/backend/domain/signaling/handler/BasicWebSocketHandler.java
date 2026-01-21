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

        SignalMessage signal =
                objectMapper.readValue(message.getPayload(), SignalMessage.class);

        String type = signal.getType();
        String roomId = signal.getRoomId();

        // 1️⃣ join 처리
        if ("join".equals(type)) {
            sessionRoom.put(session.getId(), roomId);
            rooms.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>())
                    .add(session);

            System.out.println("[WS] JOIN " + session.getId() + " -> " + roomId);
            return;
        }

        // 2️⃣ join 안 한 세션 차단
        if (!roomId.equals(sessionRoom.get(session.getId()))) {
            System.out.println("[WS] IGNORE (not in room)");
            return;
        }

        // 3️⃣ 같은 room에만 릴레이
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
}
