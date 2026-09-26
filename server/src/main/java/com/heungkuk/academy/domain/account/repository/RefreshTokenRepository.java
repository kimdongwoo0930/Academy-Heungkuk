package com.heungkuk.academy.domain.account.repository;

import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.heungkuk.academy.domain.account.entity.Account;
import com.heungkuk.academy.domain.account.entity.RefreshToken;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findBySessionId(String sessionId);

    // 계정의 모든 세션 삭제 (계정 삭제 / 비밀번호·권한 변경 → 모든 기기 로그아웃)
    @Modifying
    @Query("delete from RefreshToken r where r.account = :account")
    int deleteAllByAccount(@Param("account") Account account);

    // 로그인할 때 그 계정의 만료된 세션 정리 (로그아웃 없이 버려진 기기 세션이 쌓이지 않게)
    @Modifying
    @Query("delete from RefreshToken r where r.account = :account and r.expiresAt < :now")
    int deleteExpiredByAccount(@Param("account") Account account, @Param("now") LocalDateTime now);
}
