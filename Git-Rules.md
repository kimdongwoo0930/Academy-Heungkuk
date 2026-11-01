# 개발 전 


## 타입 ( 브랜치 접두사 · 커밋 타입 공통 )

| 타입 | 용도 | 예시 |
|---|---|---|
| `feat` | 새 기능 | `feat: 로그아웃 API 추가` |
| `fix` | 버그 수정 | `fix: 존재하지 않는 경로 요청 시 500 대신 404 응답` |
| `refactor` | 동작은 그대로, 구조만 변경 | `refactor: 예약 배정 로직 메서드 분리` |
| `docs` | 문서만 변경 | `docs: 보안 구조 문서(Security.md) 추가` |
| `test` | 테스트만 추가·수정 | `test: 토큰 재발급 테스트 추가` |
| `chore` | 설정·정리 등 동작에 영향 없는 것 | `chore: nginx 설정을 역할별 파일로 분리` |
| `deploy` | 배포 스크립트·절차 | `deploy: 배포 시 안 쓰는 이미지 자동 정리 범위 확대` |
| `ci` | GitHub Actions 등 CI | `ci: 이미지 빌드를 GitHub Actions 로 이관` |

- 형식 : `<타입>: <무엇을 했는지 한 줄>` ( 한글, 마침표 없음, 50자 안팎 )
- 브랜치명 : `<타입>/<작업명>` ( 예: `feature/room-drag`, `chore/image-prune` )
- 커밋 하나에는 한 가지 일만 담는다.a
- `수정`, `업데이트` 처럼 뭉뚱그리지 않는다.

## 순서

```bash
    # 하던 작업이 있을경우
    git stash -u
  
    git checkout develop
    git pull origin develop
    
    git switch -c <브랜치명>
    # 브랜치 이동 후 작업 가져오기 
    git stash pop
```

# 개발 완료

## 1. 커밋    
```bash
    # 변경 확인
    git status
    
    # 작업 단위별로 나눠서 커밋
    git add <파일명> or .
    git commit -m "<타입>: <내용>"
    
    # 왜 바꿨는지, 주의할 점이 있으면 본문으로 추가
    git commit -m "<타입>: <내용>" -m "<왜 바꿨는지, 주의할 점>"
```

## 2. 푸쉬
```bash
    git push 
```

## 3. PR 생성 · 머지 ( gh )
```bash
    # PR 생성 ( base 는 반드시 develop, main 아님 )
    gh pr create --base develop --title "<타입>: <내용>" --body "<변경 내용>"
    
    # 변경 파일 확인 후 머지 ( 머지 커밋 방식 + 로컬/원격 브랜치 같이 삭제 )
    gh pr diff
    gh pr merge --merge --delete-branch
```

- 제목은 커밋 형식과 동일하게 작성한다.
- `--delete-branch` 를 쓰면 로컬 + 원격 브랜치가 같이 지워지고, 기본 브랜치( main )로 이동된다.
- 그래서 아래 "머지 후 정리"에서 브랜치 삭제 2줄은 생략해도 된다. ( `--delete-branch` 를 안 썼을 때만 필요 )

# 머지 후 정리
```bash
    git checkout develop
    git pull origin develop
    
    # 로컬  + 원격 브랜치 제거 ( gh pr merge --delete-branch 를 썼다면 생략 )
    git branch -d <브랜치명>
    git push origin --delete <브랜치명>
    
    # 남은 정보 정리
    git fetch --prune
```
