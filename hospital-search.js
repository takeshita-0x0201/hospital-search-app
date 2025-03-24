/**
 * 病院検索システム
 * 
 * 動的な地点からの病院検索と診療科フィルタリングを提供するシステム
 * 地理的インデックスによる高速検索対応版
 */

// グローバル変数
let map;
let fullscreenMap;
let markers = [];
let infoWindow;
let autocomplete;
let geocoder;
let distanceMatrixService;
let directionsService;
let searchResultsCache = {};
let currentSearchParams = null;
let hospitals = [];
let currentSearchOrigin = null;
let displayedHospitals = 0;
const BATCH_DISPLAY_COUNT = 20;
let spatialIndex; // 地理的インデックス用の変数を追加

// スプレッドシート設定
const SPREADSHEET_ID = '1IcTnDh4UiHKBUqzfEWOW4f95bta9rv2QSv2IltdXwLk';
const RANGE = '開拓リスト（緯度経度）!B2:F';
const API_KEY = 'AIzaSyDqh5zuCekqccxBqo9P48SIvPVVoUHl8uw';

// 距離係数（直線距離フィルタリング用）
const DISTANCE_FACTOR = {
    'DRIVING': 5,
    'TRANSIT': 3,
    'WALKING': 1.3,
    'BICYCLING': 1.5
};

// 地理的インデックスのグリッドサイズ（度単位、約5kmに相当）
const GRID_SIZE = 0.05;

// マップ初期化
async function initMap() {
    try {
        // マップの初期化前にロード中のメッセージを表示
        if (document.getElementById("map")) {
            document.getElementById("map").innerHTML = `
                <div class="map-loading">
                    <div class="spinner"></div>
                    <div>Google Maps を読み込み中...</div>
                </div>
            `;
        }
        
        // ローディングインジケータを表示
        showLoading('Google Maps を読み込み中...');
        
        // Google Maps APIライブラリの読み込み
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        
        // マップの初期化（東京中心）
        map = new Map(document.getElementById('map'), {
            center: { lat: 35.681236, lng: 139.767125 },
            zoom: 12,
            mapId: "DEMO_MAP_ID"
        });
        
        // 情報ウィンドウの初期化
        infoWindow = new google.maps.InfoWindow();
        
        // Geocoderの初期化
        geocoder = new google.maps.Geocoder();
        
        // Distance Matrix APIの初期化
        distanceMatrixService = new google.maps.DistanceMatrixService();
        
        // Directions APIの初期化
        directionsService = new google.maps.DirectionsService();
        
        // 住所オートコンプリートの設定
        setupAutocomplete();
        
        // 病院データの取得
        await fetchHospitals();
        
        // イベントリスナーの設定
        setupEventListeners();
        
        // 診療科選択UIの初期化
        initializeSpecialtyUI();
        
        // ローディングインジケータを非表示
        hideLoading();
        
        console.log('マップが正常に初期化されました');
    } catch (error) {
        console.error('マップの初期化中にエラーが発生しました:', error);
        hideLoading();
        showError('マップの読み込みに失敗しました。ページを再読み込みしてください。');
    }
}

// フルスクリーンマップの初期化
function initFullscreenMap() {
    // 既存の地図データがある場合は、それを利用して新しいマップを作成
    if (!map) return;
    
    const fullscreenMapContainer = document.getElementById('fullscreenMap');
    if (!fullscreenMapContainer) return;
    
    // 新しい地図インスタンスの作成
    google.maps.importLibrary("maps").then(({Map}) => {
        fullscreenMap = new Map(fullscreenMapContainer, {
            center: map.getCenter(),
            zoom: map.getZoom(),
            mapId: "FULLSCREEN_MAP_ID"
        });
        
        // マーカーを追加
        markers.forEach(marker => {
            const newMarker = new google.maps.Marker({
                position: marker.getPosition(),
                map: fullscreenMap,
                title: marker.getTitle(),
                animation: google.maps.Animation.DROP
            });
            
            // 情報ウィンドウの内容をコピー
            if (marker.infoWindow) {
                const infoWindow = new google.maps.InfoWindow({
                    content: marker.infoWindow.getContent(),
                    maxWidth: 300
                });
                
                newMarker.addListener('click', () => {
                    infoWindow.open(fullscreenMap, newMarker);
                });
            }
        });
        
        // ウィンドウリサイズでサイズ調整
        google.maps.event.trigger(fullscreenMap, 'resize');
    });
}

// 地理的インデックスの作成
function createSpatialIndex(hospitals, gridSize) {
    console.log(`地理的インデックスを構築中... (${hospitals.length}件のデータ)`);
    const startTime = performance.now();
    
    // グリッドベースのインデックスを作成
    const index = {};
    
    hospitals.forEach(hospital => {
        // 緯度・経度をグリッドセルのキーに変換
        const cellX = Math.floor(hospital.lng / gridSize);
        const cellY = Math.floor(hospital.lat / gridSize);
        const cellKey = `${cellX},${cellY}`;
        
        // グリッドセルに病院を追加
        if (!index[cellKey]) {
            index[cellKey] = [];
        }
        index[cellKey].push(hospital);
    });
    
    const endTime = performance.now();
    console.log(`地理的インデックス構築完了: ${Object.keys(index).length}セル, ${(endTime - startTime).toFixed(2)}ms`);
    
    // インデックスを使った検索メソッドを含むオブジェクトを返す
    return {
        // 指定した地点から指定距離内の病院を検索
        findNearby: function(lat, lng, radiusKm) {
            const results = [];
            
            // 検索範囲のグリッドセルを計算
            // 1度は約111kmなので、グリッドサイズに基づいて計算
            const cellRadius = Math.ceil(radiusKm / (111 * gridSize)) + 1;
            const centerX = Math.floor(lng / gridSize);
            const centerY = Math.floor(lat / gridSize);
            
            // 検索範囲内のすべてのセルを調査
            for (let x = centerX - cellRadius; x <= centerX + cellRadius; x++) {
                for (let y = centerY - cellRadius; y <= centerY + cellRadius; y++) {
                    const cellKey = `${x},${y}`;
                    
                    // そのセルに病院があれば取得
                    if (index[cellKey]) {
                        index[cellKey].forEach(hospital => {
                            // 実際の距離計算（ハーバーサイン公式）
                            const distance = haversineDistance(
                                lat, lng, 
                                hospital.lat, hospital.lng
                            );
                            
                            if (distance <= radiusKm) {
                                results.push({
                                    hospital: hospital,
                                    distance: distance
                                });
                            }
                        });
                    }
                }
            }
            
            // 距離でソート
            results.sort((a, b) => a.distance - b.distance);
            return results;
        },
        
        // インデックスの統計情報を取得
        getStats: function() {
            const cellCount = Object.keys(index).length;
            const emptyCells = Object.values(index).filter(cell => cell.length === 0).length;
            const maxHospitalsInCell = Math.max(...Object.values(index).map(cell => cell.length));
            
            return {
                cellCount,
                emptyCells,
                maxHospitalsInCell
            };
        }
    };
}

