import { useEffect } from 'react';
import { actions, useNowcastStore, useScenarioStore } from '../store';
export default function useNowcast() { return useNowcastStore(state => state.snapshot); }
export function useReplayClock() {
  const playing = useScenarioStore(state => state.playing);
  const speed = useScenarioStore(state => state.speed);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const state = useScenarioStore.getState();
      if (state.minute >= 240) { useScenarioStore.setState({ playing: false }); return; }
      actions.seek(state.minute + speed);
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, speed]);
}
