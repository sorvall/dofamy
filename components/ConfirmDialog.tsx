import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

const INK = "#1A1915";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Модалка поверх всего экрана — надёжно работает в PWA (не внутри ScrollView). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Закрыть" />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelBtn} accessibilityRole="button">
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.confirmBtn} accessibilityRole="button">
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26, 25, 21, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8E5DC",
    zIndex: 2,
  },
  title: {
    fontFamily: "Unbounded_600SemiBold",
    fontSize: 17,
    color: INK,
    letterSpacing: -0.3,
  },
  message: {
    marginTop: 10,
    fontFamily: "GolosText_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: "#8C8A82",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "#ECEAE4",
  },
  cancelText: {
    fontFamily: "GolosText_600SemiBold",
    fontSize: 14,
    color: INK,
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "#FAECE7",
  },
  confirmText: {
    fontFamily: "GolosText_600SemiBold",
    fontSize: 14,
    color: "#993C1D",
  },
});
