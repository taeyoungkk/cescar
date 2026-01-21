package com.ssafy.backend.domain.signaling.handler;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class BasicWebSocketHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions =
            ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        System.out.println("[WS] CONNECTED: " + session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        System.out.println("[WS] MESSAGE from " + session.getId() + ": " + message.getPayload());

        for (WebSocketSession s : sessions) {
            if (s.isOpen() && !s.getId().equals(session.getId())) {
                s.sendMessage(message);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        System.out.println("[WS] DISCONNECTED: " + session.getId());
    }
}
