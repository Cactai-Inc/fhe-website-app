// @vitest-environment jsdom
/**
 * Profile page avatar wiring test (crop-first, upload-only).
 *
 * Renders the REAL Profile page with the auth/api seams mocked and the crop
 * modal mocked to a confirm trigger. Proves:
 *  - the avatar URL text field is GONE — upload is the only path,
 *  - a picked file > 10MB is rejected with a clear message BEFORE the crop
 *    modal ever opens (and nothing uploads),
 *  - happy path: pick file → crop modal → confirm blob → uploadMyAvatar(blob)
 *    → the preview <img> switches to the uploaded public URL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../test/render';

vi.mock('../../contexts/AuthContext', () => {
  // Stable identities: Profile syncs local state in a useEffect keyed on
  // `profile`, so a fresh object per render would clobber in-test updates.
  const auth = {
    profile: {
      display_name: 'Jane',
      first_name: 'Jane',
      last_name: 'Doe',
      phone: null,
      bio: null,
      avatar_url: null,
      riding_level: null,
      email: 'jane@example.com',
    },
    user: { id: 'user-1', email: 'jane@example.com' },
    refreshProfile: vi.fn(),
  };
  return { useAuth: () => auth };
});

vi.mock('../../lib/api', () => ({
  upsertMyProfile: vi.fn(),
  uploadMyAvatar: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({
  listLinkedProviders: vi.fn(async () => ['email']),
  linkOAuthIdentity: vi.fn(),
}));

// Crop modal stand-in: confirms with a fixed JPEG blob (real modal has its own test).
const CONFIRM_BLOB = new Blob(['jpeg'], { type: 'image/jpeg' });
vi.mock('../../components/AvatarCropModal', () => ({
  default: ({ onConfirm }: { onConfirm: (b: Blob) => void }) => (
    <div data-testid="crop-modal">
      <button type="button" onClick={() => onConfirm(CONFIRM_BLOB)}>mock crop confirm</button>
    </div>
  ),
}));

import { uploadMyAvatar } from '../../lib/api';
import Profile from './Profile';

const uploadMock = vi.mocked(uploadMyAvatar);

function fileOfSize(bytes: number, name = 'me.png') {
  const f = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Profile avatar (crop-first upload-only)', () => {
  it('has NO avatar URL text field — upload is the only path', () => {
    renderWithRouter(<Profile />);
    expect(screen.getByLabelText(/profile photo/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/paste an image url/i)).not.toBeInTheDocument();
    expect(document.querySelector('#avatar_url')).toBeNull();
  });

  it('rejects a file over 10MB with a clear message BEFORE the crop modal opens', async () => {
    renderWithRouter(<Profile />);
    const input = screen.getByLabelText(/profile photo/i) as HTMLInputElement;

    await userEvent.upload(input, fileOfSize(10 * 1024 * 1024 + 1));

    expect(await screen.findByRole('alert')).toHaveTextContent(/larger than 10MB/i);
    expect(screen.queryByTestId('crop-modal')).not.toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('happy path: pick → crop → confirm uploads the blob and updates the preview', async () => {
    uploadMock.mockResolvedValue('https://cdn.test/profile-images/user-1/avatar-1.jpg');
    renderWithRouter(<Profile />);
    const input = screen.getByLabelText(/profile photo/i) as HTMLInputElement;

    await userEvent.upload(input, fileOfSize(1024));
    // Crop modal opens (no upload yet — crop-first).
    expect(await screen.findByTestId('crop-modal')).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /mock crop confirm/i }));

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
    expect(uploadMock.mock.calls[0][0]).toBe(CONFIRM_BLOB); // the cropped blob, not the raw file

    // Modal closes, preview <img> shows the uploaded public URL.
    await waitFor(() => expect(screen.queryByTestId('crop-modal')).not.toBeInTheDocument());
    await waitFor(() => {
      const img = document.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://cdn.test/profile-images/user-1/avatar-1.jpg');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
