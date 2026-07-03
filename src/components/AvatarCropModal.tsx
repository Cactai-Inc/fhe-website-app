/**
 * Crop-first avatar modal. Given a picked image File, shows it in
 * react-easy-crop (1:1 aspect, circular preview, zoom slider). Confirm draws
 * the selected square onto a canvas capped at 512×512 and emits a JPEG Blob
 * (quality 0.85) via onConfirm — the caller uploads that resized blob, never
 * the original file.
 */
import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

/** Output cap: the avatar is displayed small; 512px² @ q0.85 keeps files tiny. */
const MAX_OUTPUT_PX = 512;
const JPEG_QUALITY = 0.85;

export interface AvatarCropModalProps {
  /** The image file picked by the user (already size-validated by the caller). */
  file: File;
  /** Receives the cropped, resized JPEG blob. */
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

/** Draw the cropped square (source pixels) to a ≤512×512 canvas → JPEG blob. */
export async function cropImageToBlob(imageSrc: string, cropPx: Area): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const outSize = Math.min(MAX_OUTPUT_PX, Math.max(1, Math.round(cropPx.width)));
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image in this browser.');
  ctx.drawImage(
    img,
    cropPx.x, cropPx.y, cropPx.width, cropPx.height, // source square
    0, 0, outSize, outSize, // destination (auto-resize)
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not crop the image.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

export default function AvatarCropModal({ file, onConfirm, onCancel }: AvatarCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Object URL lives for the modal's lifetime; revoked on unmount/file change.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function confirm() {
    if (!imageSrc || !croppedAreaPixels) return;
    setWorking(true);
    setError(null);
    try {
      const blob = await cropImageToBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop the image.');
      setWorking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-green-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crop your profile photo"
    >
      <div className="bg-white w-full max-w-md p-6">
        <h2 className="font-serif text-green-800 text-lg mb-3">Crop your photo</h2>

        <div className="relative w-full h-72 bg-green-950/5" data-testid="avatar-crop-area">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <label className="form-label mt-4" htmlFor="avatar_zoom">Zoom</label>
        <input
          id="avatar_zoom"
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />

        {error && <p role="alert" className="form-error mt-2">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={confirm}
            disabled={working || !croppedAreaPixels}
            className="btn-primary flex-1 justify-center"
          >
            {working ? 'Preparing…' : 'Use photo'}
          </button>
          <button type="button" onClick={onCancel} disabled={working} className="btn-outline-gold flex-1 justify-center">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