// 病院データをスプレッドシートから取得
async function fetchHospitals() {
    showLoading('病院データを読み込み中...');
    updateLoadingProgress('スプレッドシートに接続中...');
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`スプレッドシートの取得に失敗しました: ${response.status}`);
        }
        
        updateLoadingProgress('データを解析中...');
        const data = await response.json();
        
        if (data.values && data.values.length > 0) {
            const rowCount = data.values.length;
            updateLoadingProgress(`${rowCount}件のデータを処理中...`);
            
            // データ処理
            let validCount = 0;
            let invalidCount = 0;
            
            hospitals = [];
            
            // データの処理（バッチ処理で UI ブロックを防止）
            const BATCH_SIZE = 500;
            for (let i = 0; i < data.values.length; i += BATCH_SIZE) {
                await processBatch(data.values, i, Math.min(i + BATCH_SIZE, data.values.length));
                updateLoadingProgress(`データ処理中... (${Math.min(i + BATCH_SIZE, data.values.length)}/${rowCount})`);
                
                // UI更新のための小さな遅延
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            validCount = hospitals.length;
            invalidCount = data.values.length - validCount;
            
            updateLoadingProgress(`データ処理完了: ${validCount}件の有効データを読み込みました`);
            console.log(`病院データ読み込み完了: 有効 ${validCount}件, 無効 ${invalidCount}件`);
            
            // 地理的インデックスの構築
            updateLoadingProgress('地理的インデックスを構築中...');
            spatialIndex = createSpatialIndex(hospitals, GRID_SIZE);
            
            const indexStats = spatialIndex.getStats();
            console.log(`地理的インデックス: ${indexStats.cellCount}セル, 最大${indexStats.maxHospitalsInCell}件/セル`);
            
            return hospitals;
        } else {
            throw new Error('スプレッドシートにデータが見つかりませんでした');
        }
    } catch (error) {
        console.error('病院データの取得中にエラーが発生しました:', error);
        showError('病院データの読み込みに失敗しました。ページを再読み込みしてください。');
        throw error;
    } finally {
        setTimeout(() => {
            hideLoading();
        }, 500);
    }
}

// データのバッチ処理
async function processBatch(values, start, end) {
    for (let i = start; i < end; i++) {
        const row = values[i];
        
        // データ形式の検証
        if (row.length < 5) continue;
        
        const lat = parseFloat(row[5]); // 緯度（F列）
        const lng = parseFloat(row[6]); // 経度（G列）
        
        if (isNaN(lat) || isNaN(lng)) {
            continue;
        }
        
        // 有効なデータを追加
        hospitals.push({
            name: row[0],
            specialties: row[1] ? row[1].split(',').map(s => s.trim()) : [],
            address: row[2],
            lat: lat,
            lng: lng
        });
    }
}

// 住所オートコンプリートの設定
function setupAutocomplete() {
    const addressInput = document.getElementById('address');
    autocomplete = new google.maps.places.Autocomplete(addressInput, {
        componentRestrictions: { country: 'jp' },
        fields: ['geometry', 'name', 'formatted_address']
    });
    
    // 場所の選択時にマップを更新
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry) {
            console.warn('選択された場所の詳細情報を取得できませんでした');
            return;
        }
        
        // マップをその場所にセンタリング
        map.setCenter(place.geometry.location);
        map.setZoom(15);
        
        // 検索ではなく、単に場所を表示するためのマーカーを追加
        clearMarkers();
        addMarker(place.geometry.location, place.name || '選択した場所');
    });
}

// イベントリスナーのセットアップ
function setupEventListeners() {
    // 検索フォーム送信
    document.getElementById('searchForm').addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch();
    });
    
    // リセットボタン
    document.getElementById('resetButton').addEventListener('click', () => {
        document.getElementById('searchForm').reset();
        clearResults();
        clearMarkers();
        document.getElementById('selectedSpecialties').innerHTML = '';
        currentSearchParams = null;
    });
    
    // マップタイプ切替ボタン
    const mapTypeBtn = document.getElementById('mapTypeBtn');
    if (mapTypeBtn) {
        mapTypeBtn.addEventListener('click', toggleMapType);
    }
    
    // マップセンタリングボタン
    const centerMapBtn = document.getElementById('centerMapBtn');
    if (centerMapBtn) {
        centerMapBtn.addEventListener('click', () => {
            if (currentSearchOrigin) {
                map.setCenter(currentSearchOrigin);
                map.setZoom(15);
            }
        });
    }
    
    // もっと見るボタン
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreResults);
    }
    
    // 地図拡大ボタン
    const expandMapBtn = document.getElementById('expandMapBtn');
    if (expandMapBtn) {
        expandMapBtn.addEventListener('click', function() {
            const fullscreenMapModal = document.getElementById('fullscreenMapModal');
            if (fullscreenMapModal) {
                fullscreenMapModal.style.display = 'flex';
                setTimeout(function() {
                    initFullscreenMap();
                }, 100);
            }
        });
    }
    
    // 全画面マップを閉じるボタン
    const closeMapModal = document.getElementById('closeMapModal');
    if (closeMapModal) {
        closeMapModal.addEventListener('click', function() {
            const fullscreenMapModal = document.getElementById('fullscreenMapModal');
            if (fullscreenMapModal) {
                fullscreenMapModal.style.display = 'none';
            }
        });
    }
    
    // モーダル外クリックで閉じる
    window.addEventListener('click', function(event) {
        const fullscreenMapModal = document.getElementById('fullscreenMapModal');
        if (event.target === fullscreenMapModal) {
            fullscreenMapModal.style.display = 'none';
        }
    });
    
    // ソート機能
    const sortResults = document.getElementById('sortResults');
    if (sortResults) {
        sortResults.addEventListener('change', function() {
            sortSearchResults(this.value);
        });
    }
}

