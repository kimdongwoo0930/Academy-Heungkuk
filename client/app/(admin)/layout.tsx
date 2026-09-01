'use client';

import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Toast from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import styles from './layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            router.replace('/auth/login');
        }
    }, [router]);

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
