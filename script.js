const GAS_URL = "https://script.google.com/macros/s/AKfycbxv7nzbpy6LcRljgSdi6umaCGOjNlmyncDInFx19JZrW-2Mt6JIepifvZCmzaGiOKDFSw/exec"; // GASのデプロイURLを設定

let map;
let directionsService;
let directionsRenderer;
let hospitals = [];

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.466069, lng: 139.622619 },
        zoom: 12,
        mapId: "3378829b499b78cb" // `mapId` を必ず指定
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map });

    fetchHospitalData();

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

// GAS から病院データを取得
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

// `AdvancedMarkerElement` を使用（公式ドキュメント準拠）
function createHospitalMarker(hospital) {
    const position = { lat: parseFloat(hospital.lat), lng: parseFloat(hospital.lng) };

    // `AdvancedMarkerElement` を作成
    const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: hospital.name
    });

    // 情報ウィンドウを作成
    const infoWindow = new google.maps.InfoWindow({
        content: `<b>${hospital.name}</b><br>${hospital.address}`
    });

    // クリックイベントを設定
    marker.addListener("click", () => {
        infoWindow.open({
            anchor: marker,
            map
        });
    });
}
