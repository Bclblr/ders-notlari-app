import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RichEditor, RichToolbar, actions, type RichEditor as RichEditorInstance } from "react-native-pell-rich-editor";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function initialHtml(value: string): string {
  if (!value) return "";
  // Existing plain-text notes are escaped before entering the HTML editor.
  if (/<\/?[a-z][\s\S]*?>/i.test(value)) return value;
  return escapeHtml(value);
}

export default function RichNoteEditor({ value, onChange }: Props) {
  const editorRef = useRef<RichEditorInstance | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <RichToolbar
          editor={editorRef}
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.heading1,
            actions.heading2,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.undo,
            actions.redo,
          ]}
          iconTint="#6F6482"
          selectedIconTint="#6339B8"
          disabledIconTint="#C4BCCD"
          style={styles.richToolbar}
        />
        <View style={styles.colors}>
          <Pressable accessibilityLabel="Mor yazı rengi" onPress={() => editorRef.current?.setForeColor("#6339B8")} style={[styles.colorDot, { backgroundColor: "#6339B8" }]} />
          <Pressable accessibilityLabel="Kırmızı yazı rengi" onPress={() => editorRef.current?.setForeColor("#C62845")} style={[styles.colorDot, { backgroundColor: "#C62845" }]} />
          <Pressable accessibilityLabel="Siyah yazı rengi" onPress={() => editorRef.current?.setForeColor("#2B203B")} style={[styles.colorDot, { backgroundColor: "#2B203B" }]} />
        </View>
      </View>
      <View style={styles.symbols}>
        {["→", "←", "§", "¶", "•", "—", "✓", "★", "₺"].map((symbol) => (
          <Pressable key={symbol} accessibilityLabel={symbol} onPress={() => editorRef.current?.insertText(symbol)} style={styles.symbolButton}><Text style={styles.symbolText}>{symbol}</Text></Pressable>
        ))}
      </View>
      <RichEditor
        ref={editorRef}
        initialContentHTML={initialHtml(value)}
        onChange={onChange}
        placeholder="Ders notlarını yazmaya başla…"
        editorStyle={{
          backgroundColor: "#FFFFFF",
          color: "#2B203B",
          placeholderColor: "#89839A",
          contentCSSText: "font-size: 16px; line-height: 1.6; padding: 12px;",
        }}
        style={styles.editor}
        useContainer={false}
        initialHeight={280}
      />
      <Text style={styles.hint}>Biçimlendirme araçları: kalın, italik, altı çizili, madde işaretleri ve yazı rengi.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#EEE9F5",
    overflow: "hidden",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F4FC",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE9F5",
    paddingHorizontal: 6,
  },
  richToolbar: {
    flex: 1,
    backgroundColor: "transparent",
  },
  symbols: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#EEE9F5" },
  symbolButton: { minWidth: 27, height: 27, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: "#F0EAFB", borderRadius: 7 },
  symbolText: { color: "#6339B8", fontSize: 15, fontWeight: "700" },
  colors: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  editor: {
    minHeight: 280,
    backgroundColor: "#FFFFFF",
  },
  hint: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    color: "#8A8198",
    fontSize: 10,
    lineHeight: 15,
  },
});
