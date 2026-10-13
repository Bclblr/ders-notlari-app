import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

type AudioRecorderPanelProps = {
  onRecordingSaved: (uri: string) => void;
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
    directory: "document",
  });
  const state = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);

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
        onRecordingSaved(recorder.uri);
        Alert.alert("Kayıt tamamlandı", "Ses dosyası uygulamanın yerel belge alanına kaydedildi.");
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
          : "Mikrofon izni vererek yeni bir ders kaydı başlat."}
      </Text>
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
      <Text style={styles.footnote}>Kayıtlar cihazda tutulur. Şimdilik otomatik yazıya çevirme ve kayıt listesi henüz eklenmedi.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 380, alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 22, padding: 24, borderWidth: 1, borderColor: "#EEE9F5" },
  micBadge: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#F0EAFB", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  mic: { color: "#6339B8", fontSize: 26 },
  title: { fontSize: 21, fontWeight: "800", color: "#2B203B", marginBottom: 10 },
  timer: { fontSize: 34, fontWeight: "800", fontVariant: ["tabular-nums"], color: "#6339B8", marginBottom: 10 },
  caption: { textAlign: "center", color: "#817792", fontSize: 13, lineHeight: 19, marginBottom: 18 },
  button: { width: "100%", backgroundColor: "#6339B8", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  stopButton: { backgroundColor: "#B4233B" },
  disabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  footnote: { color: "#8A8198", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 16 }
});
