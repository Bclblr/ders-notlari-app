import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = "https://ynvosvngvuywizacyffn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inludm9zdm5ndnV5d2l6YWN5ZmZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MjY4NjgsImV4cCI6MjEwNzUwMjg2OH0.oYTu-WTtvJk1ISkFKYz19lE7JxUX_zd1ktFum_M74kc";
const TOKEN_KEY = "personal_location_access_token";

export default function LocationTracker() {
  const [token, setToken] = useState("");
  const [running, setRunning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const [status, setStatus] = useState("Konum paylaşımı kapalı.");
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const tokenRef = useRef("");

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then((saved) => {
      if (saved) {
        setToken(saved);
        tokenRef.current = saved;
      }
    }).catch(() => {});
    return () => { subscription.current?.remove(); };
  }, []);

  async function saveToken() {
    const cleaned = token.trim();
    if (cleaned.length < 32) {
      Alert.alert("Anahtar geçersiz", "Konum erişim anahtarı en az 32 karakter olmalı.");
      return;
    }
    await AsyncStorage.setItem(TOKEN_KEY, cleaned);
    tokenRef.current = cleaned;
    setToken(cleaned);
    setStatus("Erişim anahtarı bu cihazda kaydedildi.");
  }

  async function sendLocation(position: Location.LocationObject, accessToken: string) {
    const response = await fetch(SUPABASE_URL + "/functions/v1/device-location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "x-location-token": accessToken,
      },
      body: JSON.stringify({
        action: "update",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        recordedAt: new Date(position.timestamp).toISOString(),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Konum sunucuya gönderilemedi.");
    setLastUpdate(new Date().toLocaleString("tr-TR"));
    setStatus("Konum güncellendi.");
  }

  async function startTracking() {
    const accessToken = tokenRef.current || token.trim();
    if (accessToken.length < 32) {
      Alert.alert("Erişim anahtarı gerekli", "Önce konum paneli için oluşturduğun erişim anahtarını kaydet.");
      return;
    }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setStatus("Konum izni verilmedi.");
        Alert.alert("Konum izni gerekli", "iPhone ayarlarından uygulama için konum izni vermen gerekiyor.");
        return;
      }
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await sendLocation(initial, accessToken);
      subscription.current?.remove();
      subscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 50 },
        (position) => {
          sendLocation(position, accessToken).catch((error) => {
            setStatus(error instanceof Error ? error.message : "Konum gönderilemedi.");
          });
        },
      );
      setRunning(true);
      setStatus("Takip açık. Uygulama ekranda açıkken konum güncellenir.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Konum alınamadı.");
      Alert.alert("Konum başlatılamadı", error instanceof Error ? error.message : "Bilinmeyen hata");
    }
  }

  function stopTracking() {
    subscription.current?.remove();
    subscription.current = null;
    setRunning(false);
    setStatus("Konum paylaşımı durduruldu.");
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kendi konumum</Text>
      <Text style={styles.body}>Konumun özel paneline gönderilir. İlk sürümde takip yalnızca uygulama açıkken çalışır; arka plan takibi etkin değildir.</Text>
      <Text style={styles.label}>Konum paneli erişim anahtarı</Text>
      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder="En az 32 karakterlik anahtar"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={styles.input}
        editable={!running}
      />
      <Pressable style={styles.secondaryButton} onPress={saveToken} disabled={running}>
        <Text style={styles.secondaryText}>Anahtarı bu cihaza kaydet</Text>
      </Pressable>
      {!running ? (
        <Pressable style={styles.primaryButton} onPress={startTracking}>
          <Text style={styles.primaryText}>Konum paylaşımını başlat</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.stopButton} onPress={stopTracking}>
          <Text style={styles.primaryText}>Takibi durdur</Text>
        </Pressable>
      )}
      <Text style={styles.status}>{status}</Text>
      {lastUpdate ? <Text style={styles.meta}>Son gönderim: {lastUpdate}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 440, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#EEE9F5", padding: 16, marginTop: 20, gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: "#2B203B" },
  body: { fontSize: 13, lineHeight: 19, color: "#817792" },
  label: { fontSize: 12, fontWeight: "800", color: "#4D415E", marginTop: 4 },
  input: { backgroundColor: "#F8F6FB", borderColor: "#EAE5F2", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: "#2B203B" },
  primaryButton: { backgroundColor: "#6339B8", padding: 13, borderRadius: 12, alignItems: "center", marginTop: 2 },
  stopButton: { backgroundColor: "#B4233B", padding: 13, borderRadius: 12, alignItems: "center", marginTop: 2 },
  primaryText: { color: "#FFFFFF", fontWeight: "800" },
  secondaryButton: { backgroundColor: "#EEE8F8", padding: 12, borderRadius: 12, alignItems: "center" },
  secondaryText: { color: "#6339B8", fontWeight: "800" },
  status: { fontSize: 12, color: "#4D415E", marginTop: 3 },
  meta: { fontSize: 11, color: "#817792" },
});
