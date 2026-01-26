package com.ssafy.backend.domain.member.application;

import com.ssafy.backend.domain.car.dao.CarRepository;
import com.ssafy.backend.domain.member.dao.MemberRepository;
import com.ssafy.backend.domain.member.domain.Member;
import com.ssafy.backend.domain.member.dto.MemberRequest;
import com.ssafy.backend.domain.member.dto.MemberResponse;
import com.ssafy.backend.global.exception.CustomException;
import com.ssafy.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final CarRepository carRepository;

    /**
     * 🏁 1단계: 회원가입 로직
     */
    @Transactional
    public MemberResponse.MemberInfoResponse signup(MemberRequest.SignupRequest request) {
        // 이미 가입된 이메일인지 확인
        if (memberRepository.findByEmail(request.email()).isPresent()) {
            throw new CustomException(ErrorCode.ALREADY_REGISTERED_MEMBER);
        }

        Member member = Member.create(
                request.email(),
                request.password(), // 2단계에서 암호화 적용 예정
                request.name(),
                request.nickname());

        Member savedMember = memberRepository.save(member);
        return MemberResponse.MemberInfoResponse.from(savedMember);
    }

    /**
     * 🏁 1단계: 기초 로그인 (단순 비밀번호 대조)
     */
    @Transactional(readOnly = true)
    public MemberResponse.LoginResponse login(MemberRequest.LoginRequest request) {
        Member member = memberRepository.findByEmail(request.email())
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        // 암호화 전이므로 단순 비교 (2단계에서 BCrypt 적용)
        if (!member.getPassword().equals(request.password())) {
            throw new CustomException(ErrorCode.INVALID_INPUT_VALUE); // 혹은 전용 에러 코드
        }

        // 임시 토큰 발행 (3단계에서 진짜 JWT 적용)
        String mockToken = "mock-jwt-token-for-" + member.getEmail();
        return MemberResponse.LoginResponse.of(mockToken, member);
    }

    /**
     * 🏁 1단계: 내 정보 조회
     */
    @Transactional(readOnly = true)
    public MemberResponse.MemberInfoResponse getMyInfo(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));
        return MemberResponse.MemberInfoResponse.from(member);
    }

    /**
     * 🏁 1단계: 회원 정보 수정
     */
    @Transactional
    public MemberResponse.MemberInfoResponse updateMember(Long memberId, MemberRequest.UpdateMemberRequest request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        // 변경된 값만 업데이트
        member.update(request.name(), request.nickname());

        return MemberResponse.MemberInfoResponse.from(member);
    }

    /**
     * 🏁 1단계: 회원 탈퇴
     */
    @Transactional
    public void withdraw(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        // 차량 소유권 해제 로직 등 연관 관계 처리
        carRepository.findAll().stream()
                .filter(car -> car.getOwner() != null && car.getOwner().getId().equals(memberId))
                .forEach(car -> car.releaseOwner(member));

        memberRepository.delete(member);
    }
}
