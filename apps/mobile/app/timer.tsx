import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { theme } from '../src/theme';
import { Button, Card, Field, Row, Screen, Subtle, TextField, Title } from '../src/ui/components';

// IPSC shot-timer scaffolding: random delay → GO cue → running clock with manual
// split taps and an optional par time. Automatic shot detection from the mic is a
// Phase 5 item; for now splits are tapped by hand.

type Phase = 'idle' | 'waiting' | 'running';

export default function Timer() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [splits, setSplits] = useState<number[]>([]);
  const [parTime, setParTime] = useState('');
  const startRef = useRef(0);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (rafRef.current) clearInterval(rafRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);
  }, []);

  const start = () => {
    setSplits([]);
    setElapsed(0);
    setPhase('waiting');
    // Random 1.5–4 s delay before the buzzer, like a real timer.
    const delay = 1500 + Math.random() * 2500;
    delayRef.current = setTimeout(() => {
      go();
    }, delay);
  };

  const go = () => {
    Vibration.vibrate(300); // stand-in for the start beep (audio beep lands in Phase 5)
    startRef.current = Date.now();
    setPhase('running');
    rafRef.current = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000;
      setElapsed(t);
      const par = Number(parTime);
      if (par && t >= par && t - 0.05 < par) Vibration.vibrate(150);
    }, 33);
  };

  const split = () => {
    if (phase !== 'running') return;
    setSplits((prev) => [...prev, (Date.now() - startRef.current) / 1000]);
  };

  const stop = () => {
    if (rafRef.current) clearInterval(rafRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);
    setPhase('idle');
  };

  const splitDeltas = splits.map((s, i) => (i === 0 ? s : s - splits[i - 1]!));

  return (
    <Screen>
      <Title>Shot timer</Title>
      <Subtle>Random start delay, then tap anywhere to record splits. Par time buzzes when reached.</Subtle>

      <Pressable onPress={phase === 'running' ? split : undefined}>
        <Card style={styles.clockCard}>
          <Text style={styles.clock}>
            {phase === 'waiting' ? 'Wait…' : `${elapsed.toFixed(2)}s`}
          </Text>
          <Subtle>
            {phase === 'running'
              ? 'Tap to split'
              : phase === 'waiting'
                ? 'Get ready'
                : 'Ready'}
          </Subtle>
        </Card>
      </Pressable>

      <Field label="Par time (s, optional)">
        <TextField value={parTime} onChangeText={setParTime} keyboardType="decimal-pad" />
      </Field>

      <Row>
        {phase === 'idle' ? (
          <View style={{ flex: 1 }}>
            <Button title="Start" onPress={start} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Button title="Stop" variant="danger" onPress={stop} />
          </View>
        )}
      </Row>

      {splits.length > 0 && (
        <Card>
          <Text style={{ color: theme.text, fontWeight: '600' }}>Splits</Text>
          {splits.map((s, i) => (
            <Row key={i} style={{ justifyContent: 'space-between' }}>
              <Subtle>Shot {i + 1}</Subtle>
              <Text style={{ color: theme.text }}>
                {s.toFixed(2)}s <Text style={{ color: theme.textFaint }}>(+{splitDeltas[i]!.toFixed(2)})</Text>
              </Text>
            </Row>
          ))}
        </Card>
      )}

      <Subtle>
        Automatic shot detection from the microphone is coming in a later phase — for now, tap the
        clock for each shot.
      </Subtle>
    </Screen>
  );
}

const styles = StyleSheet.create({
  clockCard: { alignItems: 'center', paddingVertical: 40 },
  clock: { color: theme.accent, fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
