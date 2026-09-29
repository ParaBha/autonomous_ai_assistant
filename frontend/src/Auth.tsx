import React, { useState, useEffect, useRef } from 'react';
import { Brain, Mail, Lock, User, ArrowRight, Github, Zap } from 'lucide-react';

const NeuralNetworkBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: any[] = [];
        const particleCount = 40;

        const resize = () => {
            if (!canvas) return;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };

        class Particle {
            x: number; y: number; vx: number; vy: number; size: number;
            constructor() {
                if (!canvas) {
                    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.size = 0;
                    return;
                }
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                this.size = Math.random() * 2 + 1;
            }
            update() {
                if (!canvas) return;
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }
            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(251, 146, 60, 0.3)';
                ctx.fill();
            }
        }

        const init = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) particles.push(new Particle());
        };

        const animate = () => {
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, i) => {
                p.update();
                p.draw();
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(251, 146, 60, ${0.15 * (1 - dist / 150)})`;
                        ctx.stroke();
                    }
                }
            });
            animationFrameId = requestAnimationFrame(animate);
        };

        window.addEventListener('resize', resize);
        resize();
        init();
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40" />;
};

const Auth = ({ onLogin, theme }: { onLogin: (user: any) => void, theme: string }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ email: '', password: '', name: '', profession: '', phone: '', institution: '', field_of_study: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const endpoint = isLogin ? '/api/v1/auth/signin' : '/api/v1/auth/signup';
            const payload = isLogin
                ? { email: formData.email, password: formData.password }
                : {
                    email: formData.email,
                    password: formData.password,
                    name: formData.name,
                    profession: formData.profession,
                    phone: formData.phone,
                    institution: formData.institution,
                    field_of_study: formData.field_of_study
                };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let errorMessage = 'Authentication failed';
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorMessage;
                } else {
                    const errorText = await response.text();
                    errorMessage = errorText || `Error ${response.status}: Internal Server Error`;
                }
                throw new Error(errorMessage);
            }

            const userData = await response.json();

            // Store user data in localStorage for session persistence
            localStorage.setItem('user', JSON.stringify(userData));

            onLogin(userData);
        } catch (err: any) {
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // OAuth Configuration
    const oauthConfig = {
        github: {
            clientId: 'YOUR_GITHUB_CLIENT_ID', // Replace with your GitHub OAuth App Client ID
            redirectUri: `${window.location.origin}/auth/callback`,
            scope: 'read:user user:email',
            authUrl: 'https://github.com/login/oauth/authorize'
        },
        google: {
            clientId: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your Google OAuth Client ID
            redirectUri: `${window.location.origin}/auth/callback`,
            scope: 'openid profile email',
            authUrl: 'https://accounts.google.com/o/oauth2/v2/auth'
        },
        microsoft: {
            clientId: 'YOUR_MICROSOFT_CLIENT_ID', // Replace with your Microsoft OAuth Client ID
            redirectUri: `${window.location.origin}/auth/callback`,
            scope: 'openid profile email',
            authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
        }
    };

    const handleOAuthLogin = (provider: 'github' | 'google' | 'microsoft') => {
        // MOCK MODE: In development, we can mock all or some. 
        // Let's set it to false for now so we can test the redirected URL logic or actual OAuth if configured.
        const USE_MOCK_AUTH = false;

        if (USE_MOCK_AUTH) {
            // Mock authentication for testing without OAuth credentials
            console.log(`Mock ${provider} login...`);
            setTimeout(() => {
                onLogin({
                    name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
                    email: `user@${provider}.com`,
                    profession: 'Research Scientist',
                    phone: '+1 (555) 123-4567',
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${provider}`,
                    authProvider: provider
                });
            }, 800);
            return;
        }

        // Real OAuth flow (requires OAuth app setup)
        const config = oauthConfig[provider];

        // Build OAuth URL with parameters
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: config.scope,
            response_type: 'code',
            ...(provider === 'google' && { access_type: 'offline', prompt: 'consent' }),
            ...(provider === 'microsoft' && { response_mode: 'query' })
        });

        const authUrl = `${config.authUrl}?${params.toString()}`;

        // Store provider for callback handling
        localStorage.setItem('oauth_provider', provider);

        // Redirect to OAuth provider
        console.log(`Redirecting to ${provider} OAuth...`, authUrl);
        window.location.href = authUrl;
    };


    return (
        <div className={`min-h-screen flex items-center justify-center p-0 font-sans relative overflow-hidden transition-colors duration-500 ${theme} theme-bg-app theme-text-primary`}>
            {/* Theme Indicator for Debugging */}
            <div className="fixed bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-[10px] rounded z-[9999] pointer-events-none">
                Auth Theme: {theme}
            </div>
            {/* Split Layout Container */}
            <div className="flex w-full min-h-screen">

                {/* Left Side: Illustration / Character Area */}
                <div className="hidden lg:flex w-1/2 bg-white dark:bg-[#0f0f13] relative overflow-hidden items-center justify-center border-r border-slate-200 dark:border-slate-800/50">
                    {/* Abstract Background Elements */}
                    <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-purple-600/5 dark:bg-purple-600/10 rounded-full blur-[120px] animate-pulse"></div>

                    {/* Animated Grid Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

                    <div className="relative z-10 text-center px-12 animate-in fade-in slide-in-from-left-8 duration-1000 w-full">
                        {/* ThinkForge Brand Label */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full mb-8 backdrop-blur-md">
                            <div className="w-5 h-5 bg-gradient-to-br from-orange-400 to-rose-600 rounded-md flex items-center justify-center">
                                <Zap size={12} className="text-white fill-white" />
                            </div>
                            <span className="text-slate-900 dark:text-white font-bold text-xs uppercase tracking-[0.2em]">ThinkForge Intelligence</span>
                        </div>

                        {/* Neural High-Tech Hero Area */}
                        <div className="relative mb-8 lg:mb-12 flex justify-center items-center h-80 lg:h-96 w-full">
                            {/* Particle Aura */}
                            <div className="absolute inset-0 bg-orange-600/5 rounded-full blur-[100px] animate-pulse"></div>

                            {/* Neural Background Layer */}
                            <NeuralNetworkBackground />

                            {/* Floating Brain Composition */}
                            <div className="relative z-10 w-64 h-64 lg:w-80 lg:h-80 flex items-center justify-center">
                                {/* Outer Orbitals */}
                                <div className="absolute w-full h-full border border-orange-500/10 rounded-full animate-spin-slow"></div>
                                <div className="absolute w-[80%] h-[80%] border-t border-rose-500/20 rounded-full animate-orbit"></div>

                                {/* 3D Glowing Brain SVG */}
                                <div className="relative z-20 group">
                                    <div className="absolute inset-0 bg-rose-500/10 dark:bg-rose-500/20 rounded-full blur-2xl group-hover:bg-rose-500/40 transition-all duration-700"></div>
                                    <svg width="200" height="200" viewBox="0 0 200 200" className="animate-float-random filter drop-shadow-[0_0_15px_rgba(251,146,60,0.5)]">
                                        <defs>
                                            <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#FB923C" />
                                                <stop offset="100%" stopColor="#E11D48" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M100 30 C 60 30, 40 60, 40 100 C 40 130, 60 160, 90 170 C 95 172, 105 172, 110 170 C 140 160, 160 130, 160 100 C 160 60, 140 30, 100 30 Z" fill="none" stroke="url(#brainGrad)" strokeWidth="1.5" strokeOpacity="0.8" />
                                        <path d="M100 50 C 75 50, 60 70, 60 100 C 60 120, 75 140, 100 150 C 125 140, 140 120, 140 100 C 140 70, 125 50, 100 50 Z" fill="none" stroke="url(#brainGrad)" strokeWidth="0.5" strokeDasharray="4 4" />
                                        {/* Synaptic nodes */}
                                        <circle cx="100" cy="100" r="4" fill="#F43F5E" className="animate-neural-pulse" />
                                        <circle cx="130" cy="80" r="3" fill="#FB923C" className="animate-neural-pulse delay-200" />
                                        <circle cx="70" cy="120" r="3" fill="#FB923C" className="animate-neural-pulse delay-500" />
                                        <circle cx="110" cy="140" r="2" fill="#F43F5E" className="animate-neural-pulse delay-700" />
                                    </svg>
                                </div>

                                {/* Floating Data Nodes */}
                                <div className="absolute top-0 right-0 px-3 py-1 bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold text-orange-600 dark:text-orange-400 backdrop-blur-md animate-float-random shadow-sm dark:shadow-none">
                                    DOC_VECTOR v1.2
                                </div>
                                <div className="absolute bottom-10 -left-10 px-3 py-1 bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold text-rose-600 dark:text-rose-400 backdrop-blur-md animate-float-random delay-500 shadow-sm dark:shadow-none">
                                    NEURAL_LINK ACTIVE
                                </div>
                                <div className="absolute -bottom-4 right-10 px-3 py-1 bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold text-purple-600 dark:text-purple-400 backdrop-blur-md animate-float-random delay-700 shadow-sm dark:shadow-none">
                                    SYNAPTIC_MAP_v2.4
                                </div>
                            </div>
                        </div>

                        <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight leading-none">
                            Forge Your Next <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-rose-500 to-purple-500">Research Breakthrough</span>
                        </h1>
                        <p className="text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                            ThinkForge empowers you with autonomous AI agents that discover, analyze, and synthesize knowledge at light speed.
                        </p>
                    </div>

                    {/* Footer attribution or tagline */}
                    <div className="absolute bottom-8 left-12 flex items-center gap-4 text-slate-400 dark:text-slate-500 text-sm font-medium">
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <img key={i} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} className="w-6 h-6 rounded-full border border-white dark:border-[#0f0f13]" alt="user" />
                            ))}
                        </div>
                        Join 2,000+ top researchers worldwide
                    </div>
                </div>

                {/* Right Side: Form Area */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex flex-col items-center mb-10 text-center">
                        <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-[0_10px_30px_rgba(244,63,94,0.3)] mb-4 border border-white/10">
                            <Zap size={32} className="text-white fill-white" />
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">ThinkForge</h1>
                        <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-rose-600 rounded-full mb-3"></div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">Intelligence Platform</p>
                    </div>

                    <div className="w-full max-w-md bg-white/80 dark:bg-[#111114]/50 backdrop-blur-3xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] p-10 shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500">
                        <div className="mb-10">
                            <div className="hidden lg:flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg border border-white/10">
                                    <Zap size={20} className="text-white fill-white" />
                                </div>
                                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ThinkForge</span>
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                                {isLogin ? 'Welcome Back' : 'Join the Forge'}
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 font-medium">
                                {isLogin ? 'Sign in to access your intelligence core' : 'Ignite your research with autonomous agents'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Dr. Elena Carter"
                                            required
                                            className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {!isLogin && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Profession / Role</label>
                                        <input
                                            type="text"
                                            placeholder="Researcher"
                                            className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Phone</label>
                                        <input
                                            type="text"
                                            placeholder="+91..."
                                            className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {!isLogin && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Institution / University</label>
                                        <input
                                            type="text"
                                            placeholder="MIT / Parul University"
                                            className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Field of Study</label>
                                        <input
                                            type="text"
                                            placeholder="AI & Data Science"
                                            className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            onChange={(e) => setFormData({ ...formData, field_of_study: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" size={18} />
                                    <input
                                        type="email"
                                        placeholder="researcher@mit.edu"
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" size={18} />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-600 dark:text-red-400 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Processing...' : (isLogin ? 'Ignite Dashboard' : 'Launch Workspace')}
                                <Zap size={20} className="font-bold fill-white" />
                            </button>
                        </form>

                        <div className="relative my-10">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                                <span className="bg-white dark:bg-[#111114] px-4 text-slate-500">Fast Access</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                onClick={() => handleOAuthLogin('github')}
                                className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold py-3 rounded-xl transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm dark:shadow-none"
                            >
                                <Github size={18} className="text-slate-900 dark:text-white" />
                                <span className="sm:hidden lg:inline text-sm">GitHub</span>
                            </button>
                            <button
                                onClick={() => handleOAuthLogin('google')}
                                className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold py-3 rounded-xl transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm dark:shadow-none"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                <span className="sm:hidden lg:inline text-sm">Google</span>
                            </button>
                            <button
                                onClick={() => handleOAuthLogin('microsoft')}
                                className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold py-3 rounded-xl transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm dark:shadow-none"
                            >
                                <svg width="18" height="18" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                                    <path fill="#747775" className="dark:fill-[#f3f3f3]" d="M0 0h11v11H0z" />
                                    <path fill="#747775" className="dark:fill-[#f3f3f3]" d="M12 0h11v11H12z" />
                                    <path fill="#747775" className="dark:fill-[#f3f3f3]" d="M0 12h11v11H0z" />
                                    <path fill="#747775" className="dark:fill-[#f3f3f3]" d="M12 12h11v11H12z" />
                                </svg>
                                <span className="sm:hidden lg:inline text-sm">Microsoft</span>
                            </button>
                        </div>

                        <p className="text-center text-slate-600 dark:text-slate-400 mt-10 text-sm font-medium">
                            {isLogin ? "New to ThinkForge?" : "Ready to start forging?"}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-bold ml-2 underline underline-offset-8 decoration-indigo-500/30 hover:decoration-indigo-500 transition-all"
                            >
                                {isLogin ? 'Create Workspace' : 'Sign in'}
                            </button>
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Auth;
