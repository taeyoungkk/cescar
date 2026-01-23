package com.ssafy.backend.global.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * 개발/테스트용 Mock 인증 필터
 * - 모든 요청에 대해 강제로 memberId = 1L을 주입함.
 * - 실제 배포 시에는 제거하거나 SecurityConfig에서 제외해야 함.
 */
@Component
public class MockAuthenticationFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;

        // 테스트용: 강제로 1번 유저로 로그인된 것처럼 처리
        httpRequest.setAttribute("memberId", 1L);

        chain.doFilter(request, response);
    }
}
