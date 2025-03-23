// 病院データ（緯度・経度・名前・診療科・住所）
const hospitals = [
    {
        name: "横浜市立市民病院",
        lat: 35.466069,
        lng: 139.622619,
        specialties: "内科, 外科, 小児科, 整形外科, 脳神経外科",
        address: "神奈川県横浜市保土ケ谷区岡沢町56"
    },
    {
        name: "聖マリアンナ医科大学病院",
        lat: 35.587517,
        lng: 139.550172,
        specialties: "内科, 外科, 小児科, 産婦人科, 眼科, 耳鼻咽喉科",
        address: "神奈川県川崎市宮前区菅生2-16-1"
    },
    {
        name: "横浜市立大学附属病院",
        lat: 35.335232,
        lng: 139.648385,
        specialties: "内科, 外科, 小児科, 整形外科, 皮膚科, 泌尿器科",
        address: "神奈川県横浜市金沢区福浦3-9"
    },
    {
        name: "済生会横浜市東部病院",
        lat: 35.512651,
        lng: 139.654535,
        specialties: "内科, 外科, 小児科, 整形外科, 循環器内科",
        address: "神奈川県横浜市鶴見区下末吉3-6-1"
    },
    {
        name: "昭和大学藤が丘病院",
        lat: 35.547049,
        lng: 139.558107,
        specialties: "内科, 外科, 小児科, 産婦人科, 眼科",
        address: "神奈川県横浜市青葉区藤が丘1-30"
    }
];

// グローバル変数
let map;
let markers = [];
let infoWindow;
let autocomplete;
let sessionToken;
let geocoder;
let distanceMatrixService; // 内部的にはRoutes を使用

// マップ初期化関数
async function initMap() {
    try {
        // マップの初期化
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        
        map = new Map(document.getElementById("map"), {
            center: { lat: 35.466069, lng: 139.622619 },
            zoom: 12,
            md: "3378829b499b78cb"
        });
        
        // InfoWindowの初期化
        infoWindow = new google.maps.InfoWindow();
        
        // Geocoderの初期化
        geocoder = new google.maps.Geocoder();
        
        // Distance Matrix の初期化
        distanceMatrixService = new google.maps.DistanceMatrixService();
        
        // 住所オートコンプリートの設定
        setupAutocomplete();
        
        // 病院マーカーの作成
        createHospitalMarkers();
        
        // 検索ボタンのイベントリスナー
        document.getElementById("searchBtn").addEventListener("click", searchHospitals);
    } catch (error) {
        console.error("マップの初期化中にエラーが発生しました:", error);
        alert("マップの読み込み中にエラーが発生しました。ページを再読み込みしてください。");
    }
}

// 住所オートコンプリートの設定
function setupAutocomplete() {
    try {
        // セッショントークンの生成
        sessionToken = new google.maps.places.AutocompleteSessionToken();
        
        // オートコンプリートの初期化
        const addressInput = document.getElementById("address");
        autocomplete = new google.maps.places.Autocomplete(addressInput, {
            types: ["geocode", "establishment"],
            sessionToken: sessionToken
        });
        
        // 選択された場合のイベントリスナー
        autocomplete.addListener("place_changed", function() {
            const place = autocomplete.getPlace();
            if (!place.geometry) {
                alert("入力された住所の詳細情報が取得できませんでした。別の住所を試してください。");
                return;
            }
        });
    } catch (error) {
        console.error("オートコンプリートの設定中にエラーが発生しました:", error);
    }
}

// 病院マーカーの作成
async function createHospitalMarkers() {
    try {
        // マーカーを一旦クリア
        clearMarkers();
        
        // マーカーライブラリを読み込み
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        
        // 病院データごとにマーカーを作成
        for (const hospital of hospitals) {
            // マーカーの作成
            const marker = new AdvancedMarkerElement({
                position: { lat: hospital.lat, lng: hospital.lng },
                map: map,
                title: hospital.name,
                content: createMarkerElement(hospital.name)
            });
            
            // マーカークリック時のイベント（gmp-clickを使用）
            marker.addListener("gmp-click", () => {
                // 情報ウィンドウの内容
                const content = `
                    <div class="info-window">
                        <h3>${hospital.name}</h3>
                        <p><strong>診療科:</strong> ${hospital.specialties}</p>
                        <p><strong>住所:</strong> ${hospital.address}</p>
                    </div>
                `;
                
                infoWindow.setContent(content);
                infoWindow.setPosition({ lat: hospital.lat, lng: hospital.lng });
                infoWindow.open(map);
            });
            
            markers.push(marker);
        }
    } catch (error) {
        console.error("病院マーカーの作成中にエラーが発生しました:", error);
    }
}

// マーカー用のカスタム要素を作成
function createMarkerElement(title) {
    const element = document.createElement("div");
    element.className = "marker";
    element.innerHTML = `
        <div class="marker-pin"></div>
        <div class="marker-label">${title}</div>
    `;
    return element;
}

