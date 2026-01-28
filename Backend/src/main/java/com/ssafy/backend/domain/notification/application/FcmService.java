package com.ssafy.backend.domain.notification.application;

import com.google.firebase.messaging.*;
import org.springframework.stereotype.Service;

@Service
public class FcmService {

    /**
     * 특정 사용자(토큰)에게 알림을 보냅니다.
     * 
     * @param targetToken 클라이언트로부터 받은 FCM 토큰
     * @param title       알림 제목
     * @param body        알림 내용
     */
    public void sendMessage(String targetToken, String title, String body) {
        try {
            Message message = Message.builder()
                    .setToken(targetToken)
                    .setWebpushConfig(WebpushConfig.builder()
                            .putHeader("Urgency", "high") // 우선순위 높임
                            .build())
                    .setNotification(Notification.builder().setTitle(title).setBody(body).build())
                    .build();

            String response = FirebaseMessaging.getInstance().send(message);
            System.out.println("알림 전송 성공: " + response);
        } catch (FirebaseMessagingException e) {
            System.err.println("알림 전송 실패: " + e.getMessage());
            // 프로젝트 로그 전략에 따라 Logger를 사용하세요.
        }
    }
}