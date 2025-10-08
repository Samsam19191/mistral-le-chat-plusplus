'use client';

import { useEffect, useState } from 'react';

interface ClientTimestampProps {
  date: Date;
  className?: string;
}

export function ClientTimestamp({ date, className }: ClientTimestampProps) {
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    setTimestamp(date.toLocaleTimeString());
  }, [date]);

  return (
    <span className={className}>
      {timestamp}
    </span>
  );
}