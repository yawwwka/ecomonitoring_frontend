import { useState, useEffect } from 'react';

export default function ProfileSettings({ isOpen, onClose, userEmail, token, onUpdate }) {
    const [telegramId, setTelegramId] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Загрузка текущих данных пользователя при открытии
    useEffect(() => {
        if (isOpen && token) {
            fetchCurrentUser();
        }
    }, [isOpen, token]);

    const fetchCurrentUser = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.telegramId) {
                setTelegramId(data.telegramId);
            }
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

        // Проверка пароля
        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ text: 'Пароли не совпадают', type: 'error' });
            setLoading(false);
            return;
        }

        const updateData = {};
        if (telegramId !== undefined) updateData.telegramId = telegramId;
        if (newPassword) updateData.password = newPassword;

        if (Object.keys(updateData).length === 0) {
            setMessage({ text: 'Нет изменений для сохранения', type: 'info' });
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:8080/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ text: 'Профиль успешно обновлен!', type: 'success' });
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                setMessage({ text: data.error || 'Ошибка обновления', type: 'error' });
            }
        } catch (error) {
            setMessage({ text: 'Ошибка соединения с сервером', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
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
                backgroundColor: '#fff',
                borderRadius: '16px',
                padding: '30px',
                width: '450px',
                maxWidth: '90%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
                <h2 style={{ margin: '0 0 20px', textAlign: 'center', color: '#333' }}>
                    ⚙️ Настройки профиля
                </h2>

                <div style={{
                    marginBottom: '20px',
                    padding: '12px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: '#333'
                }}>
                    <strong>Email:</strong> {userEmail}
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Telegram ID</label>
                        <input
                            type="text"
                            value={telegramId}
                            onChange={(e) => setTelegramId(e.target.value)}
                            placeholder="Ваш Telegram ID"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                            Для получения уведомлений в Telegram
                        </div>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Новый пароль (оставьте пустым, если не хотите менять)</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Подтверждение пароля</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {message.text && (
                        <div style={{
                            padding: '10px',
                            borderRadius: '8px',
                            marginBottom: '15px',
                            backgroundColor: message.type === 'error' ? '#ffebee' : message.type === 'success' ? '#e8f5e9' : '#e3f2fd',
                            color: message.type === 'error' ? '#c62828' : message.type === 'success' ? '#2e7d32' : '#1565c0',
                            fontSize: '14px',
                            textAlign: 'center'
                        }}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: '#2c3e50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                </form>

                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        marginTop: '15px',
                        padding: '10px',
                        backgroundColor: '#e74c3c',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer'
                    }}
                >
                    Закрыть
                </button>
            </div>
        </div>
    );
}