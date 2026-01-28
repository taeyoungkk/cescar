package com.ssafy.backend.domain.notification.application;

import com.google.firebase.messaging.*;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class FcmService {

    // 테스트를 위해 메모리에 토큰을 저장합니다. (실제 운영시 DB 권장)
    private final List<String> tokens = new CopyOnWriteArrayList<>();

    public void registerToken(String token) {
        if (token != null && !token.trim().isEmpty() && !tokens.contains(token)) {
            tokens.add(token);
            System.out.println("✅ FCM 토큰 등록됨: " + token);
        }
    }

    /**
     * 특정 사용자(토큰)에게 알림을 보냅니다.
     */
    public void sendMessage(String targetToken, String title, String body) {
        try {
            Message message = Message.builder()
                    .setToken(targetToken)
                    .setWebpushConfig(WebpushConfig.builder()
                            .putHeader("Urgency", "high")
                            .build())
                    .setNotification(Notification.builder().setTitle(title).setBody(body).build())
                    .build();

            String response = FirebaseMessaging.getInstance().send(message);
            System.out.println("알림 전송 성공: " + response);
        } catch (FirebaseMessagingException e) {
            System.err.println("알림 전송 실패: " + e.getMessage());
        }
    }

    /**
     * 등록된 모든 토큰으로 알림을 보냅니다. (브로드캐스트)
     */
    public void broadcastMessage(String title, String body) {
        if (tokens.isEmpty()) {
            System.out.println("ℹ️ 등록된 FCM 토큰이 없어 알림을 보내지 않았습니다.");
            return;
        }

        System.out.println("📢 " + tokens.size() + "개의 기기에 알림 전송 중...");
        for (String token : tokens) {
            sendMessage(token, title, body);
        }
    }
}