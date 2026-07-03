// @vitest-environment jsdom
/**
 * AvatarCropModal wiring test (crop-first avatar upload).
 *
 * react-easy-crop is canvas/layout heavy, so it is mocked with a minimal stand-in
 * that exposes a button to fire onCropComplete with a fixed pixel area — the
 * REAL modal logic around it (object URL, confirm → canvas draw capped at
 * 512×512 → toBlob('image/jpeg', 0.85) → onConfirm(blob)) runs for real, with
 * jsdom's canvas + Image seams stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEventImport from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

const userEvent = ((userEventImport as unknown as { default?: typeof userEventImport })
  .default ?? userEventImport);

// ---- minimal react-easy-crop mock: a trigger for onCropComplete ------------
interface CropperProps {
  image: string;
  aspect: number;
  cropShape?: string;
  onCropComplete: (area: unknown, areaPixels: { x: number; y: number; width: number; height: number }) => void;
}
let lastCropperProps: CropperProps | null = null;
vi.mock('react-easy-crop', () => ({
  default: (props: CropperProps) => {
    lastCropperProps = props;
    return (
      <button
        type="button"
        data-testid="mock-crop-complete"
        onClick={() => props.onCropComplete({}, { x: 10, y: 20, width: 1024, height: 1024 })}
      >
        crop
      </button>
    );
  },
}));

import AvatarCropModal from './AvatarCropModal';

// ---- jsdom seams: object URLs, Image loading, canvas ------------------------
const drawImage = vi.fn();
let lastCanvas: HTMLCanvasElement | null = null;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  lastCropperProps = null;
  drawImage.mockClear();
  lastCanvas = null;

  URL.createObjectURL = vi.fn(() => 'blob:mock-avatar');
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);

  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
    lastCanvas = this;
    return { drawImage } as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    expect(type).toBe('image/jpeg');
    expect(quality).toBe(0.85);
    cb(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function pickedFile() {
  return new File(['x'], 'me.png', { type: 'image/png' });
}

describe('AvatarCropModal', () => {
  it('renders the cropper at 1:1 with a round crop and a zoom slider', async () => {
    render(<AvatarCropModal file={pickedFile()} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByTestId('mock-crop-complete');
    expect(lastCropperProps?.aspect).toBe(1);
    expect(lastCropperProps?.cropShape).toBe('round');
    expect(lastCropperProps?.image).toBe('blob:mock-avatar');
    expect(screen.getByLabelText(/zoom/i)).toBeInTheDocument();
  });

  it('Confirm is disabled until a crop exists, then draws to a ≤512 canvas and returns the JPEG blob', async () => {
    const onConfirm = vi.fn();
    render(<AvatarCropModal file={pickedFile()} onConfirm={onConfirm} onCancel={vi.fn()} />);

    const confirmBtn = await screen.findByRole('button', { name: /use photo/i });
    expect(confirmBtn).toBeDisabled(); // no croppedAreaPixels yet

    await userEvent.click(screen.getByTestId('mock-crop-complete'));
    expect(confirmBtn).toBeEnabled();

    await userEvent.click(confirmBtn);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));

    // The 1024px source crop is auto-resized: destination canvas capped at 512.
    expect(lastCanvas?.width).toBe(512);
    expect(lastCanvas?.height).toBe(512);
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      10, 20, 1024, 1024, // source square from onCropComplete
      0, 0, 512, 512, // capped destination
    );
    const blob = onConfirm.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/jpeg');
  });

  it('Cancel calls onCancel without uploading', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<AvatarCropModal file={pickedFile()} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(await screen.findByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
