import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useState } from 'react';

import { useLanguage } from '../context/LanguageContext';
import { getDateLocale } from '../utils/dateFormat';

interface OctImage {
  title: string;
  date: string;
  path: string;
}

interface OctViewerProps {
  images: OctImage[];
  crt?: { date: string; value: number }[];
  controlledIdx?: number;
  onSelectIdx?: (idx: number) => void;
}

export default function OctViewer({ images, crt, controlledIdx, onSelectIdx }: OctViewerProps) {
  const [internalIdx, setInternalIdx] = useState(0);
  const selectedIdx = controlledIdx ?? internalIdx;
  const setSelectedIdx = onSelectIdx ?? setInternalIdx;
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIdx, setCompareIdx] = useState(0);
  const { locale, t } = useLanguage();

  const dateFmt = getDateLocale(locale);

  if (images.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          {t('octTitle')}
        </h3>
        <p className="text-sm text-gray-400">
          {t('octNoImages')}
        </p>
      </div>
    );
  }

  const current = images[selectedIdx];
  const matchingCrt = crt?.find((c) => c.date === current.date);

  const handlePrev = () =>
    setSelectedIdx(selectedIdx > 0 ? selectedIdx - 1 : images.length - 1);
  const handleNext = () =>
    setSelectedIdx(selectedIdx < images.length - 1 ? selectedIdx + 1 : 0);

  const viewer = (
    img: OctImage,
    zoomLevel: number,
    label?: string
  ) => (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      {label && (
        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/60 text-white text-xs rounded">
          {label}
        </div>
      )}
      <div className="overflow-auto" style={{ maxHeight: fullscreen ? '70vh' : '400px' }}>
        <img
          src={img.path}
          alt={img.title}
          className="w-full transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center' }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '';
            target.alt = t('octImageUnavailable');
            target.className = 'w-full h-48 bg-gray-800 flex items-center justify-center';
          }}
        />
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <p className="text-white text-sm font-medium">{img.title}</p>
        <p className="text-gray-300 text-xs">
          {new Date(img.date).toLocaleDateString(dateFmt)}
          {matchingCrt && ` — CRT: ${matchingCrt.value} µm`}
        </p>
      </div>
    </div>
  );

  const mainContent = (
    <div className={fullscreen ? '' : 'bg-white rounded-xl border border-gray-200 p-5'}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          {t('octTitle')} ({images.length})
        </h3>
        <div className="flex items-center gap-1">
          {images.length > 1 && (
            <button
              onClick={() => {
                setCompareMode(!compareMode);
                setCompareIdx(Math.min(1, images.length - 1));
              }}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                compareMode
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('octCompare')}
            </button>
          )}
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
            title={t('octZoomOut')}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-400 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
            title={t('octZoomIn')}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setFullscreen(!fullscreen);
              setZoom(1);
            }}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
            title={fullscreen ? t('close') : t('octFullscreen')}
          >
            {fullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && !compareMode && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                i === selectedIdx
                  ? 'border-blue-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <img
                src={img.path}
                alt={img.title}
                className="w-20 h-14 object-cover"
              />
              <p className="text-[10px] text-gray-500 px-1 py-0.5 bg-gray-50 truncate w-20">
                {img.date}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Main image area */}
      {compareMode ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            {viewer(images[selectedIdx], zoom, `${selectedIdx + 1}/${images.length}`)}
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="mt-2 w-full text-sm border rounded px-2 py-1"
            >
              {images.map((img, i) => (
                <option key={i} value={i}>
                  {img.date} — {img.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            {viewer(images[compareIdx], zoom, `${compareIdx + 1}/${images.length}`)}
            <select
              value={compareIdx}
              onChange={(e) => setCompareIdx(Number(e.target.value))}
              className="mt-2 w-full text-sm border rounded px-2 py-1"
            >
              {images.map((img, i) => (
                <option key={i} value={i}>
                  {img.date} — {img.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="relative">
          {viewer(current, zoom)}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Data attribution */}
      <p className="text-[10px] text-gray-400 mt-3">
        {t('octAttribution')}
      </p>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6">
          {mainContent}
        </div>
      </div>
    );
  }

  return mainContent;
}
