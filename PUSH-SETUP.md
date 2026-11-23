# 앱 푸시 설정

현재는 로컬 미리보기입니다. 서버 변경, 실제 발송, GitHub 배포는 하지 않았습니다.
기존 일정·예약·지출 데이터는 변경하지 않습니다. 공지와 기기별 알림 주소는 별도 표에 저장합니다.

## 1. 알림 저장소 추가
Supabase 프로젝트 → SQL Editor → New query.
`supabase/notifications.sql` 전체를 붙여넣고 Run. 기존 표 삭제나 여행 데이터 초기화는 없습니다.
완료되면 `family_notices`, `family_push_subscriptions` 두 표와 RLS 정책이 생깁니다.

## 2. 발송 키 만들기
개발 컴퓨터에서 `npx web-push generate-vapid-keys --json` 실행.
Public Key는 `push-config.js`의 publicKey에 넣습니다.
Private Key는 파일·채팅·GitHub에 넣지 않습니다. 다음 단계의 Supabase Secrets에만 넣습니다.
키는 재배포마다 바꾸지 마세요. 바꾸면 가족 기기에서 알림을 다시 등록해야 합니다.

## 3. 서버 비밀값 저장
Supabase → Edge Functions → Secrets에 다음 세 항목 등록:
- VAPID_PUBLIC_KEY: Public Key
- VAPID_PRIVATE_KEY: Private Key
- VAPID_SUBJECT: 본인 연락용 이메일을 `mailto:이메일주소` 형식으로 입력
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 서버 기본 환경값을 사용합니다. 브라우저 파일에 복사하지 않습니다.

## 4. 공지 발송 함수 만들기
Supabase → Edge Functions → 새 함수 → 이름 `send-family-notice`.
`supabase/functions/send-family-notice/index.ts` 내용으로 교체 후 Deploy.
함수 설정에서 기존 JWT gateway 검증은 끕니다. 함수 내부가 실제 로그인 토큰을 검증하고,
family_trip.owner_id와 일치하는 기존 관리자 계정만 허용합니다.
CLI를 쓰면 `supabase functions deploy send-family-notice --project-ref tneuwdqhitjcwzvqfaqc`.
`supabase/config.toml`에 해당 옵션이 있습니다.

## 5. 미리보기 확인 후 웹앱 배포
사용자 승인 후 웹앱 파일을 배포합니다. 지금은 하지 않았습니다.
알림 설정은 기기마다 따로 저장됩니다. 프로필을 바꿔도 기기의 알림 수신 설정은 유지됩니다.
아이폰은 iOS 16.4 이상에서 홈 화면에 추가한 앱을 열고 ‘앱 푸시’을 켠 뒤 허용합니다.
안드로이드는 지원 브라우저/홈 화면 앱에서 같은 버튼으로 허용합니다.
알림을 끈 기기도 알림센터 공지 이력을 조회할 수 있습니다.

## 6. 관리자 확인 및 실제 시험
🌼 관리자 프로필 → 알림센터 → 알림 발송.
최초 공용 저장소 설정 때 사용한 관리자 이메일/비밀번호로 확인합니다. 가족의 자동 연결은 유지됩니다.
가족 3명이 모두 알림을 켠 뒤, 발송 전 확인창에서 실제 시험 공지를 보냅니다.
앱이 닫힌 상태 수신과 알림 클릭 → 지정한 앱 화면 이동 (미지정 시 알림 이력)을 아이폰·안드로이드에서 각각 확인합니다.
실제 발송 시험은 아직 하지 않았습니다. 운영체제의 집중 모드·네트워크 등으로 수신이 지연될 수 있습니다.

## 동작과 한계
- 관리자 이외의 계정은 서버가 발송을 거절합니다. 관리자 프로필 선택만으로 발송할 수 없습니다.
- 이력은 최근 100건 조회, 읽음은 기기별 저장. 이력에서 실제 보인 카드는 창을 닫을 때 읽음으로 저장하고, 휴대폰 알림을 눌러 연 항목도 읽음 처리. 새 이력은 최대 30초 간격/화면 복귀 시 갱신.
- 발송 확인을 반복해도 같은 요청 ID는 한 번만 저장됩니다. 중복 요청은 푸시를 재발송하지 않습니다.
- 일부 푸시 실패 시 이력은 남으며 결과 안내가 표시됩니다. 실패한 기기만 재발송하는 기능은 아직 없습니다.
- 서비스워커는 푸시만 담당하며 앱 파일을 캐시하지 않아 재배포 업데이트를 막지 않습니다.

참고: https://supabase.com/docs/guides/functions/auth
https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

## 이동 화면 필드 추가
이미 초기 알림 SQL을 실행했다면 같은 `supabase/notifications.sql`을 다시 실행해 target 열을 추가하세요. 기존 알림과 여행 기록은 유지됩니다. 이동 화면은 정해진 앱 메뉴만 허용하며 외부 URL은 허용하지 않습니다.

## 세부 화면 연결
알림 작성에서 이동할 화면을 고른 뒤 세부 대상을 선택할 수 있습니다. 일정은 날짜 또는 개별 일정, 예약·지출·메모·장소는 개별 상세, 체크리스트는 공통 또는 현재 프로필 개인 목록을 지정합니다. 미선택 시 메뉴 첫 화면, 삭제된 대상은 해당 메뉴로 이동합니다. 기기에서 연결할 때는 공용 데이터 조회와 프로필 선택이 끝난 뒤 상세를 엽니다.
기존 알림 SQL을 실행했다면 업데이트된 notifications.sql을 다시 실행하여 target_detail 열도 추가하세요. 서버 함수도 업데이트해야 합니다. 지금은 로컬 파일만 준비했으며 실제 서버 변경은 하지 않았습니다.

