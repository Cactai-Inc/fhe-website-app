import { useDocumentTitle } from '../../lib/hooks';
import { MyLessonsContent } from '../../components/app/MyLessonsContent';

/**
 * CP-LESSONS — the member's Lessons page (module mod.lessons), the /app/lessons
 * nav target. The content itself is MyLessonsContent, shared with the Account
 * page's inline panel — see that file for the module-gate, session, report and
 * credits-ledger behavior.
 */
export default function MyLessons() {
  useDocumentTitle('My Lessons');
  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">My Lessons</p>
      <h1 className="heading-section text-green-800 mb-8">Your riding, at a glance.</h1>
      <MyLessonsContent />
    </div>
  );
}
