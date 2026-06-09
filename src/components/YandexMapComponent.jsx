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
import AuthModal from './AuthModal';
import ProfileSettings from './ProfileSettings';
import AdminPanel from "./AdminPanel.jsx";
import html2canvas from 'html2canvas';
import 'jspdf-autotable';
import API_URL from "../config";

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
    const [historyDays, setHistoryDays] = useState(7);
    const [selectedMetric, setSelectedMetric] = useState('aqi');
    const [locating, setLocating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || '');

    // Состояния для экспорта
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState('csv');
    const [exportDays, setExportDays] = useState(30);
    const [exportMetric, setExportMetric] = useState('aqi');

    const mapInitialized = useRef(false);
    const ymapsRef = useRef(null);
    const currentPlacemarkRef = useRef(null);
    const currentInfoWindowRef = useRef(null);

    const metrics = [
        { key: 'aqi', label: 'AQI', unit: '', color: 'rgb(75, 192, 192)', yMax: 300, yStep: 50,
            description: 'Индекс качества воздуха — комплексный показатель. Чем ниже, тем чище воздух.' },
        { key: 'pm25', label: 'PM2.5', unit: 'μg/m³', color: 'rgb(255, 99, 132)', yMax: 200, yStep: 40,
            description: 'Твердые частицы до 2.5 мкм. Проникают в легкие и кровоток, наиболее опасны.' },
        { key: 'pm10', label: 'PM10', unit: 'μg/m³', color: 'rgb(54, 162, 235)', yMax: 200, yStep: 40,
            description: 'Твердые частицы до 10 мкм. Вызывают раздражение дыхательных путей.' },
        { key: 'co', label: 'CO', unit: 'μg/m³', color: 'rgb(255, 159, 64)', yMax: 1000, yStep: 200,
            description: 'Угарный газ. Снижает способность крови переносить кислород.' },
        { key: 'no2', label: 'NO₂', unit: 'μg/m³', color: 'rgb(153, 102, 255)', yMax: 200, yStep: 40,
            description: 'Диоксид азота. Раздражает легкие, может вызывать бронхит.' },
        { key: 'so2', label: 'SO₂', unit: 'μg/m³', color: 'rgb(255, 99, 71)', yMax: 150, yStep: 30,
            description: 'Диоксид серы. Раздражает слизистые дыхательных путей.' }
    ];

    const getMetricValue = (item, metricKey) => {
        switch(metricKey) {
            case 'aqi': return item.aqi;
            case 'pm25': return item.pm25;
            case 'pm10': return item.pm10;
            case 'co': return item.co;
            case 'no2': return item.no2;
            case 'so2': return item.so2;
            default: return item.aqi;
        }
    };

    const getMetricUnit = () => {
        const metric = metrics.find(m => m.key === selectedMetric);
        return metric ? metric.unit : '';
    };

    const getMetricLabel = () => {
        const metric = metrics.find(m => m.key === selectedMetric);
        return metric ? `${metric.label}` : selectedMetric.toUpperCase();
    };

    // Функции экспорта
    const openExportModal = (format) => {
        setExportFormat(format);
        setExportModalOpen(true);
    };

    const closeExportModal = () => {
        setExportModalOpen(false);
    };

    const exportCSV = async () => {
        if (!selectedCityInfo) return;
        try {
            const response = await fetch(`${API_URL}/api/air/history/export/${selectedCityInfo.id}?days=${exportDays}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `air_quality_${selectedCityInfo.name}_${exportDays}days.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            closeExportModal();
        } catch (error) {
            console.error('Ошибка экспорта CSV:', error);
            alert('Ошибка экспорта');
        }
    };


    const exportPNG = async () => {
        const element = document.getElementById('chart-container');
        if (!element) {
            alert('Контейнер графика не найден');
            return;
        }

        try {
            const canvas = await html2canvas(element, {
                scale: 2, // лучшее качество
                backgroundColor: themeStyles.cardBg,
                logging: false
            });

            const link = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            link.download = `aqi_${selectedCityInfo?.name || 'chart'}_${exportMetric}_${exportDays}days_${timestamp}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            closeExportModal();
        } catch (error) {
            console.error('Ошибка экспорта PNG:', error);
            alert('Не удалось сохранить график');
        }
    };

    const exportPDF = () => {
        generateFullPdfReport();
    };

    const generateFullPdfReport = async () => {
        if (!selectedCityInfo) {
            alert('Сначала выберите город на карте');
            return;
        }

        const loadingDiv = document.createElement('div');
        loadingDiv.textContent = `Загрузка данных за ${exportDays} дней...`;
        loadingDiv.style.position = 'fixed';
        loadingDiv.style.bottom = '20px';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translateX(-50%)';
        loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
        loadingDiv.style.color = 'white';
        loadingDiv.style.padding = '12px 24px';
        loadingDiv.style.borderRadius = '8px';
        loadingDiv.style.zIndex = '9999';
        document.body.appendChild(loadingDiv);

        try {
            // Загружаем историю за выбранный период
            const response = await fetch(`${API_URL}/api/air/history/${selectedCityInfo.id}/period?days=${exportDays}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const fullHistory = await response.json();

            if (!fullHistory || fullHistory.length === 0) {
                alert(`Нет данных за выбранный период (${exportDays} дней)`);
                document.body.removeChild(loadingDiv);
                closeExportModal();
                return;
            }

            // Расчет статистики
            const calcStats = (data, field) => {
                const valid = data.filter(item => item[field] !== null && item[field] !== undefined);
                if (valid.length === 0) return { avg: '-', max: '-', min: '-' };
                const sum = valid.reduce((s, item) => s + item[field], 0);
                return {
                    avg: (sum / valid.length).toFixed(1),
                    max: Math.max(...valid.map(item => item[field])).toFixed(1),
                    min: Math.min(...valid.map(item => item[field])).toFixed(1)
                };
            };

            const stats = {
                aqi: calcStats(fullHistory, 'aqi'),
                pm25: calcStats(fullHistory, 'pm25'),
                pm10: calcStats(fullHistory, 'pm10'),
                co: calcStats(fullHistory, 'co'),
                no2: calcStats(fullHistory, 'no2'),
                so2: calcStats(fullHistory, 'so2')
            };

            // Определяем период
            let periodText = '';
            if (exportDays === 1) periodText = '24 часа';
            else if (exportDays === 7) periodText = '7 дней';
            else if (exportDays === 30) periodText = '30 дней';
            else if (exportDays === 90) periodText = '90 дней';
            else if (exportDays === 365) periodText = 'год';
            else periodText = `${exportDays} дней`;

            // Формируем HTML отчета
            const reportHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>ЭкоМониторинг - Статистический отчет</title>
                <style>
                    body {
                        font-family: 'Times New Roman', Times, serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 40px 20px;
                        background-color: #f5f5f5;
                    }
                    .report {
                        background-color: white;
                        padding: 40px;
                        border-radius: 12px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #2c3e50;
                        text-align: center;
                        margin-bottom: 5px;
                        font-size: 28px;
                    }
                    h2 {
                        color: #34495e;
                        text-align: center;
                        border-bottom: 2px solid #2c3e50;
                        padding-bottom: 10px;
                        margin-top: 0;
                        font-size: 20px;
                    }
                    h3 {
                        background-color: #2c3e50;
                        color: white;
                        padding: 8px 12px;
                        border-radius: 6px;
                        margin-top: 30px;
                        font-size: 16px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    th, td {
                        padding: 12px;
                        text-align: left;
                        border: 1px solid #ddd;
                    }
                    th {
                        background-color: #34495e;
                        color: white;
                        font-weight: bold;
                    }
                    td {
                        background-color: white;
                    }
                    .stats-table td {
                        text-align: center;
                    }
                    .info-table td {
                        padding: 10px;
                    }
                    .info-table td:first-child {
                        font-weight: bold;
                        width: 30%;
                        background-color: #f9f9f9;
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 15px;
                        border-top: 2px solid #2c3e50;
                        text-align: center;
                        font-size: 11px;
                        color: #666;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                            background-color: white;
                        }
                        .report {
                            box-shadow: none;
                            padding: 20px;
                        }
                        button {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="report">
                    <h1>🌍 ЭкоМониторинг</h1>
                    <h2>СТАТИСТИЧЕСКИЙ ОТЧЕТ<br/>О КАЧЕСТВЕ ВОЗДУХА</h2>
                    
                    <h3>📊 ИНФОРМАЦИЯ ОБ ОТЧЕТЕ</h3>
                    <table class="info-table">
                        <tr><td>Город:</td><td><strong>${selectedCityInfo.name}</strong></td></tr>
                        <tr><td>Регион:</td><td>${selectedCityInfo.region || '-'}</td></tr>
                        <tr><td>Период анализа:</td><td><strong>${periodText}</strong></td></tr>
                        <tr><td>Количество измерений:</td><td><strong>${fullHistory.length}</strong></td></tr>
                        <tr><td>Дата формирования отчета:</td><td>${new Date().toLocaleString('ru-RU')}</td></tr>
                        <tr><td>Источник данных:</td><td>Open-Meteo API</td></tr>
                    </table>
                    
                    <h3>📈 СТАТИСТИКА ЗА ПЕРИОД</h3>
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Показатель</th>
                                <th>Среднее значение</th>
                                <th>Максимальное</th>
                                <th>Минимальное</th>
                                <th>Единица измерения</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>AQI</strong><br/><span style="font-size: 10px; color: #666;">Индекс качества воздуха</span></td>
                                <td><strong>${stats.aqi.avg}</strong></td>
                                <td>${stats.aqi.max}</td>
                                <td>${stats.aqi.min}</td>
                                <td>—</td>
                            </tr>
                            <tr style="background-color: #f9f9f9;">
                                <td><strong>PM2.5</strong><br/><span style="font-size: 10px; color: #666;">Твердые частицы до 2.5 мкм</span></td>
                                <td><strong>${stats.pm25.avg}</strong></td>
                                <td>${stats.pm25.max}</td>
                                <td>${stats.pm25.min}</td>
                                <td>мкг/м³</td>
                            </tr>
                            <tr>
                                <td><strong>PM10</strong><br/><span style="font-size: 10px; color: #666;">Твердые частицы до 10 мкм</span></td>
                                <td><strong>${stats.pm10.avg}</strong></td>
                                <td>${stats.pm10.max}</td>
                                <td>${stats.pm10.min}</td>
                                <td>мкг/м³</td>
                            </tr>
                            <tr style="background-color: #f9f9f9;">
                                <td><strong>CO</strong><br/><span style="font-size: 10px; color: #666;">Угарный газ</span></td>
                                <td><strong>${stats.co.avg}</strong></td>
                                <td>${stats.co.max}</td>
                                <td>${stats.co.min}</td>
                                <td>мкг/м³</td>
                            </tr>
                            <tr>
                                <td><strong>NO₂</strong><br/><span style="font-size: 10px; color: #666;">Диоксид азота</span></td>
                                <td><strong>${stats.no2.avg}</strong></td>
                                <td>${stats.no2.max}</td>
                                <td>${stats.no2.min}</td>
                                <td>мкг/м³</td>
                            </tr>
                            <tr style="background-color: #f9f9f9;">
                                <td><strong>SO₂</strong><br/><span style="font-size: 10px; color: #666;">Диоксид серы</span></td>
                                <td><strong>${stats.so2.avg}</strong></td>
                                <td>${stats.so2.max}</td>
                                <td>${stats.so2.min}</td>
                                <td>мкг/м³</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="footer">
                        <p>© ЭкоМониторинг - Система мониторинга качества воздуха</p>
                        <p>📊 Данные предоставлены Open-Meteo API • Нормы: ВОЗ (2021), СанПиН 1.2.3685-21</p>
                        <button onclick="window.print()" style="margin-top: 15px; padding: 10px 20px; background-color: #2c3e50; color: white; border: none; border-radius: 5px; cursor: pointer;">🖨️ Сохранить как PDF</button>
                    </div>
                </div>
                <script>
                    setTimeout(function() { window.print(); }, 500);
                </script>
            </body>
            </html>
        `;

            const reportWindow = window.open('', '_blank');
            if (!reportWindow) {
                alert('Пожалуйста, разрешите всплывающие окна для этого сайта');
                document.body.removeChild(loadingDiv);
                closeExportModal();
                return;
            }

            reportWindow.document.write(reportHtml);
            reportWindow.document.close();

        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при генерации PDF: ' + error.message);
        } finally {
            if (loadingDiv && loadingDiv.parentNode) {
                document.body.removeChild(loadingDiv);
            }
            closeExportModal();
        }
    };

// Функция расчета статистики
    const calcStats = (data, field) => {
        const valid = data.filter(item => item[field] !== null && item[field] !== undefined);
        if (valid.length === 0) return { avg: '-', max: '-', min: '-' };
        const sum = valid.reduce((s, item) => s + item[field], 0);
        return {
            avg: (sum / valid.length).toFixed(1),
            max: Math.max(...valid.map(item => item[field])).toFixed(1),
            min: Math.min(...valid.map(item => item[field])).toFixed(1)
        };
    };

    const handleExport = () => {
        if (exportFormat === 'csv') exportCSV();
        else if (exportFormat === 'png') exportPNG();
        else if (exportFormat === 'pdf') exportPDF();
    };

    // Обработчик клика по email
    const handleEmailClick = () => {
        setIsProfileOpen(true);
    };

    const handleProfileUpdate = (newEmail) => {
        setUserEmail(newEmail);
    };

    const fetchAirQuality = async (lat, lon) => {
        setLoading(true);
        setCurrentCoords([lat, lon]);

        try {
            const url = `${API_URL}/api/air?lat=${lat}&lon=${lon}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
            const data = await response.json();
            setAirData(data);
        } catch (error) {
            console.error('Ошибка:', error);
            setAirData(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchCityHistory = async (cityId, cityName) => {
        try {
            const url = `${API_URL}/api/air/history/${cityId}`;
            const response = await fetch(url);
            const data = await response.json();
            setCityHistory(data);
            setSelectedCity(cityName);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            setCityHistory([]);
        }
    };

    const fetchNearestCity = async (lat, lon) => {
        try {
            const response = await fetch(`${API_URL}/api/air/nearest-city?lat=${lat}&lon=${lon}`);
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

    const handleMyLocation = () => {
        if (!ymapsRef.current || !map) {
            console.warn('Карта еще не загружена');
            return;
        }

        setLocating(true);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    console.log('Мое местоположение:', latitude, longitude);

                    map.setCenter([latitude, longitude]);
                    map.setZoom(12);

                    if (currentPlacemarkRef.current) {
                        map.geoObjects.remove(currentPlacemarkRef.current);
                    }

                    const newPlacemark = new ymapsRef.current.Placemark([latitude, longitude], {}, {
                        preset: 'islands#circleIcon',
                        iconColor: '#0066cc'
                    });

                    currentPlacemarkRef.current = newPlacemark;
                    map.geoObjects.add(newPlacemark);

                    fetchAirQuality(latitude, longitude);
                    fetchNearestCity(latitude, longitude);
                    setLocating(false);
                },
                (error) => {
                    console.error('Ошибка геолокации:', error);
                    alert('Не удалось определить ваше местоположение. Проверьте разрешения в браузере.');
                    setLocating(false);
                }
            );
        } else {
            alert('Ваш браузер не поддерживает геолокацию');
            setLocating(false);
        }
    };

    const searchCities = async (query) => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/air/cities/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            setSearchResults(data);
            setShowResults(true);
        } catch (error) {
            console.error('Ошибка поиска городов:', error);
            setSearchResults([]);
        }
    };

    const selectCity = (city) => {
        map.setCenter([city.latitude, city.longitude]);
        map.setZoom(12);

        if (currentPlacemarkRef.current) {
            map.geoObjects.remove(currentPlacemarkRef.current);
        }

        const newPlacemark = new ymapsRef.current.Placemark([city.latitude, city.longitude], {}, {
            preset: 'islands#circleIcon',
            iconColor: '#0066cc'
        });

        currentPlacemarkRef.current = newPlacemark;
        map.geoObjects.add(newPlacemark);

        fetchAirQuality(city.latitude, city.longitude);
        fetchNearestCity(city.latitude, city.longitude);

        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
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

    // Проверка токена при загрузке
    useEffect(() => {
        const token = localStorage.getItem('token');
        const email = localStorage.getItem('userEmail');
        if (token && email) {
            setIsLoggedIn(true);
            setUserEmail(email);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userRole');
        setIsLoggedIn(false);
        setUserEmail('');
        setUserRole('');
    };

    const handleLoginSuccess = (userData) => {
        setIsLoggedIn(true);
        setUserEmail(userData.email);
        setUserRole(userData.role || 'USER');
        localStorage.setItem('userRole', userData.role || 'USER');
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

                if (currentPlacemarkRef.current) {
                    newMap.geoObjects.remove(currentPlacemarkRef.current);
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

        document.body.appendChild(script);

        return () => {
            if (map) map.destroy();
        };
    }, []);

    useEffect(() => {
        if (airData && currentCoords) showBalloon(currentCoords, airData);
    }, [airData, currentCoords]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.search-container')) {
                setShowResults(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const getFilteredHistory = () => {
        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - historyDays);
        return cityHistory.filter(item => new Date(item.requestedAt) >= cutoffDate);
    };

    const getAQIDisplay = () => {
        const pm25 = airData?.hourly?.pm2_5?.[0];
        let aqiText = 'Нет данных';
        let aqiColor = '#999';
        let textColor = '#fff';

        if (pm25) {
            if (pm25 <= 12) { aqiText = 'Хорошо'; aqiColor = '#4CAF50'; textColor = '#fff'; }
            else if (pm25 <= 35.4) { aqiText = 'Умеренно'; aqiColor = '#FFC107'; textColor = '#333'; }
            else if (pm25 <= 55.4) { aqiText = 'Вредно для чувствительных групп'; aqiColor = '#FF9800'; textColor = '#fff'; }
            else if (pm25 <= 150.4) { aqiText = 'Вредно'; aqiColor = '#F44336'; textColor = '#fff'; }
            else { aqiText = 'Очень вредно'; aqiColor = '#9C27B0'; textColor = '#fff'; }
        }
        return { aqiText, aqiColor, textColor };
    };

    const filteredHistory = getFilteredHistory();
    const sortedHistory = [...filteredHistory].sort((a, b) =>
        new Date(a.requestedAt) - new Date(b.requestedAt)
    );

    const currentMetric = metrics.find(m => m.key === selectedMetric);
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
        datasets: [{
            label: getMetricLabel(),
            data: sortedHistory.map(item => getMetricValue(item, selectedMetric)),
            borderColor: currentMetric?.color || 'rgb(75, 192, 192)',
            backgroundColor: `${currentMetric?.color || 'rgb(75, 192, 192)'}33`,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: selectedMetric === 'aqi'
                ? sortedHistory.map(item => {
                    if (item.aqi <= 50) return '#4CAF50';
                    if (item.aqi <= 100) return '#FFC107';
                    if (item.aqi <= 150) return '#FF9800';
                    if (item.aqi <= 200) return '#F44336';
                    return '#9C27B0';
                })
                : currentMetric?.color || 'rgb(75, 192, 192)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { position: 'top', labels: { color: chartTextColor, boxWidth: 12 } },
            tooltip: {
                callbacks: {
                    label: (context) => `${getMetricLabel()}: ${context.raw} ${getMetricUnit()}`
                }
            }
        },
        scales: {
            y: {
                ticks: { color: chartTextColor, stepSize: currentMetric?.yStep || 50 },
                grid: { color: chartGridColor },
                min: 0,
                max: currentMetric?.yMax || 300
            },
            x: {
                ticks: { color: chartTextColor, rotation: 45, maxRotation: 45, autoSkip: true, maxTicksLimit: 6 },
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
            {/* Шапка */}
            <div style={{
                backgroundColor: themeStyles.cardHeaderBg,
                color: 'white',
                padding: '15px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px' }}>🌍 ЭкоМониторинг</h1>
                    <p style={{ margin: '5px 0 0', fontSize: '14px', opacity: 0.8 }}>
                        Мониторинг качества воздуха в реальном времени
                    </p>
                </div>

                <div className="search-container" style={{ position: 'relative', minWidth: '250px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Поиск города..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            searchCities(e.target.value);
                        }}
                        style={{
                            width: '100%',
                            padding: '10px 15px',
                            borderRadius: '25px',
                            border: 'none',
                            fontSize: '14px',
                            outline: 'none',
                            backgroundColor: darkMode ? '#2c3e50' : 'white',
                            color: darkMode ? 'white' : '#333'
                        }}
                    />

                    {showResults && searchResults.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '5px',
                            backgroundColor: themeStyles.cardBg,
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            zIndex: 1000,
                            maxHeight: '300px',
                            overflowY: 'auto'
                        }}>
                            {searchResults.map(city => (
                                <div
                                    key={city.id}
                                    onClick={() => selectCity(city)}
                                    style={{
                                        padding: '10px 15px',
                                        cursor: 'pointer',
                                        borderBottom: `1px solid ${themeStyles.borderColor}`,
                                        fontSize: '14px',
                                        transition: 'background 0.2s',
                                        color: themeStyles.textColor
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = themeStyles.tableRowBg}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <strong>{city.name}</strong>
                                    {city.region && <span style={{ fontSize: '12px', opacity: 0.7 }}> • {city.region}</span>}
                                    {city.population && (
                                        <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '8px' }}>
                                            👥 {city.population.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleMyLocation}
                        disabled={locating}
                        style={{
                            background: darkMode ? '#f39c12' : '#2c3e50',
                            border: 'none',
                            color: 'white',
                            padding: '10px 20px',
                            borderRadius: '25px',
                            cursor: locating ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: locating ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>📍</span> {locating ? 'Определение...' : 'Моё местоположение'}
                    </button>

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
                            fontWeight: 'bold'
                        }}
                    >
                        {darkMode ? '☀️ Светлая тема' : '🌙 Темная тема'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {!isLoggedIn ? (
                        <button
                            onClick={() => setIsAuthModalOpen(true)}
                            style={{
                                background: '#f39c12',
                                border: 'none',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '25px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold'
                            }}
                        >
                            🔑 Войти
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsProfileOpen(true)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid white',
                                    color: 'white',
                                    padding: '10px 20px',
                                    borderRadius: '25px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                👤 {userEmail}
                            </button>

                            {userRole === 'ADMIN' && (
                                <button
                                    onClick={() => setIsAdminPanelOpen(true)}
                                    style={{
                                        background: '#9b59b6',
                                        border: 'none',
                                        color: 'white',
                                        padding: '10px 20px',
                                        borderRadius: '25px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    👑 Админ-панель
                                </button>
                            )}

                            <button
                                onClick={handleLogout}
                                style={{
                                    background: '#e74c3c',
                                    border: 'none',
                                    color: 'white',
                                    padding: '10px 20px',
                                    borderRadius: '25px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}
                            >
                                Выйти
                            </button>
                        </>
                    )}

                    <ProfileSettings
                        isOpen={isProfileOpen}
                        onClose={() => setIsProfileOpen(false)}
                        userEmail={userEmail}
                        token={localStorage.getItem('token')}
                        onUpdate={handleProfileUpdate}
                    />

                    <AdminPanel
                        isOpen={isAdminPanelOpen}
                        onClose={() => setIsAdminPanelOpen(false)}
                        token={localStorage.getItem('token')}
                        currentUserEmail={userEmail}
                    />
                </div>

                <AuthModal
                    isOpen={isAuthModalOpen}
                    onClose={() => setIsAuthModalOpen(false)}
                    onLoginSuccess={handleLoginSuccess}
                />
            </div>

            {/* Карта */}
            <div style={{
                width: '100%',
                height: '70vh',
                minHeight: '400px',
                borderBottom: `1px solid ${themeStyles.borderColor}`
            }}>
                <div id="map" style={{ width: '100%', height: '100%' }}></div>
            </div>

            {/* Контент под картой */}
            <div style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '20px',
                width: '100%'
            }}>

                {/* Блок с текущими показателями */}
                {airData && !loading && currentCoords ? (
                    <div style={{
                        backgroundColor: themeStyles.cardBg,
                        borderRadius: '12px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                        marginBottom: '20px',
                        overflow: 'hidden'
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
                                <p style={{ marginBottom: '8px', marginTop: '0px', fontSize: '16px' }}>
                                    📍 <strong>Город:</strong> {selectedCityInfo.name}
                                    {selectedCityInfo.region && `, ${selectedCityInfo.region}`}
                                </p>
                            )}
                            <div style={{
                                backgroundColor: aqiColor,
                                padding: '12px',
                                borderRadius: '10px',
                                textAlign: 'center',
                                color: textColor,
                                marginBottom: '15px'
                            }}>
                                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                    Индекс качества воздуха (AQI): {aqiText}
                                </span>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '15px'
                            }}>
                                <div style={{ background: themeStyles.tableRowBg, padding: '10px', borderRadius: '8px' }}>
                                    <strong>PM2.5:</strong> {airData?.hourly?.pm2_5?.[0] ?? 'нет данных'} μg/m³
                                </div>
                                <div style={{ background: themeStyles.tableRowBg, padding: '10px', borderRadius: '8px' }}>
                                    <strong>PM10:</strong> {airData?.hourly?.pm10?.[0] ?? 'нет данных'} μg/m³
                                </div>
                                <div style={{ background: themeStyles.tableRowBg, padding: '10px', borderRadius: '8px' }}>
                                    <strong>CO:</strong> {airData?.hourly?.carbon_monoxide?.[0] ?? 'нет данных'} μg/m³
                                </div>
                                <div style={{ background: themeStyles.tableRowBg, padding: '10px', borderRadius: '8px' }}>
                                    <strong>NO₂:</strong> {airData?.hourly?.nitrogen_dioxide?.[0] ?? 'нет данных'} μg/m³
                                </div>
                                <div style={{ background: themeStyles.tableRowBg, padding: '10px', borderRadius: '8px' }}>
                                    <strong>SO₂:</strong> {airData?.hourly?.sulphur_dioxide?.[0] ?? 'нет данных'} μg/m³
                                </div>
                            </div>
                        </div>
                    </div>
                ) : !loading && (
                    <div style={{
                        backgroundColor: themeStyles.cardBg,
                        borderRadius: '12px',
                        padding: '40px',
                        textAlign: 'center',
                        marginBottom: '20px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
                    }}>
                        <p style={{ fontSize: '18px' }}>👆 Кликните на карту, чтобы получить данные</p>
                    </div>
                )}

                {loading && (
                    <div style={{
                        backgroundColor: themeStyles.cardBg,
                        borderRadius: '12px',
                        padding: '40px',
                        textAlign: 'center',
                        marginBottom: '20px'
                    }}>
                        <p>🔄 Загрузка данных...</p>
                    </div>
                )}

                {/* Две колонки: график + справочная информация */}
                {cityHistory.length > 0 && (
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        {/* Левая колонка - график */}
                        <div style={{
                            flex: '2',
                            minWidth: '300px',
                            backgroundColor: themeStyles.cardBg,
                            borderRadius: '12px',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                backgroundColor: themeStyles.cardHeaderBg,
                                color: 'white',
                                padding: '12px 20px',
                                fontSize: '18px',
                                fontWeight: 'bold'
                            }}>
                                📈 Динамика показателей
                            </div>

                            {/* Переключатели периода */}
                            <div style={{ padding: '12px 20px', display: 'flex', gap: '10px', borderBottom: `1px solid ${themeStyles.borderColor}` }}>
                                <button onClick={() => setHistoryDays(1)} style={{ background: historyDays === 1 ? themeStyles.buttonActive : themeStyles.buttonInactive, border: 'none', color: 'white', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px' }}>24 часа</button>
                                <button onClick={() => setHistoryDays(7)} style={{ background: historyDays === 7 ? themeStyles.buttonActive : themeStyles.buttonInactive, border: 'none', color: 'white', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px' }}>Неделя</button>
                                <button onClick={() => setHistoryDays(30)} style={{ background: historyDays === 30 ? themeStyles.buttonActive : themeStyles.buttonInactive, border: 'none', color: 'white', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px' }}>Месяц</button>
                            </div>

                            {/* Переключатели показателей */}
                            <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px', borderBottom: `1px solid ${themeStyles.borderColor}` }}>
                                {metrics.map(m => (
                                    <button key={m.key} onClick={() => setSelectedMetric(m.key)} style={{
                                        background: selectedMetric === m.key ? m.color : 'transparent',
                                        border: `1px solid ${m.color}`,
                                        color: selectedMetric === m.key ? 'white' : m.color,
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                    }}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>

                            {/* ГРАФИК + КНОПКИ ЭКСПОРТА ВЕРТИКАЛЬНО */}
                            <div style={{ display: 'flex', gap: '15px', padding: '20px' }}>
                                {/* График */}
                                <div id="chart-for-pdf" style={{ flex: 4, height: '350px' }}>
                                    <Line data={chartData} options={chartOptions} />
                                </div>

                                {/* Вертикальные кнопки экспорта */}
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                    justifyContent: 'center',
                                    alignItems: 'stretch'
                                }}>
                                    <div style={{
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        color: themeStyles.textColor,
                                        marginBottom: '5px'
                                    }}>
                                        Экспорт выбранного графика
                                    </div>
                                    <button
                                        onClick={() => openExportModal('csv')}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: '#4CAF50',
                                            border: 'none',
                                            borderRadius: '6px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        📄 CSV
                                    </button>
                                    <button
                                        onClick={() => openExportModal('png')}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: '#2196F3',
                                            border: 'none',
                                            borderRadius: '6px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        🖼️ PNG
                                    </button>
                                    <button
                                        onClick={() => openExportModal('pdf')}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: '#ff9800',
                                            border: 'none',
                                            borderRadius: '6px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        📑 PDF
                                    </button>
                                </div>
                            </div>

                            <div style={{ padding: '0 20px 20px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                                Показано {sortedHistory.length} измерений за {historyDays === 1 ? '24 часа' : historyDays === 7 ? '7 дней' : '30 дней'}
                            </div>
                        </div>

                        {/* Правая колонка - справочная информация */}
                        <div style={{
                            flex: '1',
                            minWidth: '300px',
                            backgroundColor: themeStyles.cardBg,
                            borderRadius: '12px',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                backgroundColor: themeStyles.cardHeaderBg,
                                color: 'white',
                                padding: '12px 20px',
                                fontSize: '18px',
                                fontWeight: 'bold'
                            }}>
                                📖 Справочная информация
                            </div>

                            <div style={{ padding: '20px', maxHeight: '500px', overflowY: 'auto' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: themeStyles.textColor }}>🎯 Как пользоваться:</h4>
                                    <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                                        <li>Нажмите на карту в любом месте</li>
                                        <li>Система определит ближайший город</li>
                                        <li>Появятся текущие показатели качества воздуха</li>
                                        <li>Выберите период и показатель для графика</li>
                                        <li>Используйте кнопку "Моё местоположение" для быстрого доступа</li>
                                    </ol>
                                </div>

                                <div style={{ marginBottom: '20px', borderTop: `1px solid ${themeStyles.borderColor}`, paddingTop: '15px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: themeStyles.textColor }}>📊 Как рассчитывается AQI:</h4>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', lineHeight: '1.5' }}>
                                        AQI (Air Quality Index) — комплексный показатель, рассчитываемый на основе концентрации PM2.5.
                                        Используется упрощенная линейная шкала:
                                    </p>
                                    <div style={{
                                        background: themeStyles.tableRowBg,
                                        padding: '12px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        marginBottom: '10px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <span style={{ fontWeight: 'bold' }}>PM2.5 (μg/m³)</span>
                                            <span style={{ fontWeight: 'bold' }}>AQI</span>
                                            <span style={{ fontWeight: 'bold' }}>Качество</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4CAF50' }}>
                                            <span>≤ 12</span><span>≤ 50</span><span>Хорошо</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFC107' }}>
                                            <span>12.1 - 35.4</span><span>51 - 100</span><span>Умеренно</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FF9800' }}>
                                            <span>35.5 - 55.4</span><span>101 - 150</span><span>Вредно для чувствительных</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F44336' }}>
                                            <span>55.5 - 150.4</span><span>151 - 200</span><span>Вредно</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9C27B0' }}>
                                            <span>&gt; 150.4</span><span>&gt; 200</span><span>Очень вредно</span>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '11px', opacity: 0.7, margin: 0 }}>
                                        ⚠️ AQI рассчитывается по упрощенной методике на основе PM2.5.
                                        Полный AQI учитывает также PM10, NO₂, SO₂, CO, O₃.
                                    </p>
                                </div>

                                <div style={{ marginBottom: '20px', borderTop: `1px solid ${themeStyles.borderColor}`, paddingTop: '15px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: themeStyles.textColor }}>📋 Нормальные значения:</h4>
                                    <div style={{
                                        background: themeStyles.tableRowBg,
                                        padding: '12px',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong style={{ color: metrics.find(m => m.key === 'pm25')?.color }}>PM2.5</strong>
                                            <div>Суточная норма (ВОЗ): ≤ 15 μg/m³</div>
                                            <div>Суточная норма (СанПиН): ≤ 35 μg/m³</div>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong style={{ color: metrics.find(m => m.key === 'pm10')?.color }}>PM10</strong>
                                            <div>Суточная норма (ВОЗ): ≤ 45 μg/m³</div>
                                            <div>Суточная норма (СанПиН): ≤ 60 μg/m³</div>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong style={{ color: metrics.find(m => m.key === 'co')?.color }}>CO</strong>
                                            <div>8-часовая норма (ВОЗ): ≤ 10000 μg/m³ (10 mg/m³)</div>
                                            <div>Суточная норма (СанПиН): ≤ 3000 μg/m³ (3 mg/m³)</div>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong style={{ color: metrics.find(m => m.key === 'no2')?.color }}>NO₂</strong>
                                            <div>Часовая норма (ВОЗ): ≤ 200 μg/m³</div>
                                            <div>Суточная норма (СанПиН): ≤ 40 μg/m³</div>
                                        </div>
                                        <div>
                                            <strong style={{ color: metrics.find(m => m.key === 'so2')?.color }}>SO₂</strong>
                                            <div>Часовая норма (ВОЗ): ≤ 40 μg/m³</div>
                                            <div>Суточная норма (СанПиН): ≤ 30 μg/m³</div>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '11px', opacity: 0.7, marginTop: '10px' }}>
                                        📌 Нормы приведены по стандартам ВОЗ (2021) и СанПиН 1.2.3685-21.<br/>
                                        ⚠️ Превышение норм указывает на потенциальный риск для здоровья.
                                    </p>
                                </div>

                                <div style={{ borderTop: `1px solid ${themeStyles.borderColor}`, paddingTop: '15px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: themeStyles.textColor }}>⚠️ Что означают показатели:</h4>
                                    {metrics.map(m => (
                                        <div key={m.key} style={{ marginBottom: '12px', borderLeft: `3px solid ${m.color}`, paddingLeft: '10px' }}>
                                            <div><strong style={{ color: m.color }}>{m.label}</strong> {m.unit && `(${m.unit})`}</div>
                                            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '3px' }}>{m.description}</div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: `1px solid ${themeStyles.borderColor}`, fontSize: '12px', opacity: 0.7 }}>
                                    <p>📊 Источник: Open-Meteo API</p>
                                    <p>🔄 Данные обновляются раз в час</p>
                                    <p>📋 Нормы: ВОЗ (2021), СанПиН 1.2.3685-21</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Модальное окно экспорта */}
            {exportModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '25px',
                        width: '400px',
                        maxWidth: '90%',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                    }}>
                        <h3 style={{ margin: '0 0 20px', textAlign: 'center' }}>
                            Экспорт {exportFormat.toUpperCase()}
                        </h3>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>📅 Период:</label>
                            <select
                                value={exportDays}
                                onChange={(e) => setExportDays(parseInt(e.target.value))}
                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
                            >
                                <option value="7">Последние 7 дней</option>
                                <option value="30">Последние 30 дней</option>
                                <option value="90">Последние 90 дней</option>
                                <option value="365">Последний год</option>
                            </select>
                        </div>

                        {exportFormat === 'png' && (
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>📊 Показатель:</label>
                                <select
                                    value={exportMetric}
                                    onChange={(e) => setExportMetric(e.target.value)}
                                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
                                >
                                    <option value="aqi">AQI</option>
                                    <option value="pm25">PM2.5</option>
                                    <option value="pm10">PM10</option>
                                    <option value="co">CO</option>
                                    <option value="no2">NO₂</option>
                                    <option value="so2">SO₂</option>
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={handleExport} style={{ flex: 1, padding: '10px', backgroundColor: '#4CAF50', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                                Экспортировать
                            </button>
                            <button onClick={closeExportModal} style={{ flex: 1, padding: '10px', backgroundColor: '#e74c3c', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Скрытый контейнер для генерации PDF */}
            <div id="pdf-report-container" style={{
                position: 'fixed',
                top: '-9999px',
                left: '-9999px',
                width: '1000px',
                backgroundColor: 'white',
                padding: '30px',
                fontFamily: 'Arial, sans-serif',
                zIndex: -1
            }} />

        </div>
    );
}