import { useParams } from 'react-router-dom';
import { HorseRecord } from '../../components/app/HorseRecord';
import { BackControl } from '../../components/app/BackControl';

/**
 * HORSE PAGE (/app/horses/:horseId) — the route wrapper for the horse record.
 *
 * The record itself is <HorseRecord>, one horseId-driven component shared by this
 * page, the contract drawer and the contract modal (Part 2 item 1). This wrapper
 * only supplies the route id and the page chrome; HorseRecord sets the title.
 */
export default function HorsePage() {
  const { horseId } = useParams<{ horseId: string }>();
  return (
    <div className="max-w-4xl">
      <BackControl to="/app/account" label="My stable" className="mb-4" />
      {horseId && <HorseRecord horseId={horseId} />}
    </div>
  );
}
