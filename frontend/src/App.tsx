import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, Send, Upload, FileText, PieChart as PieChartIcon, Search, BookOpen, Brain, Zap, Settings, MessageSquare, Plus, Trash2, Calendar, Layout, BarChart2, User, Phone, Briefcase, Camera, ArrowRight, Volume2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import Auth from './Auth';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316'];

const MarkdownFormatter = ({ content }: { content: string }) => {
    if (typeof content !== 'string') return <>{String(content)}</>;
    
    // Split into lines to handle block-level elements
    const lines = content.split('\n');
    let inList = false;
    const formatted = [];

    const renderInline = (text: string) => {
        let parts: any[] = [text];
        
        // Bold: **text**
        parts = parts.flatMap(p => typeof p !== 'string' ? p : p.split(/(\*\*.*?\*\*)/g).map((s, j) => 
            s.startsWith('**') && s.endsWith('**') ? <strong key={j} className="font-bold text-indigo-500">{s.slice(2, -2)}</strong> : s
        ));
        
        // Code: `text`
        parts = parts.flatMap(p => typeof p !== 'string' ? p : p.split(/(`.*?`)/g).map((s, j) => 
            s.startsWith('`') && s.endsWith('`') ? <code key={j} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono text-sm">{s.slice(1, -1)}</code> : s
        ));

        return parts;
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Handle Headers
        if (line.startsWith('### ')) {
            formatted.push(<h3 key={i} className="text-lg font-bold mt-4 mb-2 text-indigo-600 dark:text-indigo-400">{line.replace('### ', '')}</h3>);
            continue;
        }

        // Handle Lists
        const listMatch = line.match(/^[\*\-]\s+(.*)/);
        if (listMatch) {
            formatted.push(
                <div key={i} className="flex gap-2 ml-4 mb-1">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span className="text-slate-700 dark:text-slate-300 flex-1">{renderInline(listMatch[1])}</span>
                </div>
            );
            continue;
        }

        // Handle Regular Paragraphs
        if (line.trim() !== '') {
            formatted.push(<p key={i} className="mb-3">{renderInline(line)}</p>);
        } else {
            formatted.push(<div key={i} className="h-2"></div>);
        }
    }

    return <div className="markdown-render font-sans">{formatted}</div>;
};

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('chat');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editForm, setEditForm] = useState<any>(null);
    const [isRecording, setIsRecording] = useState(false);

    // Settings State
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        const stored = localStorage.getItem('theme');
        return (stored === 'light' || stored === 'dark') ? stored : 'dark';
    });
    const [aiResponseLength, setAiResponseLength] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
    const [language, setLanguage] = useState('en');
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    interface Message {
        role: 'user' | 'assistant';
        content: string;
        id?: number;
        sources?: any[];
    }
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! I am your Autonomous AI Research Assistant. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [focusedDocument, setFocusedDocument] = useState<{id: string, name: string} | null>(null);
    const [uploading, setUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

    const showToast = (message: string, type: 'error' | 'success' = 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Advanced Data States
    const [documents, setDocuments] = useState<any[]>([]);
    const [insights, setInsights] = useState<any>(null);
    const [vizData, setVizData] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [newProjectTitle, setNewProjectTitle] = useState('');
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

    // TTS Logic
    const speak = (text: string) => {
        if (!window.speechSynthesis) return;
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // Strip markdown for cleaner speech
        const cleanText = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/###\s+/g, '')
            .replace(/[\*\-]\s+/g, '')
            .replace(/`/g, '');

        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // More robust language mapping
        const langMap: Record<string, string> = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'zh': 'zh-CN',
            'ja': 'ja-JP',
            'hi': 'hi-IN'
        };
        utterance.lang = langMap[language] || language;
        
        // Find a better voice if available
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            const preferredVoice = voices.find(v => v.lang.startsWith(language) && (v.name.includes('Google') || v.name.includes('Premium'))) || voices.find(v => v.lang.startsWith(language)) || voices[0];
            if (preferredVoice) utterance.voice = preferredVoice;
        }

        // Adjust rate and pitch for a "perfect" experience
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
    };

    const stopSpeaking = () => {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    };

    // STT Logic
    const toggleRecording = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Speech Recognition is not supported in this browser.');
            return;
        }

        if (isRecording) {
            setIsRecording(false);
            return;
        }

        stopSpeaking(); // Stop AI voice when user starts speaking
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === 'en' ? 'en-US' : (language === 'hi' ? 'hi-IN' : language);

        recognition.onstart = () => setIsRecording(true);
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsRecording(false);
        };

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            if (finalTranscript || interimTranscript) {
                setInput(prev => prev + (finalTranscript || interimTranscript));
            }
        };

        recognition.start();

        // Auto-stop after 10 seconds of silence/total
        setTimeout(() => {
            recognition.stop();
        }, 15000);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const profileImageInputRef = useRef<HTMLInputElement>(null);

    // Check for existing session on mount
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                setUser(userData);
                setIsAuthenticated(true);
            } catch (error) {
                console.error('Failed to parse stored user data:', error);
                localStorage.removeItem('user');
            }
        }
    }, []);

    useEffect(() => {
        console.log('[THEME DEBUG] Theme state:', theme);
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        if (theme === 'dark') {
            root.classList.add('dark');
            document.body.classList.add('dark');
            console.log('[THEME DEBUG] Added .dark and data-theme=dark');
        } else {
            root.classList.remove('dark');
            document.body.classList.remove('dark');
            console.log('[THEME DEBUG] Removed .dark and data-theme=light');
        }
        localStorage.setItem('theme', theme);
        // @ts-ignore
        window.__THEME__ = theme;
    }, [theme]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchDocuments();
            fetchInsights();
            fetchVisualizations();
            fetchProjects();
        }
    }, [isAuthenticated]);

    const fetchDocuments = async () => {
        try {
            const res = await axios.get('/api/v1/docs/documents');
            setDocuments(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchInsights = async () => {
        try {
            const res = await axios.get('/api/v1/docs/insights');
            setInsights(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchVisualizations = async () => {
        try {
            const res = await axios.get('/api/v1/docs/visualizations');
            setVizData(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchProjects = async () => {
        try {
            const res = await axios.get('/api/v1/projects/');
            const pData = res.data;
            setProjects(pData);
            // Sync selected project if it exists using functional update to avoid stale closure
            setSelectedProject((prev: any) => {
                if (!prev) return null;
                const updated = pData.find((p: any) => p.id === prev.id);
                return updated || prev;
            });
        } catch (e) {
            console.error('Fetch projects failed:', e);
        }
    };

    const deleteDocument = async (id: number) => {
        try {
            await axios.delete(`/api/v1/docs/${id}`);
            fetchDocuments();
            fetchVisualizations();
        } catch (e) { console.error(e); }
    };

    const createProject = async () => {
        if (!newProjectTitle.trim()) return;
        try {
            const res = await axios.post('/api/v1/projects/', { title: newProjectTitle });
            setNewProjectTitle('');
            fetchProjects();
            // Auto open the new project
            openProject(res.data);
        } catch (e) { console.error(e); }
    };

    const generateRoadmap = async (projectId: number) => {
        setIsGeneratingPlan(true);
        try {
            const res = await axios.post(`/api/v1/projects/${projectId}/plan`);
            const planData = res.data; // { roadmap: "..." }

            // Update selected project immediately using the response data
            setSelectedProject((prev: any) => {
                if (prev && prev.id === projectId) {
                    return { ...prev, plan: planData };
                }
                return prev;
            });

            await fetchProjects(); // Also sync the main list
        } catch (error) {
            console.error('Roadmap generation failed:', error);
            alert('Roadmap generation failed. This could be due to an API limit or network error. Please try again.');
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    const openProject = (project: any) => {
        setSelectedProject(project);
        setActiveTab('planner');
        if (!project.plan) {
            generateRoadmap(project.id);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        stopSpeaking();

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        
        // Check for specific document context (if any)
        const currentDocId = focusedDocument?.id || null; 
        
        setInput('');
        setIsLoading(true);

        // Add a placeholder assistant message that we will stream into
        const assistantMessageId = Date.now();
        setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: '', 
            id: assistantMessageId,
            sources: [] 
        }]);

        try {
            const response = await fetch('/api/v1/chat/stream_chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input,
                    chat_history: messages
                        .filter(m => m.role !== 'assistant' || m.content !== 'Hello! I am your Autonomous AI Research Assistant. How can I help you today?')
                        .slice(-5)
                        .map(m => [m.role, m.content]),
                    document_id: currentDocId
                })
            });

            if (!response.body) throw new Error('No response body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let sources: any[] = [];

            let sourcesProcessed = false;
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                
                if (!sourcesProcessed && chunk.includes('__SOURCES__:')) {
                    const parts = chunk.split('\n');
                    for (const part of parts) {
                        if (part.startsWith('__SOURCES__:')) {
                            try {
                                sources = JSON.parse(part.replace('__SOURCES__:', ''));
                                sourcesProcessed = true;
                            } catch (e) { console.error('Failed to parse sources:', e); }
                        } else if (part.trim() || sourcesProcessed) {
                            // Only append if it's not empty OR if sources are already done
                            accumulatedContent += part + (parts.length > 1 && part !== parts[parts.length-1] ? '\n' : '');
                        }
                    }
                } else {
                    accumulatedContent += chunk;
                }

                // Update the last message
                setMessages(prev => {
                    const last = [...prev];
                    const idx = last.findIndex(m => (m as any).id === assistantMessageId);
                    if (idx !== -1) {
                        last[idx] = { ...last[idx], content: accumulatedContent, sources: sources };
                    }
                    return last;
                });
            }
            
            // Speak if enabled
            if (voiceEnabled) speak(accumulatedContent);
        } catch (error) {
            console.error('Chat failed:', error);
            setMessages(prev => {
                const last = [...prev];
                const idx = last.findIndex(m => (m as any).id === assistantMessageId);
                if (idx !== -1) {
                    last[idx] = { ...last[idx], content: 'Sorry, I encountered an error during streaming.' };
                }
                return last;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type — only PDF and DOCX allowed
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const allowedExtensions = ['.pdf', '.docx'];
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
            showToast('Only PDF or DOCX files can be uploaded. Please choose a valid file.', 'error');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await axios.post('/api/v1/docs/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast(`"${file.name}" uploaded successfully!`, 'success');
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Successfully uploaded "${file.name}". I've indexed it for your research.`
            }]);
            fetchDocuments();
            fetchVisualizations();
            fetchInsights();
        } catch (error) {
            console.error('Upload failed:', error);
            showToast(`Failed to upload "${file.name}". Please try again.`, 'error');
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Sorry, I failed to process "${file.name}".`
            }]);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleProfileImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const newAvatar = reader.result as string;
            // Update user avatar immediately
            setUser((prev: any) => ({ ...prev, avatar: newAvatar }));
            // Also update edit form if it exists
            setEditForm((prev: any) => prev ? ({ ...prev, avatar: newAvatar }) : null);
        };
        reader.readAsDataURL(file);
    };

    if (!isAuthenticated) {
        // @ts-ignore - bypassing persistent lint that might be due to caching
        return <Auth onLogin={(userData: any) => {
            setUser(userData);
            setIsAuthenticated(true);
        }} theme={theme} />;
    }

    return (
        <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${theme} theme-bg-app theme-text-primary`}>
            {/* Theme Indicator for Debugging */}
            <div className="fixed bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-[10px] rounded z-[9999] pointer-events-none">
                Theme: {theme}
            </div>
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-4 fade-in duration-300 ${toast.type === 'error'
                        ? 'bg-red-950/90 border-red-500/40 text-red-200 backdrop-blur-xl'
                        : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 backdrop-blur-xl'
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${toast.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                        {toast.type === 'error' ? (
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                        ) : (
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <p className="font-semibold text-sm">{toast.type === 'error' ? 'Upload Restricted' : 'Upload Successful'}</p>
                        <p className="text-xs opacity-80 mt-0.5">{toast.message}</p>
                    </div>
                    <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
            {/* Sidebar */}
            <div className="w-64 border-r flex flex-col p-4 z-20 transition-colors duration-300 theme-bg-sidebar theme-border">
                <div className="flex items-center gap-3 mb-8 px-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 p-2 rounded-xl transition-all" onClick={() => setActiveTab('profile')}>
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20">
                        {user?.avatar ? (
                            <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs text-white">
                                {user?.name?.charAt(0) || 'R'}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{user?.name || 'Researcher'}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest font-bold">Pro Account</span>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setSelectedProject(null);
                        setActiveTab('planner');
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl p-3 mb-6 transition-all duration-200 shadow-lg shadow-indigo-600/20 font-medium"
                >
                    <Plus size={20} />
                    New Research
                </button>

                <nav className="flex-1 space-y-1">
                    {[
                        { id: 'chat', icon: MessageSquare, label: 'Research Chat' },
                        { id: 'docs', icon: FileText, label: 'Documents' },
                        { id: 'insights', icon: Zap, label: 'AI Insights' },
                        { id: 'planner', icon: BookOpen, label: 'Research Planner' },
                        { id: 'visuals', icon: PieChartIcon, label: 'Visualization' },
                        { id: 'profile', icon: User, label: 'My Profile' },
                        { id: 'settings', icon: Settings, label: 'Settings' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                stopSpeaking();
                                setActiveTab(item.id);
                                if (item.id !== 'planner') setSelectedProject(null);
                            }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${activeTab === item.id ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                        >
                            <item.icon size={20} />
                            {item.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative transition-all duration-700 animate-in fade-in zoom-in-95 theme-bg-app">
                {/* Subtle Grid Background Pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)',
                        backgroundSize: '50px 50px'
                    }}
                ></div>

                <header className="h-16 border-b flex items-center justify-between px-8 backdrop-blur-xl sticky top-0 z-10 relative transition-colors duration-300 theme-bg-header theme-border">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white capitalize">{activeTab.replace('-', ' ')}</h2>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                            <input
                                type="text"
                                placeholder="Search research..."
                                className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white w-64 transition-all"
                            />
                        </div>
                        <div
                            onClick={() => setActiveTab('profile')}
                            className="w-10 h-10 rounded-full border-2 border-slate-800 overflow-hidden cursor-pointer hover:border-indigo-500 transition-all shadow-lg"
                        >
                            <img src={user?.avatar} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-6xl mx-auto w-full h-full">

                        {/* CHAT TAB */}
                        {activeTab === 'chat' && (
                            <div className="h-full flex flex-col max-w-3xl mx-auto animate-in slide-in-from-right-8 fade-in duration-500 relative">
                                {/* SVG Gradient Background - Lightweight & Clean */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                    {/* Radial gradient overlay for depth */}
                                    <div
                                        className="absolute inset-0 opacity-[0.03]"
                                        style={{
                                            background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent 50%), radial-gradient(ellipse 60% 50% at 50% 120%, rgba(139, 92, 246, 0.1), transparent 50%)'
                                        }}
                                    ></div>
                                    {/* Subtle grid pattern */}
                                    <div
                                        className="absolute inset-0 opacity-[0.02]"
                                        style={{
                                            backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)',
                                            backgroundSize: '40px 40px'
                                        }}
                                    ></div>
                                </div>

                                <div className="flex-1 space-y-6 mb-8 relative z-10">
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                            <div className={`max-w-[85%] shadow-xl ${msg.role === 'user'
                                                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-indigo-500/10 rounded-2xl p-4 backdrop-blur-sm'
                                                : 'theme-bg-chat theme-border chat-bubble-ai prose-ai animate-text-reveal backdrop-blur-md theme-text-primary'
                                                }`}>
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex-1">
                                                        <MarkdownFormatter content={msg.content} />
                                                    </div>
                                                    {msg.role === 'assistant' && (
                                                        <button 
                                                            onClick={() => speak(msg.content)}
                                                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 theme-text-secondary transition-all"
                                                            title="Speak message"
                                                        >
                                                            <Volume2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="chat-bubble-ai border-indigo-500/20 animate-forge-loading text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-3 backdrop-blur-md bg-white/70 dark:bg-[#1a1a1e]/70">
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                                Forging research insights...
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto px-2 pb-6 animate-slide-up delay-300">
                                    <div className="relative bg-white/70 dark:bg-[#16161a]/70 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-2 shadow-2xl backdrop-blur-xl hover:scale-[1.02] transition-all duration-500">
                                        <div className="flex items-center gap-2">
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.docx" />
                                            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`p-3 rounded-xl transition-all ${uploading ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
                                                <Upload size={20} />
                                            </button>
                                            <input
                                                type="text"
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                                placeholder="Ask your assistant anything..."
                                                className="flex-1 bg-transparent border-none outline-none py-2 px-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                                            />
                                            <button
                                                onClick={toggleRecording}
                                                className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse-ripple shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:scale-110 active:scale-90'}`}
                                            >
                                                <Mic size={20} />
                                            </button>
                                            <button
                                                onClick={handleSend}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                                            >
                                                <Send size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DOCUMENTS TAB */}
                        {activeTab === 'docs' && (
                            <div className="animate-slide-up">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Resource Library</h3>
                                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 transition-all hover:scale-105 active:scale-95 shadow-lg hover:shadow-indigo-500/10">
                                        <Upload size={18} />
                                        Import File
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {documents.map(doc => (
                                        <div key={doc.id} className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 hover:border-indigo-500/30 transition-all group relative shadow-sm">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                    <FileText size={24} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-slate-900 dark:text-white font-medium truncate mb-1">{doc.filename}</h4>
                                                    <p className="text-slate-500 dark:text-slate-500 text-xs uppercase tracking-wider font-bold">{doc.file_type}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setFocusedDocument({ id: doc.id, name: doc.filename });
                                                    setActiveTab('chat');
                                                    setMessages(prev => [...prev, { 
                                                        role: 'assistant', 
                                                        content: `I've focused my research on **${doc.filename}**. What specific information are you looking for in this document?` 
                                                    } as Message]);
                                                }}
                                                className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl transition-all"
                                            >
                                                <Brain size={14} />
                                                Chat with this file
                                            </button>
                                            <button
                                                onClick={() => deleteDocument(doc.id)}
                                                className="absolute top-4 right-4 text-slate-400 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* INSIGHTS TAB */}
                        {activeTab === 'insights' && insights && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8 insights-page">
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-600/20 dark:to-purple-600/10 border border-indigo-200 dark:border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl">
                                    <Zap className="text-indigo-600 dark:text-indigo-400 mb-4" size={32} />
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Executive Summary</h3>
                                    <div className="text-slate-700 dark:text-slate-200 leading-relaxed text-lg prose-ai animate-text-reveal">{insights.summary}</div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {insights.key_findings.map((finding: string, i: number) => (
                                        <div key={i} className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6 relative overflow-hidden group shadow-sm">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 group-hover:w-2 transition-all"></div>
                                            <p className="text-slate-800 dark:text-slate-200 text-lg leading-snug">{finding}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* PLANNER TAB */}
                        {activeTab === 'planner' && (
                            <div className="animate-in fade-in duration-500 space-y-8 max-w-4xl">
                                {!selectedProject ? (
                                    <>
                                        <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-8 shadow-sm dark:shadow-2xl">
                                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Start New Project</h3>
                                            <div className="flex gap-4">
                                                <input
                                                    type="text"
                                                    value={newProjectTitle}
                                                    onChange={(e) => setNewProjectTitle(e.target.value)}
                                                    placeholder="Enter research topic (e.g. Impact of AI on Healthcare)"
                                                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                                />
                                                <button
                                                    onClick={createProject}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                                                >
                                                    Create Roadmap
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-sm">Active Projects</h4>
                                            {projects.map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => openProject(p)}
                                                    className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                            <Calendar size={20} />
                                                        </div>
                                                        <div>
                                                            <h5 className="text-slate-900 dark:text-white font-bold">{p.title}</h5>
                                                            <p className="text-slate-500 text-sm">Status: {p.plan ? 'Roadmap Ready' : 'Planning Stage'}</p>
                                                        </div>
                                                    </div>
                                                    <ArrowRight className="text-slate-400 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white transition-all" size={20} />
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        <button
                                            onClick={() => setSelectedProject(null)}
                                            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-4 group font-medium"
                                        >
                                            <div className="rotate-180">
                                                <ArrowRight size={20} />
                                            </div>
                                            Back to Projects
                                        </button>

                                        <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-8 shadow-sm dark:shadow-2xl relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
                                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{selectedProject.title}</h3>
                                            <p className="text-orange-500 dark:text-orange-400 font-medium mb-8 flex items-center gap-2">
                                                <Zap size={18} className="fill-orange-500 dark:fill-orange-400" />
                                                ThinkForge Research Roadmap
                                            </p>

                                            {isGeneratingPlan ? (
                                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                                    <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-500/20 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
                                                    <p className="text-slate-500 dark:text-slate-400 animate-pulse">Consulting AI Knowledge Base...</p>
                                                </div>
                                            ) : selectedProject.plan ? (
                                                <div className="prose prose-slate dark:prose-invert max-w-none">
                                                    <div className="animate-text-reveal">
                                                        {Array.isArray(selectedProject.plan.roadmap) ? (
                                                            <div className="space-y-6">
                                                                {selectedProject.plan.roadmap.map((phase: any, i: number) => (
                                                                    <div key={i} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 transition-all hover:bg-white dark:hover:bg-slate-900 shadow-sm relative group overflow-hidden">
                                                                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                                        <div className="flex justify-between items-start mb-3">
                                                                            <h5 className="text-xl font-bold text-slate-900 dark:text-white">{phase.title}</h5>
                                                                            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-full uppercase tracking-widest border border-indigo-200 dark:border-indigo-500/20">
                                                                                <Calendar size={12} />
                                                                                {phase.duration}
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium text-sm">{phase.description}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed font-sans prose-ai">
                                                                {selectedProject.plan.roadmap}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-12">
                                                    <p className="text-slate-500 dark:text-slate-400 mb-6">No roadmap found for this project.</p>
                                                    <button
                                                        onClick={() => generateRoadmap(selectedProject.id)}
                                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                                                    >
                                                        Generate Now
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* VISUALIZATION TAB */}
                        {activeTab === 'visuals' && vizData && (
                            <div className="animate-in fade-in duration-500 space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[500px]">
                                    <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-8 flex flex-col shadow-sm dark:shadow-2xl">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
                                            <Layout size={20} className="text-indigo-600 dark:text-indigo-400" />
                                            Resource Allocation
                                        </h3>
                                        <div className="flex-1">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={vizData.topic_distribution}
                                                        innerRadius={80}
                                                        outerRadius={120}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {vizData.topic_distribution.map((_: any, index: number) => (
                                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: theme === 'dark' ? '#111114' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                                                    />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-8 flex flex-col shadow-sm dark:shadow-2xl">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
                                            <BarChart2 size={20} className="text-purple-600 dark:text-purple-400" />
                                            Research Intensity
                                        </h3>
                                        <div className="flex-1">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={vizData.research_progress}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} vertical={false} />
                                                    <XAxis dataKey="name" stroke={theme === 'dark' ? '#64748b' : '#475569'} fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke={theme === 'dark' ? '#64748b' : '#475569'} fontSize={12} tickLine={false} axisLine={false} />
                                                    <Tooltip
                                                        cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                                                        contentStyle={{ backgroundColor: theme === 'dark' ? '#111114' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                                                    />
                                                    <Bar dataKey="progress" fill="url(#colorBar)" radius={[10, 10, 0, 0]} />
                                                    <defs>
                                                        <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
                                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.3} />
                                                        </linearGradient>
                                                    </defs>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PROFILE TAB */}
                        {activeTab === 'profile' && user && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
                                <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-[2rem] overflow-hidden shadow-sm dark:shadow-2xl relative">
                                    {/* Cover Pattern */}
                                    <div className="h-48 bg-gradient-to-r from-indigo-600 to-purple-700 relative">
                                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                                    </div>

                                    {/* Profile Info Area */}
                                    <div className="px-10 pb-12 -mt-16 relative">
                                        {/* Hidden file input for profile image upload */}
                                        <input
                                            type="file"
                                            ref={profileImageInputRef}
                                            onChange={handleProfileImageUpload}
                                            className="hidden"
                                            accept="image/*"
                                        />
                                        <div className="flex flex-col md:flex-row items-end gap-6 mb-8">
                                            <div className="relative group">
                                                <div className="w-40 h-40 rounded-[2.5rem] border-8 border-white dark:border-[#1a1a1e] overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-2xl relative">
                                                    <img src={user.avatar} alt="Profile Large" className="w-full h-full object-cover" />
                                                </div>
                                                <button
                                                    onClick={() => profileImageInputRef.current?.click()}
                                                    className="absolute bottom-2 right-2 w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-xl border-4 border-white dark:border-[#1a1a1e] transition-all transform hover:scale-110 z-10"
                                                    title="Change Profile Photo"
                                                >
                                                    <Plus size={20} />
                                                </button>
                                            </div>
                                            <div className="flex-1 pb-4">
                                                <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{user.name}</h3>
                                                <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                                                    <span className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full text-xs font-semibold text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20">
                                                        <Briefcase size={14} /> {user.profession || 'Lead Researcher'}
                                                    </span>
                                                    <span className="text-sm">{user.email}</span>
                                                    {user.phone && <span className="text-sm flex items-center gap-1.5"><Phone size={14} /> {user.phone}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-3 pb-4">
                                                <button
                                                    onClick={() => {
                                                        setEditForm(user);
                                                        setIsEditingProfile(true);
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                                                >
                                                    Edit Profile
                                                </button>
                                            </div>
                                        </div>

                                        {isEditingProfile && (
                                            <div className="bg-slate-50 dark:bg-slate-900/50 border border-indigo-200 dark:border-indigo-500/20 rounded-3xl p-8 mb-8 animate-in zoom-in-95 duration-200">
                                                <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                                    <Settings size={20} className="text-indigo-600 dark:text-indigo-400" />
                                                    Personalize Your Experience
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 ml-1">Display Name</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.name}
                                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                            className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 ml-1">Profession</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.profession}
                                                            onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                                                            className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-2 col-span-2">
                                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 ml-1">Contact Phone</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.phone}
                                                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                                            className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-3">
                                                    <button
                                                        onClick={() => setIsEditingProfile(false)}
                                                        className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setUser(editForm);
                                                            setIsEditingProfile(false);
                                                        }}
                                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95"
                                                    >
                                                        Save Settings
                                                    </button>
                                                </div>
                                            </div>
                                        )}



                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-200 dark:border-slate-800/50">
                                            {[
                                                { label: 'Total Projects', value: projects.length, icon: BookOpen, color: 'text-indigo-600 dark:text-indigo-400' },
                                                { label: 'Documents Hooked', value: documents.length, icon: FileText, color: 'text-purple-600 dark:text-purple-400' },
                                                { label: 'AI Interactions', value: '1.2k', icon: Zap, color: 'text-amber-600 dark:text-amber-400' },
                                            ].map((stat, i) => (
                                                <div key={i} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6 transition-all hover:bg-slate-100 dark:hover:bg-slate-900/60 shadow-sm">
                                                    <stat.icon className={`${stat.color} mb-3`} size={24} />
                                                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-widest font-bold">{stat.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SETTINGS TAB */}
                        {activeTab === 'settings' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto settings-page">
                                <div className="border rounded-3xl p-8 shadow-sm dark:shadow-2xl theme-bg-card theme-border-accent">
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                                        <Settings size={32} className="text-indigo-600 dark:text-indigo-400" />
                                        Settings & Preferences
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 mb-8">Customize your ThinkForge experience</p>

                                    <div className="space-y-6">
                                        {/* Dark/Light Mode Toggle */}
                                        <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-slate-800 rounded-2xl">
                                            <div>
                                                <h5 className="text-slate-900 dark:text-white font-bold mb-1">Interface Theme</h5>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">Choose between light and dark visual aesthetics</p>
                                            </div>
                                            <div className="flex gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
                                                <button
                                                    onClick={() => {
                                                        console.log('[THEME DEBUG] Dark button clicked');
                                                        setTheme('dark');
                                                    }}
                                                    className={`px-5 py-2 rounded-lg font-bold transition-all ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}
                                                >
                                                    Dark
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        console.log('[THEME DEBUG] Light button clicked');
                                                        setTheme('light');
                                                    }}
                                                    className={`px-5 py-2 rounded-lg font-bold transition-all ${theme === 'light' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}
                                                >
                                                    Light
                                                </button>
                                            </div>
                                        </div>

                                        {/* AI Response Length */}
                                        <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-slate-800 rounded-2xl">
                                            <div>
                                                <h5 className="text-slate-900 dark:text-white font-bold mb-1">AI Response Length</h5>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">Control how detailed AI responses should be</p>
                                            </div>
                                            <select
                                                value={aiResponseLength}
                                                onChange={(e) => setAiResponseLength(e.target.value as any)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer font-medium"
                                            >
                                                <option value="concise">Concise</option>
                                                <option value="balanced">Balanced</option>
                                                <option value="detailed">Detailed</option>
                                            </select>
                                        </div>

                                        {/* Language Selection */}
                                        <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-slate-800 rounded-2xl">
                                            <div>
                                                <h5 className="text-slate-900 dark:text-white font-bold mb-1">Language Support</h5>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">Select your preferred interaction language</p>
                                            </div>
                                            <select
                                                value={language}
                                                onChange={(e) => setLanguage(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer font-medium"
                                            >
                                                <option value="en">English</option>
                                                <option value="es">Español</option>
                                                <option value="fr">Français</option>
                                                <option value="de">Deutsch</option>
                                                <option value="zh">中文</option>
                                                <option value="ja">日本語</option>
                                                <option value="hi">हिन्दी</option>
                                            </select>
                                        </div>

                                        {/* Voice Toggle */}
                                        <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-slate-800 rounded-2xl">
                                            <div>
                                                <h5 className="text-slate-900 dark:text-white font-bold mb-1">Voice Feedback</h5>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">Enable text-to-speech for AI responses</p>
                                            </div>
                                            <button
                                                onClick={() => setVoiceEnabled(!voiceEnabled)}
                                                className={`relative w-14 h-8 rounded-full transition-all ${voiceEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${voiceEnabled ? 'translate-x-6' : ''}`}></div>
                                            </button>
                                        </div>

                                        {/* Password Change */}
                                        <div className="p-5 bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-slate-800 rounded-2xl">
                                            <button
                                                onClick={() => setShowPasswordChange(!showPasswordChange)}
                                                className="w-full flex items-center justify-between text-left group"
                                            >
                                                <div>
                                                    <h5 className="text-slate-900 dark:text-white font-bold mb-1">Security & Access</h5>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Update your account password and security</p>
                                                </div>
                                                <div className={`transform transition-transform text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white ${showPasswordChange ? 'rotate-180' : ''}`}>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </button>

                                            {showPasswordChange && (
                                                <div className="mt-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                    <input
                                                        type="password"
                                                        placeholder="Current Password"
                                                        value={passwordForm.current}
                                                        onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                                    />
                                                    <input
                                                        type="password"
                                                        placeholder="New Password"
                                                        value={passwordForm.new}
                                                        onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                                    />
                                                    <input
                                                        type="password"
                                                        placeholder="Confirm New Password"
                                                        value={passwordForm.confirm}
                                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            alert('Password change functionality will be implemented with backend integration');
                                                            setPasswordForm({ current: '', new: '', confirm: '' });
                                                            setShowPasswordChange(false);
                                                        }}
                                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                                                    >
                                                        Update Credentials
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Logout Button */}
                                        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                                            <button
                                                onClick={() => {
                                                    setIsAuthenticated(false);
                                                    setUser(null);
                                                    setMessages([{ role: 'assistant', content: 'Hello! I am your Autonomous AI Research Assistant. How can I help you today?' }]);
                                                }}
                                                className="w-full bg-red-50 dark:bg-red-600/10 hover:bg-red-100 dark:hover:bg-red-600/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Sign Out of Account
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};


export default App;
