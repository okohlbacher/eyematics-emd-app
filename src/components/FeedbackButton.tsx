import { toPng } from 'html-to-image';
import { CheckCircle,MessageSquarePlus, Send, X } from 'lucide-react';
import { useCallback,useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import { addIssue } from '../services/issueService';

/** Map route path to translation key for page name */
const PAGE_KEY_MAP: Record<string, TranslationKey> = {
  '/': 'navHome',
  '/cohort': 'navCohort',
  '/analysis': 'navAnalysis',
  '/quality': 'navQuality',
  '/doc-quality': 'navDocQuality',
  '/audit': 'navAudit',
  '/admin': 'navAdmin',
  '/settings': 'navSettings',
};

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const closeModal = useCallback(() => {
    setOpen(false);
    setSubmitted(false);
  }, []);

  // S-09: Escape to close modal + focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
    // Focus trap: keep Tab within modal
    if (e.key === 'Tab' && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, textarea, input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [closeModal]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  /** Resolve page label using translation keys */
  const pageLabel = (pathname: string): string => {
    if (pathname.startsWith('/case/')) return `${t('fullCaseView')} (${pathname.slice(6)})`;
    const key = PAGE_KEY_MAP[pathname];
    return key ? t(key) : pathname;
  };

  const handleOpen = async () => {
    // Capture screenshot BEFORE showing the modal overlay,
    // otherwise the dark overlay (bg-black/40) covers the page content
    let capturedScreenshot: string | null = null;
    setCapturing(true);
    try {
      const mainEl = document.querySelector('main');
      if (mainEl) {
        capturedScreenshot = await toPng(mainEl as HTMLElement, {
          quality: 0.8,
          pixelRatio: 1,
        });
      }
    } catch (err) {
      console.error('[FeedbackButton] Screenshot capture failed:', err);
    }

    setOpen(true);
    setSubmitted(false);
    setDescription('');
    setScreenshot(capturedScreenshot);
    setCapturing(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    try {
      await addIssue({
        user: user?.username ?? 'unknown',
        page: pageLabel(location.pathname),
        description: description.trim(),
        screenshot: screenshot ?? undefined,
        appVersion: __APP_VERSION__,
      });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error('[FeedbackButton] Failed to save issue:', err);
    }
  };

  const handleClose = closeModal;

  return (
    <>
      {/* Floating button on the right edge */}
      <button
        onClick={handleOpen}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-amber-500 hover:bg-amber-600 text-white px-2 py-3 rounded-l-lg shadow-lg transition-colors flex flex-col items-center gap-1 group"
        title={t('feedbackButton')}
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="text-[10px] font-medium writing-mode-vertical" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
          {t('feedbackButton')}
        </span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          role="dialog"
          aria-modal="true"
          aria-label={t('feedbackTitle')}
        >
          <div ref={modalRef} className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-amber-500" />
                {t('feedbackTitle')}
              </h2>
              <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitted ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-sm text-green-700 font-medium">{t('feedbackSuccess')}</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Page info + build version */}
                <div className="text-sm text-gray-500 flex gap-4 flex-wrap">
                  <span>
                    <span className="font-medium">{t('feedbackPage')}:</span>{' '}
                    <span className="font-mono text-gray-700">{pageLabel(location.pathname)}</span>
                  </span>
                  <span>
                    <span className="font-medium">{t('feedbackVersion')}:</span>{' '}
                    <span className="font-mono text-gray-700">v{__APP_VERSION__}</span>
                  </span>
                </div>

                {/* Screenshot preview */}
                {capturing && (
                  <p className="text-xs text-gray-400 animate-pulse">Capturing screenshot...</p>
                )}
                {screenshot && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={screenshot}
                      alt="Screenshot"
                      className="w-full h-32 object-cover object-top"
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('feedbackDescription')}
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('feedbackPlaceholder')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                    rows={4}
                    autoFocus
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={!description.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {t('feedbackSubmit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
