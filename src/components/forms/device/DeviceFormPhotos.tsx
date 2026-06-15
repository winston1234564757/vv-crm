"use client";

import { DeviceFormData } from "@/lib/types/device.types";

interface DeviceFormPhotosProps {
  device: DeviceFormData;
}

export function DeviceFormPhotos({ device }: DeviceFormPhotosProps) {
  const existingPhotos = device?.photo_urls || [];
  const fallbackSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23888888" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Завантажити нові фотографії</label>
        <input 
          type="file" 
          name="photos" 
          multiple 
          accept="image/*" 
          className="w-full text-sm text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-violet file:px-3 file:py-2 file:text-xs file:font-medium file:text-white cursor-pointer hover:file:bg-violet-hover" 
        />
        
        {existingPhotos.length > 0 && (
          <div className="mt-4">
            <span className="text-xs font-medium text-text-secondary">Існуючі фотографії</span>
            <div className="mt-2 flex gap-2 overflow-x-auto py-1">
              {existingPhotos.map((url, index) => (
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
          </div>
        )}
      </div>
    </div>
  );
}

export default DeviceFormPhotos;