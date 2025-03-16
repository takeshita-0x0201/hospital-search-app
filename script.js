let map;
let sessionToken;  // Autocomplete用のセッショントークン

// スクリプト内に直接定義する病院情報
// ※ 表では「病院名, 診療科, 住所, 緯度, 経度」となっていますが、実際のマップ表示のため
//    緯度(lat)は35～、経度(lng)は139～となるよう、値の位置を入れ替えています。
const hospitals = [
  {
    name: "川崎市立井田病院",
    department: "内科、アレルギー科、血液内科、リウマチ科、外科、精神科、脳神経外科、呼吸器外科、消化器外科、腎臓内科、心臓血管外科、整形外科、形成外科、皮膚科、泌尿器科、婦人科、眼科、耳鼻咽喉科、リハビリテーション科、一般歯科、歯科口腔外科、麻酔科、乳腺外科、呼吸器内科、循環器内科、緩和ケア内科、腫瘍内科、感染症内科、消化器内科、肝臓内科、糖尿病内科、人工透析内科、脳神経内科、放射線診断科、放射線",
    address: "神奈川県川崎市中原区井田2丁目27-1",
    lat: 35.55917,
    lng: 139.64122
  },
  {
    name: "菊名記念病院",
    department: "内科、アレルギー科、血液内科、外科、精神科、神経内科、脳神経外科、腎臓内科、心臓血管外科、整形外科、皮膚科、泌尿器科、婦人科、リハビリテーション科、放射線科、麻酔科、乳腺外科、呼吸器内科、循環器内科、消化器内科、肝臓内科、内視鏡内科、糖尿病内科、膠原病内科、美容皮膚科、総合診療科、病理診断科",
    address: "神奈川県横浜市港北区菊名4丁目4-27",
    lat: 35.50938,
    lng: 139.63454
  },
  {
    name: "横浜労災病院",
    department: "内科、血液内科、リウマチ科、外科、心療内科、精神科、脳神経外科、呼吸器外科、消化器外科、腎臓内科、心臓血管外科、小児科、小児外科、整形外科、形成外科、皮膚科、泌尿器科、産婦人科、眼科、耳鼻咽喉科、リハビリテーション科、一般歯科、歯科口腔外科、麻酔科、乳腺外科、呼吸器内科、循環器内科、消化器内科、糖尿病内科、内分泌内科、代謝内科、膠原病内科、脳神経内科、放射線診断科、放射線治療科、病理診断科",
    address: "神奈川県横浜市港北区小机町3211",
    lat: 35.51088,
    lng: 139.61101
  },
  {
    name: "横浜第一病院",
    department: "内科、神経内科、腎臓内科、整形外科、皮膚科、泌尿器科、呼吸器内科、循環器内科、消化器内科、糖尿病内科、人工透析内科",
    address: "神奈川県横浜市西区高島2丁目5-15",
    lat: 35.46173,
    lng: 139.62265
  },
  {
    name: "川崎幸病院",
    department: "内科、外科、脳神経外科、呼吸器外科、消化器外科、腎臓内科、心臓血管外科、整形外科、形成外科、泌尿器科、婦人科、リハビリテーション科、麻酔科、乳腺外科、循環器内科、消化器内科、糖尿病内科、代謝内科、人工透析内科、肛門外科、放射線診断科、放射線治療科、病理診断科、内視鏡外科",
    address: "神奈川県川崎市幸区大宮町31-27",
    lat: 35.52789,
    lng: 139.6924
  },
  {
    name: "亀田病院",
    department: "内科、外科、神経内科、整形外科、皮膚科、泌尿器科、リハビリテーション科、放射線科、呼吸器内科、循環器内科、消化器内科、糖尿病内科、血管外科",
    address: "神奈川県横浜市西区御所山町77",
    lat: 35.45529,
    lng: 139.623
  },
  {
    name: "片倉病院",
    department: "内科、リウマチ科、腎臓内科、循環器内科、消化器内科、糖尿病内科、内分泌内科、代謝内科、脳神経内科",
    address: "神奈川県川崎市高津区新作4丁目11-16",
    lat: 35.58687,
    lng: 139.61935
  },
  {
    name: "日本鋼管病院",
    department: "内科、血液内科、外科、神経内科、脳神経外科、消化器外科、腎臓内科、小児科、整形外科、皮膚科、泌尿器科、婦人科、眼科、耳鼻咽喉科、リハビリテーション科、放射線科、歯科口腔外科、麻酔科、乳腺外科、呼吸器内科、循環器内科、消化器内科、肝臓内科、糖尿病内科、内分泌内科、肛門外科、血管外科、精神神経科、病理診断科",
    address: "神奈川県川崎市川崎区鋼管通1丁目2-1",
    lat: 35.5196,
    lng: 139.71225
  },
  {
    name: "聖隷横浜病院",
    department: "内科、循環器科、呼吸器内科、消化器科、泌尿器科、外科、脳神経外科、小児科、整形外科、皮膚科、リハビリテーション科、放射線科、内分泌科、糖尿病内科、心臓血管外科、消化器外科、麻酔科",
    address: "神奈川県横浜市保土ケ谷区岩井町215",
    lat: 35.44231,
    lng: 139.60487
  },
  {
    name: "総合新川橋病院",
    department: "内科、外科、脳神経外科、整形外科、形成外科、皮膚科、眼科、リハビリテーション科、放射線科、麻酔科、循環器内科、消化器内科、肝臓内科、糖尿病内科、代謝内科",
    address: "神奈川県川崎市川崎区新川通1-15",
    lat: 35.52676,
    lng: 139.70311
  },
  {
    name: "古川病院",
    department: "内科、アレルギー科、外科、神経内科、小児科、整形外科、皮膚科、泌尿器科、婦人科、リハビリテーション科、循環器内科、消化器内科、糖尿病内科",
    address: "神奈川県横浜市神奈川区子安通2丁目286",
    lat: 35.48605,
    lng: 139.65547
  },
  {
    name: "市ケ尾病院",
    department: "内科、アレルギー科、血液内科、外科、精神科、神経内科、脳神経外科、消化器外科、整形外科、形成外科、泌尿器科、リハビリテーション科、一般歯科、歯科口腔外科、乳腺外科、呼吸器内科、循環器内科、消化器内科、糖尿病内科、内分泌内科、代謝内科、脳神経内科",
    address: "神奈川県横浜市青葉区市ｹ尾町23-1",
    lat: 35.5485,
    lng: 139.53949
  },
  {
    name: "横浜保土ケ谷中央病院",
    department: "内科、リウマチ科、外科、精神科、神経内科、脳神経外科、呼吸器科、消化器外科、消化器科、腎臓内科、循環器科、小児科、整形外科、皮膚科、泌尿器科、眼科、耳鼻咽喉科、リハビリテーション科、放射線科、歯科口腔外科、麻酔科、糖尿病内科、内分泌内科、代謝内科、膠原病内科、血管外科、総合診療科",
    address: "神奈川県横浜市保土ケ谷区釜台町43-1",
    lat: 35.47254,
    lng: 139.58353
  },
  {
    name: "ふれあい横浜ホスピタル",
    department: "内科、外科、消化器外科、腎臓内科、心臓血管外科、小児科、整形外科、形成外科、美容外科、泌尿器科、産婦人科、リハビリテーション科、放射線科、一般歯科、麻酔科、乳腺外科、呼吸器内科、循環器内科、消化器内科、内視鏡内科、糖尿病内科、人工透析内科、内視鏡外科",
    address: "神奈川県横浜市中区万代町2丁目3-3",
    lat: 35.44228,
    lng: 139.63562
  },
  {
    name: "江田記念病院",
    department: "内科、心療内科、精神科、整形外科、皮膚科、リハビリテーション科、循環器内科、消化器内科、糖尿病内科、脳神経内科",
    address: "神奈川県横浜市青葉区あざみ野南1丁目1",
    lat: 35.55984,
    lng: 139.55339
  },
  {
    name: "神奈川県立がんセンター",
    department: "内科、血液内科、東洋医学科、精神科、脳神経外科、呼吸器外科、消化器外科、整形外科、形成外科、皮膚科、泌尿器科、婦人科、リハビリテーション科、歯科口腔外科、麻酔科、乳腺外科、呼吸器内科、循環器内科、緩和ケア内科、腫瘍内科、感染症内科、消化器内科、糖尿病内科、内分泌内科、内分泌外科、放射線診断科、放射線治療科、頭頸部外科、病理診断科",
    address: "神奈川県横浜市旭区中尾2丁目3-2",
    lat: 35.46832,
    lng: 139.52473
  },
  {
    name: "横浜中央病院",
    department: "内科、外科、脳神経外科、呼吸器外科、消化器外科、腎臓内科、整形外科、皮膚科、泌尿器科、婦人科、眼科、リハビリテーション科、放射線科、歯科口腔外科、麻酔科、乳腺外科、呼吸器内科、循環器内科、消化器内科、肝臓内科、糖尿病内科、人工透析内科、肛門外科、血管外科、ペインクリニック内科、総合診療科、病理診断科",
    address: "神奈川県横浜市中区山下町268",
    lat: 35.44087,
    lng: 139.6438
  },
  {
    name: "新百合ヶ丘総合病院",
    department: "糖尿病内科、内科、総合診療科、循環器内科、血液内科、消化器科、呼吸器内科、神経内科、脳神経外科、消化器外科、外科、乳腺外科、呼吸器外科、整形外科、形成外科、心臓血管外科、泌尿器科、小児科、産婦人科、産科、婦人科、皮膚科、小児外科、精神科、心療内科、眼科、耳鼻咽喉科、歯科口腔外科、リハビリテーション科、放射線科、麻酔科",
    address: "神奈川県川崎市麻生区古沢字都古255",
    lat: 35.60316,
    lng: 139.49847
  },
  {
    name: "AOI国際病院",
    department: "内科、リウマチ科、外科、心療内科、精神科、神経内科、脳神経外科、呼吸器外科、消化器外科、腎臓内科、心臓血管外科、小児科、整形外科、形成外科、皮膚科、泌尿器科、婦人科、眼科、耳鼻咽喉科、リハビリテーション科、放射線科、一般歯科、歯科口腔外科、麻酔科、乳腺外科、呼吸器内科、循環器内科、消化器内科、糖尿病内科、代謝内科、人工透析内科、血管外科",
    address: "神奈川県川崎市川崎区田町2丁目9-1",
    lat: 35.53392,
    lng: 139.74605
  }
];

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 35.466069, lng: 139.622619 },
    zoom: 12,
    mapId: "3378829b499b78cb"
  });

  // 各病院情報からマーカーを生成
  hospitals.forEach(hospital => {
    createHospitalMarker(hospital);
  });

  // セッショントークンの生成（ユーザー入力ごとに一意のトークンを利用）
  sessionToken = new google.maps.places.AutocompleteSessionToken();

  // 住所オートコンプリートの設定：セッショントークンを付与
  const input = document.getElementById("address");
  const autocomplete = new google.maps.places.Autocomplete(input, {
    sessionToken: sessionToken
  });
  autocomplete.setFields(["geometry", "formatted_address"]);

  autocomplete.addListener("place_changed", function () {
    const place = autocomplete.getPlace();
    if (!place.geometry) {
      alert("有効な住所を選択してください");
      return;
    }
    searchHospitals(place.geometry.location);
  });

  // 検索ボタンのイベントリスナー：住所をジオコーディングして検索
  document.getElementById("search").addEventListener("click", () => {
    const address = document.getElementById("address").value;
    if (!address) {
      alert("住所または最寄駅を入力してください");
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, (results, status) => {
      if (status === "OK" && results[0]) {
        searchHospitals(results[0].geometry.location);
      } else {
        alert("有効な住所を入力してください");
      }
    });
  });
}

