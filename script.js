const GAS_URL = "https://script.google.com/macros/s/AKfycbyf7nEIDPH20LCwUnIoxbqoAONQJ30Y7s7Hej0TYxFU76BRoKZRcRC78cOkYNY2YJi5lA/exec"; // GASのデプロイURL

let map;
let directionsService;
let directionsRenderer;
let hospitals = [];

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.466069, lng: 139.622619 },
        zoom: 12,
        mapId: "3378829b499b78cb" // 実際の `Map ID` を指定
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map });

    fetchHospitalData();

    // 📌 住所 & 施設名を対象にオートコンプリート
    const input = document.getElementById("address");
    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ["geocode", "establishment"] // 住所 & 施設
    });
    autocomplete.setFields(["geometry", "formatted_address", "place_id"]);

    autocomplete.addListener("place_changed", function () {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
            alert("有効な住所または施設を選択してください");
            return;
        }
        searchHospitals(place.geometry.location);
    });
}

// 📌 GAS から病院データを取得
function fetchHospitalData() {
    fetch(`${GAS_URL}?key=AIzaSyBMpuPyp44-V8JgrHyLgeO-tFeQBoUWvfQ`)
        .then(response => response.json())
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error("病院データが取得できませんでした");
            }
            hospitals = data;
            console.log("取得した病院データ:", hospitals);

            hospitals.forEach(hospital => {
                createHospitalMarker(hospital);
            });
        })
        .catch(error => console.error("病院データ取得エラー:", error));
}

// 📌 `AdvancedMarkerElement` を使用して病院マーカーを作成
function createHospitalMarker(hospital) {
    if (!hospital.lat || !hospital.lng) {
        console.error("病院データが不完全です:", hospital);
        return;
    }

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

// 📌 住所 & 施設名で病院を検索
function searchHospitals(origin) {
    let mode = document.getElementById("mode").value;

    if (!hospitals.length) {
        alert("病院データがまだ読み込まれていません");
        return;
    }

    let nearestHospital = hospitals[0];
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

    document.getElementById("results").innerHTML = `最も近い病院: <b>${nearestHospital.name}</b> (${(minDistance / 1000).toFixed(2)} km)`;

    showRoute(origin, nearestHospital, mode);
}

// 📌 ルートを表示
function showRoute(origin, hospital, mode) {
    let request = {
        origin: origin,
        destination: new google.maps.LatLng(hospital.lat, hospital.lng),
        travelMode: mode
    };

    directionsService.route(request, function (result, status) {
        if (status === "OK") {
            directionsRenderer.setDirections(result);
        } else {
            alert("ルート検索に失敗しました: " + status);
        }
    });
}
