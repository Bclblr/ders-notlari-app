import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

type AudioRecordingPlayerProps = { uri: string };

export default function AudioRecordingPlayer({ uri }: AudioRecordingPlayerProps) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  function togglePlayback() {
    if (playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? "Kaydı duraklat" : "Kaydı dinle"}
      style={styles.button}
      onPress={togglePlayback}
    >
      <Text style={styles.text}>{playing ? "Duraklat" : "Dinle"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: "#F0EAFB", paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 },
  text: { color: "#6339B8", fontSize: 12, fontWeight: "800" },
});
