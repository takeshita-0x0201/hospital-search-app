function doGet() {
    let sheet = SpreadsheetApp.openById("1nDYKsgZbh5IkuvmNijf7pP3LhaT_z-XQvJH4rWD4nbQ").getSheetByName("病院リスト");
    let data = sheet.getDataRange().getValues();
    
    let hospitals = data.slice(1).map(row => ({
        name: row[0],
        lat: parseFloat(row[3]),
        lng: parseFloat(row[4]),
        address: row[2]
    }));

    return ContentService.createTextOutput(JSON.stringify(hospitals)).setMimeType(ContentService.MimeType.JSON);
}
