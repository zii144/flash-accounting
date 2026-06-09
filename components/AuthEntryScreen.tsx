import { GlassContainer } from "@/components/GlassContainer";
import { SymbolIcon } from "@/components/symbol-icon";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useProviderAuth } from "@/hooks/useProviderAuth";
import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const LOGIN_SPLASH_VIDEO = require("../assets/videos/login-spash.mp4");

type ExpoVideoModule = typeof import("expo-video");

function getOptionalExpoVideo(): ExpoVideoModule | null {
  try {
    // Keep this guarded so older dev clients without ExpoVideo do not crash at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-video") as ExpoVideoModule;
  } catch {
    return null;
  }
}

const expoVideo = getOptionalExpoVideo();

function LoginSplashVideo() {
  if (!expoVideo) {
    return (
      <View style={styles.videoFallback}>
        <SymbolIcon name="accounting" size={30} color="rgba(142, 142, 147, 0.9)" />
      </View>
    );
  }

  const loginVideoPlayer = expoVideo.useVideoPlayer(LOGIN_SPLASH_VIDEO, (player) => {
    player.loop = true;
    player.muted = true;
    player.keepScreenOnWhilePlaying = false;
    player.play();
  });

  return (
    <expoVideo.VideoView
      player={loginVideoPlayer}
      nativeControls={false}
      contentFit="cover"
      allowsPictureInPicture={false}
      playsInline
      requiresLinearPlayback
      useExoShutter={false}
      style={styles.video}
    />
  );
}

export function AuthEntryScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isAuthReady, isFirebaseReady, isSignedIn } = useAuth();
  const {
    canUseAppleAuth,
    handleSignInApple,
    handleSignInFacebook,
    handleSignInGoogle,
    isAuthBusy,
  } = useProviderAuth();

  if (isAuthReady && isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LoginSplashVideo />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.outer}
        >
          <View style={styles.spacer} />

          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={[styles.appTitle, { color: theme.text }]}>{t("flashAccounting")}</Text>
              <View style={[styles.headerIcon, { borderColor: theme.border }]}>
                <SymbolIcon name="person-circle" size={22} color={theme.text} />
              </View>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{t("authGateTitle")}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t("authGateSubtitle")}
            </Text>
          </View>

          <View style={styles.content}>
            <GlassContainer intensity="medium" style={styles.listCard}>
              {!isAuthReady ? (
                <View style={styles.loadingBlock}>
                  <ActivityIndicator color={theme.text} />
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                    {t("loading")}
                  </Text>
                </View>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.providerRow,
                      {
                        borderBottomColor: theme.border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                      pressed && !isAuthBusy && styles.pressed,
                      isAuthBusy && styles.disabled,
                    ]}
                    onPress={handleSignInGoogle}
                    disabled={isAuthBusy}
                  >
                    <View style={styles.providerLeft}>
                      <SymbolIcon name="person-circle" size={22} color={theme.text} />
                      <Text style={[styles.providerText, { color: theme.text }]}>
                        {t("authContinueGoogle")}
                      </Text>
                    </View>
                    <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.providerRow,
                      {
                        borderBottomColor: theme.border,
                        borderBottomWidth: canUseAppleAuth ? StyleSheet.hairlineWidth : 0,
                      },
                      pressed && !isAuthBusy && styles.pressed,
                      isAuthBusy && styles.disabled,
                    ]}
                    onPress={handleSignInFacebook}
                    disabled={isAuthBusy}
                  >
                    <View style={styles.providerLeft}>
                      <SymbolIcon name="person-circle" size={22} color={theme.text} />
                      <Text style={[styles.providerText, { color: theme.text }]}>
                        {t("authContinueFacebook")}
                      </Text>
                    </View>
                    <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                  </Pressable>

                  {canUseAppleAuth ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.providerRow,
                        pressed && !isAuthBusy && styles.pressed,
                        isAuthBusy && styles.disabled,
                      ]}
                      onPress={handleSignInApple}
                      disabled={isAuthBusy}
                    >
                      <View style={styles.providerLeft}>
                        <SymbolIcon name="apple-logo" size={22} color={theme.text} />
                        <Text style={[styles.providerText, { color: theme.text }]}>
                          {t("authContinueApple")}
                        </Text>
                      </View>
                      <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
                    </Pressable>
                  ) : null}
                </>
              )}
            </GlassContainer>

            <GlassContainer intensity="light" style={styles.noteCard}>
              <Text style={[styles.footnote, { color: theme.textSecondary }]}>
                {isFirebaseReady ? t("authGateFootnote") : t("authGateUnavailable")}
              </Text>
              <Text style={[styles.bottomText, { color: theme.textSecondary }]}>
                {Platform.OS === "ios" ? t("authGateBottomApple") : t("authGateBottom")}
              </Text>
            </GlassContainer>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  outer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  spacer: {
    flexGrow: 1,
    minHeight: 170,
  },
  header: {
    paddingBottom: 18,
    gap: 8,
  },
  headerTop: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  appTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  content: {
    gap: 16,
  },
  video: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  videoFallback: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(142, 142, 147, 0.12)",
  },
  listCard: {
    borderRadius: 24,
    overflow: "hidden",
  },
  loadingBlock: {
    minHeight: 192,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  providerRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  providerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  providerText: {
    fontSize: 17,
    fontWeight: "500",
  },
  noteCard: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 20,
  },
  bottomText: {
    fontSize: 13,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.74,
  },
  disabled: {
    opacity: 0.45,
  },
});
