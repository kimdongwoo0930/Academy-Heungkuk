# 🏨 흥국생명 연수원 관리 시스템 v2.0

> 전화로 접수된 예약을 입력·관리하는 **연수원 내부 관리 시스템**

---

## 📋 프로젝트 개요

| 항목       | 내용                        |
| ---------- | --------------------------- |
| 프로젝트명 | 흥국생명 연수원 관리 시스템 |
| 버전       | 4.0.0 Release               |
| 사용 대상  | 연수원 직원                 |

---

## 🛠️ 기술 스택

### 백엔드

| 항목      | 기술               |
| --------- | ------------------ |
| Framework | Spring Boot 3.5.11 |
| Language  | Java 21            |
| ORM       | JPA / Hibernate    |
| DB        | MySQL              |
| 인증      | JWT                |
| 빌드      | Gradle             |

### 프론트엔드

| 항목      | 기술                    |
| --------- | ----------------------- |
| Framework | Next.js 15 (App Router) |
| Language  | TypeScript              |
| 스타일    | CSS Module              |
| 상태관리  | Zustand                 |
| HTTP      | Axios                   |

### 인프라

| 항목              | 기술                     |
| ----------------- | ------------------------ |
| 서버              | Oracle Cloud ARM         |
| 컨테이너          | Docker / docker-compose  |
| 리버스 프록시     | NGINX                    |
| 로그 수집         | Promtail → Loki          |
| 메트릭 수집       | node-exporter / cAdvisor |
| 메트릭 저장       | Prometheus               |
| 모니터링 대시보드 | Grafana                  |

---

## 👥 사용자 역할 (Role)

| 역할         | 설명      | 권한                            |
| ------------ | --------- | ------------------------------- |
| `ROLE_ADMIN` | 관리자    | 모든 기능 + 계정 관리           |
| `ROLE_USER`  | 일반 직원 | 예약 조회·수정 (계정 관리 불가) |

---

## 📄 문서

| 문서      | 설명                                  | 링크                                         |
| --------- | ------------------------------------- | -------------------------------------------- |
| API 명세  | 전체 엔드포인트 및 요청/응답 구조     | [docs/API.md](docs/API.md)                   |
| 기능 명세 | 도메인별 기능 목록 및 구현 상태       | [docs/FEATURES.md](docs/FEATURES.md)         |
| 변경 이력 | 버전별 업데이트 내역                  | [CHANGELOG.md](CHANGELOG.md)                 |
| 모니터링  | 로그·메트릭 구성, 쿼리 예시, 대시보드 | [docs/Grafana-Loki.md](docs/Grafana-Loki.md) |
| 보안, 인가 구조 | 서버 보안및 인가 방식 구조 설명 | [docs/Security.md](docs/Security.md) |

---
