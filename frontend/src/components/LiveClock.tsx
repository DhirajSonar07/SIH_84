import { useEffect, useState } from 'react';

function formatClock(value: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value).toUpperCase();
}

export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const clock = formatClock(now);
  return (
    <div className="header-clock" aria-label={`Current system time, ${clock} India Standard Time`}>
      <span className="label">SYSTEM TIME · LIVE</span>
      <strong>{clock}<small> IST</small></strong>
      <small>{formatDate(now)} · UTC+05:30</small>
    </div>
  );
}