// 診療科選択UIの初期化
function initializeSpecialtyUI() {
    const specialtyTags = document.getElementById('specialtyTags');
    const specialtyList = document.getElementById('specialtyList');
    const specialtyDropdownBtn = document.getElementById('specialtyDropdownBtn');
    const specialtyDropdown = document.getElementById('specialtyDropdown');
    const specialtySearch = document.getElementById('specialtySearch');
    
    if (!specialtyTags || !specialtyList || !specialtyDropdownBtn || !specialtyDropdown || !specialtySearch) {
        console.warn('診療科UI要素が見つかりません');
        return;
    }
    
    // クイックタグの追加
    COMMON_SPECIALTIES.forEach(code => {
        const specialty = SPECIALTIES.find(s => s.code === code);
        if (!specialty) return;
        
        const tag = document.createElement('div');
        tag.className = 'specialty-tag';
        tag.textContent = specialty.name;
        tag.dataset.code = specialty.code;
        
        tag.addEventListener('click', () => {
            toggleSpecialty(specialty.code, specialty.name);
            tag.classList.toggle('selected');
        });
        
        specialtyTags.appendChild(tag);
    });
    
    // すべての診療科のリストを作成
    SPECIALTIES.forEach(specialty => {
        const item = document.createElement('div');
        item.className = 'specialty-item';
        item.dataset.code = specialty.code;
        item.innerHTML = `
            ${specialty.name}
            <span class="specialty-code">(${specialty.code})</span>
        `;
        
        item.addEventListener('click', () => {
            toggleSpecialty(specialty.code, specialty.name);
            
            // リスト内の選択状態を更新
            item.classList.toggle('selected');
            
            // クイックタグの選択状態も更新
            const quickTag = Array.from(specialtyTags.children).find(
                tag => tag.dataset.code === specialty.code
            );
            
            if (quickTag) {
                quickTag.classList.toggle('selected', item.classList.contains('selected'));
            }
        });
        
        specialtyList.appendChild(item);
    });
    
    // ドロップダウン表示/非表示
    specialtyDropdownBtn.addEventListener('click', () => {
        specialtyDropdown.classList.toggle('show');
        specialtySearch.focus();
    });
    
    // 診療科検索
    specialtySearch.addEventListener('input', () => {
        const query = specialtySearch.value.toLowerCase();
        
        Array.from(specialtyList.children).forEach(item => {
            const text = item.textContent.toLowerCase();
            const code = item.dataset.code;
            item.style.display = text.includes(query) || code.includes(query) ? '' : 'none';
        });
    });
    
    // 外部クリックでドロップダウンを閉じる
    document.addEventListener('click', (e) => {
        if (!specialtyDropdownBtn.contains(e.target) && 
            !specialtyDropdown.contains(e.target)) {
            specialtyDropdown.classList.remove('show');
        }
    });
}

// 診療科の選択/選択解除
function toggleSpecialty(code, name) {
    const selectedSpecialties = document.getElementById('selectedSpecialties');
    if (!selectedSpecialties) return;
    
    const existingItem = document.querySelector(`.selected-specialty[data-code="${code}"]`);
    
    if (existingItem) {
        // 選択解除
        existingItem.remove();
        
        // リストとクイックタグの選択状態を更新
        document.querySelector(`.specialty-item[data-code="${code}"]`)?.classList.remove('selected');
        document.querySelector(`.specialty-tag[data-code="${code}"]`)?.classList.remove('selected');
    } else {
        // 新規選択
        const item = document.createElement('div');
        item.className = 'selected-specialty';
        item.dataset.code = code;
        item.innerHTML = `
            ${name}
            <span class="remove-specialty" title="選択解除">×</span>
        `;
        
        // 選択解除ボタン
        item.querySelector('.remove-specialty').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSpecialty(code, name);
        });
        
        selectedSpecialties.appendChild(item);
        
        // リストとクイックタグの選択状態を更新
        document.querySelector(`.specialty-item[data-code="${code}"]`)?.classList.add('selected');
        document.querySelector(`.specialty-tag[data-code="${code}"]`)?.classList.add('selected');
    }
}

// 選択された診療科の取得
function getSelectedSpecialties() {
    const selectedItems = document.querySelectorAll('.selected-specialty');
    return Array.from(selectedItems).map(item => item.dataset.code);
}

// 診療科フィルターモードの取得（AND/OR）
function getSpecialtyFilterMode() {
    const checkedRadio = document.querySelector('input[name="specialtyFilterMode"]:checked');
    return checkedRadio ? checkedRadio.value : 'AND'; // デフォルトはAND
}

