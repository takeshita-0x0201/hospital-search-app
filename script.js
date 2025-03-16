const API_KEY = "AIzaSyBMpuPyp44-V8JgrHyLgeO-tFeQBoUWvfQ";  // Google Maps APIキー
const GAS_URL = "https://script.google.com/macros/s/AKfycbzGsea9yGQf7tlD5LXl0j2oRaZdPAEff1h6j8m09iM-J-EJtFJQ3P4MDhPOrMwFIslU-w/exec"; // GASのURL
const ROUTES_API_URL = `https://routes.googleapis.com/directions/v2:computeRoutes?key=${API_KEY}`;

let map;
let hospitals = [];
let directionsService;
let directionsRenderer;

// ** Google Map の初期化 **
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.46606942124, lng: 139.62261961841 },
        zoom: 13
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);

    // **病院データを取得**
    fetchHospitalData();

    // **住所のオートコンプリート**
    let input = document.getElementById("address");
    let autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.setFields(["geometry"]);
}

// ** Google スプレッドシートから病院データを取得 **
function fetchHospitalData() {
    fetch(GAS_URL)
        .then(response => response.json())
        .then(data => {
            hospitals = data;
            console.log("取得した病院データ:", hospitals);
            placeHospitalMarkers();
        })
        .catch(error => console.error("病院データ取得エラー:", error));
}

// ** 病院のマーカーを地図上に表示 **
function placeHospitalMarkers() {
    hospitals.forEach(hospital => {
        let marker = new google.maps.Marker({
            position: { lat: hospital.lat, lng: hospital.lng },
            map: map,
            title: hospital.name
        });

        let infoWindow = new google.maps.InfoWindow({
            content: `<b>${hospital.name}</b><br>${hospital.address}`
        });

        marker.addListener("click", function () {
            infoWindow.open(map, marker);
        });
    });
}

// ** 検索開始 **
function startSearch() {
    let address = document.getElementById("address").value;
    if (!address) {
        alert("住所を入力してください！");
        return;
    }

    let geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, function (results, status) {
        if (status === "OK") {
            searchHospitals(results[0].geometry.location);
        } else {
            alert("住所が見つかりませんでした: " + status);
        }
    });
}

// ** 病院の所要時間を計算してリストアップ **
function searchHospitals(origin) {
    let mode = document.getElementById("mode").value;
    let maxTime = parseInt(document.getElementById("maxTime").value);

    if (isNaN(maxTime)) {
        alert("最大到達時間を入力してください");
        return;
    }

    let resultsContainer = document.getElementById("results");
    resultsContainer.innerHTML = "<p>検索中...</p>";

    let hospitalResults = [];
    let completedRequests = 0;

    hospitals.forEach(hospital => {
        getTravelTime(origin, hospital, mode, (duration, distance) => {
            completedRequests++;
            if (duration <= maxTime) {
                hospitalResults.push({
                    name: hospital.name,
                    address: hospital.address,
                    duration: duration,
                    distance: distance,
                    lat: hospital.lat,
                    lng: hospital.lng
                });
            }

            // 全てのリクエストが完了したら表示を更新
            if (completedRequests === hospitals.length) {
                displayResults(hospitalResults);
            }
        });
    });
}

// ** Google Routes API を利用して移動時間を取得 **
function getTravelTime(origin, hospital, mode, callback) {
    fetch(ROUTES_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
        },
        body: JSON.stringify({
            origin: { location: { latLng: { latitude: origin.lat(), longitude: origin.lng() } } },
            destination: { location: { latLng: { latitude: hospital.lat, longitude: hospital.lng } } },
            travelMode: mode.toUpperCase()
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.routes && data.routes.length > 0) {
            let durationInSeconds = data.routes[0].duration;
            let distanceInMeters = data.routes[0].distanceMeters;
            let durationInMinutes = Math.round(durationInSeconds / 60);
            let distanceInKm = (distanceInMeters / 1000).toFixed(2);
            callback(durationInMinutes, distanceInKm);
        } else {
            callback(Infinity, "不明");
        }
    })
    .catch(error => {
        console.error("移動時間取得エラー:", error);
        callback(Infinity, "エラー");
    });
}

// ** 検索結果を表示 **
function displayResults(results) {
    let resultsContainer = document.getElementById("results");
    resultsContainer.innerHTML = "";

    if (results.length === 0) {
        resultsContainer.innerHTML = "<p>条件に合う病院が見つかりませんでした。</p>";
        return;
    }

    results.sort((a, b) => a.duration - b.duration); // 所要時間順にソート

    results.forEach(hospital => {
        let hospitalElement = document.createElement("div");
        hospitalElement.classList.add("result-item");
        hospitalElement.innerHTML = `
            <b>${hospital.name}</b><br>
            ${hospital.address}<br>
            <b>所要時間:</b> ${hospital.duration} 分<br>
            <b>距離:</b> ${hospital.distance} km
            <br><button onclick="showRoute(${hospital.lat}, ${hospital.lng})">ルート表示</button>
            <hr>
        `;
        resultsContainer.appendChild(hospitalElement);
    });
}

// ** 選択した病院へのルートをマップに表示 **
function showRoute(lat, lng) {
    let address = document.getElementById("address").value;

    let geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, function (results, status) {
        if (status === "OK") {
            let origin = results[0].geometry.location;
            let destination = new google.maps.LatLng(lat, lng);
            let mode = document.getElementById("mode").value;

            let request = {
                origin: origin,
                destination: destination,
                travelMode: mode.toUpperCase()
            };

            directionsService.route(request, function (result, status) {
                if (status === "OK") {
                    directionsRenderer.setDirections(result);
                } else {
                    alert("ルート検索に失敗しました: " + status);
                }
            });
        } else {
            alert("住所が見つかりませんでした: " + status);
        }
    });
}
