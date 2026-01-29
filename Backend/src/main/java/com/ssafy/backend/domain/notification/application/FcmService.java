package com.ssafy.backend.domain.notification.application;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.WebpushConfig;
import com.ssafy.backend.domain.member.dao.MemberRepository;
import com.ssafy.backend.domain.member.domain.Member;
import com.ssafy.backend.domain.notification.dao.NotificationTokenRepository;
import com.ssafy.backend.domain.notification.domain.NotificationToken;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FcmService {

    private final NotificationTokenRepository notificationTokenRepository;
    private final MemberRepository memberRepository;

    // 회원별 FCM 토큰을 DB에 저장합니다.
    public void registerToken(Long memberId, String token) {
        if (memberId == null) {
            throw new IllegalArgumentException("회원 인증 정보가 없습니다.");
        }
        if (token == null || token.trim().isEmpty()) {
            return;
        }

        NotificationToken existing = notificationTokenRepository.findByToken(token).orElse(null);
        if (existing != null) {
            if (!existing.getMember().getId().equals(memberId)) {
                Member member = memberRepository.findById(memberId)
                        .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
                existing.changeMember(member);
                notificationTokenRepository.save(existing);
            }
            return;
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        notificationTokenRepository.save(NotificationToken.create(token, member));
        System.out.println("✅ FCM 토큰 등록됨: " + token);
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

    public void sendToMember(Long memberId, String title, String body) {
        List<NotificationToken> tokens = notificationTokenRepository.findAllByMemberId(memberId);
        if (tokens.isEmpty()) {
            System.out.println("ℹ️ 등록된 FCM 토큰이 없어 알림을 보내지 않았습니다.");
            return;
        }

        System.out.println("[FCM] sendToMember memberId=" + memberId
                + " tokenCount=" + tokens.size());

        for (NotificationToken token : tokens) {
            sendMessage(token.getToken(), title, body);
        }
    }

    /**
     * 등록된 모든 토큰으로 알림을 보냅니다. (브로드캐스트)
     */
    public void broadcastMessage(String title, String body) {
        List<NotificationToken> tokens = notificationTokenRepository.findAll();
        if (tokens.isEmpty()) {
            System.out.println("ℹ️ 등록된 FCM 토큰이 없어 알림을 보내지 않았습니다.");
            return;
        }

        System.out.println("📢 " + tokens.size() + "개의 기기에 알림 전송 중...");
        for (NotificationToken token : tokens) {
            sendMessage(token.getToken(), title, body);
        }
    }

}
