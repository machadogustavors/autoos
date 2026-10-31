import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, rounded, spacing, touchHeight, type } from '../theme/tokens';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

// Filtro de lista com 4+ opções: quebra em linhas (a Segmented é para 2–3 e
// deixa de caber no celular). Selecionado = primary-soft com borda laranja,
// sem competir com o primário da view. Altura de toque 48 (DESIGN.md).
export function FilterBar<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.item, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  item: {
    flexGrow: 1,
    minHeight: touchHeight,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  label: { ...type.bodyMdMedium, color: colors.ink },
  selectedLabel: { color: colors.onPrimarySoft },
});
