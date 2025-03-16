function fetchHospitalData() {
    fetch(GAS_URL)
        .then(response => response.json())
        .then(data => {
            console.log("病院データ取得:", data);
            hospitals = data;
        })
        .catch(error => console.error("スプレッドシートデータ取得エラー:", error));
}
