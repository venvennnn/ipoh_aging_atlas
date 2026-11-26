import { useEffect, useState } from 'react';
import { loadAtlas, loadStats } from './data';
import type { AtlasData, Stats } from './types';

export interface Loaded<T> {
  data: T | null;
  error: string | null;
}

function useLoader<T>(fn: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: null });
  useEffect(() => {
    let live = true;
    fn().then(
      (data) => live && setState({ data, error: null }),
      (e: unknown) => live && setState({ data: null, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, [fn]);
  return state;
}

export const useAtlas = () => useLoader<AtlasData>(loadAtlas);
export const useStats = () => useLoader<Stats>(loadStats);
