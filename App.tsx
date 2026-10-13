import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  ScrollView,
  Alert,
} from "react-native";
import { createNote as makeNote, type Note } from "./src/types/note";
import { createNotesArchiveFile, loadNotes, saveNotes } from "./src/storage/nativeNotesStorage";
import * as Sharing from "expo-sharing";
import RichNoteEditor from "./src/components/RichNoteEditor";
import { createNotePdf } from "./src/services/pdfService";
import AudioRecorderPanel from "./src/components/AudioRecorderPanel";
import { loadRecordings, saveRecordings, type AudioRecording } from "./src/storage/nativeNotesStorage";

type Tab = "notes" | "record" | "settings";

function htmlToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export default function App() {
  const [tab, setTab] = useState<Tab>("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [recordingsReady, setRecordingsReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadNotes()
      .then((savedNotes) => {
        if (!active) return;
        const startingNotes = savedNotes.length > 0 ? savedNotes : [makeNote({
          title: "İlk ders notum",
          body: "Ders sırasında notlarını burada tutabilirsin.\n\nBu uygulama çevrimdışı çalışacak şekilde geliştiriliyor.",
        })];
        setNotes(startingNotes);
        setStorageReady(true);
      })
      .catch(() => {
        if (!active) return;
        setStorageMessage("Yerel notlar okunamadı. Bağımlılıklar kurulduktan sonra yeniden deneyin.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    saveNotes(notes).catch(() => {
      setStorageMessage("Notlar cihaza kaydedilemedi. Cihazında boş alan olduğundan emin ol.");
    });
  }, [notes, storageReady]);
  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;
  const visibleNotes = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return notes;
    return notes.filter((note) =>
      (note.title + " " + htmlToPlainText(note.body)).toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [notes, search]);

  function onRecordingSaved(uri: string) {\n    const recording: AudioRecording = {\n      id: "recording-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),\n      uri,\n      title: "Ders kaydı " + new Date().toLocaleDateString("tr-TR"),\n      createdAt: new Date().toISOString(),\n    };\n    setRecordings((current) => [recording, ...current]);\n  }\n\n  async function shareRecording(recording: AudioRecording) {\n    try {\n      if (!(await Sharing.isAvailableAsync())) { Alert.alert("Paylaşım kullanılamıyor", "Bu cihazda paylaşım menüsü açılamadı."); return; }\n      await Sharing.shareAsync(recording.uri, { dialogTitle: recording.title });\n    } catch { Alert.alert("Kayıt açılamadı", "Ses dosyası paylaşılamadı. Dosyanın cihazda mevcut olduğundan emin ol."); }\n  }\n\n  function createNote() {
    const note = makeNote({ title: "Yeni ders notu", body: "" });
    setNotes((current) => [note, ...current]);
    setSelectedId(note.id);
    setTab("notes");
  }

  function deleteSelectedNote() {
    if (!selectedNote) return;
    Alert.alert(
      "Not silinsin mi?",
      `“${selectedNote.title || "Başlıksız not"}” kalıcı olarak silinecek.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            setNotes((current) => current.filter((note) => note.id !== selectedNote.id));
            setSelectedId(null);
          },
        },
      ]
    );
  }

  async function exportArchive() {
    try {
      const uri = await createNotesArchiveFile(notes);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Paylaşım kullanılamıyor", "Bu cihazda paylaşım menüsü açılamadı.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Ders notları yedeğini paylaş",
        UTI: "public.json",
      });
    } catch {
      Alert.alert("Dışa aktarma başarısız", "Not arşivi oluşturulamadı. Daha sonra tekrar dene.");
    }
  }

  async function exportSelectedNotePdf() {
    if (!selectedNote || pdfBusy) return;
    setPdfBusy(true);
    try {
      const uri = await createNotePdf(selectedNote);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Paylaşım kullanılamıyor", "PDF oluşturuldu ancak bu cihazda paylaşım menüsü açılamadı.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Ders notunu PDF olarak paylaş",
        UTI: "com.adobe.pdf",
      });
    } catch {
      Alert.alert("PDF oluşturulamadı", "Not PDF'ye dönüştürülemedi. Daha sonra tekrar dene.");
    } finally {
      setPdfBusy(false);
    }
  }

  function updateSelected(changes: Partial<Note>) {
    if (!selectedId) return;
    setNotes((current) =>
      current.map((note) =>
        note.id === selectedId ? { ...note, ...changes, updatedAt: new Date().toISOString() } : note
      )
    );
  }

  const pageTitle = tab === "notes" ? "Notlarım" : tab === "record" ? "Ses kaydı" : "Ayarlar";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5FC" />
      <View style={styles.app}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>KİŞİSEL ÇALIŞMA ALANIN</Text>
            <Text style={styles.heading}>{selectedNote ? "Not düzenle" : pageTitle}</Text>
          </View>
          {tab === "notes" && !selectedNote ? (
            <Pressable accessibilityRole="button" style={styles.addButton} onPress={createNote}>
              <Text style={styles.addButtonText}>＋ Yeni</Text>
            </Pressable>
          ) : null}
          {selectedNote ? (
            <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => setSelectedId(null)}>
              <Text style={styles.backButtonText}>Bitti</Text>
            </Pressable>
          ) : null}
        </View>

        {selectedNote ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.editor}>
            <TextInput
              value={selectedNote.title}
              onChangeText={(title) => updateSelected({ title })}
              placeholder="Not başlığı"
              style={styles.titleInput}
              accessibilityLabel="Not başlığı"
            />
            <View style={styles.editorHint}>
              <Text style={styles.editorHintText}>Ders notu · Zengin metin düzenleyici</Text>
            </View>
            <RichNoteEditor key={selectedNote.id} value={selectedNote.body} onChange={(body) => updateSelected({ body })} />
            <Pressable accessibilityRole="button" style={styles.exportButton} onPress={exportSelectedNotePdf} disabled={pdfBusy}>
              <Text style={styles.exportButtonText}>{pdfBusy ? "PDF hazırlanıyor..." : "↓ PDF oluştur ve paylaş"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={deleteSelectedNote}>
              <Text style={styles.deleteButtonText}>Notu sil</Text>
            </Pressable>
            <Text style={styles.localHint}>{storageMessage || "Notlar cihazında yerel olarak saklanır. Yedek için Ayarlar bölümünden arşiv oluşturabilirsin."}</Text>
          </ScrollView>
        ) : tab === "notes" ? (
          <View style={styles.content}>
            <View style={styles.introCard}>
              <View style={styles.introIcon}><Text style={styles.introIconText}>✎</Text></View>
              <Text style={styles.introTitle}>Derslerini tek yerde topla</Text>
              <Text style={styles.introBody}>Not al, kayıt ve metin araçlarına aynı çalışma alanından ulaş.</Text>
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Notlarında ara"
              placeholderTextColor="#89839A"
              style={styles.search}
              accessibilityLabel="Notlarda ara"
            />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>SON NOTLAR</Text>
              <Text style={styles.count}>{visibleNotes.length} not</Text>
            </View>
            <ScrollView contentContainerStyle={styles.noteList}>
              {visibleNotes.map((note) => (
                <Pressable key={note.id} style={styles.noteCard} onPress={() => setSelectedId(note.id)}>
                  <View style={styles.noteGlyph}><Text style={styles.noteGlyphText}>▤</Text></View>
                  <View style={styles.noteInfo}>
                    <Text style={styles.noteTitle} numberOfLines={1}>{note.title || "Başlıksız not"}</Text>
                    <Text style={styles.notePreview} numberOfLines={2}>{htmlToPlainText(note.body) || "Henüz içerik yok"}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
              {visibleNotes.length === 0 ? <Text style={styles.empty}>Aramana uygun not bulunamadı.</Text> : null}
            </ScrollView>
          </View>
        ) : tab === "record" ? (
          <View style={styles.placeholder}>
            <View style={styles.micCircle}><Text style={styles.micEmoji}>🎙</Text></View>
            <Text style={styles.placeholderTitle}>Dersi kaydet</Text>
            <Text style={styles.placeholderBody}>Ses kaydı ve Türkçe çevrimdışı yazıya çevirme bu aşamalarda eklenecek.</Text>
            <View style={styles.statusPill}><View style={styles.statusDot} /><Text style={styles.statusText}>Kayıt özelliği sıradaki aşamalarda</Text></View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.micCircle}><Text style={styles.micEmoji}>⚙</Text></View>
            <Text style={styles.placeholderTitle}>Uygulama tercihleri</Text>
            <Text style={styles.placeholderBody}>Temel hedef: internet, hesap veya bulut gerektirmeden cihaz üzerinde çalışmak.</Text>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>Çevrimdışı çalışma</Text><Text style={styles.settingValue}>Hedefleniyor</Text></View>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>Yerel arşiv</Text><Text style={styles.settingValue}>Hazır</Text></View>
            <Pressable accessibilityRole="button" style={styles.exportButton} onPress={exportArchive}>
              <Text style={styles.exportButtonText}>↗ Notları yedekle (JSON)</Text>
            </Pressable>
            <Text style={styles.localHint}>Yedek dosyası cihazındaki paylaşım menüsüyle Dosyalar'a veya başka bir konuma kaydedilebilir.</Text>
          </View>
        )}

        {!selectedNote ? (
          <View style={styles.tabBar}>
            <TabButton label="Notlar" symbol="▤" active={tab === "notes"} onPress={() => setTab("notes")} />
            <TabButton label="Kayıt" symbol="◉" active={tab === "record"} onPress={() => setTab("record")} />
            <TabButton label="Ayarlar" symbol="⚙" active={tab === "settings"} onPress={() => setTab("settings")} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function TabButton({ label, symbol, active, onPress }: { label: string; symbol: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={styles.tabButton}>
      <Text style={[styles.tabSymbol, active && styles.tabActive]}>{symbol}</Text>
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F5FC" },
  app: { flex: 1, backgroundColor: "#F7F5FC" },
  header: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: "#817792", marginBottom: 7 },
  heading: { fontSize: 29, lineHeight: 35, fontWeight: "800", color: "#241A35" },
  addButton: { backgroundColor: "#6339B8", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14 },
  addButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  backButton: { backgroundColor: "#EAE3F7", paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
  backButtonText: { color: "#58339D", fontWeight: "800" },
  deleteButton: { alignSelf: "flex-start", backgroundColor: "#FCE9EC", paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, marginTop: 14 },
  deleteButtonText: { color: "#B4233B", fontWeight: "800" },
  exportButton: { width: "100%", maxWidth: 320, padding: 16, backgroundColor: "#6339B8", borderRadius: 14, alignItems: "center", marginTop: 18 },
  exportButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  content: { flex: 1, paddingHorizontal: 20 },\n  recordScreen: { flexGrow: 1, alignItems: "center", paddingHorizontal: 20, paddingBottom: 28, gap: 14 },\n  recordingsHeader: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },\n  recordingRow: { width: "100%", flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#EEE9F5", padding: 12, gap: 10 },\n  recordingShare: { backgroundColor: "#EEE8F8", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },\n  recordingShareText: { color: "#6339B8", fontSize: 12, fontWeight: "800" },
  introCard: { backgroundColor: "#2D2043", borderRadius: 22, padding: 20, marginBottom: 20 },
  introIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#4A3767", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  introIconText: { color: "#FFFFFF", fontSize: 22 },
  introTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 7 },
  introBody: { color: "#D5CBE5", fontSize: 13, lineHeight: 19 },
  search: { backgroundColor: "#FFFFFF", borderColor: "#EAE5F2", borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, color: "#241A35", fontSize: 14, marginBottom: 22 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.3, color: "#817792" },
  count: { fontSize: 12, color: "#817792" },
  noteList: { gap: 10, paddingBottom: 20 },
  noteCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1, borderColor: "#EEE9F5", padding: 14, gap: 12 },
  noteGlyph: { width: 42, height: 46, borderRadius: 12, backgroundColor: "#F0EAFB", alignItems: "center", justifyContent: "center" },
  noteGlyphText: { color: "#6339B8", fontSize: 21 },
  noteInfo: { flex: 1 },
  noteTitle: { fontSize: 15, fontWeight: "800", color: "#2B203B", marginBottom: 5 },
  notePreview: { fontSize: 12, color: "#817792", lineHeight: 17 },
  chevron: { color: "#A69CB6", fontSize: 25 },
  empty: { textAlign: "center", padding: 24, color: "#817792" },
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#EAE5F2", backgroundColor: "#FFFFFF", paddingTop: 11, paddingBottom: 12, paddingHorizontal: 10 },
  tabButton: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 3 },
  tabSymbol: { fontSize: 20, color: "#A49AB4" },
  tabLabel: { fontSize: 11, color: "#A49AB4", fontWeight: "700" },
  tabActive: { color: "#6339B8" },
  editor: { paddingHorizontal: 20, paddingBottom: 35, flexGrow: 1 },
  titleInput: { fontSize: 24, fontWeight: "800", color: "#2B203B", backgroundColor: "#FFFFFF", borderRadius: 15, paddingHorizontal: 15, paddingVertical: 14, marginBottom: 12 },
  editorHint: { backgroundColor: "#EEE8F8", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 },
  editorHintText: { fontSize: 11, color: "#6945A4", fontWeight: "700" },
  bodyInput: { minHeight: 260, backgroundColor: "#FFFFFF", borderRadius: 15, padding: 16, fontSize: 16, lineHeight: 25, color: "#2B203B" },
  localHint: { fontSize: 11, color: "#8A8198", lineHeight: 16, marginTop: 12 },
  placeholder: { flex: 1, paddingHorizontal: 28, justifyContent: "center", alignItems: "center" },
  micCircle: { width: 84, height: 84, borderRadius: 28, backgroundColor: "#EAE2F8", alignItems: "center", justifyContent: "center", marginBottom: 22 },
  micEmoji: { fontSize: 34, color: "#6339B8" },
  placeholderTitle: { fontSize: 23, fontWeight: "800", color: "#2B203B", marginBottom: 10, textAlign: "center" },
  placeholderBody: { fontSize: 14, color: "#817792", lineHeight: 21, textAlign: "center", maxWidth: 300 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 99, paddingHorizontal: 13, paddingVertical: 10, marginTop: 22 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D9A13C" },
  statusText: { fontSize: 11, color: "#746984", fontWeight: "700" },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: 320, padding: 15, backgroundColor: "#FFFFFF", borderRadius: 14, marginTop: 10 },
  settingLabel: { fontSize: 13, color: "#4D415E", fontWeight: "700" },
  settingValue: { fontSize: 12, color: "#8B7DA1" },
});
