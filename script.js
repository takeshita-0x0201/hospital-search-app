const GAS_URL = "https://script.google.com/macros/s/AKfycbzb77NHuB3UMjMCl6gcJo40nXC4ff-enON32mEY19G9rXa6nGArdEhYFPGcv2d25VNQGQ/exec"; // Google Apps Script のデプロイ URL に変更

let map;
let hospitals = [];

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 35.466069, lng: 139.622619 },
    zoom: 12,
    mapId: "3378829b499b78cb" // `mapId` を設定
  });

  fetchHospitalData();

  // 住所オートコンプリートの設定
  const input = document.getElementById("address");
  const autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.setFields(["geometry", "formatted_address"]);

  autocomplete.addListener("place_changed", function () {
    const place = autocomplete.getPlace();
    if (!place.geometry) {
      alert("有効な住所を選択してください");
      return;
    }
    searchHospitals(place.geometry.location);
  });

  // 検索ボタンのイベントリスナーを追加（住所からジオコーディングして検索）
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

// スプレッドシートから病院データを取得
function fetchHospitalData() {
  fetch(GAS_URL)
    .then(response => response.json())
    .then(data => {
      if (!Array.isArray(data)) {
        throw new Error("病院データが正しく取得できませんでした");
      }
      hospitals = data;
      hospitals.forEach(hospital => {
        createHospitalMarker(hospital);
      });
    })
    .catch(error => console.error("病院データ取得エラー:", error));
}

// 病院のマーカーをプロット（標準の Marker を使用）
function createHospitalMarker(hospital) {
  const position = { lat: parseFloat(hospital.lat), lng: parseFloat(hospital.lng) };

  const marker = new google.maps.Marker({
    position: position,
    map: map,
    title: hospital.name
  });

  const infoWindow = new google.maps.InfoWindow({
    content: `<b>${hospital.name}</b><br>${hospital.address}`
  });

  marker.addListener("click", () => {
    infoWindow.open(map, marker);
  });
}

// 病院検索処理
function searchHospitals(origin) {
  let mode = document.getElementById("mode").value;
  let maxTime = parseInt(document.getElementById("maxTime").value);

  if (isNaN(maxTime)) {
    alert("最大到達時間を入力してください");
    return;
  }

  let destinations = hospitals.map(h => new google.maps.LatLng(h.lat, h.lng));
  let service = new google.maps.DistanceMatrixService();

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

      let results = response.rows[0].elements;
      let filteredHospitals = [];

      for (let i = 0; i < results.length; i++) {
        let durationValue = results[i].duration ? results[i].duration.value / 60 : Infinity;
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
  let resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = "<h3>検索結果</h3>";

  if (filteredHospitals.length === 0) {
    resultsContainer.innerHTML += "<p>該当する病院が見つかりませんでした。</p>";
    return;
  }

  filteredHospitals.forEach(hospital => {
    let div = document.createElement("div");
    div.innerHTML = `<b>${hospital.name}</b> (${hospital.address})`;
    resultsContainer.appendChild(div);
  });
}
