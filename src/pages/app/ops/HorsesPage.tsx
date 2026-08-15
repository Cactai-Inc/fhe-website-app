import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Helmet } from 'react-helmet-async';
import { Modal } from '../../../lib/ops';
import {
  listHorses,
  createHorse,
  updateHorse,
  listHorseBreeds,
  listHorseColors,
  listContacts,
} from '../../../lib/api';
import type { Horse, HorseInput, LookupCode, Contact } from '../../../lib/ops/types';
import { HorseTable } from '../../../components/ops/horses/HorseTable';
import { HorseForm } from '../../../components/ops/horses/HorseForm';
import { usePropertyTerm } from '../../../contexts/BrandProvider';

/**
 * OPS-HORSES — Horses roster + create/edit.
 *
 * Loads the roster (listHorses) plus the global breed/color lookups
 * (listHorseBreeds/listHorseColors) and contacts (owners). "New horse" opens a
 * Modal HorseForm whose submit calls createHorse; a row click opens the same
 * form in edit mode calling updateHorse. On success the roster is updated in
 * place (new row rendered) and the modal closes; a load failure renders an
 * inline error branch.
 */
type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; horse: Horse };

export default function HorsesPage() {
  const propertyTerm = usePropertyTerm();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [breeds, setBreeds] = useState<LookupCode[]>([]);
  const [colors, setColors] = useState<LookupCode[]>([]);
  const [owners, setOwners] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [h, b, c, o] = await Promise.all([
        listHorses(),
        listHorseBreeds(),
        listHorseColors(),
        listContacts(),
      ]);
      setHorses(h);
      setBreeds(b);
      setColors(c);
      setOwners(o);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load horses.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (input: HorseInput) => {
    const created = await createHorse(input);
    setHorses((prev) => [created, ...prev]);
    setModal({ mode: 'closed' });
  };

  const handleUpdate = (id: string) => async (input: HorseInput) => {
    const updated = await updateHorse(id, input);
    setHorses((prev) => prev.map((h) => (h.id === id ? updated : h)));
    setModal({ mode: 'closed' });
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Horses · Ops</title>
      </Helmet>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Horses</h1>
          <p className="text-sm text-green-800/70">Roster of horses {propertyTerm.preposition} your {propertyTerm.term}.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          New horse
        </button>
      </header>

      {loadError ? (
        <div role="alert" className="form-error">
          {loadError}
        </div>
      ) : (
        <HorseTable
          horses={horses}
          breeds={breeds}
          colors={colors}
          owners={owners}
          loading={loading}
          onRowClick={(horse) => setModal({ mode: 'edit', horse })}
        />
      )}

      <Modal
        open={modal.mode !== 'closed'}
        onClose={() => setModal({ mode: 'closed' })}
        title={modal.mode === 'edit' ? 'Edit horse' : 'New horse'}
        disableBackdropClose
      >
        {modal.mode !== 'closed' && (
          <HorseForm
            breeds={breeds}
            colors={colors}
            owners={owners}
            horse={modal.mode === 'edit' ? modal.horse : null}
            onSubmit={modal.mode === 'edit' ? handleUpdate(modal.horse.id) : handleCreate}
            onCancel={() => setModal({ mode: 'closed' })}
          />
        )}
      </Modal>
    </div>
  );
}

/** RETIRED behind a boolean, never deleted (standing rule from 86a2c33). This
 *  is a THIRD independent horse-roster implementation (its own
 *  listHorses/createHorse/updateHorse, own HorseTable/HorseForm) — never
 *  linked from any nav, superseded by HorseRecordsPage since TASK-RECORDS
 *  (2026-08-12) folded Horses into the Records tab strip. Found and retired
 *  2026-08-15 while closing out the standalone-Horses-page request — exactly
 *  the "3 horse rosters" duplication CLAUDE.md names as this project's
 *  defining failure. /app/ops/horses now redirects to /app/records/horses. */
export const HORSES_PAGE_RETIRED = true;
