import type { Me } from '../../lib/types';

interface BadgeDef {
  id: string;

  name: string;
  goalText: string;
  c1: string;
  c2: string;
  icon: string;
  value: (m: Me) => number;
  goal: number;
}

// Icônes (grille 24) dessinées en blanc au centre de la médaille
const ICON = {
  sunrise: 'M3.5 17h17M7 17a5 5 0 0 1 10 0M12 6v3M5.8 9.8l2 2M18.2 9.8l-2 2M6 20.5h12',
  shield: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zM8.4 12.2s1.5-2.6 3.6-2.6 3.6 2.6 3.6 2.6-1.5 2.6-3.6 2.6-3.6-2.6-3.6-2.6z',
  gauge: 'M4 17a8 8 0 1 1 16 0M12 17l4.2-5.2M6.5 17h.01M17.5 17h.01M12 9v.01',
  check: 'M12 3.5l2.2 1.6 2.7-.1.8 2.6 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-.8 2.6-2.7-.1L12 20.5l-2.2-1.6-2.7.1-.8-2.6-2.2-1.6.9-2.6-.9-2.6 2.2-1.6.8-2.6 2.7.1zM8.8 12.3l2.2 2.2 4.3-4.4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3.2 4M16 6h3a3 3 0 0 1-3.2 4M12 13v3.5M9 20h6M10 16.5h4',
};

export const BADGES: BadgeDef[] = [
  { id: 'eclaireur', name: 'Éclaireur du matin', goalText: '3 signalements avant 8 h', c1: '#FFB547', c2: '#E8590C', icon: ICON.sunrise, value: (m) => m.morning_reports ?? 0, goal: 3 },
  { id: 'sentinelle', name: 'Sentinelle de contact', goalText: '10 signalements confirmés', c1: '#34C27A', c2: '#0E6B36', icon: ICON.shield, value: (m) => m.confirmed_count, goal: 10 },
  { id: 'expert', name: 'Expert du trafic', goalText: '100 points', c1: '#4F9BFF', c2: '#1747A6', icon: ICON.gauge, value: (m) => m.points, goal: 100 },
  { id: 'validateur', name: "Validateur d'or", goalText: '20 confirmations utiles', c1: '#FFE07A', c2: '#C08A00', icon: ICON.check, value: (m) => m.useful_votes ?? 0, goal: 20 },
  { id: 'champion', name: 'Champion', goalText: 'Top 3 du classement', c1: '#FF6B6B', c2: '#A3122A', icon: ICON.trophy, value: (m) => (m.points > 0 && m.rank <= 3 ? 1 : 0), goal: 1 },
];

export function Medal({ b, locked }: { b: BadgeDef; locked: boolean }) {
  const gid = `medal-${b.id}`;
  return (
    <svg viewBox="0 0 100 100" className={`medal ${locked ? 'is-locked' : ''}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={b.c1} />
          <stop offset="1" stopColor={b.c2} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill={`url(#${gid})`} />
      <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
      <circle cx="50" cy="50" r="37" fill="rgba(0,0,0,.14)" />
      <circle cx="50" cy="50" r="40.5" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.6" strokeDasharray="1.5 3.5" />
      <path d="M18 34 A36 36 0 0 1 52 14" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="4" strokeLinecap="round" />
      <g transform="translate(22 22) scale(2.33)">
        <path d={b.icon} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function BadgeStrip({ me }: { me: Me | null }) {
  return (
    <div className="badge-strip" role="list">
      {BADGES.map((b) => {
        const v = me ? b.value(me) : 0;
        const earned = v >= b.goal;
        return (
          <div key={b.id} className={`badge-card ${earned ? 'is-earned' : ''}`} role="listitem"
            aria-label={`${b.name} : ${earned ? 'obtenu' : `${Math.min(v, b.goal)} sur ${b.goal}`}`}>
            <Medal b={b} locked={!earned} />
            <strong>{b.name}</strong>
            {earned
              ? <small className="badge-card__ok">Obtenu</small>
              : (
                <>
                  <span className="badge-card__bar"><i style={{ width: `${Math.min(100, (v / b.goal) * 100)}%` }} /></span>
                  <small>{b.goalText}</small>
                </>
              )}
          </div>
        );
      })}
    </div>
  );
}