## 추가 규칙: 항목 추가 자동 알림
로컬 미리보기에서는 일정·장소·지출을 직접 추가하면 알림 이력에 생성됩니다. 이 시험은 가족 서버와 분리되어 있습니다.
실제 서버에서는 새 항목 저장 시 모두의 알림센터에 기록되고, 앱 푸시가 켜진 모든 등록 기기로 보냅니다. 작성 기기도 포함합니다. 수정·삭제·메모 작성·즐겨찾기 변경은 대상이 아닙니다.

설정 순서:
1. 앞의 notifications.sql 실행 및 VAPID 키 설정을 마칩니다.
2. SQL Editor에서 supabase/automatic-notifications.sql을 실행합니다. 기존 항목은 기준값으로만 기록하므로 과거 알림을 보내지 않습니다.
3. Edge Functions Secrets에 NOTICE_WEBHOOK_SECRET을 추가합니다. 충분히 긴 무작위 비밀값을 직접 생성하고 브라우저 파일이나 GitHub에 넣지 않습니다.
4. dispatch-added-notice 함수를 같은 이름으로 만들고 supabase/functions/dispatch-added-notice/index.ts로 배포합니다. JWT gateway 검증은 끄되, 함수가 x-notice-secret으로 요청을 검증합니다.
5. Database → Webhooks → Create webhook. public.family_notices 표의 INSERT 이벤트만 선택합니다.
6. HTTPS POST 주소는 https://tneuwdqhitjcwzvqfaqc.supabase.co/functions/v1/dispatch-added-notice 입니다. 헤더 x-notice-secret에 방금 만든 동일 비밀값을 넣습니다. Content-Type은 application/json입니다.
7. 앱 배포 승인 후 기기별 앱 푸시를 켜고 일정·장소·지출을 하나씩 추가해 실제 수신을 시험합니다. 예약은 현재 신규 추가 UI가 없지만 신규 예약 데이터 저장 시 같은 규칙으로 동작합니다.

중복 방지와 한계:
- 신규 ID를 서버에서 기억하므로 동시에 저장하거나 재접속해도 같은 ID의 자동 알림은 중복 생성하지 않습니다.
- 백업 불러오기는 알림 없이 기준값만 갱신합니다.
- 웹훅이 중복 호출돼도 자동 푸시는 한 번만 발송 시도합니다. 발송 도중 서버가 중단되거나 일부 기기가 실패한 경우 자동 재시도는 아직 없으며, 알림 이력은 남습니다. 필요하면 관리자가 수동 알림을 보낼 수 있습니다.
- 알림 이력은 앱 복귀/최대 30초 주기로 갱신합니다. 휴대폰 푸시는 서버 웹훅으로 앱 실행 여부와 무관하게 발송 시도합니다.
- 아직 실제 서버 SQL·웹훅·함수 배포나 실기기 푸시 시험은 하지 않았습니다.

## 최신 자동 알림 규칙 (이전 네 종류 규칙을 대체)
- 일정: 새로운 일정이 추가되었어요 / 월 일 (요일) 장소명
- 지출: 새로운 지출내역이 등록되었어요 / 항목 • 원래 통화 금액
- 메모: 새로운 메모가 추가되었어요 / 작성자: 구성원 이름
- 장소·예약은 자동 발송에서 제외합니다.
기기별 앱 푸시가 켜져 있으면 일정·지출·메모 세부 수신 설정이 나타납니다. 기본 모두 켜짐입니다. 수신을 꺼도 알림 이력에는 남습니다. 관리자 수동 발송은 ‘공지’ 탭에 나타나며 앱 푸시 기본 스위치에 따릅니다.
자동 알림 SQL을 이미 실행했다면 업데이트 파일을 다시 실행하고 dispatch-added-notice 함수도 업데이트하세요. preferences 열은 각 기기 구독에 저장되며 서버가 발송 직전 반영합니다. 실제 서버에는 아직 적용하지 않았습니다.

## 1.6.0 운영 변경
- 90일 이전 알림은 화면 조회에서 제외. 매일 한국 시간 03:00 서버에서 알림 이력만 자동 삭제합니다. 실제 cron 작업 등록 확인 완료.
- 앱 실행/복귀 및 1분 주기로 version.json을 확인하고, 모달·입력·서버 저장 대기가 없을 때 새 문서를 엽니다. 프로필·인증·푸시 구독·서버 기록은 지우지 않습니다.
- 기기별 마지막 확인 버전을 저장하여 신규 업데이트 안내를 한 번 보여줍니다.
- 자동 업데이트 코드가 없던 이전 버전에서 이번 버전으로 처음 넘어올 때는 새 링크로 한 번 접속해야 할 수 있습니다. 이후 버전부터 자동 확인이 동작합니다.

## 1.6.3 신규 업데이트 푸시
서버 cron `family-release-notifications`가 매분 공개 version.json을 확인합니다. 기준 버전보다 높은 버전만 가족별로 한 번 알림을 생성합니다. 제목은 `신규 업데이트가 있어요 (버전)`, 본문은 `새롭게 바뀐 기능을 살펴보세요!`입니다. 신규 업데이트 알림은 기존 구독에서 기본 ON(키 미존재 시 ON)이며, 기기별 update=false면 발송에서 제외됩니다. 앱 내에서는 공지 탭에 표시하고 자세히 보기는 정보 화면으로 이동합니다.
서버 함수 dispatch-added-notice에 update 유형을 반영했고, supabase/release-notifications.sql에 등록 SQL을 보관했습니다. 새 배포 때 version.json 버전을 올리면 약 1~2분 뒤 감지합니다. 같은 버전 재배포나 버전 내림은 발송하지 않습니다.
