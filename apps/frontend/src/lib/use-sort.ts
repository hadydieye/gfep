'use client';

import { useCallback, useEffect, useState } from 'react';

export type SortOrder = 'asc' | 'desc';

export interface SortState {
  sort: string | null;
  order: SortOrder;
}

/** Ajoute `sort` et `order` aux paramètres d'une requête de liste (N6). */
export function applySort(params: URLSearchParams, state: SortState): void {
  if (!state.sort) return;
  params.set('sort', state.sort);
  params.set('order', state.order);
}

/**
 * Tri d'un tableau paginé côté serveur (N6) : état conservé dans l'URL
 * (`?sort=&order=`), lu après le montage. `ready` passe à vrai une fois l'URL
 * lue : la liste attend ce signal avant son premier chargement, pour ne pas
 * lancer deux requêtes concurrentes.
 *
 * Un clic sur la colonne active inverse l'ordre ; sur une autre colonne, tri
 * ascendant. Chaque changement doit ramener la liste en page 1 (`onChange`).
 */
export function useSort(allowed: readonly string[], onChange?: () => void) {
  const [state, setState] = useState<SortState>({ sort: null, order: 'asc' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sort = params.get('sort');
    if (sort && allowed.includes(sort)) {
      setState({ sort, order: params.get('order') === 'desc' ? 'desc' : 'asc' });
    }
    setReady(true);
    // `allowed` est une constante du composant appelant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSort = useCallback(
    (sort: string | null, order: SortOrder = 'asc') => {
      setState({ sort, order });
      const params = new URLSearchParams(window.location.search);
      if (sort) {
        params.set('sort', sort);
        params.set('order', order);
      } else {
        params.delete('sort');
        params.delete('order');
      }
      params.delete('page');
      const query = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
      onChange?.();
    },
    [onChange],
  );

  const toggle = useCallback(
    (key: string) => setSort(key, state.sort === key && state.order === 'asc' ? 'desc' : 'asc'),
    [state, setSort],
  );

  return { ...state, ready, toggle, setSort };
}
