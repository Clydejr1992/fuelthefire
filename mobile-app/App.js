import React from "react";
import { ActivityIndicator, Linking, Platform, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

const APP_URL = "https://fuelthefire.site/";

export default function App() {
  const [loadError, setLoadError] = React.useState(false);
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" backgroundColor="#123b32" />
      {loadError ? (
        <View style={styles.error}>
          <Text style={styles.title}>Fuel the Fire</Text>
          <Text style={styles.message}>We couldn't connect. Check your internet connection and try again.</Text>
          <Text accessibilityRole="link" style={styles.link} onPress={() => { setLoadError(false); }}>
            Try again
          </Text>
          <Text accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL(APP_URL)}>
            Open Fuel the Fire in your browser
          </Text>
        </View>
      ) : (
        <WebView
          source={{ uri: APP_URL }}
          style={styles.web}
          onError={() => setLoadError(true)}
          onHttpError={(event) => { if (event.nativeEvent.statusCode >= 500) setLoadError(true); }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#f2a900" />
              <Text style={styles.loadingText}>Loading Fuel the Fire…</Text>
            </View>
          )}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          originWhitelist={["https://*"]}
          onShouldStartLoadWithRequest={(request) => request.url.startsWith("https://fuelthefire.site") || request.url.startsWith("https://") }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#123b32", paddingTop: Platform.OS === "android" ? 0 : 0 },
  web: { flex: 1, backgroundColor: "#f7f8f5" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#123b32", gap: 12 },
  loadingText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { flex: 1, backgroundColor: "#123b32", alignItems: "center", justifyContent: "center", padding: 28, gap: 16 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  message: { color: "#e3eee9", textAlign: "center", fontSize: 16, lineHeight: 24 },
  link: { color: "#ffd166", fontWeight: "700", fontSize: 16, padding: 10 }
});
