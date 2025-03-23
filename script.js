// グローバル変数
let map;
let markers = [];
let infoWindow;
let autocomplete;
let sessionToken;
let geocoder;
let distanceMatrixService;

// スプレッドシート設定
const SPREADSHEET_ID = '1IcTnDh4UiHKBUqzfEWOW4f95bta9rv2QSv2IltdXwLk';
const RANGE = '開拓リスト（緯度経度）!B2:F'; // ヘッダー行を除外（B2から開始）
const API_KEY = 'AIzaSyDqh5zuCekqccxBqo9P48SIvPVVoUHl8uw'; // Google Maps APIキー（Sheets APIにも使用）

// 病院データをスプレッドシートから取得する関数
async function fetchHospitals() {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.values) {
            const hospitals = data.values
                .map(row => {
                    const lat = parseFloat(row[3]); // 緯度（E列）
                    const lng = parseFloat(row[4]); // 経度（F列）
                    if (isNaN(lat) || isNaN(lng)) {
                        console.warn(`無効なデータ: ${row[0]} - lat: ${row[3]}, lng: ${row[4]}`);
                        return null; // 無効なデータをスキップ
                    }
                    return {
                        name: row[0],           // 病院名
                        specialties: row[1],    // 診療科
                        address: row[2],        // 住所
                        lat: lat,
                        lng: lng
                    };
                })
                .filter(hospital => hospital !== null); // nullを除外
            console.log("取得した病院データ:", hospitals);
            return hospitals;
        } else {
            console.error("スプレッドシートからデータが取得できませんでした。");
            return [];
        }
    } catch (error) {
        console.error("病院データの取得中にエラーが発生しました:", error);
        return [];
    }
}

// マップ初期化関数
async function initMap() {
    try {
        // マップの初期化
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

        map = new Map(document.getElementById("map"), {
            center: { lat: 35.466069, lng: 139.622619 },
            zoom: 12,
            mapId: "3378829b499b78cb"
        });

        // InfoWindowの初期化
        infoWindow = new google.maps.InfoWindow();

        // Geocoderの初期化
        geocoder = new google.maps.Geocoder();

        // Distance Matrix APIの初期化
        distanceMatrixService = new google.maps.DistanceMatrixService();

        // 住所オートコンプリートの設定
        setupAutocomplete();

        // 病院データを取得
        const hospitals = await fetchHospitals();

        // 病院マーカーの作成
        createHospitalMarkers(hospitals);

        // 検索ボタンのイベントリスナー
        document.getElementById("searchBtn").addEventListener("click", () => searchHospitals(hospitals));
    } catch (error) {
        console.error("マップの初期化中にエラーが発生しました:", error);
        alert("マップの読み込み中にエラーが発生しました。ページを再読み込みしてください。");
    }
}

// 住所オートコンプリートの設定
function setupAutocomplete() {
    try {
        sessionToken = new google.maps.places.AutocompleteSessionToken();
        const addressInput = document.getElementById("address");
        autocomplete = new google.maps.places.Autocomplete(addressInput, {
            types: ["geocode", "establishment"],
            sessionToken: sessionToken
        });

        autocomplete.addListener("place_changed", function() {
            const place = autocomplete.getPlace();
            if (!place.geometry) {
                alert("入力された住所の詳細情報が取得できませんでした。別の住所を試してください。");
            }
        });
    } catch (error) {
        console.error("オートコンプリートの設定中にエラーが発生しました:", error);
    }
}

