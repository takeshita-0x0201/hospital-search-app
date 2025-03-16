const API_KEY = "AIzaSyBMpuPyp44-V8JgrHyLgeO-tFeQBoUWvfQ"; // config.js で定義
const GAS_URL = "https://script.google.com/macros/s/AKfycbxv7nzbpy6LcRljgSdi6umaCGOjNlmyncDInFx19JZrW-2Mt6JIepifvZCmzaGiOKDFSw/exec"; // Google Apps Script のデプロイ URL

let map;
let directionsService;
let directionsRenderer;
let hospitals = [];

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.466069, lng: 139.622619 },
        zoom: 12
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map });

    fetchHospitalData();

    // 住所入力のオートコンプリート
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
}

// 病院データを GAS から取得
function fetchHospitalData() {
    fetch(GAS_URL)
        .then(response => response.json())
        .then(data => {
            hospitals = data;
            hospitals.forEach(hospital => {
                createHospitalMarker(hospital);
            });
        })
        .catch(error => console.error("病院データ取得エラー:", error));
}

// 病院のマーカーを作成（新 API `AdvancedMarkerElement` を使用）
function createHospitalMarker(hospital) {
    const position = { lat: parseFloat(hospital.lat), lng: parseFloat(hospital.lng) };

    const marker = new google.maps.marker.AdvancedMarkerElement({
        position,
        map,
        title: hospital.name
    });

    const infoWindow = new google.maps.InfoWindow({
        content: `<b>${hospital.name}</b><br>${hospital.address}`
    });

    marker.addListener("click", () => {
        infoWindow.open(map, marker);
    });
}

// 住所を入力して病院検索
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
            const matchedHospitals = [];

            results.forEach((result, i) => {
                if (result.duration && (result.duration.value / 60) <= maxTime) {
                    matchedHospitals.push({ ...hospitals[i], time: result.duration.text });
                }
            });

            displayResults(matchedHospitals);
        }
    );
}

// 検索結果のリスト表示
function displayResults(hospitals) {
    const resultsContainer = document.getElementById("results");
    resultsContainer.innerHTML = "";

    hospitals.forEach(hospital => {
        const hospitalElement = document.createElement("div");
        hospitalElement.classList.add("hospital-item");
        hospitalElement.innerHTML = `<b>${hospital.name}</b><br>${hospital.address}<br>到達時間: ${hospital.time}`;
        hospitalElement.onclick = () => {
            map.setCenter({ lat: parseFloat(hospital.lat), lng: parseFloat(hospital.lng) });
        };
        resultsContainer.appendChild(hospitalElement);
    });
}
