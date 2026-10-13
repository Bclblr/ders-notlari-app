import React, { useRef, useState, useEffect } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

type AudioRecorderPanelProps = {
  onRecordingSaved: (uri: string, details: { title: string; teacher?: string; subject?: string; waveform?: number[] }) => void;
};

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function AudioRecorderPanel({ onRecordingSaved }: AudioRecorderPanelProps) {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
    directory: "document",
  });
  const state = useAudioRecorderState(recorder, 500);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const meteringSamples = useRef<number[]>([]);

  useEffect(() => {
    if (!state.isRecording || typeof state.metering !== "number") return;
    const normalized = Math.max(0.04, Math.min(1, (state.metering + 60) / 60));
    meteringSamples.current.push(normalized);
    if (meteringSamples.current.length > 12000) meteringSamples.current.shift();
  }, [state.isRecording, state.metering]);

  async function startRecording() {
    if (busy || state.isRecording) return;
    setBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Mikrofon izni gerekli", "Ses kaydı yapabilmek için cihaz ayarlarından mikrofon izni vermelisin.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      meteringSamples.current = [];
      recorder.record();
    } catch {
      Alert.alert("Kayıt başlatılamadı", "Mikrofon iznini ve cihaz ayarlarını kontrol edip tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  async function stopRecording() {
    if (busy || !state.isRecording) return;
    setBusy(true);
    try {
      await recorder.stop();
      if (recorder.uri) {
        const cleanSubject = subject.trim();
        const cleanTeacher = teacher.trim();
        const fallback = "Ders kaydı " + new Date().toLocaleDateString("tr-TR") + " " + new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        const title = cleanSubject ? cleanSubject + (cleanTeacher ? " — " + cleanTeacher : "") : fallback;
        onRecordingSaved(recorder.uri, { title, subject: cleanSubject || undefined, teacher: cleanTeacher || undefined, waveform: meteringSamples.current.slice() });
        Alert.alert("Kayıt tamamlandı", "Kayıt adı ve ders bilgileriyle arşive eklendi.");
      } else {
        Alert.alert("Kayıt bulunamadı", "Kayıt durdu ancak dosya yolu alınamadı.");
      }
    } catch {
      Alert.alert("Kayıt durdurulamadı", "Bir hata oluştu. Tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.micBadge}>
        <Text style={styles.mic}>●</Text>
      </View>
      <Text style={styles.title}>{state.isRecording ? "Ders kaydediliyor" : "Ders ses kaydı"}</Text>
      <Text style={styles.timer}>{formatDuration(state.durationMillis)}</Text>
      <Text style={styles.caption}>
        {state.isRecording
          ? "Dersi bitirdiğinde kaydı durdur."
          : "Kayda başlamadan ders/konu ve hocayı girersen arşivde kolayca bulabilirsin."}
      </Text>
      <TextInput value={subject} onChangeText={setSubject} editable={!state.isRecording && !busy} placeholder="Ders / konu (örn. Cumhuriyet Tarihi)" placeholderTextColor="#89839A" style={styles.metadataInput} accessibilityLabel="Ders veya konu" />
      <TextInput value={teacher} onChangeText={setTeacher} editable={!state.isRecording && !busy} placeholder="Hoca / konuşmacı (isteğe bağlı)" placeholderTextColor="#89839A" style={styles.metadataInput} accessibilityLabel="Hoca veya konuşmacı" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state.isRecording ? "Ses kaydını durdur" : "Ses kaydını başlat"}
        disabled={busy}
        onPress={state.isRecording ? stopRecording : startRecording}
        style={[styles.button, state.isRecording && styles.stopButton, busy && styles.disabled]}
      >
        <Text style={styles.buttonText}>
          {busy ? "İşleniyor..." : state.isRecording ? "■ Kaydı durdur" : "● Kaydı başlat"}
        </Text>
      </Pressable>
      <Text style={styles.footnote}>Kayıt dosyaları cihazda tutulur. Kaydı bitirdikten sonra listeden dinleyebilir veya paylaşabilirsin.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 460, alignSelf: "center", minWidth: 0, alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 20, borderWidth: 1, borderColor: "#EEE9F5" },
  micBadge: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#F0EAFB", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  mic: { color: "#6339B8", fontSize: 26 },
  title: { fontSize: 20, textAlign: "center", flexShrink: 1, fontWeight: "800", color: "#2B203B", marginBottom: 10 },
  timer: { fontSize: 32, fontWeight: "800", fontVariant: ["tabular-nums"], color: "#6339B8", marginBottom: 10 },
  caption: { textAlign: "center", color: "#817792", fontSize: 13, lineHeight: 19, marginBottom: 18 },
  metadataInput: { width: "100%", minWidth: 0, backgroundColor: "#F8F6FB", borderColor: "#EAE5F2", borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 12, color: "#2B203B", marginBottom: 9, fontSize: 13 },
  button: { width: "100%", backgroundColor: "#6339B8", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  stopButton: { backgroundColor: "#B4233B" },
  disabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  footnote: { color: "#8A8198", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 16 }
});
