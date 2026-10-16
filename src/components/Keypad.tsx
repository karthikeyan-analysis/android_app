import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Delete, RotateCcw } from 'lucide-react-native';

interface KeypadProps {
  value: string;
  onChange: (val: string) => void;
}

export const Keypad: React.FC<KeypadProps> = ({ value, onChange }) => {
  const handlePress = (char: string) => {
    if (char === '.' && value.includes('.')) return;
    if (char === '-') {
      if (value.startsWith('-')) {
        onChange(value.substring(1));
      } else {
        onChange('-' + value);
      }
      return;
    }
    onChange(value + char);
  };

  const handleBackspace = () => {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    onChange('');
  };

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '-'],
  ];

  return (
    <View style={styles.container}>
      <View style={styles.displayRow}>
        <Text style={styles.displayLabel}>Your Answer:</Text>
        <View style={styles.displayBox}>
          <Text style={styles.displayText}>
            {value.length ? value : <Text style={styles.placeholderText}>Enter numerical value</Text>}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {keys.map((row, rIdx) => (
          <View key={rIdx} style={styles.row}>
            {row.map((k) => (
              <TouchableOpacity
                key={k}
                style={styles.keyButton}
                activeOpacity={0.7}
                onPress={() => handlePress(k)}
              >
                <Text style={styles.keyText}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.keyButton, styles.actionButton]}
            activeOpacity={0.7}
            onPress={handleClear}
          >
            <RotateCcw size={18} color="#475569" />
            <Text style={styles.actionButtonText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.keyButton, styles.actionButton]}
            activeOpacity={0.7}
            onPress={handleBackspace}
          >
            <Delete size={20} color="#EF4444" />
            <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Backspace</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 12,
  },
  displayRow: {
    marginBottom: 16,
  },
  displayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  displayBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4F46E5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  displayText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#94A3B8',
  },
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  keyButton: {
    flex: 1,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  keyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  actionButton: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#F1F5F9',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});

