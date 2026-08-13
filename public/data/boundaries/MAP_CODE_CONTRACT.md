# 지도 지역 코드와 좌표 검증 계약

지도 탐색은 이름 정규식으로 지역 소속을 추정하지 않는다. `sidoCode`와 `sigunguCode`는 Kakao 지역 코드 앞 2자리와 5자리, `adminDongCode`는 `coord2regioncode`의 `h_code`, `legalDongCode`는 `b_code`, `boundaryAdminCode`는 SGIS 행정동 feature 코드다.

`boundaryAdminCode`는 Kakao `h_code`와 코드 체계가 다르므로 서로 대체하지 않는다. 화면 선택 데이터는 표시명과 함께 가능한 코드를 API에 전달한다. 이름은 NFC 정규화 후 완전 일치 보조 검증에만 쓴다.

검증 순서는 WGS84 범위, Kakao `coord2regioncode`, 시·도/시·군·구/행정동/법정동 코드, SGIS 경계 Point-in-Polygon이다. 실패한 좌표는 마커에서 제외하고 `rejected`에 집계한다.

API 상태는 `success`, `partial`, `empty`, `quota`, `error`다. `mapFallback.markerAllowed`가 `false`이면 클라이언트는 시·도 중심 등 임의 좌표에 건물 마커를 만들지 않는다. 카메라의 개요 위치와 검증된 건물 위치를 같은 의미로 취급하지 않는다.

인접 지역은 `MapTopologyNode`와 `MapAdjacencyEdge` 계약을 사용한다. 공유 경계를 갖는 노드에 `touches` 간선을 만들고, 시·군·구를 넘는 간선은 `crossesSigungu`로 표시한다.