// 検索処理の実行
async function performSearch() {
    const address = document.getElementById('address').value;
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    let mode = 'DRIVING'; // デフォルト値
    
    // 選択されたラジオボタンを取得
    for (const radio of modeRadios) {
        if (radio.checked) {
            mode = radio.value;
            break;
        }
    }
    
    const maxTime = parseInt(document.getElementById('maxTime').value);
    const selectedSpecialties = getSelectedSpecialties();
    const specialtyFilterMode = getSpecialtyFilterMode();
    
    if (!address) {
        showError('住所または駅名を入力してください');
        return;
    }
    
    // 検索パラメータ
    const searchParams = {
        address,
        mode,
        maxTime,
        selectedSpecialties,
        specialtyFilterMode
    };
    
    // キャッシュキー
    const cacheKey = JSON.stringify(searchParams);
    
    // キャッシュチェック
    if (searchResultsCache[cacheKey]) {
        console.log('キャッシュから検索結果を取得');
        displaySearchResults(searchResultsCache[cacheKey], searchParams);
        return;
    }
    
    // 検索パラメータを保存
    currentSearchParams = searchParams;
    
    try {
        showLoading('検索中...');
        clearResults();
        clearMarkers();
        
        // 住所のジオコーディング
        const origin = await geocodeAddress(address);
        if (!origin) {
            throw new Error('住所の緯度経度が取得できませんでした');
        }
        
        // 現在の検索位置を保存
        currentSearchOrigin = origin;
        
        // 出発地点のマーカーを追加
        addMarker(origin, '出発地点', true);
        
        // 交通手段に基づく最大距離の推定（分から直線距離kmに変換）
        const speed = getEstimatedSpeed(mode);
        const maxDistanceKm = (maxTime / 60) * speed * DISTANCE_FACTOR[mode];
        
        // 地理的インデックスでの高速フィルタリング
        updateLoadingProgress('候補となる病院をフィルタリング中...');
        console.log(`最大到達時間 ${maxTime}分 (${mode}) から推定距離 ${maxDistanceKm.toFixed(1)}km で絞り込み`);
        
        const startTime = performance.now();
        const candidateResults = spatialIndex.findNearby(
            origin.lat(), origin.lng(), maxDistanceKm
        );
        const endTime = performance.now();
        
        console.log(`地理的インデックスによるフィルタリング: ${candidateResults.length}件 (${(endTime - startTime).toFixed(2)}ms)`);
        
        if (candidateResults.length === 0) {
            showNoResults('指定した条件に合う病院が見つかりませんでした');
            hideLoading();
            return;
        }
        
        // 病院オブジェクトのみ抽出
        const nearbyHospitals = candidateResults.map(item => item.hospital);
        
        // 診療科によるフィルタリング（APIコールの前に先に行う）
        let filteredHospitals = nearbyHospitals;
        if (selectedSpecialties.length > 0) {
            updateLoadingProgress('診療科でフィルタリング中...');
            filteredHospitals = filterHospitalsBySpecialties(nearbyHospitals, selectedSpecialties, specialtyFilterMode);
            console.log(`診療科フィルタリング結果: ${filteredHospitals.length}件`);
            
            if (filteredHospitals.length === 0) {
                showNoResults('指定した条件に合う病院が見つかりませんでした');
                hideLoading();
                return;
            }
        }
        
        // 最大API呼び出し数の制限（APIコスト削減のため）
        const MAX_API_CALLS = 200; // 適切な数値に調整可能
        let hospitalsForApiCall = filteredHospitals;
        
        if (filteredHospitals.length > MAX_API_CALLS) {
            updateLoadingProgress(`API呼び出し数を制限するため、最も近い${MAX_API_CALLS}件のみ処理します`);
            // すでに距離順にソートされているので、先頭からMAX_API_CALLS件を取得
            hospitalsForApiCall = filteredHospitals.slice(0, MAX_API_CALLS);
            console.log(`API呼び出し数制限: ${filteredHospitals.length}件から${hospitalsForApiCall.length}件に制限`);
        }
        
        // Google API で実際の所要時間を計算
        updateLoadingProgress(`${hospitalsForApiCall.length}件の病院について所要時間を計算中...`);
        
        let results;
        if (mode === 'DRIVING') {
            results = await calculateDrivingDistances(origin, hospitalsForApiCall, maxTime);
        } else if (mode === 'TRANSIT') {
            results = await calculateTransitDistances(origin, hospitalsForApiCall, maxTime);
        } else {
            results = await calculateDistances(origin, hospitalsForApiCall, mode, maxTime);
        }
        
        console.log(`所要時間計算結果: ${results.length}件`);
        
        // 結果がない場合
        if (results.length === 0) {
            showNoResults('指定した条件に合う病院が見つかりませんでした');
            hideLoading();
            return;
        }
        
        // 結果をキャッシュ
        searchResultsCache[cacheKey] = results;
        
        // 結果を表示
        displaySearchResults(results, searchParams);
        
    } catch (error) {
        console.error('検索中にエラーが発生しました:', error);
        showError('検索中にエラーが発生しました: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 住所のジオコーディング（住所→緯度経度）
async function geocodeAddress(address) {
    try {
        const result = await new Promise((resolve, reject) => {
            geocoder.geocode({ address, region: 'jp' }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    resolve(results[0].geometry.location);
                } else {
                    reject(new Error(`ジオコーディングエラー: ${status}`));
                }
            });
        });
        
        return result;
    } catch (error) {
        console.error('住所のジオコーディングに失敗しました:', error);
        showError('入力された住所を見つけられませんでした。別の住所を試してください。');
        return null;
    }
}

// 交通手段別の推定速度（km/h）
function getEstimatedSpeed(mode) {
    switch (mode) {
        case 'DRIVING': return 40;
        case 'TRANSIT': return 20;
        case 'WALKING': return 4;
        case 'BICYCLING': return 15;
        default: return 30;
    }
}

// 直線距離による病院のフィルタリング
function filterHospitalsByDistance(hospitals, origin, maxDistanceKm) {
    const originLat = origin.lat();
    const originLng = origin.lng();
    
    // 緯度経度1度あたりの距離（おおよその値）
    const kmPerLat = 111;  // 赤道で約111km
    const kmPerLng = Math.cos(originLat * Math.PI / 180) * 111;
    
    // 最大距離から緯度経度の範囲を計算（高速な矩形フィルタリング）
    const latRange = maxDistanceKm / kmPerLat;
    const lngRange = maxDistanceKm / kmPerLng;
    
    return hospitals.filter(hospital => {
        // 緯度経度の差分（高速計算）
        const latDiff = Math.abs(hospital.lat - originLat);
        const lngDiff = Math.abs(hospital.lng - originLng);
        
        // 矩形範囲外なら即除外（高速）
        if (latDiff > latRange || lngDiff > lngRange) {
            return false;
        }
        
        // より正確なハーバーサイン距離計算
        const distance = haversineDistance(
            originLat, originLng, 
            hospital.lat, hospital.lng
        );
        
        return distance <= maxDistanceKm;
    });
}

// 診療科による病院のフィルタリング（病院オブジェクト用）
function filterHospitalsBySpecialties(hospitals, selectedSpecialties, filterMode) {
    if (selectedSpecialties.length === 0) {
        return hospitals;
    }
    
    return hospitals.filter(hospital => {
        const hospitalSpecialties = hospital.specialties;
        
        if (filterMode === 'AND') {
            // すべての選択診療科を含む病院（AND）
            return selectedSpecialties.every(specialty => {
                return hospitalSpecialties.includes(specialty);
            });
        } else {
            // いずれかの選択診療科を含む病院（OR）
            return selectedSpecialties.some(specialty => {
                return hospitalSpecialties.includes(specialty);
            });
        }
    });
}

// ハーバーサイン距離計算（地球の曲率を考慮した2点間の距離）
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 車での所要時間計算（高速道路あり・なしの両方）
async function calculateDrivingDistances(origin, hospitals, maxTime) {
    const maxTimeInSeconds = maxTime * 60;
    const resultsWithHighways = [];
    const BATCH_SIZE = 25; // Google API制限
    
    // 病院をバッチに分割
    const batches = [];
    for (let i = 0; i < hospitals.length; i += BATCH_SIZE) {
        batches.push(hospitals.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`車モードでの所要時間計算: ${hospitals.length}件を${batches.length}バッチで処理`);
    
    // 全バッチを処理
    let processedCount = 0;
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        updateLoadingProgress(`所要時間計算中... (${processedCount}/${hospitals.length}件)`);
        
        try {
            // 高速道路ありの計算
            const responseWithHighways = await calculateBatchDistances(origin, batch, 'DRIVING', false);
            
            // 高速道路なしの計算
            const responseWithoutHighways = await calculateBatchDistances(origin, batch, 'DRIVING', true);
            
            // 結果を統合
            for (let j = 0; j < batch.length; j++) {
                const withHighways = responseWithHighways[j];
                const withoutHighways = responseWithoutHighways[j];
                const hospital = batch[j];
                
                // 少なくとも一方の結果が有効で指定時間内
                if ((withHighways && withHighways.durationValue <= maxTimeInSeconds) || 
                    (withoutHighways && withoutHighways.durationValue <= maxTimeInSeconds)) {
                    
                    resultsWithHighways.push({
                        hospital: hospital,
                        route: {
                            withHighways: withHighways || { 
                                durationText: '不明', 
                                durationValue: Infinity,
                                distanceText: '不明',
                                distanceValue: Infinity
                            },
                            withoutHighways: withoutHighways || { 
                                durationText: '不明', 
                                durationValue: Infinity,
                                distanceText: '不明',
                                distanceValue: Infinity
                            }
                        },
                        distance: withHighways ? withHighways.distanceText : (withoutHighways ? withoutHighways.distanceText : '不明'),
                        // 高速道路ありの時間でソート
                        duration: withHighways ? withHighways.durationValue : Infinity
                    });
                }
            }
            
            processedCount += batch.length;
            
        } catch (error) {
            console.error(`バッチ ${i + 1}/${batches.length} の処理中にエラー:`, error);
            // エラーが発生しても他のバッチの処理を継続
        }
        
        // UI更新の時間を確保
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 所要時間でソート
    resultsWithHighways.sort((a, b) => a.duration - b.duration);
    
    return resultsWithHighways;
}

// 公共交通機関での所要時間計算
async function calculateTransitDistances(origin, hospitals, maxTime) {
    const maxTimeInSeconds = maxTime * 60;
    const results = [];
    
    // 計算対象を制限（APIコールを減らすため）
    const MAX_TRANSIT_CALCULATIONS = 100;
    const targetHospitals = hospitals.length > MAX_TRANSIT_CALCULATIONS ? 
        hospitals.slice(0, MAX_TRANSIT_CALCULATIONS) : hospitals;
    
    console.log(`公共交通機関モードでの所要時間計算: ${targetHospitals.length}件を処理`);
    
    // 各病院への経路を計算
    for (let i = 0; i < targetHospitals.length; i++) {
        const hospital = targetHospitals[i];
        
        updateLoadingProgress(`公共交通機関での経路計算中... (${i + 1}/${targetHospitals.length}件)`);
        
        try {
            // Directions APIで詳細な経路情報を取得
            const route = await calculateTransitRoute(
                origin, 
                { lat: hospital.lat, lng: hospital.lng }
            );
            
            // 指定時間内なら結果に追加
            if (route && route.durationValue <= maxTimeInSeconds) {
                results.push({
                    hospital: hospital,
                    route: route,
                    distance: route.distanceText,
                    duration: route.durationValue
                });
            }
            
        } catch (error) {
            console.error(`病院 ${i + 1}/${targetHospitals.length} の経路計算中にエラー:`, error);
            // エラーが発生しても他の病院の処理を継続
        }
        
        // API制限を避けるための遅延
        if (i < targetHospitals.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    // 所要時間でソート
    results.sort((a, b) => a.duration - b.duration);
    
    return results;
}

// 公共交通機関の詳細な経路情報を取得
async function calculateTransitRoute(origin, destination) {
    try {
        const result = await new Promise((resolve, reject) => {
            directionsService.route({
                origin: origin,
                destination: destination,
                travelMode: 'TRANSIT',
                transitOptions: {
                    departureTime: new Date()
                }
            }, (response, status) => {
                if (status === 'OK' && response.routes.length > 0) {
                    resolve(response);
                } else {
                    reject(new Error(`経路計算エラー: ${status}`));
                }
            });
        });
        
        // 最初のルートを使用
        const route = result.routes[0];
        const leg = route.legs[0];
        
        // 経路セグメントの解析
        const segments = [];
        let segmentDurations = [];
        
        leg.steps.forEach(step => {
            const duration = step.duration.value;
            const distance = step.distance.value;
            
            let segment = {
                type: step.travel_mode,
                duration: step.duration.text,
                durationValue: duration,
                distance: step.distance.text,
                distanceValue: distance
            };
            
            if (step.travel_mode === 'TRANSIT') {
                segment.line = step.transit?.line?.name || '不明な路線';
                segment.vehicle = step.transit?.line?.vehicle?.name || '電車/バス';
                segment.departureStop = step.transit?.departure_stop?.name || '出発停留所';
                segment.arrivalStop = step.transit?.arrival_stop?.name || '到着停留所';
                segment.numStops = step.transit?.num_stops || 0;
            }
            
            segments.push(segment);
            segmentDurations.push(duration);
        });
        
        // 結果をフォーマット
        return {
            segments: segments,
            durationText: leg.duration.text,
            durationValue: leg.duration.value,
            distanceText: leg.distance.text,
            distanceValue: leg.distance.value
        };
        
    } catch (error) {
        console.warn('公共交通機関の経路計算に失敗:', error);
        return null;
    }
}

// 徒歩・自転車での所要時間計算
async function calculateDistances(origin, hospitals, mode, maxTime) {
    const maxTimeInSeconds = maxTime * 60;
    const results = [];
    const BATCH_SIZE = 25; // Google API制限
    
    // 病院をバッチに分割
    const batches = [];
    for (let i = 0; i < hospitals.length; i += BATCH_SIZE) {
        batches.push(hospitals.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`${mode}モードでの所要時間計算: ${hospitals.length}件を${batches.length}バッチで処理`);
    
    // 全バッチを処理
    let processedCount = 0;
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        updateLoadingProgress(`所要時間計算中... (${processedCount}/${hospitals.length}件)`);
        
        try {
            // バッチ処理
            const batchResults = await calculateBatchDistances(origin, batch, mode, false);
            
            // 有効な結果を追加
            for (let j = 0; j < batch.length; j++) {
                const result = batchResults[j];
                const hospital = batch[j];
                
                if (result && result.durationValue <= maxTimeInSeconds) {
                    results.push({
                        hospital: hospital,
                        route: result,
                        distance: result.distanceText,
                        duration: result.durationValue
                    });
                }
            }
            
            processedCount += batch.length;
            
        } catch (error) {
            console.error(`バッチ ${i + 1}/${batches.length} の処理中にエラー:`, error);
            // エラーが発生しても他のバッチの処理を継続
        }
        
        // UI更新の時間を確保
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 所要時間でソート
    results.sort((a, b) => a.duration - b.duration);
    
    return results;
}

// バッチ単位での距離計算
async function calculateBatchDistances(origin, hospitals, mode, avoidHighways) {
    return new Promise((resolve, reject) => {
        const destinations = hospitals.map(hospital => {
            return { lat: hospital.lat, lng: hospital.lng };
        });
        
        const request = {
            origins: [origin],
            destinations: destinations,
            travelMode: mode,
            avoidHighways: avoidHighways,
            unitSystem: google.maps.UnitSystem.METRIC
        };
        
        // 公共交通機関の場合は追加設定
        if (mode === 'TRANSIT') {
            request.transitOptions = {
                departureTime: new Date()
            };
        }
        
        distanceMatrixService.getDistanceMatrix(request, (response, status) => {
            if (status !== 'OK') {
                reject(new Error(`距離計算エラー: ${status}`));
                return;
            }
            
            const results = [];
            
            // 結果がない場合
            if (!response.rows || !response.rows[0] || !response.rows[0].elements) {
                resolve(Array(hospitals.length).fill(null));
                return;
            }
            
            // 各病院への結果を取得
            const elements = response.rows[0].elements;
            
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                
                if (element.status === 'OK') {
                    results.push({
                        durationText: element.duration.text,
                        durationValue: element.duration.value,
                        distanceText: element.distance.text,
                        distanceValue: element.distance.value
                    });
                } else {
                    results.push(null);
                }
            }
            
            resolve(results);
        });
    });
}

// 診療科によるフィルタリング
function filterBySpecialties(results, selectedSpecialties, filterMode) {
    if (selectedSpecialties.length === 0) {
        return results;
    }
    
    return results.filter(result => {
        const hospitalSpecialties = result.hospital.specialties;
        
        if (filterMode === 'AND') {
            // すべての選択診療科を含む病院（AND）
            return selectedSpecialties.every(specialty => {
                return hospitalSpecialties.includes(specialty);
            });
        } else {
            // いずれかの選択診療科を含む病院（OR）
            return selectedSpecialties.some(specialty => {
                return hospitalSpecialties.includes(specialty);
            });
        }
    });
}

// 検索結果の表示
function displaySearchResults(results, searchParams) {
    const resultsContainer = document.getElementById('results');
    const resultCount = document.getElementById('resultCount');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const remainingCount = document.getElementById('remainingCount');
    
    // 表示をクリア
    clearResults();
    
    // 地図マーカーをクリア
    clearMarkers();
    
    // 出発地点のマーカーを追加
    if (currentSearchOrigin) {
        addMarker(currentSearchOrigin, '出発地点', true);
    }
    
    // 結果数の表示
    resultCount.textContent = `(${results.length}件)`;
    
    // 結果がない場合
    if (results.length === 0) {
        showNoResults('条件に合う病院が見つかりませんでした');
        return;
    }
    
    // 初期表示分だけ表示
    displayedHospitals = 0;
    displayNextBatch(results, searchParams);
    
    // もっと見るボタンの表示/非表示
    if (results.length > BATCH_DISPLAY_COUNT) {
        loadMoreContainer.style.display = 'block';
        updateRemainingCount(results.length);
    } else {
        loadMoreContainer.style.display = 'none';
    }
    
    // 地図を適切な範囲に調整
    adjustMapBounds();
}

// 次のバッチを表示
function displayNextBatch(results, searchParams) {
    const startIndex = displayedHospitals;
    const endIndex = Math.min(startIndex + BATCH_DISPLAY_COUNT, results.length);
    
    for (let i = startIndex; i < endIndex; i++) {
        addHospitalToResults(results[i], i, searchParams);
    }
    
    displayedHospitals = endIndex;
    updateRemainingCount(results.length);
}

// 残り件数の更新
function updateRemainingCount(totalCount) {
    const remainingCount = document.getElementById('remainingCount');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    
    if (!remainingCount || !loadMoreContainer) return;
    
    const remaining = totalCount - displayedHospitals;
    
    if (remaining > 0) {
        remainingCount.textContent = `(あと${remaining}件)`;
        loadMoreContainer.style.display = 'block';
    } else {
        loadMoreContainer.style.display = 'none';
    }
}

// もっと見るボタンのクリックハンドラ
function loadMoreResults() {
    if (!currentSearchParams) return;
    
    const cacheKey = JSON.stringify(currentSearchParams);
    if (searchResultsCache[cacheKey]) {
        displayNextBatch(searchResultsCache[cacheKey], currentSearchParams);
    }
}

// 検索結果のソート
function sortSearchResults(sortType) {
    if (!currentSearchParams) return;
    
    const cacheKey = JSON.stringify(currentSearchParams);
    if (!searchResultsCache[cacheKey]) return;
    
    const results = [...searchResultsCache[cacheKey]]; // 結果のコピー
    
    switch (sortType) {
        case 'time':
            // すでに時間順になっているため何もしない
            break;
            
        case 'distance':
            // 距離順にソート（距離情報がない場合は考慮）
            results.sort((a, b) => {
                const distA = a.distance ? parseFloat(a.distance.replace(/[^0-9.]/g, '')) : Infinity;
                const distB = b.distance ? parseFloat(b.distance.replace(/[^0-9.]/g, '')) : Infinity;
                return distA - distB;
            });
            break;
            
        case 'name':
            // 病院名順にソート
            results.sort((a, b) => {
                return a.hospital.name.localeCompare(b.hospital.name, 'ja');
            });
            break;
    }
    
    // ソート後の結果を表示（ソート結果はキャッシュしない）
    showSortedResults(results);
}

// ソート後の結果を表示
function showSortedResults(results) {
    // 結果のクリア
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '';
    
    // 表示件数をリセット
    displayedHospitals = 0;
    
    // 初期表示分だけ表示
    displayNextBatch(results, currentSearchParams);
    
    // もっと見るボタンの表示/非表示
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (loadMoreContainer) {
        if (results.length > BATCH_DISPLAY_COUNT) {
            loadMoreContainer.style.display = 'block';
            updateRemainingCount(results.length);
        } else {
            loadMoreContainer.style.display = 'none';
        }
    }
}

// 病院を結果リストに追加
function addHospitalToResults(result, index, searchParams) {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;
    
    const templateElement = document.getElementById('hospitalItemTemplate');
    if (!templateElement) {
        console.error('病院アイテムテンプレートが見つかりません');
        return;
    }
    
    const hospital = result.hospital;
    const mode = searchParams.mode;
    const selectedSpecialties = searchParams.selectedSpecialties;
    
    // テンプレートのクローン
    const hospitalItem = templateElement.content.cloneNode(true).querySelector('.hospital-item');
    
    // 基本情報の設定
    hospitalItem.querySelector('.hospital-name').textContent = hospital.name;
    hospitalItem.querySelector('.hospital-address').textContent = hospital.address;
    
    // 距離・所要時間の表示
    const distanceBadge = hospitalItem.querySelector('.distance-badge');
    if (mode === 'DRIVING') {
        const withHighways = result.route.withHighways;
        const withoutHighways = result.route.withoutHighways;
        
        distanceBadge.textContent = `${result.distance}`;
        
        // 経路情報の表示
        const routeInfo = `
            <div>
                <span class="transport-icon"><i class="fas fa-car"></i></span>
                高速道路あり: ${withHighways.durationText} / 高速道路なし: ${withoutHighways.durationText}
            </div>
        `;
        
        hospitalItem.querySelector('.hospital-route').innerHTML = routeInfo;
    } else if (mode === 'TRANSIT') {
        // 公共交通機関の経路表示
        distanceBadge.textContent = `${result.route.durationText}`;
        
        // 各セグメントの表示
        const segments = result.route.segments || [];
        let routeInfo = '<div class="transit-route">';
        
        if (segments.length > 0) {
            segments.forEach((segment, i) => {
                if (i > 0) {
                    routeInfo += '<span class="route-arrow">→</span>';
                }
                
                if (segment.type === 'WALKING') {
                    routeInfo += `<span class="route-segment">
                        <i class="fas fa-walking transport-icon"></i> 徒歩${segment.duration}
                    </span>`;
                } else if (segment.type === 'TRANSIT') {
                    routeInfo += `<span class="route-segment">
                        <i class="fas fa-subway transport-icon"></i> ${segment.line}(${segment.departureStop}→${segment.arrivalStop})${segment.duration}
                    </span>`;
                }
            });
            
            routeInfo += `<br><span class="route-total">合計: ${result.route.durationText}</span>`;
        } else {
            routeInfo += `
                <span class="route-segment">
                    <i class="fas fa-subway transport-icon"></i> 公共交通機関 ${result.route.durationText}
                </span>
            `;
        }
        
        routeInfo += '</div>';
        hospitalItem.querySelector('.hospital-route').innerHTML = routeInfo;
    } else if (mode === 'WALKING') {
        distanceBadge.textContent = `徒歩${result.route.durationText}`;
        
        const routeInfo = `
            <div>
                <span class="transport-icon"><i class="fas fa-walking"></i></span>
                徒歩: ${result.route.durationText} (${result.distance})
            </div>
        `;
        
        hospitalItem.querySelector('.hospital-route').innerHTML = routeInfo;
    } else if (mode === 'BICYCLING') {
        distanceBadge.textContent = `自転車${result.route.durationText}`;
        
        const routeInfo = `
            <div>
                <span class="transport-icon"><i class="fas fa-bicycle"></i></span>
                自転車: ${result.route.durationText} (${result.distance})
            </div>
        `;
        
        hospitalItem.querySelector('.hospital-route').innerHTML = routeInfo;
    }
    
    // 診療科の表示
    const specialtiesContainer = hospitalItem.querySelector('.hospital-specialties');
    
    if (hospital.specialties && hospital.specialties.length > 0) {
        hospital.specialties.forEach(specialty => {
            const specialtyElement = document.createElement('span');
            specialtyElement.className = 'hospital-specialty';
            
            // 診療科コードから名前を取得
            const specialtyName = SPECIALTY_MAP[specialty] || specialty;
            specialtyElement.textContent = specialtyName;
            
            // 検索条件に一致する診療科をハイライト
            if (selectedSpecialties.includes(specialty)) {
                specialtyElement.classList.add('matched');
            }
            
            specialtiesContainer.appendChild(specialtyElement);
        });
    } else {
        specialtiesContainer.innerHTML = '<em>診療科情報なし</em>';
    }
    
    // 地図表示ボタンのイベント
    const mapButton = hospitalItem.querySelector('.btn-show-on-map');
    if (mapButton) {
        mapButton.addEventListener('click', () => {
            // マップを病院位置にセンタリング
            map.setCenter({ lat: hospital.lat, lng: hospital.lng });
            map.setZoom(16);
            
            // その病院のマーカーを開く
            const marker = markers.find(m => 
                m.position.lat() === hospital.lat && 
                m.position.lng() === hospital.lng
            );
            
            if (marker && marker.infoWindow) {
                marker.infoWindow.open(map, marker);
            }
        });
    }
    
    // 病院のマーカーを追加
    addHospitalMarker(hospital, result, mode, selectedSpecialties);
    
    // 結果リストに追加
    resultsContainer.appendChild(hospitalItem);
}

// 病院のマーカーを追加
function addHospitalMarker(hospital, result, mode, selectedSpecialties) {
    const position = { lat: hospital.lat, lng: hospital.lng };
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: hospital.name,
        animation: google.maps.Animation.DROP
    });
    
    // 情報ウィンドウの内容
    let infoContent = `
        <div class="info-window">
            <h3>${hospital.name}</h3>
            <p><strong>住所:</strong> ${hospital.address}</p>
    `;
    
    // 交通手段に応じた所要時間表示
    if (mode === 'DRIVING') {
        infoContent += `
            <p><strong>所要時間（高速道路あり）:</strong> ${result.route.withHighways.durationText}</p>
            <p><strong>所要時間（高速道路なし）:</strong> ${result.route.withoutHighways.durationText}</p>
            <p><strong>距離:</strong> ${result.distance}</p>
        `;
    } else if (mode === 'TRANSIT') {
        infoContent += `<p><strong>所要時間:</strong> ${result.route.durationText}</p>`;
        
        // 各セグメントの表示
        const segments = result.route.segments || [];
        if (segments.length > 0) {
            infoContent += '<p><strong>経路:</strong></p><ul style="padding-left: 20px;">';
            
            segments.forEach(segment => {
                if (segment.type === 'WALKING') {
                    infoContent += `<li>徒歩 ${segment.duration}</li>`;
                } else if (segment.type === 'TRANSIT') {
                    infoContent += `<li>${segment.line} (${segment.departureStop}→${segment.arrivalStop}) ${segment.duration}</li>`;
                }
            });
            
            infoContent += '</ul>';
        }
        
        infoContent += `<p><strong>距離:</strong> ${result.distance}</p>`;
    } else {
        const modeText = mode === 'WALKING' ? '徒歩' : '自転車';
        infoContent += `
            <p><strong>所要時間:</strong> ${result.route.durationText}</p>
            <p><strong>距離:</strong> ${result.distance}</p>
        `;
    }
    
    // 診療科の表示
    if (hospital.specialties && hospital.specialties.length > 0) {
        const specialtiesHtml = hospital.specialties.map(specialty => {
            const specialtyName = SPECIALTY_MAP[specialty] || specialty;
            const isMatched = selectedSpecialties.includes(specialty);
            
            return isMatched ? 
                `<span style="background-color: #4caf50; color: white; padding: 2px 4px; border-radius: 3px; margin-right: 5px;">${specialtyName}</span>` : 
                `<span style="background-color: #f1f1f1; padding: 2px 4px; border-radius: 3px; margin-right: 5px;">${specialtyName}</span>`;
        }).join(' ');
        
        infoContent += `<p><strong>診療科:</strong> ${specialtiesHtml}</p>`;
    }
    
    infoContent += '</div>';
    
    // 情報ウィンドウの作成
    const infoWindow = new google.maps.InfoWindow({
        content: infoContent,
        maxWidth: 300
    });
    
    // クリックイベントの追加
    marker.addListener('click', () => {
        infoWindow.open(map, marker);
    });
    
    // マーカーに情報ウィンドウを関連付け
    marker.infoWindow = infoWindow;
    
    // マーカーを配列に追加
    markers.push(marker);
}

// マーカーの追加（一般）
function addMarker(position, title, isOrigin = false) {
    const markerOptions = {
        position: position,
        map: map,
        title: title
    };
    
    // 出発地点は特別なアイコン
    if (isOrigin) {
        markerOptions.icon = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
        };
        markerOptions.zIndex = 1000; // 最前面に表示
    }
    
    const marker = new google.maps.Marker(markerOptions);
    markers.push(marker);
    
    return marker;
}

// 全マーカーをクリア
function clearMarkers() {
    markers.forEach(marker => {
        marker.setMap(null);
    });
    markers = [];
}

// 地図の表示範囲を調整
function adjustMapBounds() {
    if (markers.length <= 1) return;
    
    const bounds = new google.maps.LatLngBounds();
    
    markers.forEach(marker => {
        bounds.extend(marker.getPosition());
    });
    
    map.fitBounds(bounds);
    
    // ズームレベルの調整（あまりに遠い場合の対応）
    const listener = google.maps.event.addListener(map, 'idle', () => {
        if (map.getZoom() > 16) {
            map.setZoom(16);
        }
        google.maps.event.removeListener(listener);
    });
}

// 地図タイプの切り替え
function toggleMapType() {
    if (map.getMapTypeId() === 'roadmap') {
        map.setMapTypeId('hybrid');
    } else {
        map.setMapTypeId('roadmap');
    }
}

// 結果表示をクリア
function clearResults() {
    const resultsContainer = document.getElementById('results');
    const resultCount = document.getElementById('resultCount');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    
    if (!resultsContainer) return;
    
    if (resultCount) {
        resultCount.textContent = '';
    }
    
    if (loadMoreContainer) {
        loadMoreContainer.style.display = 'none';
    }
    
    // 初期メッセージ
    resultsContainer.innerHTML = `
        <div class="initial-message">
            <div class="message-icon">
                <i class="fas fa-search"></i>
            </div>
            <p>住所または駅名を入力して検索してください</p>
        </div>
    `;
    
    displayedHospitals = 0;
}

// 検索結果なしの表示
function showNoResults(message) {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="no-results">
            <div class="message-icon">
                <i class="fas fa-exclamation-circle"></i>
            </div>
            <p>${message}</p>
        </div>
    `;
}

// エラーメッセージの表示
function showError(message) {
    alert(message);
}

// ローディングインジケータの表示
function showLoading(message) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');
    const loadingProgress = document.getElementById('loadingProgress');
    
    if (!loadingOverlay || !loadingMessage || !loadingProgress) return;
    
    loadingMessage.textContent = message;
    loadingProgress.textContent = '';
    loadingOverlay.style.display = 'flex';
}

// ローディングインジケータの非表示
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// ローディング進捗の更新
function updateLoadingProgress(message) {
    const loadingProgress = document.getElementById('loadingProgress');
    if (loadingProgress) {
        loadingProgress.textContent = message;
    }
}
