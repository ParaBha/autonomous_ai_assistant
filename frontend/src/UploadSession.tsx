import React, { useState, useRef } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Image,
  Video,
  Music,
  Archive,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  File,
  Trash2,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  RefreshCw,
  FolderPlus,
  Zap,
  HardDrive
} from 'lucide-react';

export interface FileCategorySpec {
  id: string;
  name: string;
  emoji: string;
  icon: React.ElementType;
  extensions: string[];
  maxSizeMB: number;
  description: string;
  color: {
    badge: string;
    border: string;
    bg: string;
    text: string;
    icon: string;
  };
}

export const SUPPORTED_CATEGORIES: FileCategorySpec[] = [
  {
    id: 'docs',
    name: 'Documents',
    emoji: '📄',
    icon: FileText,
    extensions: ['PDF', 'DOCX', 'TXT'],
    maxSizeMB: 50,
    description: 'Research papers, articles, text notes',
    color: {
      badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      border: 'hover:border-blue-500/40',
      bg: 'from-blue-500/5 to-transparent',
      text: 'text-blue-600 dark:text-blue-400',
      icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    }
  },
  {
    id: 'spreadsheets',
    name: 'Spreadsheets',
    emoji: '📊',
    icon: FileSpreadsheet,
    extensions: ['XLSX', 'CSV'],
    maxSizeMB: 50,
    description: 'Data tables, research datasets',
    color: {
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      border: 'hover:border-emerald-500/40',
      bg: 'from-emerald-500/5 to-transparent',
      text: 'text-emerald-600 dark:text-emerald-400',
      icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    }
  },
  {
    id: 'images',
    name: 'Images',
    emoji: '🖼️',
    icon: Image,
    extensions: ['JPG', 'PNG', 'WEBP'],
    maxSizeMB: 20,
    description: 'Figures, diagrams, scan captures',
    color: {
      badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      border: 'hover:border-purple-500/40',
      bg: 'from-purple-500/5 to-transparent',
      text: 'text-purple-600 dark:text-purple-400',
      icon: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
    }
  },
  {
    id: 'videos',
    name: 'Videos',
    emoji: '🎥',
    icon: Video,
    extensions: ['MP4', 'MOV', 'WEBM'],
    maxSizeMB: 200,
    description: 'Lab recordings, presentations, interviews',
    color: {
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      border: 'hover:border-rose-500/40',
      bg: 'from-rose-500/5 to-transparent',
      text: 'text-rose-600 dark:text-rose-400',
      icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    }
  },
  {
    id: 'audio',
    name: 'Audio',
    emoji: '🎵',
    icon: Music,
    extensions: ['MP3', 'WAV', 'M4A'],
    maxSizeMB: 100,
    description: 'Dictations, meeting clips, voice notes',
    color: {
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      border: 'hover:border-amber-500/40',
      bg: 'from-amber-500/5 to-transparent',
      text: 'text-amber-600 dark:text-amber-400',
      icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    }
  },
  {
    id: 'other',
    name: 'Other Files',
    emoji: '📦',
    icon: Archive,
    extensions: ['ZIP'],
    maxSizeMB: 100,
    description: 'Compressed archives, data bundles',
    color: {
      badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      border: 'hover:border-indigo-500/40',
      bg: 'from-indigo-500/5 to-transparent',
      text: 'text-indigo-600 dark:text-indigo-400',
      icon: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
    }
  }
];

export interface QueueItem {
  id: string;
  file?: File;
  name: string;
  sizeBytes: number;
  extension: string;
  category?: FileCategorySpec;
  status: 'ready' | 'uploading' | 'warning_exceeded' | 'invalid_type' | 'complete';
  errorMessage?: string;
  progress: number;
  uploadedAt: string;
}

export interface UploadSessionProps {
  onSessionUploadComplete?: (files: QueueItem[]) => void;
  showToast?: (message: string, type: 'success' | 'error') => void;
}

