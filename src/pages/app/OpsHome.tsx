import { useAuth } from '../../contexts/AuthContext';
import OpsDashboard from './ops/OpsDashboard';
import InstructorHome from './InstructorHome';

/**
 * OPS HOME — role-adaptive management landing at /app/ops.
 *  - Admins (isAdmin) get the full tenant OpsDashboard (KPIs + module launcher).
 *  - Trainers (isStaff && !isAdmin) get the servicing-scoped InstructorHome.
 * Both are operators; this only chooses the appropriate home surface.
 */
export default function OpsHome() {
  const { isAdmin } = useAuth();
  return isAdmin ? <OpsDashboard /> : <InstructorHome />;
}
