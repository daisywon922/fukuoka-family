// 과거 이력은 주요 기능 단위로 정리했습니다. 이후 배포는 맨 위에 상세 내용을 추가합니다.
// 실제 배포 시 예정 항목의 pending을 false로 바꾸고 배포 날짜를 확정합니다.
const APP_RELEASES=[
  {
    version:'1.4.0',date:'2026-11-20',pending:false,
    changes:[
      '개인 체크리스트에 하위 항목 추가·수정·삭제 지원. 최대 두 단계로 구성',
      '상위 체크 시 하위 항목 전체 완료·해제, 하위 완료 상태에 따라 상위 상태 자동 표시',
      '상위 그룹 및 그룹 안 하위 항목의 드래그 순서 이동',
      '개인 체크리스트 완료 수를 실제 준비할 하위 항목 기준으로 집계',
      '필수품·세안도구·화장품·옷 기본 목록 추가, 구성원 이름에 따라 전용 준비물 구분'
    ]
  },
  {
    version:'1.3.1',date:'2026-11-17',pending:false,
    changes:[
      '일정 시간을 오전·오후 / 시 / 분을 함께 고르는 휠 방식으로 변경. 새 일정은 오후 기본, 분은 10분 단위',
      '일정의 활동을 선택 입력으로 변경'
    ]
  },
  {
    version:'1.3.0',date:'2026-11-17',pending:false,
    changes:[
      '장소 메뉴 추가: 카테고리·장소명·지도 검색값·메모 등록, 수정·삭제',
      '카테고리별 장소 보기, 즐겨찾기 설정·해제 및 상단 정렬',
      '일정 장소명 입력과 저장 장소 선택 통합. 선택 시 이름·지도 검색값만 복사하며 원본 수정·삭제와 독립적으로 유지',
      '일치하는 장소가 없으면 추천 목록 숨김',
      '일정·장소 카드 제목과 설명의 글자 크기·간격 통일',
      '입력 모달의 필수 항목에 빨간 별표 표시',
      '정보 화면에 업데이트 이력 추가'
    ]
  },
  {
    version:'1.2.0',date:'2026-11-16',pending:false,
    changes:[
      '가족 초대 링크와 공용 저장소 연결',
      '일정·예약·지출·메모·체크리스트의 기기 간 공유 및 변경 자동 반영',
      '프로필별 개인 체크리스트 공유, 선택한 프로필은 기기에 기억',
      '동시 수정 병합, 연결이 끊긴 동안의 변경 보관 및 재전송'
    ]
  },
  {
    version:'1.1.0',date:'2026-11-16',pending:false,
    changes:[
      '실제 여행 준비 모드 전환, 더미 일정·지출 정리',
      '예약 현황 정리 및 여행자보험·나카스 유람선 항목 추가',
      '앱 이름과 비행기 홈 화면 아이콘 적용, 메뉴·정보 화면 정리'
    ]
  },
  {
    version:'1.0.0',date:'2026-11-13',pending:false,
    changes:[
      '가족여행 웹앱 최초 배포: 일정·예약 현황·지출 내역 제공',
      '일정 추가·수정·삭제와 구글지도 장소 검색·길찾기',
      '지출 등록·필터·통계, 원화 환산과 기준 환율 설정',
      '프로필 선택·전환, 여행 메모, 공통·개인 체크리스트',
      '모바일 화면·모달·입력 폼 개선 및 블루 테마 적용'
    ]
  }
];
(function renderReleaseHistory(){
  const latest=APP_RELEASES[0];
  $('app-version').textContent='버전 '+latest.version+(latest.pending?' · 배포 예정':' · 업데이트 '+latest.date.replaceAll('-','.'));
  const list=$('release-list');list.replaceChildren();
  APP_RELEASES.forEach(release=>{
    const article=el('article','release-entry'),heading=el('div','release-heading'),version=el('div','release-version'),title=el('h4','',release.version),date=el('time','',release.date.replaceAll('-','.'));
    version.append(title);if(release.pending)version.append(el('span','release-pending','배포 예정'));date.dateTime=release.date;heading.append(version,date);
    const changes=el('ul','release-changes');changes.setAttribute('role','list');release.changes.forEach(change=>changes.append(el('li','',change)));
    article.append(heading,changes);list.append(article);
  });
})();
