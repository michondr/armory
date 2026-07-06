import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export interface Option {
  label: string;
  value: string;
}

/** Lightweight dropdown: a pressable field that opens a modal list of options. */
export function Select({
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.value, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[styles.optionText, item.value === value && styles.optionSelected]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No options</Text>}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: theme.inputBg,
    borderColor: theme.inputBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: { color: theme.text, fontSize: 15 },
  placeholder: { color: theme.textFaint },
  chevron: { color: theme.textMuted, fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', padding: 32 },
  sheet: {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  option: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
  optionText: { color: theme.text, fontSize: 16 },
  optionSelected: { color: theme.accent, fontWeight: '700' },
  empty: { color: theme.textMuted, padding: 16, textAlign: 'center' },
});
