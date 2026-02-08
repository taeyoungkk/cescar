package com.ssafy.backend.domain.notification.application;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.WebpushFcmOptions;
import com.google.firebase.messaging.WebpushConfig;
import com.ssafy.backend.domain.member.dao.MemberRepository;
import com.ssafy.backend.domain.member.domain.Member;
import com.ssafy.backend.domain.notification.dao.NotificationTokenRepository;
import com.ssafy.backend.domain.notification.domain.NotificationToken;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FcmService {
    private final NotificationTokenRepository notificationTokenRepository;
    private final MemberRepository memberRepository;
    private final TransactionTemplate transactionTemplate;


    @Transactional
    public void registerToken(Long memberId, String token) {
        if (memberId == null) {
            throw new IllegalArgumentException("Member authentication is required.");
        }
        if (token == null || token.trim().isEmpty()) {
            return;
        }

        NotificationToken existing = notificationTokenRepository.findByToken(token).orElse(null);

        if (existing != null) {
            if (!existing.getMember().getId().equals(memberId)) {
                Member member = memberRepository.findById(memberId)
                        .orElseThrow(() -> new IllegalArgumentException("Member not found."));
                existing.changeMember(member);
                notificationTokenRepository.save(existing);
            }
            return;
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found."));
        try {
            notificationTokenRepository.save(NotificationToken.create(token, member));
            System.out.println("[FCM] token registered: " + token);
        } catch (DataIntegrityViolationException e) {
            // Possible race condition: another request inserted the same token.
            System.out.println("[FCM] duplicate token ignored: " + token);
        }
    }


    @Transactional
    public void removeToken(Long memberId, String token) {
        if (memberId == null) {
            throw new IllegalArgumentException("Member authentication is required.");
        }
        if (token == null || token.trim().isEmpty()) {
            return;
        }

        int deleted = notificationTokenRepository.deleteByMemberIdAndToken(memberId, token);

        if (deleted > 0) {
            System.out.println("[FCM] token deleted: " + token);
        } else {
            System.out.println("[FCM] token not found (memberId=" + memberId + ")");
        }
    }


    public void sendMessage(String targetToken, String title, String body) {
        sendMessage(targetToken, title, body, null);
    }

    public void sendMessage(String targetToken, String title, String body, String detectionId) {
        try {
            String link = (detectionId != null && !detectionId.isBlank())
                    ? "/dashboard?detectionId=" + detectionId
                    : "/dashboard";
            String safeTitle = title != null ? title : "";
            String safeBody = body != null ? body : "";
            System.out.println("[FCM] payload token=" + tokenTag(targetToken)
                    + " title=" + safeTitle
                    + " body=" + safeBody
                    + " detectionId=" + (detectionId != null ? detectionId : ""));
            Message message = Message.builder()
                    .setToken(targetToken)
                    .setWebpushConfig(WebpushConfig.builder()
                            .putHeader("Urgency", "high")
                            .setFcmOptions(WebpushFcmOptions.withLink(link))
                            .build())
                    .setNotification(Notification.builder().setTitle(safeTitle).setBody(safeBody).build())
                    .putData("title", safeTitle)
                    .putData("body", safeBody)
                    .putData("detectionId", detectionId != null ? detectionId : "")
                    .build();

            String response = FirebaseMessaging.getInstance().send(message);

            System.out.println("[FCM] send success: " + response);
        } catch (FirebaseMessagingException e) {
            System.err.println("[FCM] send failed: " + e.getMessage());

            MessagingErrorCode errorCode = e.getMessagingErrorCode();

            if (errorCode == MessagingErrorCode.UNREGISTERED || errorCode == MessagingErrorCode.INVALID_ARGUMENT) {
                transactionTemplate.executeWithoutResult(status -> {
                    int deleted = notificationTokenRepository.deleteByToken(targetToken);

                    if (deleted > 0) {
                        System.out.println("[FCM] invalid token removed: " + targetToken);
                    }
                });
            }
        }
    }

    public void sendToMember(Long memberId, String title, String body) {
        sendToMember(memberId, title, body, null);
    }

    public void sendToMember(Long memberId, String title, String body, Long detectionId) {
        List<NotificationToken> tokens = notificationTokenRepository.findAllByMemberId(memberId);

        if (tokens.isEmpty()) {
            System.out.println("[FCM] no tokens for member.");
            return;
        }

        System.out.println("[FCM] send to member start memberId=" + memberId + " tokenCount=" + tokens.size());
        String detectionIdText = detectionId != null ? String.valueOf(detectionId) : null;
        for (NotificationToken token : tokens) {
            sendMessage(token.getToken(), title, body, detectionIdText);
        }
    }

    public void broadcastMessage(String title, String body) {
        List<NotificationToken> tokens = notificationTokenRepository.findAll();

        if (tokens.isEmpty()) {
            System.out.println("[FCM] no tokens for broadcast.");
            return;
        }

        System.out.println("[FCM] broadcasting to " + tokens.size() + " tokens.");

        for (NotificationToken token : tokens) {
            sendMessage(token.getToken(), title, body);
        }
    }

    private String tokenTag(String token) {
        if (token == null || token.isBlank()) {
            return "empty";
        }
        int len = token.length();
        String suffix = token.substring(Math.max(0, len - 8));
        return "..." + suffix;
    }
}
