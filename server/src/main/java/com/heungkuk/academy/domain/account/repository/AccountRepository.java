package com.heungkuk.academy.domain.account.repository;


import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.heungkuk.academy.domain.account.entity.Account;
import com.heungkuk.academy.domain.account.entity.Role;

public interface AccountRepository extends JpaRepository<Account,Long>{
    boolean existsByUserId(String userId);
    Optional<Account> findByUserId(String userId);
    // 마지막 관리자 삭제·강등 방지용
    long countByRole(Role role);
}  
