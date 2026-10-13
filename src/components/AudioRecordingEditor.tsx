import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { File, Paths } from "expo-file-system";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { AudioRecording } from "../types/recording";

type Props = {
  recording: AudioRecording | null;
  onClose: () => void;
  onSaveCopy: (recording: AudioRecording) => void;
};

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function parseTime(value: string): number | null {
  const parts = value.trim().split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.some((part) => !/^\d+$/.test(String(part)))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export default function AudioRecordingEditor({ recording, onClose, onSaveCopy }: Props) {
  const player = useAudioPlayer(recording?.uri ?? null);
  const status = useAudioPlayerStatus(player);
  const duration = Number.isFinite(status.duration) ? Math.max(0, status.duration) : 0;
  const currentTime = Number.isFinite(status.currentTime) ? Math.max(0, status.currentTime) : 0;
  const [startText, setStartText] = useState("00:00");
  const [endText, setEndText] = useState("00:00");
  const [busy, setBusy] = useState(false);
  const [trackWidth, setTrackWidth] = useState(1);
  const waveformBars = useMemo(() => {
    const samples = recording?.waveform;
    if (!samples?.length) return [];
    const count = Math.min(72, samples.length);
    return Array.from({ length: count }, (_, index) => samples[Math.floor(index * samples.length / count)] ?? 0.05);
  }, [recording?.id, recording?.waveform]);

  useEffect(() => {
    if (!recording) return;
    setStartText("00:00");
    setEndText(formatTime(duration));
    player.pause();
    player.seekTo(0);
  }, [recording?.id]);

  useEffect(() => {
    if (duration > 0 && endText === "00:00") setEndText(formatTime(duration));
  }, [duration, endText]);

  useEffect(() => {
    if (!status.playing || duration <= 0) return;
    const end = parseTime(endText);
    if (end !== null && end > 0 && currentTime >= end) player.pause();
  }, [currentTime, duration, endText, status.playing]);

  const range = useMemo(() => {
    const start = parseTime(startText);
    const end = parseTime(endText);
    return { start, end, valid: start !== null && end !== null && start >= 0 && end > start && end <= duration + 1 };
  }, [startText, endText, duration]);

  async function trimAndSave() {
    if (!recording || busy) return;
    if (!range.valid || range.start === null || range.end === null) {
      Alert.alert("Zaman aralığını kontrol et", "Başlangıç ve bitişi dakika:saniye (veya saat:dakika:saniye) biçiminde gir. Bitiş başlangıçtan sonra olmalı ve kayıt süresini aşmamalı.");
      return;
    }
    setBusy(true);
    try {
      const trimModule = await import("react-native-video-trim");
      const result = await trimModule.trim(recording.uri, {
        startTime: Math.round(range.start * 1000),
        endTime: Math.round(range.end * 1000),
        type: "audio",
        outputExt: "m4a",
      });
      const outputUri = result.outputPath.startsWith("file://")
        ? result.outputPath
        : "file://" + result.outputPath;
      const source = new File(outputUri);
      const destination = new File(Paths.document, `ders-notlarim-kirpilan-${Date.now()}.m4a`);
      destination.create();
      destination.write(await source.bytes());
      const copy: AudioRecording = {
        ...recording,
        id: "recording-trim-" + Date.now().toString(36),
        uri: destination.uri,
        title: recording.title + " — kırpılmış",
        waveform: recording.waveform?.slice(
          Math.floor((range.start / Math.max(duration, 1)) * recording.waveform.length),
          Math.max(
            Math.floor((range.start / Math.max(duration, 1)) * recording.waveform.length) + 1,
            Math.ceil((range.end / Math.max(duration, 1)) * recording.waveform.length)
          )
        ),
        createdAt: new Date().toISOString(),
      };
      onSaveCopy(copy);
      Alert.alert("Kırpma tamamlandı", "Seçtiğin bölüm yeni bir kayıt olarak kaydedildi. Orijinal kayıt korunuyor.");
      player.pause();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      Alert.alert("Kırpma başarısız", "Ses bölümü kaydedilemedi. Geliştirme sürümünü ve dosya biçimini kontrol et. " + message);
    } finally {
      setBusy(false);
    }
  }

  function seekToPosition(x: number) {
    if (duration <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / trackWidth));
    player.seekTo(ratio * duration);
  }

  return (
    <Modal visible={!!recording} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>SES DÜZENLEYİCİ</Text>
            <Text style={styles.title} numberOfLines={2}>{recording?.title ?? "Ses kaydı"}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>Kapat</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.help}>Çizgi üzerinde bir noktaya dokunarak o zamana git. Başlangıç ve bitişi mevcut konumdan belirleyebilirsin.</Text>
          <View style={styles.timeRow}>
            <Text style={styles.current}>{formatTime(currentTime)}</Text>
            <Text style={styles.total}>/ {formatTime(duration)}</Text>
          </View>
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="Ses zaman çizelgesi"
            onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
            onPress={(event) => seekToPosition(event.nativeEvent.locationX)}
            style={styles.track}
          >
            {waveformBars.length > 0 ? (
              <View pointerEvents="none" style={styles.waveformBars}>
                {waveformBars.map((peak, index) => (
                  <View
                    key={index}
                    style={[
                      styles.waveBar,
                      {
                        height: Math.max(4, Math.min(24, peak * 26)),
                        backgroundColor: duration > 0 && index / waveformBars.length <= currentTime / duration ? "#6339B8" : "#B6A0E2",
                      },
                    ]}
                  />
                ))}
              </View>
            ) : (
              <>
                <View style={[styles.trackProgress, { width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }]} />
                <View style={[styles.playhead, { left: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }]} />
              </>
            )}
          </Pressable>
          <View style={styles.playControls}>
            <Pressable style={styles.secondaryButton} onPress={() => player.seekTo(Math.max(0, currentTime - 10))}><Text style={styles.secondaryText}>−10 sn</Text></Pressable>
            <Pressable style={styles.primaryButton} onPress={() => status.playing ? player.pause() : player.play()}><Text style={styles.primaryText}>{status.playing ? "Duraklat" : "▶ Dinlet"}</Text></Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => player.seekTo(Math.min(duration, currentTime + 10))}><Text style={styles.secondaryText}>+10 sn</Text></Pressable>
          </View>
          <View style={styles.rangeCard}>
            <Text style={styles.sectionTitle}>KIRPILACAK BÖLÜM</Text>
            <Text style={styles.label}>Başlangıç (dakika:saniye veya saat:dakika:saniye)</Text>
            <TextInput value={startText} onChangeText={setStartText} placeholder="00:00" keyboardType="numbers-and-punctuation" style={styles.input} />
            <Pressable style={styles.setButton} onPress={() => setStartText(formatTime(currentTime))}><Text style={styles.setText}>Mevcut konumu başlangıç yap · {formatTime(currentTime)}</Text></Pressable>
            <Text style={styles.label}>Bitiş</Text>
            <TextInput value={endText} onChangeText={setEndText} placeholder="10:00" keyboardType="numbers-and-punctuation" style={styles.input} />
            <Pressable style={styles.setButton} onPress={() => setEndText(formatTime(currentTime))}><Text style={styles.setText}>Mevcut konumu bitiş yap · {formatTime(currentTime)}</Text></Pressable>
            {range.valid && range.start !== null && range.end !== null ? (
              <Text style={styles.rangeSummary}>Seçilen bölüm: {formatTime(range.start)} – {formatTime(range.end)} · {formatTime(range.end - range.start)}</Text>
            ) : <Text style={styles.errorText}>Zaman aralığını kontrol et. Bitiş, başlangıçtan sonra olmalı.</Text>}
          </View>
          <Pressable disabled={busy || !range.valid} style={[styles.saveButton, (busy || !range.valid) && styles.disabled]} onPress={trimAndSave}>
            <Text style={styles.saveText}>{busy ? "Bölüm kaydediliyor..." : "✂ Seçili bölümü yeni kayıt olarak kaydet"}</Text>
          </Pressable>
          <Text style={styles.note}>Orijinal kayıt silinmez. Gerçek ses kırpma için bu uygulamanın özel Android/iPhone sürümünü kullan. Expo Go yerel kırpma modülünü çalıştıramaz.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5FC" },
  header: { paddingTop: 12, paddingHorizontal: 14, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#EAE5F2" },
  headerText: { flex: 1 },
  eyebrow: { color: "#817792", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 6 },
  title: { color: "#2B203B", fontSize: 18, flexShrink: 1, fontWeight: "800" },
  closeButton: { paddingHorizontal: 11, paddingVertical: 10, borderRadius: 12, backgroundColor: "#EAE3F7" },
  closeText: { color: "#58339D", fontWeight: "800" },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 28, gap: 12 },
  help: { color: "#817792", fontSize: 13, lineHeight: 19 },
  timeRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 5, marginTop: 10 },
  current: { color: "#6339B8", fontSize: 28, fontWeight: "900", fontVariant: ["tabular-nums"] },
  total: { color: "#817792", fontSize: 14, fontVariant: ["tabular-nums"] },
  track: { height: 30, justifyContent: "center", backgroundColor: "#E5DDF3", borderRadius: 99, overflow: "hidden" },
  trackProgress: { height: "100%", backgroundColor: "#B6A0E2", borderRadius: 99 },
  waveformBars: { flex: 1, height: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 2, paddingHorizontal: 5 },
  waveBar: { flex: 1, minWidth: 1, maxWidth: 5, borderRadius: 3 },
  playhead: { position: "absolute", top: 0, bottom: 0, width: 3, marginLeft: -1, backgroundColor: "#6339B8" },
  playControls: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  primaryButton: { backgroundColor: "#6339B8", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  primaryText: { color: "#FFFFFF", fontWeight: "800" },
  secondaryButton: { backgroundColor: "#EAE3F7", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 },
  secondaryText: { color: "#58339D", fontWeight: "800" },
  rangeCard: { width: "100%", minWidth: 0, backgroundColor: "#FFFFFF", borderColor: "#EEE9F5", borderWidth: 1, borderRadius: 16, padding: 13, gap: 9 },
  sectionTitle: { color: "#817792", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginBottom: 4 },
  label: { color: "#4D415E", fontSize: 12, fontWeight: "800", marginTop: 4 },
  input: { backgroundColor: "#F8F6FB", borderColor: "#EAE5F2", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: "#2B203B", fontVariant: ["tabular-nums"] },
  setButton: { alignSelf: "flex-start", maxWidth: "100%", paddingVertical: 6 },
  setText: { color: "#6339B8", fontSize: 12, lineHeight: 17, flexShrink: 1, fontWeight: "800" },
  rangeSummary: { color: "#3B6E55", fontSize: 12, fontWeight: "800", marginTop: 5 },
  errorText: { color: "#B4233B", fontSize: 12, marginTop: 5 },
  saveButton: { width: "100%", alignSelf: "stretch", backgroundColor: "#6339B8", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 15, alignItems: "center" },
  saveText: { color: "#FFFFFF", fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.45 },
  note: { color: "#8A8198", fontSize: 11, lineHeight: 17, marginTop: 4 },
});
