const API_KEY = "AIzaSyBMpuPyp44-V8JgrHyLgeO-tFeQBoUWvfQ"; // ここに正しいAPIキーを入れる
const GAS_URL = "https://script.google.com/macros/s/AKfycbxiyT63xD4llbY5OAaJmAwW-XAEWhR6Fzj2hYqw4QMtd6PoMTI7c4JTl9qAMxiRHQGU/exec"; // GASのWebアプリURL

let map, directionsService, directionsRenderer, hospitals = [];

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.46606942124, lng: 139.62261961841 },
        zoom: 13
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);

    fetchHospitalData();

    // オートコンプリート機能の追加
    let input = document.getElementById("address");
    let autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.setFields(["geometry"]);

    autocomplete.addListener("place_changed", function () {
        let place = autocomplete.getPlace();
        if (!place.geometry) {
            alert("有効な住所を選択してください");
            return;
        }
        searchHospitals(place.geometry.location);
    });
}

// 🔹 スプレッドシートから病院データを取得
async function fetchHospitalData() {
    try {
        let response = await fetch(GAS_URL);
        let data = await response.json();
        hospitals = data;

        hospitals.forEach(hospital => {
            let marker;
            try {
                // AdvancedMarkerElement を試し、失敗したら通常の Marker にフォールバック
                marker = new google.maps.marker.AdvancedMarkerElement({
                    position: { lat: hospital.lat, lng: hospital.lng },
                    map: map,
                    title: hospital.name
                });
            } catch (e) {
                marker = new google.maps.Marker({
                    position: { lat: hospital.lat, lng: hospital.lng },
                    map: map,
                    title: hospital.name
                });
            }

            let infoWindow = new google.maps.InfoWindow({
                content: `<b>${hospital.name}</b><br>${hospital.address}`
            });

            marker.addListener("click", function () {
                infoWindow.open(map, marker);
            });
        });

        console.log("取得した病院データ:", hospitals);
    } catch (error) {
        console.error("病院データの取得に失敗:", error);
    }
}

// 🔹 病院検索＆ルート案内
function searchHospitals(origin) {
    let mode = document.getElementById("mode").value;

    let nearestHospital = null;
    let minDistance = Infinity;

    hospitals.forEach(hospital => {
        let distance = google.maps.geometry.spherical.computeDistanceBetween(
            origin,
            new google.maps.LatLng(hospital.lat, hospital.lng)
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearestHospital = hospital;
        }
    });

    if (nearestHospital) {
        document.getElementById("results").innerHTML = `最も近い病院: <b>${nearestHospital.name}</b> (${(minDistance / 1000).toFixed(2)} km)`;
        showRoute(origin, nearestHospital, mode);
    } else {
        alert("該当する病院が見つかりませんでした。");
    }
}

// 🔹 ルートを表示
function showRoute(origin, hospital, mode) {
    let request = {
        origin: origin,
        destination: new google.maps.LatLng(hospital.lat, hospital.lng),
        travelMode: mode.toUpperCase()
    };

    directionsService.route(request, function (result, status) {
        if (status === "OK") {
            directionsRenderer.setDirections(result);
        } else {
            alert("ルート検索に失敗しました: " + status);
        }
    });
}

