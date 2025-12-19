import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const { subscribeAll } = useWebSocket();

    useEffect(() => {
        if (!user) return;

        // Subscribe to all WebSocket events
        const unsubscribe = subscribeAll((notification) => {
            setNotifications(prev => [notification, ...prev].slice(0, 10));
            setUnreadCount(prev => prev + 1);

            // Browser notification
            if (Notification.permission === 'granted') {
                new Notification('Thoth Notification', {
                    body: notification.message || 'New update',
                });
            }
        });

        // Request notification permission
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        return unsubscribe;
    }, [user, subscribeAll]);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gold-primary hover:text-gold-light transition-colors"
                aria-label="Notifications"
            >
                <span className="text-2xl">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-bg-obsidian border border-gold-primary/30 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
                        <div className="p-4 border-b border-gold-primary/30 bg-bg-void">
                            <h3 className="text-gold-primary font-semibold text-lg">Notifications</h3>
                        </div>

                        <div className="overflow-y-auto max-h-80">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-text-muted">
                                    <div className="text-4xl mb-2">📭</div>
                                    <p>No notifications yet</p>
                                </div>
                            ) : (
                                notifications.map((notif, idx) => {
                                    const isQuizNotification = notif.event_type?.includes('quiz');
                                    const content = (
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">
                                                {notif.event_type?.includes('document') ? '📄' :
                                                    notif.event_type?.includes('quiz') ? '🧠' :
                                                        notif.event_type?.includes('audio') ? '🔊' : '✨'}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-text-main text-sm font-medium">
                                                    {notif.message}
                                                </p>
                                                <p className="text-text-muted text-xs mt-1">
                                                    {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Just now'}
                                                </p>
                                                {isQuizNotification && (
                                                    <p className="text-gold-primary text-xs mt-2 font-semibold">
                                                        → Click to view quiz
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );

                                    return (
                                        <div
                                            key={idx}
                                            className="border-b border-gold-primary/10 hover:bg-gold-primary/5 transition-colors"
                                        >
                                            {isQuizNotification ? (
                                                <Link
                                                    to="/quiz"
                                                    className="block p-4"
                                                    onClick={() => setIsOpen(false)}
                                                >
                                                    {content}
                                                </Link>
                                            ) : (
                                                <div className="p-4 cursor-pointer">
                                                    {content}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="p-3 border-t border-gold-primary/30 bg-bg-void">
                                <button
                                    onClick={() => {
                                        setUnreadCount(0);
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-sm text-gold-primary hover:text-gold-light transition-colors font-medium"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
