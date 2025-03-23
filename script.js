/* ローディング表示用のスタイル */
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.status-overlay {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 9998;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.loading-content {
    text-align: center;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    max-width: 80%;
}

.status-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid #3498db;
    border-radius: 50%;
    margin: 0 auto 20px;
    animation: spin 1s linear infinite;
}

.loading-spinner-small {
    width: 24px;
    height: 24px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.loading-text {
    font-size: 18px;
    margin-bottom: 15px;
    color: #333;
}

.loading-progress {
    font-size: 14px;
    color: #666;
}

.status-text {
    font-size: 14px;
}

.map-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: #f9f9f9;
    color: #333;
    font-size: 16px;
    gap: 15px;
}

.map-error {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: #f9f9f9;
    color: #d9534f;
    padding: 20px;
    text-align: center;
}

.map-error button {
    margin-top: 15px;
    padding: 8px 15px;
    background-color: #5bc0de;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.hospital-distance {
    font-size: 0.9em;
    color: #666;
    margin-top: 4px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* レスポンシブデザイン対応 */
@media (max-width: 768px) {
    .loading-content {
        padding: 20px;
    }
    
    .loading-spinner {
        width: 40px;
        height: 40px;
        border-width: 4px;
    }
    
    .loading-text {
        font-size: 16px;
    }
}
