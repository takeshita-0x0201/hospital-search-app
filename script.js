const GAS_URL = "https://script.google.com/macros/s/AKfycbxv7nzbpy6LcRljgSdi6umaCGOjNlmyncDInFx19JZrW-2Mt6JIepifvZCmzaGiOKDFSw/exec"; // ← GASのデプロイURLに変更

let map;
let directionsService;
let directionsRenderer;
let hospitals = [];

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.466069, lng: 139.622619 },
        zoom: 12,
        mapId: "3378829b499b78cb"
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

    document.getElementById("search").addEventListener("click", startSearch);
}

// GAS から病院データを取得
function fetchHospitalData() {
    fetch(GAS_URL)
        .then(response => response.json())
        .then(data => {
            console.log("取得した病院データ:", data); // デバッグ用ログ

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

// 病院マーカーを `AdvancedMarkerElement` で作成
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

    hospital.marker = marker; // マーカーを病院データに紐づける
}

// 住所を元に病院検索を実行
function startSearch() {
    const address = document.getElementById("address").value;
    if (!address) {
        alert("住所を入力してください！");
        return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, function (results, status) {
        if (status === "OK") {
            searchHospitals(results[0].geometry.location);
        } else {
            alert("住所が見つかりませんでした: " + status);
        }
    });
}

// 検索地点から近い病院を検索
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
            travelMode: mode
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
                    filteredHospitals.push({ ...hospitals[i], duration: results[i].duration.text });
                }
            }

            displayHospitalList(filteredHospitals);
        }
    );
}

// 条件に一致する病院リストを表示
function displayHospitalList(filteredHospitals) {
    const resultsContainer = document.getElementById("results");
    resultsContainer.innerHTML = ""; // 既存のリストをクリア

    if (filteredHospitals.length === 0) {
        resultsContainer.innerHTML = "<p>該当する病院が見つかりませんでした。</p>";
        return;
    }

    let list = document.createElement("ul");
    list.style.listStyle = "none";
    list.style.padding = "0";

    filteredHospitals.forEach(hospital => {
        let listItem = document.createElement("li");
        listItem.style.padding = "10px";
        listItem.style.borderBottom = "1px solid #ddd";
        listItem.style.cursor = "pointer";

        listItem.innerHTML = `<b>${hospital.name}</b><br>所要時間: ${hospital.duration}`;

        listItem.addEventListener("click", function () {
            map.setCenter({ lat: parseFloat(hospital.lat), lng: parseFloat(hospital.lng) });
            map.setZoom(15);
            new google.maps.InfoWindow({
                content: `<b>${hospital.name}</b><br>${hospital.address}`
            }).open(map, hospital.marker);
        });

        list.appendChild(listItem);
    });

    resultsContainer.appendChild(list);
}


