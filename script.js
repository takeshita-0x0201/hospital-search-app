window.initMap = function() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.46606942124, lng: 139.62261961841 },
        zoom: 14
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);

    fetchHospitalData();

    let input = document.getElementById("address");
    let autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.setFields(["geometry"]);
};

function fetchHospitalData() {
    fetch(GAS_URL)
        .then(response => response.json())
        .then(data => {
            hospitals = data;
            console.log("病院データ取得:", hospitals);
            hospitals.forEach(hospital => {
                const marker = new google.maps.marker.AdvancedMarkerElement({
                    position: { lat: hospital.lat, lng: hospital.lng },
                    map: map,
                    title: hospital.name
                });


                let infoWindow = new google.maps.InfoWindow({
                    content: `<b>${hospital.name}</b><br>${hospital.address}`
                });

                marker.addListener("click", function() {
                    infoWindow.open(map, marker);
                });
            });
        })
        .catch(error => console.error("スプレッドシートデータ取得エラー:", error));
}

document.getElementById("search").addEventListener("click", () => {
    let address = document.getElementById("address").value;
    if (!address) {
        alert("住所を入力してください！");
        return;
    }

    let geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, function(results, status) {
        if (status === "OK") {
            searchHospitals(results[0].geometry.location);
        } else {
            alert("住所が見つかりませんでした: " + status);
        }
    });
});

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
        function(response, status) {
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

            displayResults(filteredHospitals);
        }
    );
}

function displayResults(hospitals) {
    let resultsContainer = document.getElementById("results");
    resultsContainer.innerHTML = "<h3>検索結果</h3>";

    if (hospitals.length === 0) {
        resultsContainer.innerHTML += "<p>条件に一致する病院は見つかりませんでした。</p>";
        return;
    }

    hospitals.forEach(hospital => {
        resultsContainer.innerHTML += `<p><b>${hospital.name}</b><br>${hospital.address}</p>`;
    });
}
