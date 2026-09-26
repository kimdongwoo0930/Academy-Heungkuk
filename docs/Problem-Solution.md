# Problem & Solution

## Backend

### N+1 쿼리 문제

**문제**
예약 목록 조회 시 `toResponse()` 내부에서 강의실, 객실, 식사 정보를 각각 별도의 repository로 조회하고 있었다. 예약이 N개일 때 1(목록) + N(강의실) + N(객실) + N(식사) 쿼리가 발생하는 N+1 문제가 존재했다.

**원인**
JPA Lazy Loading 방식으로 연관 엔티티를 개별 조회하는 구조였기 때문에 예약 건수에 비례하여 쿼리 수가 증가했다.

**해결 방법**
`findByReservationIn(List<Reservation> reservations)`을 사용하여 예약 목록을 한 번에 넘겨 강의실, 객실, 식사 예약을 각각 1번의 쿼리로 조회했다.

```java
List<ClassroomReservation> findByReservationIn(List<Reservation> reservations);
List<RoomReservation> findByReservationIn(List<Reservation> reservations);
List<MealReservation> findByReservationIn(List<Reservation> reservations);
```

**결과**
- 기존: 1(예약 목록) + 3N(강의실/객실/식사 개별 조회) 쿼리
- 개선: 1(예약 목록) + 3(강의실/객실/식사 각 1번) = 총 4개 쿼리로 감소
- 예약 건수에 상관없이 일정한 쿼리 수 유지
- API 응답시간: 약 1000ms 이상 → 약 376ms로 단축 (약 60% 개선)


### 로그인 실패 응답으로 계정 존재 여부가 노출되는 문제

**문제**
로그인 실패 시 없는 아이디는 `404 "존재하지 않는 계정입니다."`, 비밀번호가 틀리면 `401 "비밀번호가 올바르지 않습니다."`로 응답이 달랐다. 프론트 화면은 항상 같은 문구를 보여줬지만, F12나 curl로 응답을 보면 아무 아이디나 넣어보는 것만으로 **실제 존재하는 계정인지** 알 수 있었다 (계정 열거 공격). 공격자는 이렇게 진짜 아이디 목록을 먼저 모은 뒤 그 계정들에만 비밀번호를 대입할 수 있다.

**원인**
1. 실패 사유별로 다른 `ErrorCode`(`ACCOUNT_NOT_FOUND` / `INVALID_PASSWORD`)를 그대로 응답했다.
2. 메시지를 통일해도 **응답 시간**이 달랐다. 없는 아이디는 DB 조회 후 바로 예외를 던지고, 있는 아이디는 BCrypt 비교(의도적으로 느린 해시)를 거쳐 더 오래 걸렸다. 응답 시간만 재도 계정 존재 여부를 추측할 수 있는 구조였다.

**해결 방법**
- 두 경우 모두 `LOGIN_FAILED`(401, `"아이디 또는 비밀번호가 올바르지 않습니다."`) 하나로 통일
- 없는 아이디여도 **가짜 해시로 BCrypt 비교를 한 번 수행**해 두 경우의 처리 시간을 맞춤 (가짜 해시는 서버 시작 시 1회 생성)
- 서버 로그에는 실패 원인을 계속 구분해서 남겨 운영 시 원인 파악은 가능하게 유지

```java
// 서버가 뜰 때 한 번만 만들어 두는 비교용 가짜 해시
@PostConstruct
void initDummyPasswordHash() {
    dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
}

Account account = accountRepository.findByUserId(request.getUserId())
        .orElseThrow(() -> {
            passwordEncoder.matches(request.getPassword(), dummyPasswordHash); // 시간 맞추기
            log.warn("로그인 실패 - 존재하지 않는 계정: userId={}", request.getUserId());
            return new BusinessException(ErrorCode.LOGIN_FAILED);
        });
if (!passwordEncoder.matches(request.getPassword(), account.getPassword())) {
    log.warn("로그인 실패 - 비밀번호 불일치: userId={}", request.getUserId());
    throw new BusinessException(ErrorCode.LOGIN_FAILED);
}
```

**결과**
- 없는 아이디 / 비밀번호 틀림 → 둘 다 `401`, 같은 메시지
- 응답 시간(로컬, 5회 평균): 없는 아이디 **79ms**, 비밀번호 틀림 **79ms** → 시간 차이로도 구분 불가
- 서버 로그로는 `존재하지 않는 계정` / `비밀번호 불일치` 구분 가능


## Frontend

### Pretendard 폰트 CDN 사용으로 인한 로딩 지연

**문제**
Pretendard 폰트를 `cdn.jsdelivr.net` 외부 CDN에서 가져오는 방식으로 사용했다. 외부 네트워크 요청으로 인해 최대 750ms의 로딩 지연이 발생했으며 Lighthouse 성능 점수에도 영향을 미쳤다.

**원인**
외부 CDN 서버에 의존하는 구조로, 네트워크 상태나 CDN 서버 응답 속도에 따라 폰트 로딩 시간이 달라졌다.

**해결 방향**
- `next/font/local`을 사용하여 폰트 파일을 직접 서버에서 서빙 (self-hosting)
- 폰트 파일을 `public/fonts/`에 저장하고 Next.js가 최적화하여 제공

**결과**
- 외부 CDN 의존성 제거
- 폰트 로딩 시간 단축
- Lighthouse FCP/LCP 점수 개선
