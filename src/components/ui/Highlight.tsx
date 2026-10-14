import React from 'react';
import { splitHighlight } from '../../utils/search';

/** Resalta en amarillo las palabras buscadas dentro de un texto. */
export const Highlight: React.FC<{ text: string | number | null | undefined; query?: string }> = ({ text, query }) => {
  const str = text === null || text === undefined ? '' : String(text);
  if (!query || !query.trim()) return <>{str}</>;
  const parts = splitHighlight(str, query);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="hl">
            {p.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        )
      )}
    </>
  );
};
