'use client';

import HeungkukLogo from '@/components/ui/HeungkukLogo';
import { login } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import styles from './page.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await login({ userId, password });
            // access 토큰은 메모리에만 저장 (refresh 토큰은 서버가 HttpOnly 쿠키로 설정)
            useAuthStore.getState().setAccessToken(res.accessToken);
            router.push('/dashboard');
        } catch {
            setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.logo}>
                    <HeungkukLogo size={48} />
                    <p className={styles.logoTitle}>흥국생명 연수원</p>
                    <p className={styles.logoSub}>관리자 시스템</p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.field}>
                        <label className={styles.label}>아이디</label>
                        <input
                            className={styles.input}
                            type="text"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="아이디를 입력하세요"
                            required
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>비밀번호</label>
                        <input
                            className={styles.input}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="비밀번호를 입력하세요"
                            required
                        />
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    <button className={styles.submitBtn} type="submit" disabled={loading}>
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                </form>
            </div>
        </div>
    );
}