export const UploadSession: React.FC<UploadSessionProps> = ({
  onSessionUploadComplete,
  showToast
}) => {
  const [sessionName, setSessionName] = useState('Research Ingestion Session #' + Math.floor(100 + Math.random() * 900));
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([
    {
      id: 'demo-1',
      name: 'Neural_Architecture_Survey_2026.pdf',
      sizeBytes: 14.2 * 1024 * 1024,
      extension: 'pdf',
      category: SUPPORTED_CATEGORIES[0],
      status: 'complete',
      progress: 100,
      uploadedAt: '11:42 AM'
    },
    {
      id: 'demo-2',
      name: 'Benchmark_Results_Raw_Data.xlsx',
      sizeBytes: 8.7 * 1024 * 1024,
      extension: 'xlsx',
      category: SUPPORTED_CATEGORIES[1],
      status: 'complete',
      progress: 100,
      uploadedAt: '11:43 AM'
    }
  ]);

  const [activeWarning, setActiveWarning] = useState<{
    fileName: string;
    actualSizeMB: string;
    maxLimitMB: number;
    categoryName: string;
  } | null>(null);

  const [isProcessingSession, setIsProcessingSession] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const findCategoryForExtension = (ext: string): FileCategorySpec | undefined => {
    const cleanExt = ext.replace('.', '').toUpperCase();
    return SUPPORTED_CATEGORIES.find(cat =>
      cat.extensions.includes(cleanExt)
    );
  };

  const processIncomingFiles = (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    let newWarningTriggered = false;

    const newItems: QueueItem[] = filesArray.map(file => {
      const ext = file.name.split('.').pop() || '';
      const category = findCategoryForExtension(ext);
      const sizeMB = file.size / (1024 * 1024);

      if (!category) {
        if (showToast) {
          showToast(`"${file.name}" has an unsupported file type.`, 'error');
        }
        return {
          id: 'file-' + Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          sizeBytes: file.size,
          extension: ext,
          status: 'invalid_type',
          errorMessage: `Unsupported format .${ext.toUpperCase()}`,
          progress: 0,
          uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }

      if (sizeMB > category.maxSizeMB) {
        newWarningTriggered = true;
        setActiveWarning({
          fileName: file.name,
          actualSizeMB: sizeMB.toFixed(1),
          maxLimitMB: category.maxSizeMB,
          categoryName: category.name
        });
        if (showToast) {
          showToast(`File "${file.name}" (${sizeMB.toFixed(1)} MB) exceeds max limit of ${category.maxSizeMB} MB!`, 'error');
        }
        return {
          id: 'file-' + Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          sizeBytes: file.size,
          extension: ext,
          category,
          status: 'warning_exceeded',
          errorMessage: `Exceeds max file limit (${sizeMB.toFixed(1)} MB > ${category.maxSizeMB} MB)`,
          progress: 0,
          uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }

      return {
        id: 'file-' + Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        sizeBytes: file.size,
        extension: ext,
        category,
        status: 'ready',
        progress: 100,
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });

    setQueue(prev => [...newItems, ...prev]);

    if (!newWarningTriggered && showToast && newItems.length > 0) {
      const validCount = newItems.filter(i => i.status === 'ready').length;
      if (validCount > 0) {
        showToast(`${validCount} file(s) added to session queue`, 'success');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const simulateOversizedUpload = (categoryId: string) => {
    const cat = SUPPORTED_CATEGORIES.find(c => c.id === categoryId) || SUPPORTED_CATEGORIES[0];
    const oversizedMB = cat.maxSizeMB + (cat.maxSizeMB > 100 ? 50 : 15);
    const mockFileName = `Large_${cat.name.replace(' ', '_')}_Dataset.${cat.extensions[0].toLowerCase()}`;

    setActiveWarning({
      fileName: mockFileName,
      actualSizeMB: oversizedMB.toFixed(1),
      maxLimitMB: cat.maxSizeMB,
      categoryName: cat.name
    });

    const mockItem: QueueItem = {
      id: 'mock-oversized-' + Date.now(),
      name: mockFileName,
      sizeBytes: oversizedMB * 1024 * 1024,
      extension: cat.extensions[0].toLowerCase(),
      category: cat,
      status: 'warning_exceeded',
      errorMessage: `Exceeds maximum file size limit (${oversizedMB.toFixed(1)} MB > ${cat.maxSizeMB} MB)`,
      progress: 0,
      uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setQueue(prev => [mockItem, ...prev]);

    if (showToast) {
      showToast(`Warning: "${mockFileName}" exceeds limit of ${cat.maxSizeMB} MB`, 'error');
    }
  };

  const removeQueueItem = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearCompletedOrWarnings = () => {
    setQueue(prev => prev.filter(item => item.status === 'ready' || item.status === 'uploading'));
  };

  const startProcessingSession = () => {
    const readyItems = queue.filter(item => item.status === 'ready');
    if (readyItems.length === 0) {
      if (showToast) showToast('No valid files in queue to process.', 'error');
      return;
    }

    setIsProcessingSession(true);
    setTimeout(() => {
      setQueue(prev =>
        prev.map(item =>
          item.status === 'ready' ? { ...item, status: 'complete', progress: 100 } : item
        )
      );
      setIsProcessingSession(false);
      if (showToast) {
        showToast(`Session "${sessionName}" processed ${readyItems.length} file(s) successfully!`, 'success');
      }
      if (onSessionUploadComplete) {
        onSessionUploadComplete(readyItems);
      }
    }, 1500);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const totalSizeBytes = queue.reduce((sum, item) => sum + item.sizeBytes, 0);
  const readyCount = queue.filter(i => i.status === 'ready' || i.status === 'complete').length;
  const warningCount = queue.filter(i => i.status === 'warning_exceeded' || i.status === 'invalid_type').length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Session Title Bar */}
      <div className="bg-white dark:bg-[#16161a] border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <UploadCloud size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                Upload Session
              </span>
              <span className="text-xs text-slate-400">ID: {sessionName.split('#')[1] || 'Ingest-01'}</span>
            </div>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="text-xl font-bold bg-transparent text-slate-900 dark:text-white border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none transition-all mt-0.5"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 text-sm"
          >
            <FolderPlus size={18} />
            Upload Files
          </button>
          {queue.length > 0 && (
            <button
              onClick={startProcessingSession}
              disabled={isProcessingSession || readyCount === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md ${
                isProcessingSession || readyCount === 0
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 hover:scale-105 active:scale-95'
              }`}
            >
              {isProcessingSession ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Ingesting Session...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Process Session ({readyCount})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Warning Alert Banner (If triggered) */}
      {activeWarning && (
        <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-5 text-red-900 dark:text-red-200 backdrop-blur-xl animate-in slide-in-from-top-3 duration-300 relative shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-base text-red-700 dark:text-red-300">
                  File Size Limit Exceeded Warning
                </h4>
                <button
                  onClick={() => setActiveWarning(null)}
                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                >
                  Dismiss Warning
                </button>
              </div>
              <p className="text-sm mt-1 text-red-800 dark:text-red-200 leading-relaxed">
                File <strong className="font-mono">{activeWarning.fileName}</strong> is{' '}
                <span className="font-bold text-red-600 dark:text-red-400">{activeWarning.actualSizeMB} MB</span>,
                which exceeds the maximum limit of{' '}
                <span className="font-bold">{activeWarning.maxLimitMB} MB</span> allowed for{' '}
                <span className="underline">{activeWarning.categoryName}</span>.
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <span className="bg-red-500/20 text-red-700 dark:text-red-300 px-3 py-1 rounded-lg font-medium">
                  Max Limit: {activeWarning.maxLimitMB} MB
                </span>
                <span className="text-red-600/80 dark:text-red-300/80">
                  Suggestion: Compress your file or extract smaller sub-sections before uploading.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supported File Types Grid with Max Limits */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={20} className="text-indigo-500" />
              Supported File Types & Maximum Limits
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Check allowed formats and maximum size restrictions before initiating session upload
            </p>
          </div>
          {selectedCategoryFilter && (
            <button
              onClick={() => setSelectedCategoryFilter(null)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Reset Category Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUPPORTED_CATEGORIES.map(cat => {
            const IconComp = cat.icon;
            const isSelected = selectedCategoryFilter === cat.id;

            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategoryFilter(isSelected ? null : cat.id)}
                className={`bg-white dark:bg-[#1a1a1e] border rounded-2xl p-5 transition-all cursor-pointer relative overflow-hidden group shadow-sm hover:shadow-md ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800/60 ' + cat.color.border
                }`}
              >
                {/* Background Gradient Tint */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${cat.color.bg} opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none`}
                ></div>

                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${cat.color.icon}`}>
                      <IconComp size={22} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-1.5">
                        <span>{cat.emoji}</span>
                        <span>{cat.name}</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cat.description}</p>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                  {/* Extension Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {cat.extensions.map(ext => (
                      <span
                        key={ext}
                        className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/50"
                      >
                        .{ext.toLowerCase()}
                      </span>
                    ))}
                  </div>

                  {/* Prominent Max Size Badge */}
                  <div
                    className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${cat.color.badge} flex items-center gap-1 shadow-sm`}
                  >
                    <span>Max</span>
                    <span className="text-sm">{cat.maxSizeMB} MB</span>
                  </div>
                </div>

                {/* Quick Simulation Button for Testing Warning */}
                <div className="relative z-10 mt-3 pt-2 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      simulateOversizedUpload(cat.id);
                    }}
                    className="text-[10px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:underline flex items-center gap-1"
                    title={`Test uploading an oversized ${cat.name} file (> ${cat.maxSizeMB} MB)`}
                  >
                    <AlertTriangle size={10} />
                    Test Exceed Limit Warning
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01] shadow-2xl shadow-indigo-500/20'
            : 'border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-[#16161a]/80 hover:border-indigo-400/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 shadow-sm'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          className="hidden"
          accept=".pdf,.docx,.txt,.xlsx,.csv,.jpg,.png,.webp,.mp4,.mov,.webm,.mp3,.wav,.m4a,.zip"
        />

        <div className="max-w-xl mx-auto flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 animate-bounce-slow shadow-lg shadow-indigo-500/10">
            <UploadCloud size={32} />
          </div>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Drag & drop research files here
          </h3>

          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">
            Support for Documents, Spreadsheets, Images, Videos, Audio, and Archives. Maximum size limits apply per category up to 200 MB.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-2xl shadow-xl shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95"
            >
              <FolderPlus size={20} />
              Upload Files
            </button>
          </div>
        </div>
      </div>

      {/* Upload Session Queue & Status */}
      {queue.length > 0 && (
        <div className="bg-white dark:bg-[#16161a] border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/60">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HardDrive size={20} className="text-indigo-500" />
                Session File Queue ({queue.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Total Queue Size: <strong className="text-slate-700 dark:text-slate-300">{formatFileSize(totalSizeBytes)}</strong>
                {warningCount > 0 && (
                  <span className="ml-2 text-red-500 font-semibold">• {warningCount} file(s) exceed limit</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearCompletedOrWarnings}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-all"
              >
                Clear Warnings / Done
              </button>
              <button
                onClick={() => setQueue([])}
                className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/30 transition-all"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {queue.map(item => {
              const isWarning = item.status === 'warning_exceeded' || item.status === 'invalid_type';
              const isComplete = item.status === 'complete';
              const catColor = item.category?.color || {
                badge: 'bg-slate-500/10 text-slate-600',
                icon: 'bg-slate-500/10 text-slate-600'
              };

              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                    isWarning
                      ? 'bg-red-500/5 border-red-500/30 dark:bg-red-950/20'
                      : isComplete
                      ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                      : 'bg-white dark:bg-[#1a1a1e] border-slate-200 dark:border-slate-800 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 ${catColor.icon}`}
                    >
                      {item.extension.substring(0, 4)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                          {item.name}
                        </h4>
                        {item.category && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catColor.badge}`}
                          >
                            {item.category.name} ({item.category.maxSizeMB} MB Limit)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{formatFileSize(item.sizeBytes)}</span>
                        <span>•</span>
                        <span>Uploaded at {item.uploadedAt}</span>
                      </div>

                      {/* Error Message display if warning */}
                      {isWarning && item.errorMessage && (
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          {item.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Indicator & Action */}
                  <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                    <div>
                      {isWarning ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-3 py-1 rounded-xl border border-red-500/20">
                          <XCircle size={14} />
                          Limit Exceeded
                        </span>
                      ) : isComplete ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                          <CheckCircle2 size={14} />
                          Ready / Ingested
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-xl border border-indigo-500/20">
                          <Sparkles size={14} />
                          Queued for Session
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => removeQueueItem(item.id)}
                      className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                      title="Remove file from queue"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadSession;