// 病院マーカーの作成
async function createHospitalMarkers(hospitals) {
    try {
        clearMarkers();
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

        for (const hospital of hospitals) {
            if (isNaN(hospital.lat) || isNaN(hospital.lng)) {
                console.warn(`マーカー作成スキップ: ${hospital.name} - lat: ${hospital.lat}, lng: ${hospital.lng}`);
                continue; // 無効なデータはスキップ
            }
            const marker = new AdvancedMarkerElement({
                position: { lat: hospital.lat, lng: hospital.lng },
                map: map,
                title: hospital.name,
                content: createMarkerElement(hospital.name)
            });

            marker.addListener("gmp-click", () => {
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
async function searchHospitals(hospitals) {
    const address = document.getElementById("address").value;
    const modeSelect = document.getElementById("mode");
    const mode = modeSelect.value;
    const modeText = modeSelect.options[modeSelect.selectedIndex].text;
    const maxTime = parseInt(document.getElementById("maxTime").value);

    if (!address) {
        alert("住所または駅名を入力してください。");
        return;
    }

    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = '<div class="loading">検索中...</div>';

    try {
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
        map.setCenter(origin);

        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const originMarker = new AdvancedMarkerElement({
            position: origin,
            map: map,
            title: "検索位置",
            content: createMarkerElement("検索位置")
        });

        const destinations = hospitals.map(hospital => {
            return new google.maps.LatLng(hospital.lat, hospital.lng);
        });

        if (mode === 'DRIVING') {
            // 車の場合、高速道路利用あり・なしの両方を計算
            calculateDrivingDistances(origin, destinations, maxTime, hospitals);
        } else {
            // 他の交通手段（徒歩、公共交通機関）
            calculateDistances(origin, destinations, mode, maxTime, hospitals, modeText);
        }
    } catch (error) {
        console.error("検索処理中にエラーが発生しました:", error);
        resultsDiv.innerHTML = '<div class="no-results">検索処理中にエラーが発生しました。もう一度お試しください。</div>';
    }
}

// 車での距離と時間の計算（高速道路利用あり・なしの両方）
function calculateDrivingDistances(origin, destinations, maxTime, hospitals) {
    // 高速道路利用ありのリクエスト
    const requestWithHighways = {
        origins: [origin],
        destinations: destinations,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
    };

    // 高速道路利用なしのリクエスト
    const requestWithoutHighways = {
        origins: [origin],
        destinations: destinations,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: true,
        avoidTolls: false
    };

    // 高速道路利用ありの計算
    distanceMatrixService.getDistanceMatrix(requestWithHighways, (responseWithHighways, statusWithHighways) => {
        console.log("Distance Matrix API ステータス (高速道路利用あり):", statusWithHighways);
        console.log("Response with highways:", responseWithHighways);
        
        if (statusWithHighways !== "OK") {
            const resultsDiv = document.getElementById("results");
            resultsDiv.innerHTML = `<div class="no-results">距離計算中にエラーが発生しました。エラーコード: ${statusWithHighways}</div>`;
            return;
        }
        
        // 高速道路利用なしの計算
        distanceMatrixService.getDistanceMatrix(requestWithoutHighways, (responseWithoutHighways, statusWithoutHighways) => {
            console.log("Distance Matrix API ステータス (高速道路利用なし):", statusWithoutHighways);
            console.log("Response without highways:", responseWithoutHighways);
            
            if (statusWithoutHighways !== "OK") {
                const resultsDiv = document.getElementById("results");
                resultsDiv.innerHTML = `<div class="no-results">距離計算中にエラーが発生しました。エラーコード: ${statusWithoutHighways}</div>`;
                return;
            }
            
            // 両方の結果が取得できた場合のみ処理を進める
            processDrivingResults(responseWithHighways, responseWithoutHighways, maxTime, hospitals);
        });
    });
}

// 距離と時間の計算（高速道路利用区別なし）
function calculateDistances(origin, destinations, mode, maxTime, hospitals, modeText) {
    // 全ての病院への計算を一度に行うのではなく、1つずつ計算する
    // 特に公共交通機関モードでは個別計算が信頼性が高い
    
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = '<div class="loading">検索中...(0/' + destinations.length + ')</div>';
    
    // 結果を格納する配列
    const calculationResults = [];
    let completedCount = 0;
    
    // 各病院に対して個別に計算
    const calculateForHospital = (index) => {
        if (index >= destinations.length) {
            // 全ての計算が終了したら結果を処理
            const finalResponse = {
                rows: [{
                    elements: calculationResults
                }]
            };
            
            // 有効な結果があるか確認
            const validResultsExist = calculationResults.some(result => result.status === "OK");
            
            if (validResultsExist) {
                processResults({ rows: [{ elements: calculationResults }] }, maxTime, hospitals, modeText);
            } else {
                resultsDiv.innerHTML = '<div class="no-results">該当するルートが見つかりませんでした。</div>';
            }
            return;
        }
        
        // 現在の進捗を表示
        resultsDiv.innerHTML = `<div class="loading">検索中...(${completedCount}/${destinations.length})</div>`;
        
        const request = {
            origins: [origin],
            destinations: [destinations[index]],  // 1つの目的地のみ
            travelMode: google.maps.TravelMode[mode],
            unitSystem: google.maps.UnitSystem.METRIC
        };
        
        // 公共交通機関（TRANSIT）モードの場合、設定を調整
        if (mode === 'TRANSIT') {
            const now = new Date();
            request.transitOptions = {
                departureTime: now
            };
            console.log(`病院[${index}] ${hospitals[index].name} TRANSIT mode request:`, request);
        }
        
        distanceMatrixService.getDistanceMatrix(request, (response, status) => {
            completedCount++;
            console.log(`病院[${index}] ${hospitals[index].name} - ${modeText} API ステータス:`, status);
            
            // 結果を格納
            let element = { status: "FAILED" };
            
            if (status === "OK" && response.rows && response.rows[0] && response.rows[0].elements && 
                response.rows[0].elements[0] && response.rows[0].elements[0].status === "OK") {
                // APIから有効な結果が返された
                element = response.rows[0].elements[0];
                console.log(`病院[${index}] ${hospitals[index].name}: 時間=${element.duration.text}, 距離=${element.distance.text}`);
            } else {
                // APIエラーまたは経路なし
                console.log(`病院[${index}] ${hospitals[index].name}: 有効な経路なし`);
                element = { 
                    status: "ZERO_RESULTS",
                    error_message: status !== "OK" ? `API Error: ${status}` : "経路が見つかりません"
                };
            }
            
            // 結果を配列に保存
            calculationResults[index] = element;
            
            // 次の病院を計算
            setTimeout(() => calculateForHospital(index + 1), 100);
        });
    };
    
    // 計算開始
    calculateForHospital(0);
}

// 車選択時の結果の処理とフィルタリング
function processDrivingResults(responseWithHighways, responseWithoutHighways, maxTime, hospitals) {
    const results = document.getElementById("results");
    results.innerHTML = "";

    const maxTimeInSeconds = maxTime * 60;
    let filteredHospitals = [];

    console.log("processDrivingResults 開始");
    console.log("maxTimeInSeconds:", maxTimeInSeconds);

    // 高速道路利用ありのデータを処理
    if (responseWithHighways.rows && responseWithHighways.rows[0] && responseWithHighways.rows[0].elements) {
        console.log("高速道路利用あり要素数:", responseWithHighways.rows[0].elements.length);
        console.log("病院データ数:", hospitals.length);
        
        responseWithHighways.rows[0].elements.forEach((elementWithHighways, index) => {
            if (index >= hospitals.length) {
                console.warn(`インデックス ${index} が hospitals 配列の範囲外です`);
                return;
            }

            console.log(`病院[${index}] ${hospitals[index].name} 高速道路あり:`, elementWithHighways);
            
            const elementWithoutHighways = responseWithoutHighways.rows[0].elements[index];
            console.log(`病院[${index}] ${hospitals[index].name} 高速道路なし:`, elementWithoutHighways);

            if (elementWithHighways.status === "OK") {
                // 高速道路ありの場合の所要時間（秒）
                const durationWithHighwaysValue = elementWithHighways.duration.value;
                
                // 高速道路なしの場合の所要時間（秒）
                let durationWithoutHighwaysValue = Infinity;
                let durationWithoutHighwaysText = "不明";
                
                if (elementWithoutHighways && elementWithoutHighways.status === "OK") {
                    durationWithoutHighwaysValue = elementWithoutHighways.duration.value;
                    durationWithoutHighwaysText = elementWithoutHighways.duration.text;
                }
                
                // 指定時間内なら結果に追加
                if (durationWithHighwaysValue <= maxTimeInSeconds || durationWithoutHighwaysValue <= maxTimeInSeconds) {
                    filteredHospitals.push({
                        hospital: hospitals[index],
                        durationWithHighways: elementWithHighways.duration.text,
                        durationWithHighwaysValue: durationWithHighwaysValue,
                        durationWithoutHighways: durationWithoutHighwaysText,
                        durationWithoutHighwaysValue: durationWithoutHighwaysValue
                    });
                    
                    console.log(`病院[${index}] ${hospitals[index].name} を結果に追加:`);
                    console.log(`- 高速あり: ${elementWithHighways.duration.text} (${durationWithHighwaysValue}秒)`);
                    console.log(`- 高速なし: ${durationWithoutHighwaysText} (${durationWithoutHighwaysValue}秒)`);
                }
            }
        });
    }

    // 時間順にソート（高速道路利用ありの時間でソート）
    filteredHospitals.sort((a, b) => a.durationWithHighwaysValue - b.durationWithHighwaysValue);
    console.log("フィルター後の病院数:", filteredHospitals.length);

    if (filteredHospitals.length > 0) {
        filteredHospitals.forEach(item => {
            const hospitalElement = document.createElement("div");
            hospitalElement.className = "hospital-item";
            hospitalElement.innerHTML = `
                <div class="hospital-name">${item.hospital.name}</div>
                <div class="hospital-address">${item.hospital.address}</div>
                <div class="hospital-time">
                    <div>所要時間（高速道路あり）: ${item.durationWithHighways}</div>
                    <div>所要時間（高速道路なし）: ${item.durationWithoutHighways}</div>
                </div>
            `;

            hospitalElement.addEventListener("click", () => {
                map.setCenter({ lat: item.hospital.lat, lng: item.hospital.lng });
                map.setZoom(15);
                const content = `
                    <div class="info-window">
                        <h3>${item.hospital.name}</h3>
                        <p><strong>診療科:</strong> ${item.hospital.specialties}</p>
                        <p><strong>住所:</strong> ${item.hospital.address}</p>
                        <p><strong>所要時間（高速道路あり）:</strong> ${item.durationWithHighways}</p>
                        <p><strong>所要時間（高速道路なし）:</strong> ${item.durationWithoutHighways}</p>
                    </div>
                `;
                infoWindow.setContent(content);
                infoWindow.setPosition({ lat: item.hospital.lat, lng: item.hospital.lng });
                infoWindow.open(map);
            });

            results.appendChild(hospitalElement);
        });
    } else {
        results.innerHTML = '<div class="no-results">該当する病院が見つかりませんでした。</div>';
    }
}

// 結果の処理とフィルタリング（車以外のモード）
function processResults(response, maxTime, hospitals, modeText) {
    const results = document.getElementById("results");
    results.innerHTML = "";

    const maxTimeInSeconds = maxTime * 60;
    let filteredHospitals = [];

    console.log(`${modeText}の結果処理開始、最大時間: ${maxTimeInSeconds}秒`);

    if (response.rows && response.rows[0] && response.rows[0].elements) {
        console.log(`結果要素数: ${response.rows[0].elements.length}`);
        
        response.rows[0].elements.forEach((element, index) => {
            if (index >= hospitals.length) {
                console.warn(`インデックス ${index} が hospitals 配列の範囲外です`);
                return;
            }
            
            console.log(`病院[${index}] ${hospitals[index].name} 状態: ${element.status}`);
            
            if (element.status === "OK" && element.duration) {
                console.log(`- 所要時間: ${element.duration.text} (${element.duration.value}秒)`);
                
                if (element.duration.value <= maxTimeInSeconds) {
                    filteredHospitals.push({
                        hospital: hospitals[index],
                        duration: element.duration.text,
                        durationValue: element.duration.value,
                        distance: element.distance ? element.distance.text : "不明"
                    });
                    console.log(`- 基準時間内のため結果に追加`);
                }
            } else {
                console.log(`- 無効な結果またはルートなし: ${element.status}`);
                // 公共交通機関で経路が見つからない場合でもデバッグのためコンソールに出力
                if (element.error_message) {
                    console.log(`  エラー: ${element.error_message}`);
                }
            }
        });
    } else {
        console.warn("有効な結果行がありません");
    }

    filteredHospitals.sort((a, b) => a.durationValue - b.durationValue);
    console.log(`フィルター後の病院数: ${filteredHospitals.length}`);

    if (filteredHospitals.length > 0) {
        filteredHospitals.forEach(item => {
            const hospitalElement = document.createElement("div");
            hospitalElement.className = "hospital-item";
            hospitalElement.innerHTML = `
                <div class="hospital-name">${item.hospital.name}</div>
                <div class="hospital-address">${item.hospital.address}</div>
                <div class="hospital-time">
                    所要時間: ${item.duration}
                    <div class="hospital-distance">距離: ${item.distance}</div>
                </div>
            `;

            hospitalElement.addEventListener("click", () => {
                map.setCenter({ lat: item.hospital.lat, lng: item.hospital.lng });
                map.setZoom(15);
                const content = `
                    <div class="info-window">
                        <h3>${item.hospital.name}</h3>
                        <p><strong>診療科:</strong> ${item.hospital.specialties}</p>
                        <p><strong>住所:</strong> ${item.hospital.address}</p>
                        <p><strong>所要時間:</strong> ${item.duration}</p>
                        <p><strong>距離:</strong> ${item.distance}</p>
                    </div>
                `;
                infoWindow.setContent(content);
                infoWindow.setPosition({ lat: item.hospital.lat, lng: item.hospital.lng });
                infoWindow.open(map);
            });

            results.appendChild(hospitalElement);
        });
    } else {
        results.innerHTML = '<div class="no-results">該当する病院が見つかりませんでした。</div>';
    }
}

// マップ初期化のコールバック関数として登録
window.initMap = initMap;
