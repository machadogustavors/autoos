import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, rounded, spacing, touchHeight, type } from '../theme/tokens';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

// Escolha entre 2–3 opções sem competir com o primário da view (DESIGN.md:
// um laranja sólido por tela). Selecionado = primary-soft + borda laranja.
export function Segmented<T extends string>({
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
  row: { flexDirection: 'row', gap: spacing.sm },
  item: {
    flex: 1,
    height: touchHeight,
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
  label: { ...type.buttonMd, color: colors.ink },
  selectedLabel: { color: colors.onPrimarySoft },
});
