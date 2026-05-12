import { useState, useEffect } from 'react';

export default function AdminPanel({ isOpen, onClose, token, currentUserEmail }) {
    const [users, setUsers] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setUsers(data);
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
        }
    };

    const deleteUser = async (userId, userEmail) => {
        if (userEmail === currentUserEmail) {
            setMessage('Нельзя удалить самого себя');
            return;
        }
        if (!confirm('Удалить пользователя?')) return;
        try {
            const response = await fetch(`http://localhost:8080/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setMessage('Пользователь удален');
                fetchUsers();
            } else {
                setMessage('Ошибка при удалении');
            }
        } catch (error) {
            console.error('Ошибка удаления:', error);
            setMessage('Ошибка соединения');
        }
    };

    const updateUserRole = async (userId, role, userEmail) => {
        if (userEmail === currentUserEmail) {
            setMessage('Нельзя изменить свою собственную роль');
            return;
        }
        try {
            const response = await fetch(`http://localhost:8080/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ role })
            });
            if (response.ok) {
                setMessage('Роль обновлена');
                fetchUsers();
            } else {
                setMessage('Ошибка при обновлении роли');
            }
        } catch (error) {
            console.error('Ошибка обновления роли:', error);
            setMessage('Ошибка соединения');
        }
    };

    const [intervalMinutes, setIntervalMinutes] = useState(60);
    const [intervalLoading, setIntervalLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchInterval();
        }
    }, [isOpen]);

    const fetchInterval = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/admin/settings/interval', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setIntervalMinutes(data.interval_minutes);
            }
        } catch (error) {
            console.error('Ошибка загрузки интервала:', error);
        }
    };

    const updateInterval = async (minutes) => {
        setIntervalLoading(true);
        try {
            const response = await fetch('http://localhost:8080/api/admin/settings/interval', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ interval_minutes: minutes })
            });
            const data = await response.json();
            if (response.ok) {
                setMessage(data.message);
                setIntervalMinutes(minutes);
            } else {
                setMessage(data.error || 'Ошибка обновления');
            }
        } catch (error) {
            setMessage('Ошибка соединения');
        } finally {
            setIntervalLoading(false);
        }
    };

    const [nextCollection, setNextCollection] = useState('');

    const fetchNextCollection = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/admin/next-collection', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.next_collection) {
                setNextCollection(data.next_collection);
            }
        } catch (error) {
            console.error('Ошибка получения времени:', error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchNextCollection();
        }
    }, [isOpen]);

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
                padding: '20px',
                width: '900px',
                maxWidth: '95%',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
                <h2 style={{ margin: '0 0 20px', textAlign: 'center', color: '#333' }}>👑 Админ-панель</h2>

                {message && (
                    <div style={{
                        backgroundColor: '#e8f5e9',
                        padding: '10px',
                        borderRadius: '8px',
                        marginBottom: '15px',
                        color: '#2e7d32',
                        textAlign: 'center'
                    }}>
                        {message}
                    </div>
                )}

                {nextCollection && (
                    <div style={{
                        backgroundColor: '#e3f2fd',
                        padding: '10px',
                        borderRadius: '8px',
                        marginBottom: '15px',
                        textAlign: 'center',
                        color: '#333',
                    }}>
                        ⏰ <strong>Следующий сбор данных:</strong> {nextCollection}
                    </div>
                )}

                <div>
                    <h3 style={{ color: '#333', marginBottom: '15px' }}>👥 Пользователи ({users.length})</h3>
                    {users.length === 0 ? (
                        <p style={{ color: '#666' }}>Нет пользователей</p>
                    ) : (
                        <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                <tr style={{ backgroundColor: '#f0f0f0', position: 'sticky', top: 0 }}>
                                    <th style={{ padding: '12px', textAlign: 'left', color: '#333', backgroundColor: '#f0f0f0' }}>ID</th>
                                    <th style={{ padding: '12px', textAlign: 'left', color: '#333', backgroundColor: '#f0f0f0' }}>Email</th>
                                    <th style={{ padding: '12px', textAlign: 'left', color: '#333', backgroundColor: '#f0f0f0' }}>VK</th>
                                    <th style={{ padding: '12px', textAlign: 'left', color: '#333', backgroundColor: '#f0f0f0' }}>Роль</th>
                                    <th style={{ padding: '12px', textAlign: 'left', color: '#333', backgroundColor: '#f0f0f0' }}>Действия</th>
                                </tr>
                                </thead>
                                <tbody>
                                {users.map(user => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={{ padding: '12px', color: '#333' }}>{user.id}</td>
                                        <td style={{ padding: '12px', color: '#333' }}>
                                            {user.email}
                                            {user.email === currentUserEmail && (
                                                <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>(вы)</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', color: '#333' }}>{user.messengerId || '-'}</td>
                                        <td style={{ padding: '12px' }}>
                                            <select
                                                value={user.role}
                                                onChange={(e) => updateUserRole(user.id, e.target.value, user.email)}
                                                style={{
                                                    padding: '5px 10px',
                                                    borderRadius: '5px',
                                                    border: '1px solid #ddd',
                                                    backgroundColor: user.email === currentUserEmail ? '#f0f0f0' : '#fff',
                                                    cursor: user.email === currentUserEmail ? 'not-allowed' : 'pointer'
                                                }}
                                                disabled={user.email === currentUserEmail}
                                            >
                                                <option value="USER">USER</option>
                                                <option value="ADMIN">ADMIN</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <button
                                                onClick={() => deleteUser(user.id, user.email)}
                                                style={{
                                                    backgroundColor: '#e74c3c',
                                                    border: 'none',
                                                    color: 'white',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    cursor: user.email === currentUserEmail ? 'not-allowed' : 'pointer',
                                                    opacity: user.email === currentUserEmail ? 0.6 : 1
                                                }}
                                                disabled={user.email === currentUserEmail}
                                            >
                                                Удалить
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '30px', borderTop: '1px solid #ddd', paddingTop: '20px' }}>
                    <h3 style={{ color: '#333', marginBottom: '15px' }}>⚙️ Настройки системы</h3>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                            Интервал сбора данных (минуты)
                        </label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                type="number"
                                value={intervalMinutes}
                                onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 60)}
                                min={1}
                                max={1440}
                                step={1}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    width: '120px'
                                }}
                            />
                            <button
                                onClick={() => updateInterval(intervalMinutes)}
                                disabled={intervalLoading}
                                style={{
                                    padding: '8px 20px',
                                    backgroundColor: '#2c3e50',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                {intervalLoading ? 'Сохранение...' : 'Применить'}
                            </button>
                            <span style={{ fontSize: '12px', color: '#666' }}>
        Текущий интервал: {intervalMinutes} мин
      </span>
                        </div>
                        <p style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                            ⚠️ Интервал должен быть от 1 до 1440 минут (1 сутки). Изменение применяется сразу без перезапуска.
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        marginTop: '20px',
                        padding: '12px',
                        backgroundColor: '#e74c3c',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}
                >
                    Закрыть
                </button>
            </div>
        </div>
    );
}