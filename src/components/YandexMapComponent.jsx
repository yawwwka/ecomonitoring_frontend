import { useEffect, useState, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

export default function YandexMapComponent() {
    const [map, setMap] = useState(null);
    const [airData, setAirData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentCoords, setCurrentCoords] = useState(null);
    const [cityHistory, setCityHistory] = useState([]);
    const [selectedCity, setSelectedCity] = useState(null);
    const [selectedCityInfo, setSelectedCityInfo] = useState(null);
    const [darkMode, setDarkMode] = useState(false);
    const [historyDays, setHistoryDays] = useState(7); // 24ч=1, 7=неделя, 30=месяц

    const mapInitialized = useRef(false);
    const ymapsRef = useRef(null);
    const currentPlacemarkRef = useRef(null);
    const currentInfoWindowRef = useRef(null);

    const fetchAirQuality = async (lat, lon) => {
        setLoading(true);
        setCurrentCoords([lat, lon]);

        try {
            const url = `http://localhost:8080/api/air?lat=${lat}&lon=${lon}`;
            console.log('Запрос к:', url);

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('Получены данные:', data);
            setAirData(data);

        } catch (error) {
            console.error('Ошибка:', error);
            setAirData(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchCityHistory = async (cityId, cityName) => {
        console.log(`Загрузка истории для города ID=${cityId}, name=${cityName}`);
        try {
            const url = `http://localhost:8080/api/air/history/${cityId}`;
            const response = await fetch(url);
            const data = await response.json();
            console.log('История города:', data);
            setCityHistory(data);
            setSelectedCity(cityName);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            setCityHistory([]);
        }
    };

    const fetchNearestCity = async (lat, lon) => {
        try {
            const response = await fetch(`http://localhost:8080/api/air/nearest-city?lat=${lat}&lon=${lon}`);
            const city = await response.json();
            if (city && city.id) {
                setSelectedCityInfo(city);
                fetchCityHistory(city.id, city.name);
            }
            return city;
        } catch (error) {
            console.error('Ошибка получения города:', error);
            return null;
        }
    };

    const showBalloon = (coords, data) => {
        if (!ymapsRef.current || !map) return;

        try {
            const pm25 = data?.hourly?.pm2_5?.[0];

            let aqiText = 'Нет данных';
            let aqiColor = '#999';

            if (pm25) {
                if (pm25 <= 12) { aqiText = 'Хорошо'; aqiColor = '#4CAF50'; }
                else if (pm25 <= 35.4) { aqiText = 'Умеренно'; aqiColor = '#FFC107'; }
                else if (pm25 <= 55.4) { aqiText = 'Вредно для чувствительных групп'; aqiColor = '#FF9800'; }
                else if (pm25 <= 150.4) { aqiText = 'Вредно'; aqiColor = '#F44336'; }
                else { aqiText = 'Очень вредно'; aqiColor = '#9C27B0'; }
            }

            const content = `
        <div style="font-family: Arial; min-width: 180px;">
          <b>Качество воздуха</b><br/>
          <span style="background:${aqiColor}; padding:2px 8px; border-radius:4px; display:inline-block; margin:5px 0;">
            ${aqiText}
          </span><br/>
          PM2.5: ${data?.hourly?.pm2_5?.[0] ?? 'нет данных'} μg/m³<br/>
          PM10: ${data?.hourly?.pm10?.[0] ?? 'нет данных'} μg/m³
        </div>
      `;

            if (currentInfoWindowRef.current) {
                try { currentInfoWindowRef.current.close(); } catch(e) {}
            }

            const infoWindow = new ymapsRef.current.InfoWindow({ content: content });
            infoWindow.open(map, coords);
            currentInfoWindowRef.current = infoWindow;

        } catch (error) {
            console.error('Ошибка балуна:', error);
        }
    };

    const initMap = () => {
        if (!ymapsRef.current || mapInitialized.current) return;

        try {
            const newMap = new ymapsRef.current.Map('map', {
                center: [55.751574, 37.573856],
                zoom: 5,
                controls: ['zoomControl', 'fullscreenControl']
            });

            setMap(newMap);
            mapInitialized.current = true;

            newMap.events.add('click', async (e) => {
                const coords = e.get('coords');
                console.log('Клик, координаты:', coords);

                if (currentPlacemarkRef.current) {
                    newMap.geoObjects.remove(currentPlacemarkRef.current);
                    currentPlacemarkRef.current = null;
                }

                const newPlacemark = new ymapsRef.current.Placemark(coords, {}, {
                    preset: 'islands#circleIcon',
                    iconColor: '#0066cc'
                });

                currentPlacemarkRef.current = newPlacemark;
                newMap.geoObjects.add(newPlacemark);

                fetchAirQuality(coords[0], coords[1]);
                fetchNearestCity(coords[0], coords[1]);
            });

        } catch (error) {
            console.error('Ошибка карты:', error);
        }
    };

    useEffect(() => {
        if (ymapsRef.current) {
            ymapsRef.current.ready(initMap);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://api-maps.yandex.ru/2.1/?apikey=9753de21-ac0e-4c05-bcdb-99e03f25844a&lang=ru_RU';
        script.async = true;

        script.onload = () => {
            if (window.ymaps) {
                ymapsRef.current = window.ymaps;
                ymapsRef.current.ready(initMap);
            }
        };

        script.onerror = () => {
            console.error('Ошибка загрузки API');
        };

        document.body.appendChild(script);

        return () => {
            if (map) {
                map.destroy();
            }
        };
    }, []);

    useEffect(() => {
        if (airData && currentCoords) {
            showBalloon(currentCoords, airData);
        }
    }, [airData, currentCoords]);

    // Фильтрация данных для графика по выбранному периоду
    const getFilteredHistory = () => {
        const now = new Date();
        let daysToFilter = historyDays;

        // Для 24 часов используем 1 день
        if (historyDays === 1) daysToFilter = 1;

        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - daysToFilter);

        return cityHistory.filter(item => new Date(item.requestedAt) >= cutoffDate);
    };

    const getAQIDisplay = () => {
        const pm25 = airData?.hourly?.pm2_5?.[0];
        let aqiText = 'Нет данных';
        let aqiColor = '#999';
        let textColor = '#fff';

        if (pm25) {
            if (pm25 <= 12) {
                aqiText = 'Хорошо';
                aqiColor = '#4CAF50';
                textColor = '#fff';
            } else if (pm25 <= 35.4) {
                aqiText = 'Умеренно';
                aqiColor = '#FFC107';
                textColor = '#333';
            } else if (pm25 <= 55.4) {
                aqiText = 'Вредно для чувствительных групп';
                aqiColor = '#FF9800';
                textColor = '#fff';
            } else if (pm25 <= 150.4) {
                aqiText = 'Вредно';
                aqiColor = '#F44336';
                textColor = '#fff';
            } else {
                aqiText = 'Очень вредно';
                aqiColor = '#9C27B0';
                textColor = '#fff';
            }
        }

        return { aqiText, aqiColor, textColor };
    };

    const filteredHistory = getFilteredHistory();

    // Сортировка по дате (сначала старые, для графика)
    const sortedHistory = [...filteredHistory].sort((a, b) =>
        new Date(a.requestedAt) - new Date(b.requestedAt)
    );

    const chartTextColor = darkMode ? '#e0e0e0' : '#333';
    const chartGridColor = darkMode ? '#444' : '#eee';

    const chartData = {
        labels: sortedHistory.map(item =>
            new Date(item.requestedAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: historyDays === 1 ? '2-digit' : undefined,
                minute: historyDays === 1 ? '2-digit' : undefined
            })
        ),
        datasets: [
            {
                label: 'AQI (Качество воздуха)',
                data: sortedHistory.map(item => item.aqi),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: sortedHistory.map(item => {
                    if (item.aqi <= 50) return '#4CAF50';
                    if (item.aqi <= 100) return '#FFC107';
                    if (item.aqi <= 150) return '#FF9800';
                    if (item.aqi <= 200) return '#F44336';
                    return '#9C27B0';
                }),
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'top',
                labels: { color: chartTextColor }
            },
            title: {
                display: true,
                text: selectedCity ? `Динамика качества воздуха: ${selectedCity}` : 'Динамика качества воздуха',
                color: chartTextColor,
                font: { size: 16 }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        return `AQI: ${context.raw}`;
                    }
                }
            }
        },
        scales: {
            y: {
                title: { display: true, text: 'Индекс качества воздуха (AQI)', color: chartTextColor },
                ticks: { color: chartTextColor, stepSize: 50 },
                grid: { color: chartGridColor },
                min: 0,
                max: 300
            },
            x: {
                title: { display: true, text: historyDays === 1 ? 'Время' : 'Дата', color: chartTextColor },
                ticks: {
                    color: chartTextColor,
                    rotation: historyDays === 1 ? 45 : 0,
                    maxRotation: 45,
                    autoSkip: true,
                    maxTicksLimit: 8
                },
                grid: { color: chartGridColor }
            }
        }
    };

    const { aqiText, aqiColor, textColor } = getAQIDisplay();

    const themeStyles = {
        backgroundColor: darkMode ? '#1a1a2e' : '#f0f2f5',
        textColor: darkMode ? '#e0e0e0' : '#333',
        cardBg: darkMode ? '#16213e' : 'white',
        cardHeaderBg: darkMode ? '#0f3460' : '#34495e',
        borderColor: darkMode ? '#2c3e50' : '#ddd',
        tableRowBg: darkMode ? '#1a1a2e' : '#f8f9fa',
        buttonActive: darkMode ? '#4CAF50' : '#2c3e50',
        buttonInactive: darkMode ? '#2c3e50' : '#95a5a6'
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: themeStyles.backgroundColor,
            color: themeStyles.textColor,
            fontFamily: 'Arial, sans-serif'
        }}>
            {/* Шапка с переключателем темы */}
            <div style={{
                backgroundColor: themeStyles.cardHeaderBg,
                color: 'white',
                padding: '15px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px' }}>🌍 ЭкоМониторинг</h1>
                    <p style={{ margin: '5px 0 0', fontSize: '14px', opacity: 0.8 }}>
                        Мониторинг качества воздуха в реальном времени
                    </p>
                </div>
                <button
                    onClick={() => setDarkMode(!darkMode)}
                    style={{
                        background: darkMode ? '#f39c12' : '#2c3e50',
                        border: 'none',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '25px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s ease'
                    }}
                >
                    {darkMode ? '☀️ Светлая тема' : '🌙 Темная тема'}
                </button>
            </div>

            {/* Карта */}
            <div style={{
                width: '100%',
                height: '70vh',
                borderBottom: `1px solid ${themeStyles.borderColor}`
            }}>
                <div id="map" style={{ width: '100%', height: '100%' }}></div>
            </div>

            {/* Информационная панель */}
            <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
                {!airData && !loading && (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        backgroundColor: themeStyles.cardBg,
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        color: themeStyles.textColor
                    }}>
                        <p style={{ fontSize: '18px' }}>
                            👆 Кликните на карту, чтобы получить данные о качестве воздуха
                        </p>
                    </div>
                )}

                {loading && (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        backgroundColor: themeStyles.cardBg,
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                        <p>🔄 Загрузка данных...</p>
                    </div>
                )}

                {airData && !loading && currentCoords && (
                    <>
                        {/* Карточка с текущими показателями */}
                        <div style={{
                            backgroundColor: themeStyles.cardBg,
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            overflow: 'hidden',
                            marginBottom: '20px'
                        }}>
                            <div style={{
                                backgroundColor: themeStyles.cardHeaderBg,
                                color: 'white',
                                padding: '12px 20px',
                                fontSize: '18px',
                                fontWeight: 'bold'
                            }}>
                                📊 Текущие показатели качества воздуха
                            </div>
                            <div style={{ padding: '20px' }}>
                                {selectedCityInfo && (
                                    <div style={{ marginBottom: '15px', fontSize: '16px' }}>
                                        📍 <strong>Город:</strong> {selectedCityInfo.name}
                                        {selectedCityInfo.region && `, ${selectedCityInfo.region}`}
                                    </div>
                                )}
                                <div style={{
                                    backgroundColor: aqiColor,
                                    padding: '15px',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    color: textColor,
                                    marginBottom: '20px'
                                }}>
                  <span style={{ fontSize: '28px', fontWeight: 'bold' }}>
                    Индекс качества воздуха (AQI): {aqiText}
                  </span>
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: '15px'
                                }}>
                                    <div style={{
                                        background: themeStyles.tableRowBg,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        color: themeStyles.textColor
                                    }}>
                                        <strong>PM2.5:</strong> {airData?.hourly?.pm2_5?.[0] ?? 'нет данных'} μg/m³
                                    </div>
                                    <div style={{
                                        background: themeStyles.tableRowBg,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        color: themeStyles.textColor
                                    }}>
                                        <strong>PM10:</strong> {airData?.hourly?.pm10?.[0] ?? 'нет данных'} μg/m³
                                    </div>
                                    <div style={{
                                        background: themeStyles.tableRowBg,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        color: themeStyles.textColor
                                    }}>
                                        <strong>CO:</strong> {airData?.hourly?.carbon_monoxide?.[0] ?? 'нет данных'} μg/m³
                                    </div>
                                    <div style={{
                                        background: themeStyles.tableRowBg,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        color: themeStyles.textColor
                                    }}>
                                        <strong>NO₂:</strong> {airData?.hourly?.nitrogen_dioxide?.[0] ?? 'нет данных'} μg/m³
                                    </div>
                                    <div style={{
                                        background: themeStyles.tableRowBg,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        color: themeStyles.textColor
                                    }}>
                                        <strong>SO₂:</strong> {airData?.hourly?.sulphur_dioxide?.[0] ?? 'нет данных'} μg/m³
                                    </div>
                                </div>
                                <p style={{ fontSize: '11px', color: '#666', marginTop: '15px' }}>
                                    📊 Источник данных: Open-Meteo API
                                </p>
                            </div>
                        </div>

                        {/* Карточка с графиком динамики */}
                        {cityHistory.length > 0 && (
                            <div style={{
                                backgroundColor: themeStyles.cardBg,
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    backgroundColor: themeStyles.cardHeaderBg,
                                    color: 'white',
                                    padding: '12px 20px',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '10px'
                                }}>
                                    <span>📈 Динамика качества воздуха</span>

                                    {/* Переключатели периода */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => setHistoryDays(1)}
                                            style={{
                                                background: historyDays === 1 ? themeStyles.buttonActive : themeStyles.buttonInactive,
                                                border: 'none',
                                                color: 'white',
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 'bold',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            24 часа
                                        </button>
                                        <button
                                            onClick={() => setHistoryDays(7)}
                                            style={{
                                                background: historyDays === 7 ? themeStyles.buttonActive : themeStyles.buttonInactive,
                                                border: 'none',
                                                color: 'white',
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 'bold',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            Неделя
                                        </button>
                                        <button
                                            onClick={() => setHistoryDays(30)}
                                            style={{
                                                background: historyDays === 30 ? themeStyles.buttonActive : themeStyles.buttonInactive,
                                                border: 'none',
                                                color: 'white',
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 'bold',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            Месяц
                                        </button>
                                    </div>
                                </div>
                                <div style={{ padding: '20px' }}>
                                    <div style={{ height: '350px' }}>
                                        <Line data={chartData} options={chartOptions} />
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#666', marginTop: '15px', textAlign: 'center' }}>
                                        Показано {sortedHistory.length} измерений из {cityHistory.length} за последние {
                                        historyDays === 1 ? '24 часа' : historyDays === 7 ? '7 дней' : '30 дней'
                                    }
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}