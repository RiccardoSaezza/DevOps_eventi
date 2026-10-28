import { Disc3 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="Accordo — home">
      <span className="brand__mark" aria-hidden="true">
        <Disc3 size={22} strokeWidth={1.8} />
      </span>
      {!compact && (
        <span className="brand__text">
          accordo<span className="brand__dot">.</span>
        </span>
      )}
    </Link>
  );
}
