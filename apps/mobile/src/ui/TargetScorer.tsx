import { useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { authHeaders, imageUrl } from '../lib/api';
import { isLocalUri } from '../sync/images';
import { theme } from '../theme';
import { Button } from './components';

export interface PlacedShot {
  x: number;
  y: number;
  ringValue: number | null;
  zone: string | null;
}

const IPSC_ZONES = ['A', 'C', 'D', 'M'];

/**
 * Tap-to-place scoring over the target photo (mirrors the web app). Pick a value,
 * tap the photo to drop a hit at normalized (0..1) coordinates; tap a hit to remove
 * it. Positions persist so the shot pattern shows on every device after sync.
 */
export function TargetScorer({
  imagePath,
  scoringSystem,
  maxScorePerShot,
  initialShots,
  onSave,
}: {
  imagePath: string;
  scoringSystem: 'RINGS' | 'IPSC' | 'GROUP';
  maxScorePerShot: number | null;
  initialShots: PlacedShot[];
  onSave: (shots: PlacedShot[]) => void;
}) {
  const [shots, setShots] = useState<PlacedShot[]>(initialShots);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const isIpsc = scoringSystem === 'IPSC';
  const [ringValue, setRingValue] = useState<number>(maxScorePerShot ?? 10);
  const [zone, setZone] = useState<string>('A');

  const source = isLocalUri(imagePath)
    ? { uri: imagePath }
    : { uri: imageUrl(imagePath), headers: authHeaders() };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const place = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    const x = clamp01(e.nativeEvent.locationX / size.w);
    const y = clamp01(e.nativeEvent.locationY / size.h);
    setShots((prev) => [
      ...prev,
      isIpsc ? { x, y, ringValue: null, zone } : { x, y, ringValue, zone: null },
    ]);
  };

  const removeAt = (idx: number) => setShots((prev) => prev.filter((_, i) => i !== idx));

  const ringOptions = range(0, maxScorePerShot ?? 10).reverse();

  return (
    <View style={{ gap: 12 }}>
      <Pressable onPress={place}>
        <View onLayout={onLayout}>
          <Image source={source} style={styles.image} resizeMode="contain" />
          {shots.map((s, i) => (
            <Pressable
              key={i}
              onPress={() => removeAt(i)}
              style={[styles.marker, { left: s.x * size.w - 12, top: s.y * size.h - 12 }]}
            >
              <Text style={styles.markerText}>{s.zone ?? s.ringValue}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>

      <Text style={{ color: theme.textMuted, fontSize: 12 }}>
        Tap the photo to place a hit ({isIpsc ? `zone ${zone}` : `ring ${ringValue}`}); tap a hit to remove it.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {isIpsc
          ? IPSC_ZONES.map((z) => (
              <Chip key={z} label={z} active={z === zone} onPress={() => setZone(z)} />
            ))
          : ringOptions.map((v) => (
              <Chip key={v} label={String(v)} active={v === ringValue} onPress={() => setRingValue(v)} />
            ))}
      </ScrollView>

      <Text style={{ color: theme.text, fontWeight: '600' }}>
        {shots.length} hit{shots.length === 1 ? '' : 's'}
      </Text>
      <Button title="Save scoring" onPress={() => onSave(shots)} />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: theme.accent, borderColor: theme.accent }]}
    >
      <Text style={[styles.chipText, active && { color: theme.accentText }]}>{label}</Text>
    </Pressable>
  );
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const range = (lo: number, hi: number): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: theme.inputBg },
  marker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.accent,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chip: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
  },
  chipText: { color: theme.text, fontSize: 15, fontWeight: '600' },
});
