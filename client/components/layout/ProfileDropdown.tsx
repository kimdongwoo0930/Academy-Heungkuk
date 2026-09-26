"use client";

import { updateMyPassword } from "@/lib/api/account";
import { logout } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BsBoxArrowRight, BsKey, BsPerson, BsShieldCheck } from "react-icons/bs";
import styles from "./ProfileDropdown.module.css";

interface Props {
  collapsed: boolean;
}

export default function ProfileDropdown({ collapsed }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 메모리(zustand)의 access 토큰에서 꺼낸 사용자 정보
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === "ROLE_ADMIN";

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 서버에서 이 기기 세션 삭제 + refresh 쿠키 만료 → 메모리 비우고 로그인 화면으로
  // (HttpOnly 쿠키는 JS 로 지울 수 없으므로 반드시 서버 로그아웃을 거친다. 실패해도 화면은 로그아웃 처리)
  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // 네트워크 오류 등 — 메모리 토큰은 아래에서 비움
    } finally {
      useAuthStore.getState().clear();
      router.replace("/auth/login");
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword) { setError("새 비밀번호를 입력해주세요."); return; }
    if (newPassword !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (newPassword.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }

    setLoading(true);
    try {
      await updateMyPassword(newPassword);
      setShowPasswordModal(false);
      setNewPassword("");
      setConfirm("");
      setError("");
      setOpen(false);
      // 비밀번호가 바뀌면 서버가 모든 기기의 세션을 삭제하므로, 이 기기도 바로 다시 로그인하게 한다
      alert("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
      await handleLogout();
    } catch {
      setError("비밀번호 변경에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const initials = userId ? userId.slice(0, 2).toUpperCase() : "?";

  return (
    <>
      <div className={styles.wrapper} ref={dropdownRef}>
        <button
          className={`${styles.profileBtn} ${collapsed ? styles.collapsed : ""}`}
          onClick={() => setOpen((v) => !v)}
          title={collapsed ? userId ?? "" : undefined}
        >
          <span className={styles.avatar}>{initials}</span>
          {!collapsed && (
            <span className={styles.info}>
              <span className={styles.userId}>{userId}</span>
              <span className={styles.role}>
                {isAdmin ? (
                  <><BsShieldCheck className={styles.roleIcon} /> 관리자</>
                ) : (
                  <><BsPerson className={styles.roleIcon} /> 일반</>
                )}
              </span>
            </span>
          )}
        </button>

        {open && (
          <div className={`${styles.dropdown} ${collapsed ? styles.dropdownCollapsed : ""}`}>
            <button
              className={styles.dropdownItem}
              onClick={() => { setShowPasswordModal(true); setOpen(false); }}
            >
              <BsKey className={styles.itemIcon} />
              비밀번호 변경
            </button>
            <div className={styles.divider} />
            <button className={`${styles.dropdownItem} ${styles.logout}`} onClick={handleLogout}>
              <BsBoxArrowRight className={styles.itemIcon} />
              로그아웃
            </button>
          </div>
        )}
      </div>

      {showPasswordModal && (
        <div className={styles.overlay} onClick={() => setShowPasswordModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>비밀번호 변경</h3>
            <div className={styles.modalField}>
              <label>새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                placeholder="6자 이상 입력"
                className={styles.input}
              />
            </div>
            <div className={styles.modalField}>
              <label>비밀번호 확인</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                placeholder="다시 입력"
                className={styles.input}
              />
            </div>
            {error && <p className={styles.errorMsg}>{error}</p>}
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => { setShowPasswordModal(false); setNewPassword(""); setConfirm(""); setError(""); }}
              >
                취소
              </button>
              <button className={styles.confirmBtn} onClick={handlePasswordChange} disabled={loading}>
                {loading ? "변경 중..." : "변경"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
