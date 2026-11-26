import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Overview' },
  { to: '/place', label: 'Place a facility' },
  { to: '/optimise', label: 'Find best sites' },
  { to: '/index', label: 'Vulnerability index' },
];

export default function Header({ narrow }: { narrow?: boolean }) {
  return (
    <header className="site-header">
      <nav aria-label="Main" className={`site-nav${narrow ? ' narrow' : ''}`}>
        <NavLink to="/" className="brand" end>
          Ipoh Ageing Atlas
        </NavLink>
        <div className="nav-links">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
