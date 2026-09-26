'use client';

import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Toast from '@/components/ui/Toast';
import { refreshAccessToken } from '@/lib/api/instance';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    // 로그인 직후(클라이언트 이동)엔 메모리에 토큰이 이미 있음 → 바로 렌더링
    const [ready, setReady] = useState(() => useAuthStore.getState().accessToken !== null);

    useEffect(() => {
        if (useAuthStore.getState().accessToken) {
            setReady(true);
            return;
        }
        // 새로고침/새 탭: 메모리 토큰이 없으므로 refresh 쿠키로 access 토큰을 다시 받아온다
        let cancelled = false;
        refreshAccessToken().then((token) => {
            if (cancelled) return;
            if (token) {
                setReady(true);
            } else {
                router.replace('/auth/login');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [router]);

    // 토큰 준비 전에는 렌더링하지 않음 — 하위 화면(AdminGuard, isAdmin 등)이 빈 토큰으로 판단하지 않도록
    if (!ready) return null;

    return (
        <>
            <Sidebar />
            <Header collapsed />
            <main className={`${styles.main} ${styles.mainCollapsed}`}>
                <div className={styles.content}>{children}</div>
            </main>
            <Toast />
        </>
    );
}
