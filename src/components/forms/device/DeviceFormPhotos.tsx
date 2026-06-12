"use client";

import { useState, useEffect } from "react";
import { DeviceFormData } from "@/lib/types/device.types";

interface DeviceFormPhotosProps {
  device: DeviceFormData;
  photosText: string;
  setPhotosText: (text: string) => void;
}

export function DeviceFormPhotos({ device, photosText, setPhotosText }: DeviceFormPhotosProps) {
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  
  useEffect(() => {
    const previews = photosText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setPhotoPreviews(previews);
  }, [photosText]);

  const fallbackSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23888888" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Посилання на фотографії (через кому)</label>
        <textarea
          name="photo_urls"
          value={photosText}
          onChange={(e) => setPhotosText(e.target.value)}
          placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg..."
          rows={2}
          className="w-full resize-none rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40"
        />
        {photoPreviews.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto py-1">
            {photoPreviews.map((url, index) => (
              <div key={index} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-warm-border/60 bg-warm-sidebar">
                <img
                  src={url}
                  alt={`Попередній перегляд ${index + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = fallbackSvg;
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DeviceFormPhotos;