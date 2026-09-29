import React, { useEffect } from 'react';

const OAuthCallback = ({ onLogin }: { onLogin: (user: any) => void }) => {
    useEffect(() => {
        const handleCallback = async () => {
            // Get the authorization code from URL
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const provider = localStorage.getItem('oauth_provider');

            if (!code || !provider) {
                console.error('Missing OAuth code or provider');
                window.location.href = '/';
                return;
            }

            try {
                // Exchange code for access token via backend
                const response = await fetch(`http://localhost:8000/api/v1/auth/oauth/${provider}/callback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code })
                });

                if (!response.ok) {
                    throw new Error('OAuth authentication failed');
                }

                const userData = await response.json();

                // Clean up
                localStorage.removeItem('oauth_provider');

                // Login with user data
                onLogin(userData);
                window.location.href = '/';
            } catch (error) {
                console.error('OAuth callback error:', error);
                window.location.href = '/';
            }
        };

        handleCallback();
    }, [onLogin]);

    return (
        <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                <p className="text-slate-400">Completing authentication...</p>
            </div>
        </div>
    );
};

export default OAuthCallback;