// マーカーをクリア
function clearMarkers() {
    markers.forEach(marker => {
        marker.map = null;
    });
    markers = [];
}

// 病院検索
async function searchHospitals() {
    const address = document.getElementById("address").value;
    const mode = document.getElementById("mode").value;
    const maxTime = parseInt(document.getElementById("maxTime").value);
    
    if (!address) {
        alert("住所または駅名を入力してください。");
        return;
    }
    
    // 検索中の表示
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = '<div class="loading">検索中...</div>';
    
    try {
        // 住所から緯度経度を取得
        const geocodeResult = await new Promise((resolve, reject) => {
            geocoder.geocode({ address: address }, (results, status) => {
                if (status === "OK" && results[0]) {
                    resolve(results[0]);
                } else {
                    reject(new Error("住所の緯度経度が取得できませんでした"));
                }
            });
        });
        
        const origin = geocodeResult.geometry.location;
        
        // マップの中心を検索位置に移動
        map.setCenter(origin);
        
        // マーカーライブラリを読み込み
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        
        // 検索元のマーカーを作成
        const originMarker = new AdvancedMarkerElement({
            position: origin,
            map: map,
            title: "検索位置",
            content: createMarkerElement("検索位置")
        });
        
        // 病院の位置情報を準備
        const destinations = hospitals.map(hospital => {
            return new google.maps.LatLng(hospital.lat, hospital.lng);
        });
        
        // Distance Matrix で距離と時間を計算
        calculateDistances(origin, destinations, mode, maxTime);
        
    } catch (error) {
        console.error("検索処理中にエラーが発生しました:", error);
        resultsDiv.innerHTML = '<div class="no-results">検索処理中にエラーが発生しました。もう一度お試しください。</div>';
    }
}

// 距離と時間の計算
function calculateDistances(origin, destinations, mode, maxTime) {
    // 現代のRoutes APIを使用したDistance Matrix計算
    // Google Maps JavaScript  v3では内部的にはRoutes を使用しますが、
    // インターフェースはDistanceMatrixServiceのままです
    distanceMatrixService.getDistanceMatrix({
        origins: [origin],
        destinations: destinations,
        travelMode: google.maps.TravelMode[mode],
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
    }, (response, status) => {
        if (status !== "OK") {
            const resultsDiv = document.getElementById("results");
            resultsDiv.innerHTML = '<div class="no-results">距離計算中にエラーが発生しました。後でもう一度お試しください。</div>';
            console.error("Routes  (Distance Matrix)エラー:", status);
            return;
        }
        
        // 結果の処理とフィルタリング
        processResults(response, maxTime);
    });
}

// 結果の処理とフィルタリング
function processResults(response, maxTime) {
    const results = document.getElementById("results");
    results.innerHTML = "";
    
    // 最大到達時間（秒に変換）
    const maxTimeInSeconds = maxTime * 60;
    
    let filteredHospitals = [];
    
    // 各病院までの所要時間をチェック
    if (response.rows[0] && response.rows[0].elements) {
        response.rows[0].elements.forEach((element, index) => {
            if (element.status === "OK") {
                // 所要時間が最大到達時間以内かチェック
                if (element.duration.value <= maxTimeInSeconds) {
                    filteredHospitals.push({
                        hospital: hospitals[index],
                        duration: element.duration.text,
                        durationValue: element.duration.value
                    });
                }
            }
        });
    }
    
    // 所要時間でソート
    filteredHospitals.sort((a, b) => a.durationValue - b.durationValue);
    
    // 結果を表示
    if (filteredHospitals.length > 0) {
        filteredHospitals.forEach(item => {
            const hospitalElement = document.createElement("div");
            hospitalElement.className = "hospital-item";
            hospitalElement.innerHTML = `
                <div class="hospital-name">${item.hospital.name}</div>
                <div class="hospital-address">${item.hospital.address}</div>
                <div class="hospital-time">所要時間: ${item.duration}</div>
            `;
            
            // 病院項目のクリックイベント
            hospitalElement.addEventListener("click", () => {
                // マップをその病院の位置に移動
                map.setCenter({ lat: item.hospital.lat, lng: item.hospital.lng });
                map.setZoom(15);
                
                // 情報ウィンドウを開く
                const content = `
                    <div class="info-window">
                        <h3>${item.hospital.name}</h3>
                        <p><strong>診療科:</strong> ${item.hospital.specialties}</p>
                        <p><strong>住所:</strong> ${item.hospital.address}</p>
                        <p><strong>所要時間:</strong> ${item.duration}</p>
                    </div>
                `;
                
                infoWindow.setContent(content);
                infoWindow.setPosition({ lat: item.hospital.lat, lng: item.hospital.lng });
                infoWindow.open(map);
            });
            
            results.appendChild(hospitalElement);
        });
    } else {
        // 該当する病院がない場合
        results.innerHTML = '<div class="no-results">該当する病院が見つかりませんでした。</div>';
    }
}

// マップ初期化のコールバック関数として登録
window.initMap = initMap;