// AdvancedMarkerElement を用いて病院マーカーをプロット
function createHospitalMarker(hospital) {
  const position = new google.maps.LatLng(hospital.lat, hospital.lng);

  // カスタムDOM要素としてマーカー内容を定義（CSSでスタイル調整可）
  const markerContent = document.createElement("div");
  markerContent.className = "advanced-marker";
  markerContent.innerText = hospital.name;

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map: map,
    position: position,
    content: markerContent
  });

  // InfoWindow の作成（病院名、診療科、住所を表示）
  const infoWindow = new google.maps.InfoWindow({
    content: `<b>${hospital.name}</b><br>${hospital.department}<br>${hospital.address}`
  });

  marker.addEventListener("gmp-click", () => {
    infoWindow.setPosition(marker.getPosition());
    infoWindow.open(map);
  });
}

// 病院検索処理：Distance Matrix API により指定地点からの所要時間でフィルタリング
function searchHospitals(origin) {
  const mode = document.getElementById("mode").value;
  const maxTime = parseInt(document.getElementById("maxTime").value);

  if (isNaN(maxTime)) {
    alert("最大到達時間を入力してください");
    return;
  }

  const destinations = hospitals.map(h => new google.maps.LatLng(h.lat, h.lng));
  const service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix(
    {
      origins: [origin],
      destinations: destinations,
      travelMode: mode.toUpperCase()
    },
    function (response, status) {
      if (status !== "OK") {
        alert("距離情報の取得に失敗しました: " + status);
        return;
      }

      const results = response.rows[0].elements;
      const filteredHospitals = [];

      for (let i = 0; i < results.length; i++) {
        const durationValue = results[i].duration ? results[i].duration.value / 60 : Infinity;
        if (durationValue <= maxTime) {
          filteredHospitals.push(hospitals[i]);
        }
      }

      displaySearchResults(filteredHospitals);
    }
  );
}

// 検索結果を表示
function displaySearchResults(filteredHospitals) {
  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = "<h3>検索結果</h3>";

  if (filteredHospitals.length === 0) {
    resultsContainer.innerHTML += "<p>該当する病院が見つかりませんでした。</p>";
    return;
  }

  filteredHospitals.forEach(hospital => {
    const div = document.createElement("div");
    div.innerHTML = `<b>${hospital.name}</b> (${hospital.address})`;
    resultsContainer.appendChild(div);
  });
}
