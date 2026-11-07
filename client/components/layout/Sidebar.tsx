'use client';

import HeungkukLogo from '@/components/ui/HeungkukLogo';
import { isAdmin } from '@/lib/utils/auth';
import {
    BarChart3,
    BedDouble,
    CalendarDays,
    ClipboardCheck,
    FileText,
    LayoutDashboard,
    LucideIcon,
    Settings,
    UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import ProfileDropdown from './ProfileDropdown';
import styles from './Sidebar.module.css';

const NAV_ITEMS: { label: string; href: string; Icon: LucideIcon; adminOnly: boolean; dividerAfter?: boolean }[] = [
    { label: '대시보드', href: '/dashboard', Icon: LayoutDashboard, adminOnly: false },
    { label: '일정 현황', href: '/scheduler', Icon: CalendarDays, adminOnly: false },
    { label: '예약 관리', href: '/reservation', Icon: ClipboardCheck, adminOnly: false },
    { label: '문서 관리', href: '/document', Icon: FileText, adminOnly: true, dividerAfter: true },
    { label: '식수 관리', href: '/restaurant', Icon: UtensilsCrossed, adminOnly: false },
    { label: '숙박 현황', href: '/accommodation', Icon: BedDouble, adminOnly: false },
    { label: '설문 관리', href: '/survey', Icon: BarChart3, adminOnly: false, dividerAfter: true },
    { label: '설정', href: '/settings', Icon: Settings, adminOnly: true },
];

export default function Sidebar() {
    const pathname = usePathname();
    const admin = isAdmin();
    const [expanded, setExpanded] = useState(false);
    const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (enterTimer.current) clearTimeout(enterTimer.current);
            if (leaveTimer.current) clearTimeout(leaveTimer.current);
        },
        [],
    );

    // 마우스가 잠깐 스쳐도 열리지 않도록 약간의 지연을 둔다
    const handleEnter = () => {
        if (leaveTimer.current) {
            clearTimeout(leaveTimer.current);
            leaveTimer.current = null;
        }
        if (enterTimer.current) return;
        enterTimer.current = setTimeout(() => {
            enterTimer.current = null;
            setExpanded(true);
        }, 200);
    };

    const handleLeave = () => {
        if (enterTimer.current) {
            clearTimeout(enterTimer.current);
            enterTimer.current = null;
        }
        if (leaveTimer.current) return;
        leaveTimer.current = setTimeout(() => {
            leaveTimer.current = null;
            setExpanded(false);
        }, 120);
    };

    const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || admin);

    return (
        <aside
            className={`${styles.sidebar} ${!expanded ? styles.collapsed : ''} ${expanded ? styles.floating : ''}`}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            <div className={styles.logo}>
                <span className={styles.logoIconWrap}>
                    <HeungkukLogo size={36} />
                </span>
                <div className={styles.logoTextWrap} aria-hidden={!expanded}>
                    <div className={styles.logoName}>흥국생명연수원</div>
                    <div className={styles.logoSub}>대관 관리</div>
                </div>
            </div>

            <nav className={styles.nav} aria-label="주 메뉴">
                {visibleItems.map((item, idx) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Fragment key={item.href}>
                            <Link
                                href={item.href}
                                className={`${styles.navItem} ${active ? styles.active : ''}`}
                                aria-current={active ? 'page' : undefined}
                                aria-label={item.label}
                                title={!expanded ? item.label : undefined}
                            >
                                <item.Icon className={styles.navIcon} size={20} aria-hidden="true" />
                                <span className={styles.navLabel}>{item.label}</span>
                            </Link>
                            {item.dividerAfter && idx < visibleItems.length - 1 && <div className={styles.navDivider} />}
                        </Fragment>
                    );
                })}
            </nav>

            <ProfileDropdown collapsed={!expanded} />
        </aside>
    );
}
