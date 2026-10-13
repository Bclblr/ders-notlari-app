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
  Modal,
} from "react-native";
import { createNote as makeNote, type Note } from "./src/types/note";
import { deleteRecordingFile, loadNotes, saveNotes, loadRecordings, saveRecordings } from "./src/storage/nativeNotesStorage";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as Print from "expo-print";
import { File } from "expo-file-system";
import { WebView } from "react-native-webview";
import { createFullArchiveFile, readLegacyNotesJson, restoreFullArchive } from "./src/services/archiveService";
import RichNoteEditor from "./src/components/RichNoteEditor";
import { createNotePdf } from "./src/services/pdfService";
import AudioRecorderPanel from "./src/components/AudioRecorderPanel";
import AudioRecordingEditor from "./src/components/AudioRecordingEditor";
import type { AudioRecording } from "./src/types/recording";
import { transcribeAudioFile } from "./src/services/transcriptionService";

type Tab = "notes" | "record" | "settings";

function plainTextToHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br/>");
}

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
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [editingRecording, setEditingRecording] = useState<AudioRecording | null>(null);
  const [trimmingRecording, setTrimmingRecording] = useState<AudioRecording | null>(null);
  const [recordingTitleDraft, setRecordingTitleDraft] = useState("");
  const [recordingTeacherDraft, setRecordingTeacherDraft] = useState("");
  const [recordingSubjectDraft, setRecordingSubjectDraft] = useState("");

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
    let active = true;
    loadRecordings()
      .then((saved) => {
        if (!active) return;
        setRecordings(saved);
        setRecordingsReady(true);
      })
      .catch(() => {
        if (active) {
          setStorageMessage("Ses kaydı arşivi okunamadı. Veri kaybını önlemek için boş arşiv kaydedilmedi.");
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!recordingsReady) return;
    saveRecordings(recordings).catch(() => {
      setStorageMessage("Ses kaydı bilgileri kaydedilemedi.");
    });
  }, [recordings, recordingsReady]);

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

  function onRecordingSaved(uri: string, details: { title: string; teacher?: string; subject?: string; waveform?: number[] }) {
    const savedRecording: AudioRecording = {
      id: "recording-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      uri,
      title: details.title.trim() || "Ders kaydı " + new Date().toLocaleDateString("tr-TR"),
      teacher: details.teacher?.trim() || undefined,
      subject: details.subject?.trim() || undefined,
      waveform: details.waveform,
      createdAt: new Date().toISOString(),
    };
    setRecordings((current) => [savedRecording, ...current]);
  }

  function openRecordingEditor(recording: AudioRecording) {
    setEditingRecording(recording);
    setRecordingTitleDraft(recording.title);
    setRecordingTeacherDraft(recording.teacher || "");
    setRecordingSubjectDraft(recording.subject || "");
  }

  function saveRecordingDetails() {
    if (!editingRecording) return;
    const title = recordingTitleDraft.trim();
    if (!title) {
      Alert.alert("Kayıt adı gerekli", "Kaydı kolayca bulabilmek için bir ad yaz.");
      return;
    }
    setRecordings((current) => current.map((item) => item.id === editingRecording.id
      ? { ...item, title, teacher: recordingTeacherDraft.trim() || undefined, subject: recordingSubjectDraft.trim() || undefined }
      : item));
    setEditingRecording(null);
  }

  async function shareRecording(recording: AudioRecording) {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Paylaşım kullanılamıyor", "Bu cihazda paylaşım menüsü açılamadı.");
        return;
      }
      await Sharing.shareAsync(recording.uri, { dialogTitle: recording.title });
    } catch {
      Alert.alert("Kayıt açılamadı", "Ses dosyası paylaşılamadı. Dosyanın cihazda mevcut olduğundan emin ol.");
    }
  }
 
  function createNoteFromRecording(recording: AudioRecording) {
    const note = makeNote({
      title: recording.title + " — Notlar",
      body: "Bu ses kaydı için ders notlarını buraya yazabilir veya kaydı Türkçe olarak yazıya çevirebilirsin.",
    });
    setNotes((current) => [note, ...current]);
    setSelectedId(note.id);
    setTab("notes");
  }

  async function transcribeRecording(recording: AudioRecording) {
    if (transcribingId) return;
    setTranscribingId(recording.id);
    setTranscriptionProgress(0);
    try {
      const text = await transcribeAudioFile(recording.uri, (progress) => setTranscriptionProgress(progress));
      if (!text.trim()) {
        Alert.alert("Metin bulunamadı", "Kayıtta anlaşılabilir konuşma tespit edilemedi.");
        return;
      }
      const note = makeNote({
        title: recording.title + " — Çözümleme",
        body: plainTextToHtml(text.trim()),
      });
      setNotes((current) => [note, ...current]);
      setSelectedId(note.id);
      setTab("notes");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
      Alert.alert("Yazıya çevirme başarısız", "Native uygulamanın derlendiğini ve modelin pakete eklendiğini kontrol et. " + detail);
    } finally {
      setTranscribingId(null);
      setTranscriptionProgress(0);
    }
  }

  function deleteRecording(recording: AudioRecording) {
    Alert.alert(
      "Ses kaydı silinsin mi?",
      "Bu işlem kayıt dosyasını ve arşivdeki bilgisini silmeye çalışır.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            setRecordings((current) => current.filter((item) => item.id !== recording.id));
            deleteRecordingFile(recording.uri).catch(() => {
              setStorageMessage("Kayıt arşivden kaldırıldı ancak dosya silinemedi.");
            });
          },
        },
      ]
    );
  }

  function createNote() {
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
    if (archiveBusy) return;
    setArchiveBusy(true);
    try {
      const uri = await createFullArchiveFile(notes, recordings);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Paylaşım kullanılamıyor", "Bu cihazda paylaşım menüsü açılamadı.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/zip",
        dialogTitle: "Ders Notlarım tam yedeğini paylaş",
        UTI: "public.zip",
      });
    } catch {
      Alert.alert("Dışa aktarma başarısız", "Tam yedek oluşturulamadı. Ses dosyalarının cihazda bulunduğunu ve yeterli boş alan olduğunu kontrol et.");
    } finally { setArchiveBusy(false); }
  }

  async function importArchive() {
    if (archiveBusy) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ["application/zip", "application/json", "application/octet-stream"], copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      Alert.alert("Yedek geri yüklensin mi?", "Mevcut notlar değiştirilecek. ZIP tam yedeği seçtiysen ses kayıtları da geri yüklenecek. Önce mevcut verilerini yedekle.", [
        { text: "Vazgeç", style: "cancel" },
        { text: "Geri yükle", style: "destructive", onPress: async () => {
          setArchiveBusy(true);
          try {
            if (asset.name.toLowerCase().endsWith(".zip") || asset.mimeType === "application/zip") {
              const restored = await restoreFullArchive(asset.uri);
              await saveNotes(restored.notes); await saveRecordings(restored.recordings);
              setNotes(restored.notes); setRecordings(restored.recordings); setRecordingsReady(true); setSelectedId(null);
              Alert.alert("Yedek geri yüklendi", restored.notes.length + " not ve " + restored.recordings.length + " ses kaydı geri yüklendi.");
            } else {
              const restoredNotes = await readLegacyNotesJson(await new File(asset.uri).text());
              await saveNotes(restoredNotes); setNotes(restoredNotes); setSelectedId(null);
              Alert.alert("Notlar geri yüklendi", restoredNotes.length + " not içe aktarıldı. Eski JSON yedeği ses dosyalarını içermez.");
            }
          } catch (error) {
            Alert.alert("Geri yükleme başarısız", error instanceof Error ? error.message : "Bilinmeyen hata");
          } finally { setArchiveBusy(false); }
        } },
      ]);
    } catch { Alert.alert("Dosya açılamadı", "Yedek dosyası seçilemedi. Tekrar dene."); }
  }

  function makePreviewHtml(note: Note): string {
    const safeTitle = (note.title || "Başlıksız ders notu").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return "<!doctype html><html lang=\"tr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><style>body{font-family:Arial,sans-serif;padding:22px;color:#292235;line-height:1.65;overflow-wrap:break-word}h1{color:#39245c}img{max-width:100%}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #ddd;padding:5px}</style></head><body><h1>" + safeTitle + "</h1>" + (note.body || "") + "</body></html>";
  }

  async function printSelectedNote() {
    if (!selectedNote) return;
    try { await Print.printAsync({ html: makePreviewHtml(selectedNote) }); }
    catch { Alert.alert("Yazdırma açılamadı", "Cihazın yazdırma hizmeti kullanılamıyor."); }
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
            <Pressable accessibilityRole="button" style={styles.exportButton} onPress={() => setPreviewVisible(true)}><Text style={styles.exportButtonText}>Notu önizle</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.exportButton} onPress={printSelectedNote}><Text style={styles.exportButtonText}>Yazdır</Text></Pressable>
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
          <ScrollView contentContainerStyle={styles.recordScreen}>
            <AudioRecorderPanel onRecordingSaved={onRecordingSaved} />
            <View style={styles.recordingsHeader}>
              <Text style={styles.sectionTitle}>KAYITLARIM</Text>
              <Text style={styles.count}>{recordings.length} kayıt</Text>
            </View>
            {recordings.length === 0 ? (
              <Text style={styles.empty}>Henüz ses kaydı yok. İlk kaydını yukarıdan başlatabilirsin.</Text>
            ) : recordings.map((recording) => (
              <View key={recording.id} style={styles.recordingRow}>
                <View style={styles.recordingInfoRow}>
                  <View style={styles.noteGlyph}><Text style={styles.noteGlyphText}>◉</Text></View>
                  <View style={styles.noteInfo}>
                    <Text style={styles.noteTitle}>{recording.title?.trim() || "İsimsiz ses kaydı"}</Text>
                    <Text style={styles.notePreview}>{recording.subject?.trim() ? "Ders: " + recording.subject : "Ders bilgisi eklenmedi"}</Text>
                    {recording.teacher?.trim() ? <Text style={styles.notePreview}>Hoca: {recording.teacher}</Text> : null}
                    <Text style={styles.notePreview}>{new Date(recording.createdAt).toLocaleString("tr-TR")}</Text>
                  </View>
                </View>
                <View style={styles.recordingActions}>
                  <Pressable accessibilityRole="button" style={styles.recordingShare} onPress={() => setTrimmingRecording(recording)}><Text style={styles.recordingShareText}>▶ Dinle / Kırp</Text></Pressable>
                  <Pressable accessibilityRole="button" style={styles.recordingShare} onPress={() => openRecordingEditor(recording)}><Text style={styles.recordingShareText}>Düzenle</Text></Pressable>
                  <Pressable accessibilityRole="button" style={styles.recordingShare} onPress={() => createNoteFromRecording(recording)}><Text style={styles.recordingShareText}>Not yaz</Text></Pressable>
                  <Pressable accessibilityRole="button" style={styles.recordingShare} disabled={!!transcribingId} onPress={() => transcribeRecording(recording)}>
                    <Text style={styles.recordingShareText}>{transcribingId === recording.id ? "Çözülüyor %" + transcriptionProgress : "Yazıya çevir"}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.recordingShare} onPress={() => shareRecording(recording)}>
                    <Text style={styles.recordingShareText}>Paylaş</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.recordingDelete} onPress={() => deleteRecording(recording)}>
                    <Text style={styles.recordingDeleteText}>Sil</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.localHint}>Kayıtlar cihazda tutulur. “Yazıya çevir” düğmesi çok dilli Whisper Base ile Türkçe metin üretir; native derleme ve cihaz testi gerekir.</Text>
          </ScrollView>
) : (
          <View style={styles.placeholder}>
            <View style={styles.micCircle}><Text style={styles.micEmoji}>⚙</Text></View>
            <Text style={styles.placeholderTitle}>Uygulama tercihleri</Text>
            <Text style={styles.placeholderBody}>Temel hedef: internet, hesap veya bulut gerektirmeden cihaz üzerinde çalışmak.</Text>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>Çevrimdışı çalışma</Text><Text style={styles.settingValue}>Hedefleniyor</Text></View>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>Yerel arşiv</Text><Text style={styles.settingValue}>Hazır</Text></View>
            <Pressable accessibilityRole="button" style={styles.exportButton} onPress={exportArchive}>
              <Text style={styles.exportButtonText}>↗ Tam yedek oluştur (ZIP)</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.exportButton} onPress={importArchive} disabled={archiveBusy}><Text style={styles.exportButtonText}>↙ Yedekten geri yükle</Text></Pressable>
            <Text style={styles.localHint}>ZIP tam yedeği notları ve ses dosyalarını içerir. Eski JSON yedekleri yalnızca notları geri yükler.</Text>
          </View>
        )}

        <AudioRecordingEditor
          recording={trimmingRecording}
          onClose={() => setTrimmingRecording(null)}
          onSaveCopy={(copy) => setRecordings((current) => [copy, ...current])}
        />
        <Modal visible={!!editingRecording} animationType="slide" transparent onRequestClose={() => setEditingRecording(null)}>
          <View style={styles.recordingModalBackdrop}>
            <View style={styles.recordingModalCard}>
              <Text style={styles.previewTitle}>Kaydı düzenle</Text>
              <Text style={styles.modalLabel}>Kayıt adı *</Text>
              <TextInput value={recordingTitleDraft} onChangeText={setRecordingTitleDraft} placeholder="Örn. Cumhuriyet Tarihi — 3. hafta" style={styles.modalInput} />
              <Text style={styles.modalLabel}>Ders / konu</Text>
              <TextInput value={recordingSubjectDraft} onChangeText={setRecordingSubjectDraft} placeholder="Örn. Atatürk İlkeleri" style={styles.modalInput} />
              <Text style={styles.modalLabel}>Hoca / konuşmacı</Text>
              <TextInput value={recordingTeacherDraft} onChangeText={setRecordingTeacherDraft} placeholder="Örn. Dr. Ayşe Yılmaz" style={styles.modalInput} />
              <View style={styles.modalActions}>
                <Pressable style={styles.backButton} onPress={() => setEditingRecording(null)}><Text style={styles.backButtonText}>Vazgeç</Text></Pressable>
                <Pressable style={styles.addButton} onPress={saveRecordingDetails}><Text style={styles.addButtonText}>Kaydet</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
        {selectedNote ? (
          <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}><SafeAreaView style={styles.previewSafe}><View style={styles.previewHeader}><Text style={styles.previewTitle}>Not önizlemesi</Text><Pressable style={styles.backButton} onPress={() => setPreviewVisible(false)}><Text style={styles.backButtonText}>Kapat</Text></Pressable></View><WebView originWhitelist={["*"]} source={{ html: makePreviewHtml(selectedNote) }} style={styles.previewWeb} /><Pressable style={styles.exportButton} onPress={printSelectedNote}><Text style={styles.exportButtonText}>Yazdır</Text></Pressable></SafeAreaView></Modal>
        ) : null}
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
  previewSafe: { flex: 1, backgroundColor: "#F7F5FC", padding: 12 },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 },
  previewTitle: { fontSize: 20, fontWeight: "800", color: "#2B203B" },
  previewWeb: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12 },
  app: { flex: 1, backgroundColor: "#F7F5FC" },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: "#817792", marginBottom: 7 },
  heading: { fontSize: 27, lineHeight: 33, flexShrink: 1, fontWeight: "800", color: "#241A35" },
  addButton: { backgroundColor: "#6339B8", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14 },
  addButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  backButton: { backgroundColor: "#EAE3F7", paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
  backButtonText: { color: "#58339D", fontWeight: "800" },
  deleteButton: { alignSelf: "flex-start", backgroundColor: "#FCE9EC", paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, marginTop: 14 },
  deleteButtonText: { color: "#B4233B", fontWeight: "800" },
  exportButton: { width: "100%", maxWidth: 420, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "#6339B8", borderRadius: 14, alignItems: "center", marginTop: 14 },
  exportButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  content: { flex: 1, paddingHorizontal: 14, minWidth: 0 },
  recordScreen: { flexGrow: 1, alignItems: "center", paddingHorizontal: 14, paddingBottom: 24, gap: 12 },
  recordingsHeader: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  recordingRow: { width: "100%", minWidth: 0, alignSelf: "stretch", flexDirection: "column", alignItems: "stretch", backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#EEE9F5", padding: 12, gap: 12 },
  recordingInfoRow: { width: "100%", minWidth: 0, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  recordingActions: { width: "100%", minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 },
  recordingShare: { backgroundColor: "#EEE8F8", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  recordingShareText: { color: "#6339B8", fontSize: 12, fontWeight: "800" },
  recordingDelete: { backgroundColor: "#FCE9EC", paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 },
  recordingDeleteText: { color: "#B4233B", fontSize: 12, fontWeight: "800" },
  recordingModalBackdrop: { flex: 1, justifyContent: "center", padding: 14, backgroundColor: "rgba(24, 16, 38, 0.45)" },
  recordingModalCard: { width: "100%", maxWidth: 480, alignSelf: "center", maxHeight: "92%", backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, gap: 9 },
  modalLabel: { color: "#4D415E", fontSize: 12, fontWeight: "800", marginTop: 4 },
  modalInput: { width: "100%", backgroundColor: "#F8F6FB", borderColor: "#EAE5F2", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: "#2B203B" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 12 },
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
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#EAE5F2", backgroundColor: "#FFFFFF", paddingTop: 9, paddingBottom: 10, paddingHorizontal: 6 },
  tabButton: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 3 },
  tabSymbol: { fontSize: 20, color: "#A49AB4" },
  tabLabel: { fontSize: 11, color: "#A49AB4", fontWeight: "700" },
  tabActive: { color: "#6339B8" },
  editor: { paddingHorizontal: 14, paddingBottom: 28, flexGrow: 1, minWidth: 0 },
  titleInput: { width: "100%", fontSize: 22, fontWeight: "800", color: "#2B203B", backgroundColor: "#FFFFFF", borderRadius: 15, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 12 },
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
