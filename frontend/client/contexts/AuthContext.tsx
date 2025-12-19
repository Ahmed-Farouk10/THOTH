import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
    user_id: string;
    username: string;
    email: string;
    full_name?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    signup: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Check for existing token on mount
    useEffect(() => {
        const checkAuth = () => {
            try {
                const storedToken = localStorage.getItem('thoth_auth_token');
                const storedUser = localStorage.getItem('thoth_user');

                if (storedToken && storedUser) {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                }
            } catch (error) {
                console.error('Error loading auth state:', error);
                localStorage.removeItem('thoth_auth_token');
                localStorage.removeItem('thoth_user');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (username: string, password: string) => {
        try {
            const response: any = await api.login(username, password);

            // Store token and user
            localStorage.setItem('thoth_auth_token', response.access_token);
            localStorage.setItem('thoth_user', JSON.stringify(response.user));

            setToken(response.access_token);
            setUser(response.user);
        } catch (error: any) {
            throw new Error(error.message || 'Login failed');
        }
    };

    const signup = async (username: string, email: string, password: string) => {
        try {
            // Register user
            await api.register(username, email, password);

            // Auto-login after signup
            await login(username, password);
        } catch (error: any) {
            throw new Error(error.message || 'Signup failed');
        }
    };

    const logout = () => {
        localStorage.removeItem('thoth_auth_token');
        localStorage.removeItem('thoth_user');
        setToken(null);
        setUser(null);
    };

    const value: AuthContextType = {
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        signup,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
