// グローバル変数
let map;
let markers = [];
let infoWindow;
let autocomplete;
let sessionToken;
let geocoder;
let distanceMatrixService;
let searchCache = {}; // 検索結果キャッシュ

// スプレッドシート設定
const SPREADSHEET_ID = '1IcTnDh4UiHKBUqzfEWOW4f95bta9rv2QSv2IltdXwLk';
const RANGE = '開拓リスト（緯度経度）!B2:F'; // ヘッダー行を除外（B2から開始）
const API_KEY = 'AIzaSyDqh5zuCekqccxBqo9P48SIvPVVoUHl8uw'; // Google Maps APIキー（Sheets APIにも使用）

// 設定パラメータ
const MAX_DIRECT_DISTANCE_FACTOR = 1.5; // 直線距離フィルタリングの係数
const INITIAL_DISPLAY_COUNT = 20; // 最初に表示する病院数
const MAX_TRANSIT_CALCULATIONS = 100; // 公共交通機関モードで計算する最大数
const BATCH_SIZE = 25; // DistanceMatrix APIの一括リクエスト数

// 病院データをスプレッドシートから取得する関数
async function fetchHospitals() {
    // 読み込み中のUIを表示
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'data-loading';
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">病院データを読み込み中...</div>
            <div class="loading-progress">準備中...</div>
        </div>
    `;
    document.body.appendChild(loadingDiv);

    // 進捗表示を更新する関数
    const updateProgress = (message) => {
        const progressDiv = document.querySelector('#data-loading .loading-progress');
        if (progressDiv) {
            progressDiv.textContent = message;
        }
    };

    try {
        updateProgress('スプレッドシートに接続中...');
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`スプレッドシートの取得に失敗しました: ${response.status} ${response.statusText}`);
        }
        
        updateProgress('データを解析中...');
        const data = await response.json();

        if (data.values && data.values.length > 0) {
            updateProgress(`${data.values.length}件のデータを処理中...`);
            console.log(`取得したレコード数: ${data.values.length}件`);
            
            const hospitals = [];
            let validCount = 0;
            let invalidCount = 0;
            
            // データ処理を小さな塊に分割して進捗を表示
            for (let i = 0; i < data.values.length; i++) {
                const row = data.values[i];
                if (i % 100 === 0) {
                    updateProgress(`データ処理中... (${i}/${data.values.length})`);
                    // 非同期処理を少し待たせて UI の更新を許可
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                
                const lat = parseFloat(row[3]); // 緯度（E列）
                const lng = parseFloat(row[4]); // 経度（F列）
                
                if (isNaN(lat) || isNaN(lng)) {
                    console.warn(`無効なデータ: ${row[0]} - lat: ${row[3]}, lng: ${row[4]}`);
                    invalidCount++;
                    continue; // 無効なデータをスキップ
                }
                
                hospitals.push({
                    name: row[0],         // 病院名
                    specialties: row[1],  // 診療科
                    address: row[2],      // 住所
                    lat: lat,
                    lng: lng
                });
                validCount++;
            }
            
            updateProgress(`データ処理完了: 有効 ${validCount}件, 無効 ${invalidCount}件`);
            console.log(`処理結果: 有効 ${validCount}件, 無効 ${invalidCount}件`);
            
            // 読み込み完了後、UI要素を削除
            setTimeout(() => {
                const loadingElement = document.getElementById('data-loading');
                if (loadingElement) {
                    loadingElement.remove();
                }
            }, 1000); // 1秒後に消す（完了メッセージを少し表示するため）
            
            return hospitals;
        } else {
            updateProgress('データがありません');
            console.error("スプレッドシートからデータが取得できませんでした。");
            return [];
        }
    } catch (error) {
        updateProgress(`エラーが発生しました: ${error.message}`);
        console.error("病院データの取得中にエラーが発生しました:", error);
        return [];
    } finally {
        // 最終的に5秒後には必ず消す（何か問題があった場合のフォールバック）
        setTimeout(() => {
            const loadingElement = document.getElementById('data-loading');
            if (loadingElement) {
                loadingElement.remove();
            }
        }, 5000);
    }
}

// マップ初期化関数
async function initMap() {
    try {
        console.log("マップ初期化開始");
        
        // マップの初期化前にロード中のメッセージを表示
        document.getElementById("map").innerHTML = `
            <div class="map-loading">
                <div class="loading-spinner"></div>
                <div>Google Maps を読み込み中...</div>
            </div>
        `;
        
        // Google Maps APIライブラリを読み込む
        console.log("Maps APIライブラリを読み込み中...");
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        console.log("Maps APIライブラリ読み込み完了");

        // マップインスタンスを作成
        map = new Map(document.getElementById("map"), {
            center: { lat: 35.466069, lng: 139.622619 },
            zoom: 12,
            mapId: "3378829b499b78cb"
        });
        console.log("マップインスタンス作成完了");

        // InfoWindowの初期化
        infoWindow = new google.maps.InfoWindow();

        // Geocoderの初期化
        geocoder = new google.maps.Geocoder();

        // Distance Matrix APIの初期化
        distanceMatrixService = new google.maps.DistanceMatrixService();
        console.log("Google Maps 関連サービス初期化完了");

        // 住所オートコンプリートの設定
        setupAutocomplete();
        console.log("オートコンプリート設定完了");

        // 病院データを取得（この関数内で進捗表示を処理）
        console.log("病院データ取得開始");
        const hospitals = await fetchHospitals();
        console.log(`病院データ取得完了: ${hospitals.length}件`);

        // 検索ボタンのイベントリスナー
        document.getElementById("searchBtn").addEventListener("click", () => searchHospitals(hospitals));
        console.log("初期化完了");
    } catch (error) {
        console.error("マップの初期化中にエラーが発生しました:", error);
        document.getElementById("map").innerHTML = `
            <div class="map-error">
                <p>マップの読み込み中にエラーが発生しました。</p>
                <button onclick="location.reload()">ページを再読み込み</button>
            </div>
        `;
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

// マーカーをクリア
function clearMarkers() {
    markers.forEach(marker => {
        marker.map = null;
    });
    markers = [];
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

// 病院検索のメイン関数
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

    // キャッシュキーの生成
    const cacheKey = `${address}_${mode}_${maxTime}`;

    // キャッシュがあれば使用
    if (searchCache[cacheKey]) {
        console.log("キャッシュから結果を取得:", cacheKey);
        displayResults(searchCache[cacheKey], mode);
        return;
    }

    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = '<div class="loading">検索中...</div>';

    try {
        console.log("住所のジオコーディングを開始:", address);
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
        console.log("検索位置:", origin.lat(), origin.lng());
        map.setCenter(origin);

        // 検索位置マーカーを作成
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const originMarker = new AdvancedMarkerElement({
            position: origin,
            map: map,
            title: "検索位置",
            content: createMarkerElement("検索位置")
        });

        // 交通手段に基づく最大距離の推定（分から直線距離kmに変換）
        let maxDistanceKm;
        if (mode === 'DRIVING') {
            maxDistanceKm = maxTime * 0.8; // 車なら1分あたり約800m (高めに見積もる)
        } else if (mode === 'TRANSIT') {
            maxDistanceKm = maxTime * 0.3; // 公共交通機関なら1分あたり約300m
        } else { // WALKING
            maxDistanceKm = maxTime * 0.07; // 徒歩なら1分あたり約70m
        }

        console.log(`最大到達時間 ${maxTime}分から推定距離 ${maxDistanceKm.toFixed(1)}km で事前フィルタリング`);
        
        // 直線距離でフィルタリング（高速）
        resultsDiv.innerHTML = '<div class="loading">直線距離でフィルタリング中...</div>';
        const nearbyHospitals = filterByDirectDistance(hospitals, origin, maxDistanceKm * MAX_DIRECT_DISTANCE_FACTOR);
        console.log(`直線距離フィルタリング結果: ${nearbyHospitals.length} / ${hospitals.length}件`);

        // 近い順にソート
        nearbyHospitals.sort((a, b) => {
            const distA = getHaversineDistance(
                origin.lat(), origin.lng(), 
                a.lat, a.lng
            );
            const distB = getHaversineDistance(
                origin.lat(), origin.lng(), 
                b.lat, b.lng
            );
            return distA - distB;
        });

        if (nearbyHospitals.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">指定した距離内に病院が見つかりませんでした。</div>';
            return;
        }

        // Google API で実際の所要時間を計算
        resultsDiv.innerHTML = `<div class="loading">所要時間を計算中...(0/${nearbyHospitals.length}件)</div>`;

        let results;
        if (mode === 'DRIVING') {
            // 車の場合、高速道路利用あり・なしの両方を計算
            results = await calculateDrivingDistances(origin, nearbyHospitals, maxTime);
        } else {
            // 他の交通手段（徒歩、公共交通機関）
            results = await calculateDistances(origin, nearbyHospitals, mode, maxTime, modeText);
        }

        // 結果をキャッシュして表示
        searchCache[cacheKey] = results;
        displayResults(results, mode);

    } catch (error) {
        console.error("検索処理中にエラーが発生しました:", error);
        resultsDiv.innerHTML = '<div class="no-results">検索処理中にエラーが発生しました。もう一度お試しください。</div>';
    }
}

// 直線距離でフィルタリングする関数
function filterByDirectDistance(hospitals, origin, maxKm) {
    const originLat = origin.lat();
    const originLng = origin.lng();
    
    // 緯度経度1度あたりの距離（おおよその値）
    const kmPerLat = 111;  // 赤道で約111km
    const kmPerLng = Math.cos(originLat * Math.PI / 180) * 111;
    
    // 最大距離から緯度経度の範囲を計算
    const latRange = maxKm / kmPerLat;
    const lngRange = maxKm / kmPerLng;
    
    // 直線距離で粗くフィルタリング（高速）
    return hospitals.filter(hospital => {
        const latDiff = Math.abs(hospital.lat - originLat);
        const lngDiff = Math.abs(hospital.lng - originLng);
        
        // 大まかな矩形範囲でフィルタリング（高速）
        if (latDiff > latRange || lngDiff > lngRange) {
            return false;
        }
        
        // より正確なハーバーサイン距離計算
        const distance = getHaversineDistance(
            originLat, originLng, 
            hospital.lat, hospital.lng
        );
        
        return distance <= maxKm;
    });
}

// ハーバーサイン距離計算（地球の曲率を考慮した2点間の距離）
function getHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // 距離（km）
}

// 車での距離と時間の計算（高速道路利用あり・なしの両方）- バッチ処理
async function calculateDrivingDistances(origin, hospitals, maxTime) {
    const maxTimeInSeconds = maxTime * 60;
    const resultsDiv = document.getElementById("results");
    let filteredHospitals = [];

    // 大量データを一度に処理せず、バッチ処理
    const batches = [];
    for (let i = 0; i < hospitals.length; i += BATCH_SIZE) {
        batches.push(hospitals.slice(i, i + BATCH_SIZE));
    }

    console.log(`車モードでの検索: ${hospitals.length}件を${batches.length}バッチで処理`);

    // 各バッチを逐次処理
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStart = batchIndex * BATCH_SIZE;
        
        // 進捗表示の更新
        resultsDiv.innerHTML = `<div class="loading">所要時間を計算中...(${batchStart}/${hospitals.length}件)</div>`;
        
        // バッチの目的地配列を作成
        const destinations = batch.map(hospital => {
            return new google.maps.LatLng(hospital.lat, hospital.lng);
        });

        try {
            // 高速道路利用ありの計算
            const responseWithHighways = await new Promise((resolve, reject) => {
                distanceMatrixService.getDistanceMatrix({
                    origins: [origin],
                    destinations: destinations,
                    travelMode: google.maps.TravelMode.DRIVING,
                    unitSystem: google.maps.UnitSystem.METRIC,
                    avoidHighways: false,
                    avoidTolls: false
                }, (response, status) => {
                    if (status === "OK") resolve(response);
                    else reject(new Error(`高速道路利用あり計算でエラー: ${status}`));
                });
            });

            // 高速道路利用なしの計算
            const responseWithoutHighways = await new Promise((resolve, reject) => {
                distanceMatrixService.getDistanceMatrix({
                    origins: [origin],
                    destinations: destinations,
                    travelMode: google.maps.TravelMode.DRIVING,
                    unitSystem: google.maps.UnitSystem.METRIC,
                    avoidHighways: true,
                    avoidTolls: false
                }, (response, status) => {
                    if (status === "OK") resolve(response);
                    else reject(new Error(`高速道路利用なし計算でエラー: ${status}`));
                });
            });

            // バッチの結果を処理
            if (responseWithHighways.rows && responseWithHighways.rows[0] && responseWithHighways.rows[0].elements) {
                responseWithHighways.rows[0].elements.forEach((elementWithHighways, index) => {
                    if (index >= batch.length) return;

                    const elementWithoutHighways = responseWithoutHighways.rows[0].elements[index];
                    const hospitalIndex = batchStart + index;
                    
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
                                hospital: batch[index],
                                durationWithHighways: elementWithHighways.duration.text,
                                durationWithHighwaysValue: durationWithHighwaysValue,
                                durationWithoutHighways: durationWithoutHighwaysText,
                                durationWithoutHighwaysValue: durationWithoutHighwaysValue,
                                distance: elementWithHighways.distance.text
                            });
                        }
                    }
                });
            }
        } catch (error) {
            console.error(`バッチ ${batchIndex + 1}/${batches.length} の処理中にエラー:`, error);
            // エラーが発生しても処理を継続
        }
        
        // UIの更新を許可するために少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 時間順にソート（高速道路利用ありの時間でソート）
    filteredHospitals.sort((a, b) => a.durationWithHighwaysValue - b.durationWithHighwaysValue);
    console.log(`車モードでのフィルタリング結果: ${filteredHospitals.length}件`);

    return filteredHospitals;
}

// 距離と時間の計算（徒歩・公共交通機関用）- バッチ処理
async function calculateDistances(origin, hospitals, mode, maxTime, modeText) {
    const maxTimeInSeconds = maxTime * 60;
    const resultsDiv = document.getElementById("results");
    const filteredHospitals = [];
    
    // 処理対象を制限（特に公共交通機関モードでは計算量削減のため）
    let targetHospitals = hospitals;
    if (mode === 'TRANSIT' && hospitals.length > MAX_TRANSIT_CALCULATIONS) {
        console.log(`公共交通機関モードで処理を ${MAX_TRANSIT_CALCULATIONS}件に制限`);
        targetHospitals = hospitals.slice(0, MAX_TRANSIT_CALCULATIONS);
    }
    
    // 大量データを一度に処理せず、バッチ処理
    const WALKING_BATCH_SIZE = 25; // 徒歩モードは一括処理可能
    const TRANSIT_BATCH_SIZE = 1;  // 公共交通機関モードは1件ずつ処理
    
    const batchSize = mode === 'WALKING' ? WALKING_BATCH_SIZE : TRANSIT_BATCH_SIZE;
    const batches = [];
    
    for (let i = 0; i < targetHospitals.length; i += batchSize) {
        batches.push(targetHospitals.slice(i, i + batchSize));
    }
    
    console.log(`${modeText}モードでの検索: ${targetHospitals.length}件を${batches.length}バッチで処理`);
    
    // 各バッチを逐次処理
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStart = batchIndex * batchSize;
        
        // 進捗表示の更新
        resultsDiv.innerHTML = `<div class="loading">所要時間を計算中...(${batchStart}/${targetHospitals.length}件)</div>`;
        
        // バッチの目的地配列を作成
        const destinations = batch.map(hospital => {
            return new google.maps.LatLng(hospital.lat, hospital.lng);
        });
        
        try {
            // DistanceMatrix API で所要時間を計算
            const request = {
                origins: [origin],
                destinations: destinations,
                travelMode: google.maps.TravelMode[mode],
                unitSystem: google.maps.UnitSystem.METRIC
            };
            
            // 公共交通機関モードの場合は追加設定
            if (mode === 'TRANSIT') {
                request.transitOptions = {
                    departureTime: new Date()
                };
            }
            
            const response = await new Promise((resolve, reject) => {
                distanceMatrixService.getDistanceMatrix(request, (response, status) => {
                    if (status === "OK") resolve(response);
                    else reject(new Error(`距離計算でエラー: ${status}`));
                });
            });
            
            // バッチの結果を処理
            if (response.rows && response.rows[0] && response.rows[0].elements) {
                response.rows[0].elements.forEach((element, index) => {
                    if (index >= batch.length) return;
                    
                    if (element.status === "OK" && element.duration) {
                        if (element.duration.value <= maxTimeInSeconds) {
                            filteredHospitals.push({
                                hospital: batch[index],
                                duration: element.duration.text,
                                durationValue: element.duration.value,
                                distance: element.distance ? element.distance.text : "不明"
                            });
                        }
                    }
                });
            }
        } catch (error) {
            console.error(`バッチ ${batchIndex + 1}/${batches.length} の処理中にエラー:`, error);
            // エラーが発生しても処理を継続
        }
        
        // 公共交通機関モードの場合、APIリクエスト制限を避けるために少し長めに待機
        if (mode === 'TRANSIT') {
            await new Promise(resolve => setTimeout(resolve, 300));
        } else {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // 時間順にソート
    filteredHospitals.sort((a, b) => a.durationValue - b.durationValue);
    console.log(`${modeText}モードでのフィルタリング結果: ${filteredHospitals.length}件`);
    
    return filteredHospitals;
}

// 検索結果の表示
function displayResults(results, mode) {
    clearMarkers(); // 既存のマーカーをクリア
    
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";
    
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="no-results">指定した条件に合う病院が見つかりませんでした。</div>';
        return;
    }
    
    // 最初は一部だけ表示
    const showInitially = Math.min(INITIAL_DISPLAY_COUNT, results.length);
    const showMore = results.length > showInitially;
    
    // 結果ヘッダー
    resultsDiv.innerHTML = `
        <div class="results-header">
            <h3>${results.length}件の病院が条件に合致しました</h3>
            <p>所要時間順に表示しています</p>
        </div>
    `;
    
    // 結果リストのコンテナ
    const listContainer = document.createElement("div");
    listContainer.className = "results-list";
    resultsDiv.appendChild(listContainer);
    
    // 病院マーカー作成のための地図ライブラリを非同期読み込み
    google.maps.importLibrary("marker").then(({ AdvancedMarkerElement }) => {
        // 結果リストとマーカーを作成（初期表示分）
        for (let i = 0; i < showInitially; i++) {
            const item = results[i];
            
            // マーカーを作成
            const marker = new AdvancedMarkerElement({
                position: { lat: item.hospital.lat, lng: item.hospital.lng },
                map: map,
                title: item.hospital.name,
                content: createMarkerElement(item.hospital.name)
            });
            
            // マーカークリックイベント
            marker.addListener("gmp-click", () => {
                const infoContent = createInfoWindowContent(item, mode);
                infoWindow.setContent(infoContent);
                infoWindow.setPosition({ lat: item.hospital.lat, lng: item.hospital.lng });
                infoWindow.open(map);
            });
            
            markers.push(marker);
            
            // 結果リストアイテムを作成
            const resultItem = createResultItem(item, mode);
            
            // リストアイテムクリックイベント
            resultItem.addEventListener("click", () => {
                map.setCenter({ lat: item.hospital.lat, lng: item.hospital.lng });
                map.setZoom(15);
                
                const infoContent = createInfoWindowContent(item, mode);
                infoWindow.setContent(infoContent);
                infoWindow.setPosition({ lat: item.hospital.lat, lng: item.hospital.lng });
                infoWindow.open(map);
            });
            
            listContainer.appendChild(resultItem);
        }
    });
    
    // 「もっと見る」ボタン
    if (showMore) {
        const moreButton = document.createElement("button");
        moreButton.className = "more-button";
        moreButton.textContent = `さらに${results.length - showInitially}件表示`;
        moreButton.onclick = async () => {
            moreButton.disabled = true;
            moreButton.textContent = "読み込み中...";
            
            // 残りの結果を表示
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
            
            for (let i = showInitially; i < results.length; i++) {
                const item = results[i];
                
                // 追加のマーカーを作成
                const marker = new AdvancedMarkerElement({
                    position: { lat: item.hospital.lat, lng: item.hospital.lng },
                    map: map,
                    title: item.hospital.name,
                    content: createMarkerElement(item.hospital.name)
                });
                
                // マーカークリックイベント
                marker.addListener("gmp-click", () => {
                    const infoContent = createInfoWindowContent(item, mode);
                    infoWindow.setContent(infoContent);
                    infoWindow.setPosition({ lat: item.hospital.lat, lng: item.hospital.lng });
                    infoWindow.open(map);
                });
                
                markers.push(marker);
                
                // 結果リストアイテムを作成
                const resultItem = createResultItem(item, mode);
                
                // リストアイテムクリックイベント
                resultItem.addEventListener("click", () => {
                    map.setCenter({ lat: item.hospital.lat, lng: item.hospital.lng });
                    map.setZoom(15);
                    
                    const infoContent = createInfoWindowContent(item, mode);
                    infoWindow.setContent(infoContent);
                    infoWindow.setPosition({ lat: item.hospital.lat, lng: item.hospital.lng });
                    infoWindow.open(map);
                });
                
                listContainer.appendChild(resultItem);
                
                // 10件ごとにUIを更新する時間を作る
                if ((i - showInitially) % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            
            moreButton.style.display = "none";
        };
        
        resultsDiv.appendChild(moreButton);
    }
}

// 結果アイテムの作成
function createResultItem(item, mode) {
    const element = document.createElement("div");
    element.className = "hospital-item";
    
    if (mode === 'DRIVING') {
        // 車モード表示
        element.innerHTML = `
            <div class="hospital-name">${item.hospital.name}</div>
            <div class="hospital-address">${item.hospital.address}</div>
            <div class="hospital-time">
                <div>所要時間（高速道路あり）: ${item.durationWithHighways}</div>
                <div>所要時間（高速道路なし）: ${item.durationWithoutHighways}</div>
                <div class="hospital-distance">距離: ${item.distance}</div>
            </div>
        `;
    } else {
        // 徒歩・公共交通機関モード表示
        element.innerHTML = `
            <div class="hospital-name">${item.hospital.name}</div>
            <div class="hospital-address">${item.hospital.address}</div>
            <div class="hospital-time">
                所要時間: ${item.duration}
                <div class="hospital-distance">距離: ${item.distance}</div>
            </div>
        `;
    }
    
    return element;
}

// 情報ウィンドウの内容作成
function createInfoWindowContent(item, mode) {
    if (mode === 'DRIVING') {
        return `
            <div class="info-window">
                <h3>${item.hospital.name}</h3>
                <p><strong>診療科:</strong> ${item.hospital.specialties}</p>
                <p><strong>住所:</strong> ${item.hospital.address}</p>
                <p><strong>所要時間（高速道路あり）:</strong> ${item.durationWithHighways}</p>
                <p><strong>所要時間（高速道路なし）:</strong> ${item.durationWithoutHighways}</p>
                <p><strong>距離:</strong> ${item.distance}</p>
            </div>
        `;
    } else {
        return `
            <div class="info-window">
                <h3>${item.hospital.name}</h3>
                <p><strong>診療科:</strong> ${item.hospital.specialties}</p>
                <p><strong>住所:</strong> ${item.hospital.address}</p>
                <p><strong>所要時間:</strong> ${item.duration}</p>
                <p><strong>距離:</strong> ${item.distance}</p>
            </div>
        `;
    }
}

// プログレス表示の更新
function updateProgressUI(message, current, total) {
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = `<div class="loading">${message}...(${current}/${total}件)</div>`;
}

// マップ初期化のコールバック関数として登録
window.initMap = initMap;
