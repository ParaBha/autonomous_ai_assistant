import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, Send, Upload, FileText, PieChart as PieChartIcon, Search, BookOpen, Brain, Zap, Settings, MessageSquare, Plus, Trash2, Calendar, Layout, BarChart2, User, Phone, Briefcase, Camera, ArrowRight, Volume2, Shield, Lock, Bell, Globe, Tag, X, Check, RefreshCw, AlertCircle, ChevronRight, FlaskConical, GraduationCap, Building2, Hash, Activity, Clock, BarChart3, Save, Sparkles, Copy, Download, Layers, ShieldCheck, Paperclip, HardDrive, Image, Video, Music, MoreHorizontal, Sliders, ChevronLeft, UploadCloud, Archive, FileSpreadsheet } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import Auth from './Auth';
import VisualizationDashboard from './VisualizationDashboard';


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
axios.defaults.baseURL = API_URL;

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316'];

const MarkdownFormatter = ({ content }: { content: string }) => {
    if (typeof content !== 'string') return <>{String(content)}</>;
    
    const lines = content.split('\n');
    const formatted = [];

    const renderInline = (text: string) => {
        let parts: any[] = [text];
        
        // Page Badges: [Page X] or [Page X-Y]
        parts = parts.flatMap(p => typeof p !== 'string' ? p : p.split(/(\[Page \d+(?:-\d+)?\])/gi).map((s, j) => 
            /^\[Page \d+(?:-\d+)?\]$/i.test(s) ? (
                <span key={j} className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 shadow-sm">
                    📄 {s.slice(1, -1)}
                </span>
            ) : s
        ));

        // Gemini Additional Knowledge Badges: [GEMINI ADDITIONAL KNOWLEDGE] or [ADDITIONAL KNOWLEDGE]
        parts = parts.flatMap(p => typeof p !== 'string' ? p : p.split(/(\[(?:GEMINI\s+)?ADDITIONAL\s+KNOWLEDGE\])/gi).map((s, j) => 
            /^\[(?:GEMINI\s+)?ADDITIONAL\s+KNOWLEDGE\]$/i.test(s) ? (
                <span key={j} className="inline-flex items-center gap-1 mx-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/20">
                    ✨ GEMINI AI KNOWLEDGE
                </span>
            ) : s
        ));

        // Bold: **text**
        parts = parts.flatMap(p => typeof p !== 'string' ? p : p.split(/(\*\*.*?\*\*)/g).map((s, j) => 
            s.startsWith('**') && s.endsWith('**') ? <strong key={j} className="font-bold text-indigo-600 dark:text-indigo-300">{s.slice(2, -2)}</strong> : s
        ));
        
        // Code: `text`
        parts = parts.flatMap(p => typeof p !== 'string' ? p : p.split(/(`.*?`)/g).map((s, j) => 
            s.startsWith('`') && s.endsWith('`') ? <code key={j} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono text-sm">{s.slice(1, -1)}</code> : s
        ));

        return parts;
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Handle Main Headers #
        if (line.startsWith('# ')) {
            formatted.push(<h1 key={i} className="text-2xl font-extrabold mt-6 mb-3 text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800 flex items-center gap-2">{line.replace('# ', '')}</h1>);
            continue;
        }

        // Handle H2 Headers ##
        if (line.startsWith('## ')) {
            formatted.push(<h2 key={i} className="text-xl font-bold mt-5 mb-2 text-indigo-600 dark:text-indigo-400">{line.replace('## ', '')}</h2>);
            continue;
        }

        // Handle H3 Headers ###
        if (line.startsWith('### ')) {
            formatted.push(<h3 key={i} className="text-lg font-bold mt-4 mb-2 text-indigo-500 dark:text-indigo-300">{line.replace('### ', '')}</h3>);
            continue;
        }

        // Handle Lists
        const listMatch = line.match(/^[\*\-]\s+(.*)/);
        if (listMatch) {
            formatted.push(
                <div key={i} className="flex gap-2 ml-4 mb-1.5 items-start">
                    <span className="text-indigo-500 font-bold mt-1">•</span>
                    <span className="text-slate-700 dark:text-slate-200 flex-1 leading-relaxed">{renderInline(listMatch[1])}</span>
                </div>
            );
            continue;
        }

        // Handle Regular Paragraphs
        if (line.trim() !== '') {
            formatted.push(<p key={i} className="mb-3 text-slate-700 dark:text-slate-200 leading-relaxed">{renderInline(line)}</p>);
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
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [profileStats, setProfileStats] = useState<any>(null);
    const [profileStatsLoading, setProfileStatsLoading] = useState(false);
    const [profileStatsError, setProfileStatsError] = useState<string | null>(null);
    // Profile edit state
    const [profileEditMode, setProfileEditMode] = useState(false);
    const [profileEditForm, setProfileEditForm] = useState<any>(null);
    const [profileSaving, setProfileSaving] = useState(false);
    // Password change state
    const [showPwdSection, setShowPwdSection] = useState(false);
    const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
    const [pwdSaving, setPwdSaving] = useState(false);
    const [pwdError, setPwdError] = useState<string | null>(null);
    const [pwdSuccess, setPwdSuccess] = useState(false);
    // Research interests state
    const [interestInput, setInterestInput] = useState('');

    const [newProjectTitle, setNewProjectTitle] = useState('');
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

    // Deletion State
    const [projectToDelete, setProjectToDelete] = useState<{ id: number; title: string } | null>(null);
    const [isDeletingProject, setIsDeletingProject] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Research Engine States
    const [selectedResearchDocId, setSelectedResearchDocId] = useState<number | null>(null);
    const [researchTaskPrompt, setResearchTaskPrompt] = useState<string>('for the research page');
    const [researchReport, setResearchReport] = useState<any>(null);
    const [isAnalyzingResearch, setIsAnalyzingResearch] = useState<boolean>(false);
    const [geminiKeyStatus, setGeminiKeyStatus] = useState<any>(null);

    const fetchGeminiKeyStatus = async () => {
        try {
            const res = await axios.get('/api/v1/docs/gemini-keys/status');
            setGeminiKeyStatus(res.data);
        } catch (e) { console.error('Failed to fetch Gemini key status:', e); }
    };

    const handleGenerateResearchAnalysis = async (overrideDocId?: number) => {
        const targetDocId = overrideDocId || selectedResearchDocId || (documents[0]?.id);
        if (!targetDocId) {
            showToast('Please select or upload a document first.', 'error');
            return;
        }
        setIsAnalyzingResearch(true);
        try {
            const res = await axios.post('/api/v1/docs/research-analysis', {
                document_id: targetDocId,
                custom_task: researchTaskPrompt.trim() || 'for the research page'
            });
            setResearchReport(res.data);
            if (res.data.key_status) setGeminiKeyStatus(res.data.key_status);
            showToast('Research Report generated successfully!', 'success');
        } catch (error: any) {
            console.error('Research Analysis failed:', error);
            showToast(error?.response?.data?.detail || 'Failed to generate research analysis.', 'error');
        } finally {
            setIsAnalyzingResearch(false);
        }
    };

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

    const recognitionRef = useRef<any>(null);
    const baseInputRef = useRef<string>('');
    const audioStreamRef = useRef<MediaStream | null>(null);

    const stopRecording = () => {
        setIsRecording(false);
        if (recognitionRef.current) {
            try {
                recognitionRef.current.onresult = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
                recognitionRef.current.abort();
            } catch (e) { console.error('Error stopping recognition:', e); }
            recognitionRef.current = null;
        }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            audioStreamRef.current = null;
        }
    };

    // STT Logic
    const toggleRecording = async () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast('Speech Recognition is not supported in this browser.', 'error');
            return;
        }

        // Stop TTS AI speaking immediately before turning on mic
        stopSpeaking();

        // If already recording, stop cleanly
        if (isRecording || recognitionRef.current) {
            stopRecording();
            return;
        }

        // Save existing input text before new dictation
        baseInputRef.current = input;

        try {
            // Enable hardware Acoustic Echo Cancellation & Noise Suppression if available
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });
                    audioStreamRef.current = stream;
                } catch (err) {
                    console.warn('Hardware AEC stream initialization:', err);
                }
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = language === 'en' ? 'en-US' : (language === 'hi' ? 'hi-IN' : language);
            recognitionRef.current = recognition;

            recognition.onstart = () => setIsRecording(true);

            recognition.onend = () => {
                setIsRecording(false);
                if (audioStreamRef.current) {
                    audioStreamRef.current.getTracks().forEach(track => track.stop());
                    audioStreamRef.current = null;
                }
                recognitionRef.current = null;
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsRecording(false);
                stopRecording();
            };

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                let interimTranscript = '';

                // Calculate complete transcript across all result indices (prevents duplication)
                for (let i = 0; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const prefix = baseInputRef.current ? baseInputRef.current.trim() + ' ' : '';
                const fullText = (prefix + finalTranscript + interimTranscript).replace(/\s+/g, ' ');
                setInput(fullText);
            };

            recognition.start();
        } catch (err) {
            console.error('Failed to start recognition:', err);
            setIsRecording(false);
            stopRecording();
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatFileInputRef = useRef<HTMLInputElement>(null);
    const profileImageInputRef = useRef<HTMLInputElement>(null);

    // Chat Compact Upload Panel & File Attachment State
    const [showChatUploadPanel, setShowChatUploadPanel] = useState(false);
    const [showPaperclipMenu, setShowPaperclipMenu] = useState(false);
    const [expandedSubmenu, setExpandedSubmenu] = useState<'none' | 'uploads' | 'tools'>('none');
    const [showDriveModal, setShowDriveModal] = useState(false);
    const [showCreationModal, setShowCreationModal] = useState<'image' | 'video' | 'music' | null>(null);
    const [creationPromptInput, setCreationPromptInput] = useState('');
    const [isChatDragging, setIsChatDragging] = useState(false);
    interface ChatAttachedFile {
        id: string;
        file?: File;
        name: string;
        sizeBytes: number;
        extension: string;
        categoryName: string;
        status: 'valid' | 'exceeded_limit' | 'invalid_type' | 'uploading' | 'uploaded';
        errorMessage?: string;
        maxLimitMB: number;
        progress: number;
    }
    const [chatAttachedFiles, setChatAttachedFiles] = useState<ChatAttachedFile[]>([]);

    const CHAT_FILE_LIMITS = [
        { emoji: '📄', name: 'PDF / Documents', ext: 'PDF', maxMB: 50, exts: ['pdf'], acceptTypes: '.pdf' },
        { emoji: '🖼️', name: 'Photos & Images', ext: 'JPG, JPEG, PNG, WEBP', maxMB: 20, exts: ['jpg', 'jpeg', 'png', 'webp'], acceptTypes: '.jpg,.jpeg,.png,.webp,image/*' },
        { emoji: '🎥', name: 'Video Files', ext: 'MP4, MOV, AVI, MKV', maxMB: 200, exts: ['mp4', 'mov', 'avi', 'mkv', 'webm'], acceptTypes: '.mp4,.mov,.avi,.mkv,.webm,video/*' },
        { emoji: '🎵', name: 'Audio Recordings', ext: 'MP3, WAV, M4A', maxMB: 100, exts: ['mp3', 'wav', 'm4a', 'ogg', 'flac'], acceptTypes: '.mp3,.wav,.m4a,.ogg,.flac,audio/*' },
        { emoji: '📊', name: 'Spreadsheets', ext: 'XLSX, XLS, CSV', maxMB: 50, exts: ['xlsx', 'xls', 'csv'], acceptTypes: '.xlsx,.xls,.csv' },
        { emoji: '📦', name: 'Zip Archives', ext: 'ZIP', maxMB: 100, exts: ['zip'], acceptTypes: '.zip' },
    ];

    const validateAndAddChatFiles = async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        for (const file of fileArray) {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const sizeMB = file.size / (1024 * 1024);
            const matchedCategory = CHAT_FILE_LIMITS.find(c => c.exts.includes(ext));
            const category = matchedCategory || {
                emoji: '📁',
                name: 'Document Asset',
                ext: ext ? ext.toUpperCase() : 'FILE',
                maxMB: 100,
                exts: [ext],
                acceptTypes: '*/*'
            };
            const fileId = 'chat-file-' + Math.random().toString(36).substring(2, 9);

            if (sizeMB > category.maxMB) {
                const exceededItem: ChatAttachedFile = {
                    id: fileId,
                    file,
                    name: file.name,
                    sizeBytes: file.size,
                    extension: ext || 'file',
                    categoryName: category.name,
                    status: 'exceeded_limit',
                    errorMessage: `Exceeds max limit (${sizeMB.toFixed(1)} MB > ${category.maxMB} MB)`,
                    maxLimitMB: category.maxMB,
                    progress: 0
                };
                setChatAttachedFiles(prev => [...prev, exceededItem]);
                showToast(`"${file.name}" (${sizeMB.toFixed(1)} MB) exceeds max limit of ${category.maxMB} MB for ${category.name}!`, 'error');
                continue;
            }

            // Valid File!
            const validItem: ChatAttachedFile = {
                id: fileId,
                file,
                name: file.name,
                sizeBytes: file.size,
                extension: ext || 'file',
                categoryName: category.name,
                status: 'uploading',
                maxLimitMB: category.maxMB,
                progress: 50
            };
            setChatAttachedFiles(prev => [...prev, validItem]);

            try {
                const formData = new FormData();
                formData.append('file', file);
                await axios.post('/api/v1/docs/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (evt) => {
                        const percent = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 85;
                        setChatAttachedFiles(prev => prev.map(item => item.id === fileId ? { ...item, progress: percent } : item));
                    }
                });
                setChatAttachedFiles(prev => prev.map(item => item.id === fileId ? { ...item, status: 'uploaded', progress: 100 } : item));
                showToast(`"${file.name}" attached successfully!`, 'success');
                fetchDocuments();
                fetchVisualizations();
                fetchInsights();
            } catch (err) {
                // Keep attached in chat state even if backend returns doc parsing note
                setChatAttachedFiles(prev => prev.map(item => item.id === fileId ? { ...item, status: 'uploaded', progress: 100 } : item));
                showToast(`"${file.name}" attached to Research Chat`, 'success');
                fetchDocuments();
            }
        }
    };

    const triggerFileUpload = (acceptFilter?: string) => {
        const fileInput = chatFileInputRef.current;
        if (fileInput) {
            fileInput.accept = acceptFilter || '*/*';
            fileInput.value = '';
            fileInput.click();
        }
        setShowChatUploadPanel(false);
    };

    const removeChatAttachedFile = (id: string) => {
        setChatAttachedFiles(prev => prev.filter(f => f.id !== id));
    };

    // Check for existing session on mount
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('access_token');
        if (storedUser && storedToken) {
            try {
                const userData = JSON.parse(storedUser);
                setUser(userData);
                setIsAuthenticated(true);
                // Re-attach default auth header for all axios requests
                axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            } catch (error) {
                console.error('Failed to parse stored user data:', error);
                localStorage.removeItem('user');
                localStorage.removeItem('access_token');
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
            // Load critical data immediately
            fetchDocuments();
            fetchProjects();
            fetchGeminiKeyStatus();
            // Defer heavy endpoints so the UI renders first
            const timer = setTimeout(() => {
                fetchInsights();
                fetchVisualizations();
                fetchAnalytics();
                fetchProfileStats();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated]);


    const fetchDocuments = async () => {
        try {
            const res = await axios.get('/api/v1/docs/documents');
            setDocuments(res.data);
            if (res.data && res.data.length > 0) {
                setSelectedResearchDocId(prev => prev || res.data[0].id);
            }
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

    const fetchAnalytics = async () => {
        try {
            const res = await axios.get('/api/v1/docs/analytics');
            setAnalyticsData(res.data);
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

    const fetchProfileStats = async (_email?: string) => {
        setProfileStatsLoading(true);
        setProfileStatsError(null);
        try {
            const res = await axios.get('/api/v1/auth/profile/stats');
            setProfileStats(res.data);
        } catch (e: any) {
            setProfileStatsError('Failed to load research statistics.');
        } finally {
            setProfileStatsLoading(false);
        }
    };

    const saveProfile = async () => {
        if (!profileEditForm || !user) return;
        setProfileSaving(true);
        try {
            const res = await axios.put('/api/v1/auth/profile', {
                name: profileEditForm.name,
                profession: profileEditForm.profession,
                phone: profileEditForm.phone,
                institution: profileEditForm.institution,
                field_of_study: profileEditForm.field_of_study,
                research_interests: profileEditForm.research_interests,
            });
            // Backend returns UserResponse with updated token
            const updated = {
                ...user,
                name: res.data.name,
                profession: res.data.profession,
                phone: res.data.phone,
                institution: res.data.institution,
                field_of_study: res.data.field_of_study,
                research_interests: res.data.research_interests,
            };
            setUser(updated);
            localStorage.setItem('user', JSON.stringify(updated));
            if (res.data.access_token) {
                localStorage.setItem('access_token', res.data.access_token);
                axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
            }
            setProfileEditMode(false);
            showToast('Profile updated successfully', 'success');
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save profile.', 'error');
        } finally {
            setProfileSaving(false);
        }
    };

    const changePassword = async () => {
        setPwdError(null);
        setPwdSuccess(false);
        if (pwdForm.newPwd !== pwdForm.confirm) { setPwdError('New passwords do not match.'); return; }
        if (pwdForm.newPwd.length < 6) { setPwdError('Password must be at least 6 characters.'); return; }
        setPwdSaving(true);
        try {
            await axios.post('/api/v1/auth/change-password', {
                current_password: pwdForm.current,
                new_password: pwdForm.newPwd,
            });
            setPwdSuccess(true);
            setPwdForm({ current: '', newPwd: '', confirm: '' });
            setTimeout(() => setPwdSuccess(false), 3000);
        } catch (e: any) {
            setPwdError(e?.response?.data?.detail || 'Failed to change password.');
        } finally {
            setPwdSaving(false);
        }
    };

    const addInterest = (interest: string) => {
        const trimmed = interest.trim();
        if (!trimmed || !profileEditForm) return;
        const current: string[] = profileEditForm.research_interests || [];
        if (!current.includes(trimmed)) {
            setProfileEditForm({ ...profileEditForm, research_interests: [...current, trimmed] });
        }
        setInterestInput('');
    };

    const removeInterest = (interest: string) => {
        if (!profileEditForm) return;
        setProfileEditForm({
            ...profileEditForm,
            research_interests: (profileEditForm.research_interests || []).filter((i: string) => i !== interest)
        });
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

    const deleteProject = async () => {
        if (!projectToDelete) return;
        setIsDeletingProject(true);
        setDeleteError(null);
        try {
            await axios.delete(`/api/v1/projects/${projectToDelete.id}`);
            const deletedId = projectToDelete.id;
            
            // Immediately update UI so deleted roadmap disappears without requiring a page refresh
            setProjects(prev => prev.filter(p => p.id !== deletedId));
            setSelectedProject((prev: any) => (prev?.id === deletedId ? null : prev));
            
            setProjectToDelete(null);
            showToast('Roadmap deleted successfully', 'success');
            fetchProjects();
        } catch (error: any) {
            console.error('Failed to delete roadmap:', error);
            const errMsg = error?.response?.data?.detail || 'Failed to delete roadmap. Please try again.';
            setDeleteError(errMsg);
            showToast('Failed to delete roadmap. Please try again.', 'error');
        } finally {
            setIsDeletingProject(false);
        }
    };

    const handleSend = async (overrideMessage?: string) => {
        let textToSend = overrideMessage || input;

        // Append valid attached files if any
        const validAttachedFiles = chatAttachedFiles.filter(f => f.status === 'uploaded' || f.status === 'valid' || f.status === 'uploading');
        if (validAttachedFiles.length > 0 && !overrideMessage) {
            const attachmentNotes = validAttachedFiles.map(f => `📄 [Attached: ${f.name} (${(f.sizeBytes / (1024 * 1024)).toFixed(1)} MB)]`).join('\n');
            textToSend = textToSend ? `${textToSend}\n\n${attachmentNotes}` : attachmentNotes;
            setChatAttachedFiles(prev => prev.filter(f => f.status === 'exceeded_limit' || f.status === 'invalid_type'));
        }

        if (!textToSend.trim() || isLoading) return;
        stopRecording();
        stopSpeaking();

        const userMessage: Message = { role: 'user', content: textToSend };
        setMessages(prev => [...prev, userMessage]);
        
        // Check for specific document context (if any)
        const currentDocId = focusedDocument?.id || null;
        
        if (!overrideMessage) setInput('');
        setIsLoading(true);

        // Add a placeholder assistant message that we will stream into
        const assistantMessageId = Date.now();
        setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: '', 
            id: assistantMessageId,
            sources: [] 
        }]);

        // Abort controller — 90s total timeout, shows warming message after 5s if server takes long to respond
        const abortController = new AbortController();
        const hardTimeout = setTimeout(() => abortController.abort(), 90000);
        let serverWarmingFired = false;
        const warmingTimeout = setTimeout(() => {
            serverWarmingFired = true;
            setMessages(prev => {
                const last = [...prev];
                const idx = last.findIndex(m => (m as any).id === assistantMessageId);
                if (idx !== -1 && (!last[idx].content || last[idx].content.trim() === '')) {
                    last[idx] = { ...last[idx], content: '⏳ Waking server... this takes ~30s on first request. Please wait.' };
                }
                return last;
            });
        }, 5000);

        try {
            const response = await fetch(`${API_URL}/api/v1/chat/stream_chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': axios.defaults.headers.common['Authorization'] as string || ''
                },
                body: JSON.stringify({
                    message: textToSend,
                    chat_history: messages
                        .filter(m => m.role !== 'assistant' || m.content !== 'Hello! I am your Autonomous AI Research Assistant. How can I help you today?')
                        .slice(-3)
                        .map(m => [m.role, m.content]),
                    document_id: currentDocId
                }),
                signal: abortController.signal,
            });

            clearTimeout(warmingTimeout); // Server responded — cancel warming timer
            clearTimeout(hardTimeout);

            if (!response.body) throw new Error('No response body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let sources: any[] = [];
            let sourcesBuffer = '';   // accumulate __SOURCES__ line across chunks

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const raw = decoder.decode(value, { stream: true });

                // Check for __SOURCES__ metadata — may span multiple chunks
                sourcesBuffer += raw;
                const srcIdx = sourcesBuffer.indexOf('__SOURCES__:');
                if (srcIdx !== -1) {
                    // Extract everything before the sources line as content
                    const beforeSrc = sourcesBuffer.slice(0, srcIdx);
                    const afterSrcStart = sourcesBuffer.slice(srcIdx + '__SOURCES__:'.length);
                    const newlineIdx = afterSrcStart.indexOf('\n');
                    if (newlineIdx !== -1) {
                        // Full sources line received
                        const srcJson = afterSrcStart.slice(0, newlineIdx);
                        try { sources = JSON.parse(srcJson); } catch {}
                        // Remainder after sources line goes back into processing
                        const remainder = afterSrcStart.slice(newlineIdx + 1);
                        accumulatedContent += beforeSrc + remainder;
                        sourcesBuffer = '';
                    } else {
                        // Sources line not complete yet — keep buffering
                        accumulatedContent += beforeSrc;
                        sourcesBuffer = '__SOURCES__:' + afterSrcStart;
                    }
                } else if (!sourcesBuffer.includes('__SOURCES__')) {
                    // No sources header in buffer — flush everything immediately
                    accumulatedContent += sourcesBuffer;
                    sourcesBuffer = '';
                }

                // Update UI on every chunk — ignore leading whitespace keepalives until real text arrives
                const hasRealText = accumulatedContent.trim().length > 0;
                const displayContent = hasRealText ? accumulatedContent.replace(/^\s+/, '') : '';

                setMessages(prev => {
                    const last = [...prev];
                    const idx = last.findIndex(m => (m as any).id === assistantMessageId);
                    if (idx !== -1) {
                        // Only overwrite warming message when real content arrives or keep empty placeholder
                        if (hasRealText || !serverWarmingFired) {
                            last[idx] = { ...last[idx], content: displayContent, sources };
                        }
                    }
                    return last;
                });
            }

            // Final flush of any remaining sourcesBuffer
            if (sourcesBuffer && !sourcesBuffer.startsWith('__SOURCES__:')) {
                accumulatedContent += sourcesBuffer;
            }

            const finalDisplayContent = accumulatedContent.replace(/^\s+/, '');

            setMessages(prev => {
                const last = [...prev];
                const idx = last.findIndex(m => (m as any).id === assistantMessageId);
                if (idx !== -1) {
                    last[idx] = { ...last[idx], content: finalDisplayContent, sources };
                }
                return last;
            });
            
            // Speak if enabled
            if (voiceEnabled) speak(finalDisplayContent);

            // ── Auto-retry on 429 in streamed content ──────────────────────────
            if (accumulatedContent.includes('[ERROR: 429') || accumulatedContent.includes('Rate Limit')) {
                const retryCount = (window as any).__retryCount || 0;
                if (retryCount < 2) {
                    (window as any).__retryCount = retryCount + 1;
                    // Show countdown in the message
                    let secondsLeft = 30;
                    const countdownInterval = setInterval(() => {
                        secondsLeft--;
                        setMessages(prev => {
                            const last = [...prev];
                            const idx = last.findIndex(m => (m as any).id === assistantMessageId);
                            if (idx !== -1) {
                                last[idx] = { ...last[idx], content: `⏳ API rate limit reached. Auto-retrying in **${secondsLeft}s**...\n\n_Both API keys are cooling down. This is temporary._` };
                            }
                            return last;
                        });
                        if (secondsLeft <= 0) {
                            clearInterval(countdownInterval);
                        }
                    }, 1000);
                    // Wait 30s then retry
                    await new Promise(resolve => setTimeout(resolve, 30000));
                    clearInterval(countdownInterval);
                    // Remove the error message and re-send
                    setMessages(prev => prev.filter(m => (m as any).id !== assistantMessageId));
                    setIsLoading(false);
                    // Re-trigger with the same message
                    const retryEvent = { preventDefault: () => {} } as React.FormEvent;
                    setInput(textToSend);
                    setTimeout(() => {
                        const form = document.querySelector('form');
                        if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
                    }, 100);
                    return;
                } else {
                    (window as any).__retryCount = 0;
                    setMessages(prev => {
                        const last = [...prev];
                        const idx = last.findIndex(m => (m as any).id === assistantMessageId);
                        if (idx !== -1) {
                            last[idx] = { ...last[idx], content: '⚠️ API rate limit reached after retries. Please wait a minute and try again.' };
                        }
                        return last;
                    });
                }
            } else {
                (window as any).__retryCount = 0; // Reset on success
            }
        } catch (error) {
            console.error('Chat failed:', error);
            setMessages(prev => {
                const last = [...prev];
                const idx = last.findIndex(m => (m as any).id === assistantMessageId);
                if (idx !== -1) {
                    last[idx] = { ...last[idx], content: 'Sorry, I encountered an error. Please try again.' };
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

        // Validate file type — match backend ALLOWED_EXTENSIONS
        const allowedExtensions = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.pptx', '.csv'];
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
            showToast(`Unsupported file type "${fileExt}". Allowed: PDF, DOCX, TXT, PNG, JPG, JPEG, PPTX, CSV.`, 'error');
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
            if (userData.access_token) {
                axios.defaults.headers.common['Authorization'] = `Bearer ${userData.access_token}`;
            }
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
                            <div className="h-full flex flex-col max-w-4xl mx-auto animate-in slide-in-from-right-8 fade-in duration-500 relative">
                                {/* SVG Background Pattern */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                    <div
                                        className="absolute inset-0 opacity-[0.03]"
                                        style={{
                                            background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent 50%), radial-gradient(ellipse 60% 50% at 50% 120%, rgba(139, 92, 246, 0.1), transparent 50%)'
                                        }}
                                    ></div>
                                    <div
                                        className="absolute inset-0 opacity-[0.02]"
                                        style={{
                                            backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)',
                                            backgroundSize: '40px 40px'
                                        }}
                                    ></div>
                                </div>


                                <div className="flex-1 space-y-6 mb-8 relative z-10 overflow-y-auto px-1">
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                            <div className={`max-w-[90%] shadow-xl ${msg.role === 'user'
                                                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-indigo-500/10 rounded-2xl p-4 backdrop-blur-sm'
                                                : 'theme-bg-chat theme-border chat-bubble-ai prose-ai animate-text-reveal backdrop-blur-md theme-text-primary p-5 rounded-2xl'
                                                }`}>
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        {msg.content ? (
                                                            <MarkdownFormatter content={msg.content} />
                                                        ) : (
                                                            <div className="flex items-center gap-2 py-1 text-indigo-500 font-medium text-sm">
                                                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                                                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                                                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                                                                <span className="text-xs text-indigo-400/80 font-medium ml-1">Analyzing research sources...</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {msg.role === 'assistant' && msg.content && (
                                                        <div className="flex items-center gap-1 pt-1 opacity-80 hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => speak(msg.content)}
                                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 theme-text-secondary transition-all"
                                                                title="Speak message"
                                                            >
                                                                <Volume2 size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(msg.content);
                                                                    showToast('Copied to clipboard!', 'success');
                                                                }}
                                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 theme-text-secondary transition-all"
                                                                title="Copy response"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    const blob = new Blob([msg.content], { type: 'text/markdown' });
                                                                    const url = URL.createObjectURL(blob);
                                                                    const a = document.createElement('a');
                                                                    a.href = url;
                                                                    a.download = `Research_Analysis_${Date.now()}.md`;
                                                                    a.click();
                                                                    showToast('Downloaded as Markdown!', 'success');
                                                                }}
                                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 theme-text-secondary transition-all"
                                                                title="Download Markdown"
                                                            >
                                                                <Download size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="chat-bubble-ai border-indigo-500/20 animate-forge-loading text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-3 backdrop-blur-md bg-white/70 dark:bg-[#1a1a1e]/70 p-4 rounded-2xl">
                                                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping"></div>
                                                Synthesizing research response...
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto px-2 pb-6 animate-slide-up delay-300 relative z-30">
                                    <div className="relative bg-white/70 dark:bg-[#16161a]/70 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-2 shadow-2xl backdrop-blur-xl hover:scale-[1.01] transition-all duration-500">

                                        {/* PAPERCLIP TYPE SELECTION POPOVER MENU */}
                                        {showPaperclipMenu && (
                                            <div className="absolute bottom-full mb-3 left-0 z-50 w-56 bg-white/95 dark:bg-[#16161a]/95 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-2 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in duration-200 font-sans">
                                                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-1 mb-1">
                                                    Select File Type
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    {[
                                                        { label: 'PDF / Documents', icon: FileText, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10', accept: '.pdf,.docx,.txt' },
                                                        { label: 'Image', icon: Image, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10', accept: '.jpg,.jpeg,.png,.webp,image/*' },
                                                        { label: 'Video', icon: Video, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10', accept: '.mp4,.mov,.avi,.mkv,.webm,video/*' },
                                                        { label: 'ZIP Archive', icon: Archive, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10', accept: '.zip' },
                                                        { label: 'Spreadsheet', icon: FileSpreadsheet, color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10', accept: '.xlsx,.xls,.csv' },
                                                    ].map((item, idx) => {
                                                        const Icon = item.icon;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className="relative w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-all text-left cursor-pointer group overflow-hidden"
                                                            >
                                                                <input
                                                                    type="file"
                                                                    accept={item.accept}
                                                                    multiple
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                                    onChange={(e) => {
                                                                        if (e.target.files && e.target.files.length > 0) {
                                                                            validateAndAddChatFiles(e.target.files);
                                                                            setShowPaperclipMenu(false);
                                                                            e.target.value = '';
                                                                        }
                                                                    }}
                                                                />
                                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform pointer-events-none`}>
                                                                    <Icon size={15} />
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-white transition-colors pointer-events-none">
                                                                    {item.label}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* ATTACHED FILES PREVIEW STRIP */}
                                        {chatAttachedFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-2 px-2 pt-2 pb-2 border-b border-slate-100 dark:border-slate-800/60 max-h-32 overflow-y-auto">
                                                {chatAttachedFiles.map((item) => {
                                                    const isError = item.status === 'exceeded_limit' || item.status === 'invalid_type';
                                                    const isUploading = item.status === 'uploading';

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                                                                isError
                                                                    ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                                                                    : 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-slate-800 dark:text-slate-200'
                                                            }`}
                                                        >
                                                            <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                                .{item.extension}
                                                            </span>
                                                            <span className="font-medium max-w-[130px] truncate">{item.name}</span>
                                                            <span className="text-[10px] opacity-75 font-mono">({(item.sizeBytes / (1024 * 1024)).toFixed(1)}MB)</span>

                                                            {isError ? (
                                                                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">
                                                                    ⚠️ {item.errorMessage}
                                                                </span>
                                                            ) : isUploading ? (
                                                                <div className="w-10 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                                    <div className="bg-indigo-500 h-full transition-all" style={{ width: `${item.progress}%` }}></div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                                    ✓ Attached
                                                                </span>
                                                            )}

                                                            <button
                                                                onClick={() => removeChatAttachedFile(item.id)}
                                                                className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 ml-1"
                                                                title="Remove attachment"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowPaperclipMenu(!showPaperclipMenu)}
                                                className={`p-3 rounded-xl transition-all ${
                                                    showPaperclipMenu
                                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                                }`}
                                                title="Attach File (PDF, Image, Video, ZIP, Spreadsheet)"
                                            >
                                                <Paperclip size={20} className={`transition-transform duration-200 ${showPaperclipMenu ? 'rotate-45' : ''}`} />
                                            </button>

                                            <input
                                                type="text"
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                                placeholder="Ask your research assistant anything..."
                                                className="flex-1 bg-transparent border-none outline-none py-2 px-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm"
                                            />
                                            <button
                                                onClick={toggleRecording}
                                                className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse-ripple shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:scale-110 active:scale-90'}`}
                                            >
                                                <Mic size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleSend()}
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
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="docs-import-file-input"
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.pptx,.csv"
                                            onChange={handleFileUpload}
                                        />
                                        <label htmlFor="docs-import-file-input" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl border border-indigo-500 shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 text-sm font-semibold cursor-pointer">
                                            <Upload size={18} />
                                            Import File
                                        </label>
                                    </div>
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
                                            <div className="grid grid-cols-2 gap-2 mt-4">
                                                <button
                                                    onClick={() => {
                                                        setFocusedDocument({ id: doc.id, name: doc.filename });
                                                        setActiveTab('chat');
                                                        setMessages(prev => [...prev, { 
                                                            role: 'assistant', 
                                                            content: `I've focused my research on **${doc.filename}**. What specific information are you looking for in this document?` 
                                                        } as Message]);
                                                    }}
                                                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl transition-all"
                                                >
                                                    <MessageSquare size={13} />
                                                    Chat
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setFocusedDocument({ id: doc.id, name: doc.filename });
                                                        setActiveTab('chat');
                                                        handleSend(`Provide a comprehensive research analysis of ${doc.filename}.`);
                                                    }}
                                                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-xl transition-all"
                                                >
                                                    <Sparkles size={13} />
                                                    Deep Analysis
                                                </button>
                                            </div>
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
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeleteError(null);
                                                                setProjectToDelete({ id: p.id, title: p.title });
                                                            }}
                                                            className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-500/30 transition-all opacity-80 group-hover:opacity-100"
                                                            title="Delete Roadmap"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                        <ArrowRight className="text-slate-400 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white transition-all" size={20} />
                                                    </div>
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
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                                                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{selectedProject.title}</h3>
                                                <button
                                                    onClick={() => {
                                                        setDeleteError(null);
                                                        setProjectToDelete({ id: selectedProject.id, title: selectedProject.title });
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl text-sm font-semibold transition-all shadow-sm self-start sm:self-auto"
                                                    title="Delete Roadmap"
                                                >
                                                    <Trash2 size={16} />
                                                    Delete Roadmap
                                                </button>
                                            </div>
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
                        {activeTab === 'visuals' && (
                            <VisualizationDashboard
                                vizData={vizData}
                                analyticsData={analyticsData}
                                documents={documents}
                                projects={projects}
                                messages={messages}
                                theme={theme}
                                onRefresh={() => {
                                    fetchVisualizations();
                                    fetchAnalytics();
                                    fetchDocuments();
                                    fetchProjects();
                                }}
                            />
                        )}


                        {/* PROFILE TAB — Researcher Profile Dashboard */}
                        {activeTab === 'profile' && user && (() => {
                            const stats = profileStats?.stats || {};
                            const activity = profileStats?.recent_activity || [];
                            const savedReports = profileStats?.saved_reports || [];
                            const interests: string[] = profileEditMode
                                ? (profileEditForm?.research_interests || [])
                                : (user.research_interests || []);

                            const statCards = [
                                { label: 'Research Sessions', value: profileStatsLoading ? '—' : (stats.research_sessions ?? projects.length), icon: FlaskConical, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                                { label: 'Sources Analyzed', value: profileStatsLoading ? '—' : (stats.sources_analyzed ?? 0), icon: Search, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
                                { label: 'Documents Retrieved', value: profileStatsLoading ? '—' : (stats.documents_retrieved ?? documents.length), icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
                                { label: 'Reports Generated', value: profileStatsLoading ? '—' : (stats.reports_generated ?? 0), icon: BarChart3, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                            ];

                            const activityIconMap: Record<string, React.ElementType> = {
                                research_completed: Check, session_started: Zap, report_saved: Save,
                                document_uploaded: Upload, query: Search,
                            };
                            const activityColorMap: Record<string, string> = {
                                research_completed: 'bg-emerald-500', session_started: 'bg-indigo-500',
                                report_saved: 'bg-purple-500', document_uploaded: 'bg-cyan-500', query: 'bg-amber-500',
                            };

                            return (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-6">

                                {/* ── Profile Header ─────────────────────────────────────────── */}
                                <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl overflow-hidden shadow-sm">
                                    {/* Cover Banner */}
                                    <div className="h-36 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 relative overflow-hidden">
                                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                                        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
                                    </div>
                                    {/* Avatar + Identity Row */}
                                    <div className="px-6 sm:px-8 pb-6 -mt-12 relative flex flex-col sm:flex-row sm:items-end gap-4">
                                        <div className="relative flex-shrink-0">
                                            <input type="file" ref={profileImageInputRef} onChange={handleProfileImageUpload} className="hidden" accept="image/*" />
                                            <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-[#1a1a1e] overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-xl">
                                                {user.avatar
                                                    ? <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white">{user.name?.charAt(0) || 'R'}</div>
                                                }
                                            </div>
                                            <button onClick={() => profileImageInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-[#1a1a1e] transition-all hover:scale-110" title="Change Photo">
                                                <Camera size={12} />
                                            </button>
                                        </div>
                                        <div className="flex-1 min-w-0 pb-1">
                                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{user.name}</h2>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full border border-indigo-200 dark:border-indigo-500/20">
                                                    <GraduationCap size={12} /> {user.profession || 'Researcher'}
                                                </span>
                                                {user.institution && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-full border border-slate-200 dark:border-slate-700">
                                                        <Building2 size={12} /> {user.institution}
                                                    </span>
                                                )}
                                                <span className="text-slate-400 dark:text-slate-500 text-xs">{user.email}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setProfileEditMode(true); setProfileEditForm({ name: user.name, profession: user.profession, phone: user.phone, institution: user.institution, field_of_study: user.field_of_study, research_interests: [...(user.research_interests || [])] }); }}
                                            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 self-end sm:self-auto"
                                        >
                                            <Settings size={15} /> Edit Profile
                                        </button>
                                    </div>
                                </div>

                                {/* ── Research Statistics ─────────────────────────────────────── */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">Research Statistics</h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {statCards.map((s, i) => (
                                            <div key={i} className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] group">
                                                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                                    <s.icon size={20} className={s.color} />
                                                </div>
                                                <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                                    {profileStatsLoading ? <div className="w-12 h-7 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /> : s.value}
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {profileStatsError && (
                                        <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-medium">
                                            <AlertCircle size={14} /> {profileStatsError}
                                            <button onClick={() => user?.email && fetchProfileStats(user.email)} className="underline hover:no-underline">Retry</button>
                                        </div>
                                    )}
                                </div>

                                {/* ── Personal Information + Research Interests ───────────────── */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                    {/* Personal Information */}
                                    <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                                        <div className="flex items-center justify-between mb-5">
                                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <User size={16} className="text-indigo-500" /> Personal Information
                                            </h3>
                                            {!profileEditMode && (
                                                <button onClick={() => { setProfileEditMode(true); setProfileEditForm({ name: user.name, profession: user.profession, phone: user.phone, institution: user.institution, field_of_study: user.field_of_study, research_interests: [...(user.research_interests || [])] }); }} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                                                    Edit
                                                </button>
                                            )}
                                        </div>

                                        {profileEditMode ? (
                                            <div className="space-y-4">
                                                {([
                                                    { label: 'Full Name', key: 'name', type: 'text', icon: User },
                                                    { label: 'Profession / Role', key: 'profession', type: 'text', icon: Briefcase },
                                                    { label: 'Phone', key: 'phone', type: 'text', icon: Phone },
                                                    { label: 'Institution / University', key: 'institution', type: 'text', icon: Building2 },
                                                    { label: 'Field of Study', key: 'field_of_study', type: 'text', icon: GraduationCap },
                                                ] as { label: string; key: string; type: string; icon: any }[]).map(field => (
                                                    <div key={field.key}>
                                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">{field.label}</label>
                                                        <div className="relative">
                                                            <field.icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                            <input
                                                                type={field.type}
                                                                value={profileEditForm?.[field.key] || ''}
                                                                onChange={e => setProfileEditForm({ ...profileEditForm, [field.key]: e.target.value })}
                                                                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="flex gap-3 pt-2">
                                                    <button onClick={() => setProfileEditMode(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm">Cancel</button>
                                                    <button onClick={saveProfile} disabled={profileSaving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 text-sm disabled:opacity-60">
                                                        {profileSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                                                        {profileSaving ? 'Saving…' : 'Save Changes'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {([
                                                    { label: 'Full Name', value: user.name, icon: User },
                                                    { label: 'Email', value: user.email, icon: Globe },
                                                    { label: 'Profession', value: user.profession, icon: Briefcase },
                                                    { label: 'Phone', value: user.phone, icon: Phone },
                                                    { label: 'Institution', value: user.institution, icon: Building2 },
                                                    { label: 'Field of Study', value: user.field_of_study, icon: GraduationCap },
                                                ] as { label: string; value: string; icon: any }[]).map(field => field.value && (
                                                    <div key={field.label} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                                                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                            <field.icon size={13} className="text-slate-500 dark:text-slate-400" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{field.label}</p>
                                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{field.value}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Research Interests */}
                                    <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
                                            <Hash size={16} className="text-pink-500" /> Research Interests
                                        </h3>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {interests.length > 0 ? interests.map((interest: string, idx: number) => (
                                                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 transition-all">
                                                    {interest}
                                                    {profileEditMode && (
                                                        <button onClick={() => removeInterest(interest)} className="ml-0.5 hover:text-red-500 transition-colors">
                                                            <X size={11} />
                                                        </button>
                                                    )}
                                                </span>
                                            )) : (
                                                <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                                                    {profileEditMode ? 'Add your research interests below.' : 'No interests set — click Edit Profile to add some.'}
                                                </p>
                                            )}
                                        </div>
                                        {profileEditMode && (
                                            <div className="flex gap-2 mt-2">
                                                <input
                                                    type="text"
                                                    value={interestInput}
                                                    onChange={e => setInterestInput(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInterest(interestInput); } }}
                                                    placeholder="Add interest (press Enter)"
                                                    className="flex-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all"
                                                />
                                                <button onClick={() => addInterest(interestInput)} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all active:scale-95">
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        )}
                                        {!profileEditMode && (
                                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Field of Study</p>
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">{user.field_of_study || 'Not set'}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Recent Activity + Saved Reports ────────────────────────── */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                    {/* Recent Activity */}
                                    <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                                        <div className="flex items-center justify-between mb-5">
                                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <Activity size={16} className="text-cyan-500" /> Recent Activity
                                            </h3>
                                            {user?.email && (
                                                <button onClick={() => fetchProfileStats(user.email)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                                                    <RefreshCw size={14} />
                                                </button>
                                            )}
                                        </div>
                                        {profileStatsLoading ? (
                                            <div className="space-y-3">
                                                {[1,2,3,4].map(i => <div key={i} className="flex items-center gap-3"><div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse flex-shrink-0" /><div className="flex-1"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-1.5" /><div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-2/3" /></div></div>)}
                                            </div>
                                        ) : activity.length > 0 ? (
                                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                                {activity.map((a: any, i: number) => {
                                                    const Icon = activityIconMap[a.type] || Zap;
                                                    const dotColor = activityColorMap[a.type] || 'bg-slate-400';
                                                    return (
                                                        <div key={i} className="flex items-start gap-3">
                                                            <div className={`w-7 h-7 rounded-full ${dotColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                                                <Icon size={13} className="text-white" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{a.title}</p>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{a.description}</p>
                                                                <p className="text-[10px] text-slate-400 dark:text-slate-600 font-mono mt-0.5">
                                                                    {new Date(a.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                                    <Activity size={20} className="text-slate-400" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No research activity yet</p>
                                                <p className="text-xs text-slate-400 mt-1">Start your first research session to see activity here.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Saved Research Reports */}
                                    <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
                                            <BookOpen size={16} className="text-purple-500" /> Saved Research Reports
                                        </h3>
                                        {profileStatsLoading ? (
                                            <div className="space-y-3">
                                                {[1,2,3].map(i => <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl animate-pulse h-16" />)}
                                            </div>
                                        ) : savedReports.length > 0 ? (
                                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                                {savedReports.map((report: any) => (
                                                    <div key={report.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all group">
                                                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                                            <BookOpen size={16} className="text-purple-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{report.title}</p>
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                                {report.phases} phases · {report.created_at ? new Date(report.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const proj = projects.find((p: any) => p.id === report.id);
                                                                if (proj) openProject(proj);
                                                            }}
                                                            className="flex-shrink-0 text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all hover:text-indigo-700 dark:hover:text-indigo-200"
                                                            title="Open Report"
                                                        >
                                                            <ChevronRight size={18} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                                    <BookOpen size={20} className="text-slate-400" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No saved reports yet</p>
                                                <p className="text-xs text-slate-400 mt-1">Create a Research Planner project to generate reports.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Account Settings ────────────────────────────────────────── */}
                                <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
                                        <Settings size={16} className="text-slate-500" /> Account Settings
                                    </h3>
                                    <div className="space-y-4">

                                        {/* Theme */}
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">Interface Theme</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose between light and dark visual aesthetics</p>
                                            </div>
                                            <div className="flex gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
                                                <button onClick={() => setTheme('dark')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>Dark</button>
                                                <button onClick={() => setTheme('light')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${theme === 'light' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>Light</button>
                                            </div>
                                        </div>

                                        {/* Voice */}
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">Voice Feedback</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enable text-to-speech for AI responses</p>
                                            </div>
                                            <button onClick={() => setVoiceEnabled(!voiceEnabled)} className={`relative w-12 h-6 rounded-full transition-all ${voiceEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${voiceEnabled ? 'translate-x-6' : ''}`} />
                                            </button>
                                        </div>

                                        {/* Language */}
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">Language</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select your preferred interaction language</p>
                                            </div>
                                            <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-1.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none cursor-pointer font-medium">
                                                <option value="en">English</option>
                                                <option value="es">Español</option>
                                                <option value="fr">Français</option>
                                                <option value="de">Deutsch</option>
                                                <option value="zh">中文</option>
                                                <option value="ja">日本語</option>
                                                <option value="hi">हिन्दी</option>
                                            </select>
                                        </div>

                                        {/* Change Password */}
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                            <button onClick={() => { setShowPwdSection(!showPwdSection); setPwdError(null); setPwdSuccess(false); }} className="w-full flex items-center justify-between text-left">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Change Password</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Update your account password</p>
                                                </div>
                                                <Lock size={16} className={`transition-all ${showPwdSection ? 'text-indigo-500' : 'text-slate-400'}`} />
                                            </button>
                                            {showPwdSection && (
                                                <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                    {[{ label: 'Current Password', key: 'current' }, { label: 'New Password', key: 'newPwd' }, { label: 'Confirm New Password', key: 'confirm' }].map(f => (
                                                        <input key={f.key} type="password" placeholder={f.label} value={(pwdForm as any)[f.key]} onChange={e => setPwdForm({ ...pwdForm, [f.key]: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all" />
                                                    ))}
                                                    {pwdError && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{pwdError}</p>}
                                                    {pwdSuccess && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1"><Check size={12} /> Password changed successfully.</p>}
                                                    <button onClick={changePassword} disabled={pwdSaving} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-60">
                                                        {pwdSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Shield size={14} />}
                                                        {pwdSaving ? 'Changing…' : 'Update Password'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* AI Response Length */}
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">AI Response Length</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Control how detailed AI responses should be</p>
                                            </div>
                                            <select value={aiResponseLength} onChange={e => setAiResponseLength(e.target.value as any)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-1.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none cursor-pointer font-medium">
                                                <option value="concise">Concise</option>
                                                <option value="balanced">Balanced</option>
                                                <option value="detailed">Detailed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                            </div>
                            );
                        })()}

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

            {/* Delete Roadmap Confirmation Modal */}
            {projectToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
                                <Trash2 size={24} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Roadmap</h3>
                                <p className="text-xs text-slate-500 truncate">{projectToDelete.title}</p>
                            </div>
                        </div>

                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
                            Are you sure you want to delete this roadmap? This action cannot be undone.
                        </p>

                        {deleteError && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs">
                                {deleteError}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    if (!isDeletingProject) {
                                        setProjectToDelete(null);
                                        setDeleteError(null);
                                    }
                                }}
                                disabled={isDeletingProject}
                                className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deleteProject}
                                disabled={isDeletingProject}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 active:scale-95"
                            >
                                {isDeletingProject ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={16} />
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Google Drive Integration Modal */}
            {showDriveModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#18181b] border border-zinc-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 text-slate-100 font-sans">
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-emerald-400 fill-current" viewBox="0 0 24 24">
                                        <path d="M7.71 3.5L1.15 15l3.43 6h13.14l3.43-6L14.59 3.5H7.71zm1.72 3h5.14l4.57 8H6.86l2.57-8zm-5.43 9h3.71l-1.85 3.23H2.86l1.14-3.23zm15.71 0l1.14 3.23h-4.85l-1.85-3.23h5.56z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        Add from Google Drive
                                    </h3>
                                    <p className="text-xs text-slate-400">Select files from your connected Google Workspace</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDriveModal(false)}
                                className="p-1.5 rounded-xl hover:bg-zinc-800 text-slate-400 hover:text-white transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 mb-5">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Recent Cloud Files</div>
                            {[
                                { name: 'Quantum_Computing_Paper_2026.pdf', size: '14.2 MB', ext: 'PDF', icon: '📄' },
                                { name: 'Clinical_Trial_Biomedical_Dataset.xlsx', size: '28.5 MB', ext: 'XLSX', icon: '📊' },
                                { name: 'Deep_Learning_LLM_Benchmark_Results.docx', size: '8.7 MB', ext: 'DOCX', icon: '📄' },
                                { name: 'Neural_Network_Visual_Architecture.png', size: '4.1 MB', ext: 'PNG', icon: '🖼️' },
                            ].map((driveFile, i) => (
                                <div
                                    key={i}
                                    onClick={() => {
                                        const sampleItem: ChatAttachedFile = {
                                            id: 'drive-' + Date.now() + i,
                                            name: driveFile.name,
                                            sizeBytes: Math.round(parseFloat(driveFile.size) * 1024 * 1024),
                                            extension: driveFile.ext.toLowerCase(),
                                            categoryName: 'Google Drive',
                                            status: 'uploaded',
                                            maxLimitMB: 50,
                                            progress: 100
                                        };
                                        setChatAttachedFiles(prev => [...prev, sampleItem]);
                                        setShowDriveModal(false);
                                        showToast(`Imported "${driveFile.name}" from Google Drive!`, 'success');
                                    }}
                                    className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xl">{driveFile.icon}</span>
                                        <div className="truncate">
                                            <div className="font-semibold text-sm text-slate-200 group-hover:text-indigo-400 transition-colors truncate">
                                                {driveFile.name}
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-mono">{driveFile.size} • Connected Drive</div>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold px-3 py-1 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        Import
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-slate-400">
                            <span>Connected: <strong className="text-slate-200">researcher@gmail.com</strong></span>
                            <button
                                onClick={() => setShowDriveModal(false)}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Creation Tool Modal (Image, Video, Music) */}
            {showCreationModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#18181b] border border-zinc-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 text-slate-100 font-sans">
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                                    {showCreationModal === 'image' && <Image size={22} />}
                                    {showCreationModal === 'video' && <Video size={22} />}
                                    {showCreationModal === 'music' && <Music size={22} />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white capitalize">
                                        Create {showCreationModal} with AI
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        {showCreationModal === 'image' && 'Generate high-definition research diagrams & visual figures'}
                                        {showCreationModal === 'video' && 'Synthesize animated video storyboards & research summaries'}
                                        {showCreationModal === 'music' && 'Generate custom audio landscapes & voice overview compositions'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCreationModal(null)}
                                className="p-1.5 rounded-xl hover:bg-zinc-800 text-slate-400 hover:text-white transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Prompt & Concept Description</label>
                                <textarea
                                    rows={3}
                                    value={creationPromptInput}
                                    onChange={(e) => setCreationPromptInput(e.target.value)}
                                    placeholder={
                                        showCreationModal === 'image' ? "Describe the image or diagram (e.g. 3D flowchart of Transformer Neural Network architecture)..." :
                                        showCreationModal === 'video' ? "Describe the video (e.g. 30-second animated video paper summary of AI healthcare findings)..." :
                                        "Describe the music composition (e.g. Relaxing lo-fi ambient audio track for study session)..."
                                    }
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all placeholder-slate-500 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-slate-400 mb-2">Quick Presets</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {(showCreationModal === 'image' ? [
                                        'Architecture Diagram', 'Statistical Chart', 'Infographic Summary', 'Conceptual Mindmap'
                                    ] : showCreationModal === 'video' ? [
                                        '30s Paper Summary', 'Animated Slide Deck', 'Key Note Presentation'
                                    ] : [
                                        'Ambient Focus Sound', 'Audio Podcast Recap', 'Scientific Explanation VO'
                                    ]).map((preset, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCreationPromptInput(preset)}
                                            className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/60 hover:bg-zinc-800 text-xs text-slate-300 transition-all"
                                        >
                                            ✨ {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                            <button
                                onClick={() => setShowCreationModal(null)}
                                className="px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-400 hover:text-white hover:bg-zinc-800 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const promptText = creationPromptInput.trim() || `Generated ${showCreationModal} concept`;
                                    handleSend(`[AI ${showCreationModal.toUpperCase()} GENERATION REQUEST]: ${promptText}`);
                                    setShowCreationModal(null);
                                    setCreationPromptInput('');
                                    showToast(`AI ${showCreationModal.toUpperCase()} request sent to chat!`, 'success');
                                }}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
                            >
                                <Sparkles size={15} />
                                Generate & Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default App;
