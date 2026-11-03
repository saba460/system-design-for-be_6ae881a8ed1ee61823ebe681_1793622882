import { AuthProvider } from "@/context/auth";
import { ThemeContext, ThemeProvider } from "@/context/themeContext";
import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { RetryLink } from "@apollo/client/link/retry";
import { ApolloProvider } from "@apollo/client/react";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { cleanupNotifications, initializeNotifications } from "@/utils/notificationService";
import * as SplashScreen from "expo-splash-screen";
import type { ReactNode } from "react";
import { Component, useContext, useEffect, useState } from "react";
import {
  AppState,
  InteractionManager,
  Platform,
  Text,
  View,
} from "react-native";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";


import useInternetCheck from "@/hooks/useInternetCheck";
import { ToastProvider } from "@/hooks/useToast";
import { useSecureStore } from "@/z-store/securestore";
import * as Application from "expo-application";
import { Provider } from "react-redux";
import { graphQLUrl } from "../libs/endpoints";
import store from "../store/store";
import Offline from "./(unprotected)/components/Offline";

import * as Updates from 'expo-updates';

console.log("Update ID:", Updates.updateId);
console.log("Runtime version:", Updates.runtimeVersion);
console.log("Channel:", Updates.channel);
console.log("Is embedded:", Updates.isEmbeddedLaunch);

import { Colors } from "@/constants/Colors";
import { DrawerContextProvider } from "@/context/drawerContext";
import * as Sentry from "@sentry/react-native";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import { vexo } from "vexo-analytics";

// Initialize Product Analytics
vexo("b3da0cf5-0cc0-4254-b3d2-d482aa3002a7");

// Initialize Sentry Monitoring Pipeline
Sentry.init({
  dsn: "https://87b4170dc19a8f901ea70c0a6a7a21f6@o4511012930715648.ingest.us.sentry.io/4511012937203712",
  sendDefaultPii: true,
  enableLogs: true,
  profilesSampleRate: Platform.OS === "android" ? 0 : 0.5,
  replaysSessionSampleRate: Platform.OS === "android" ? 0.01 : 0.05,
  replaysOnErrorSampleRate: Platform.OS === "android" ? 0.5 : 1,
  integrations: [
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
    }),
    Sentry.feedbackIntegration(),
  ],
  beforeSend(event) {


    if (event.breadcrumbs) {
      let breadcrumbsList: any[] = [];
      if (Array.isArray(event.breadcrumbs)) {
        breadcrumbsList = event.breadcrumbs;
      } else if (event.breadcrumbs && typeof event.breadcrumbs === "object") {
        const vals = (event.breadcrumbs as any).values;
        if (Array.isArray(vals)) breadcrumbsList = vals;
      }

      if (breadcrumbsList.length > 0) {
        event.breadcrumbs = breadcrumbsList.map((b: any) => ({
          ...b,
          data: undefined,
        })) as any;
      }
    }
    return event;
  },
});

SplashScreen.preventAutoHideAsync().catch((e) => {
  Sentry.captureException(e, { tags: { area: "splash-prevent-autohide" } });
});

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            backgroundColor: "#000",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "700",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              color: "#aaa",
              fontSize: 13,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            {this.state.error?.message ?? "An unexpected error occurred."}
          </Text>
          <Text
            onPress={this.handleReset}
            style={{ color: Colors.brand, fontSize: 15, fontWeight: "600" }}
          >
            Try Again
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function buildApolloClient() {
  const httpLink = new HttpLink({
    uri: graphQLUrl,
    fetchOptions: { method: "POST" },
  });

  const identityLink = new ApolloLink((operation, forward) => {
    operation.setContext(({ headers = {} }) => ({
      headers: {
        ...headers,
        "X-Client-Type": "mobile-native-app",
        "X-Platform": Platform.OS,
        "X-App-Version": Application.nativeApplicationVersion ?? "unknown",
        "X-Device-Type": "mobile",
      },
    }));

    return forward(operation);
  });

  const retryLink = new RetryLink({
    delay: { initial: 300, max: 3000, jitter: true },
    attempts: { max: 3 },
  });

  return new ApolloClient({
    link: ApolloLink.from([identityLink, retryLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            feed: {
              keyArgs: false,
              merge(existing = { items: [] }, incoming) {
                const existingItems = existing?.items ?? [];
                const incomingItems = incoming?.items ?? [];
                const mergedMap = new Map();
                existingItems.forEach((item: any) =>
                  mergedMap.set(item.id, item),
                );
                incomingItems.forEach((item: any) =>
                  mergedMap.set(item.id, item),
                );

                const allItems = Array.from(mergedMap.values());

                return {
                  ...incoming,
                  items: allItems.slice(0, 200),
                };
              },
            },
          },
        },
      },
    }),

  });
}

const apolloClient = buildApolloClient();

export const unstable_settings = {
  initialRouteName: "index",
};



// Maps root background style accurately with custom local theme status configurations
function RootBackground({ children }: { children: ReactNode }) {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const bgColor = isDark ? "#000" : "#fff";

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bgColor }}>
      {children}
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(function RootLayout() {
  const router = useRouter();
  const { isConnected } = useInternetCheck();

  const initialize = useSecureStore((state) => state.initialize);
  const token = useSecureStore((state) => state.token);
  const isSecureStoreLoading = useSecureStore((state) => state.isLoading);

  const [secureStoreTimedOut, setSecureStoreTimedOut] = useState(false);

  const [loaded, fontError] = useFonts({
    "in-m": require("../assets/fonts/in-med.ttf"),
    "in-r": require("../assets/fonts/in-reg.ttf"),
    "ms-sb": require("../assets/fonts/ms-sb.ttf"),
    "in-sb": require("../assets/fonts/in-sb.ttf"),
    "in-it": require("../assets/fonts/in-it.ttf"),
  });

  const hasToken = Boolean(token);


  useUpdateCheck();


  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      try {
        initialize();
      } catch (e) {
        Sentry.captureException(e, { tags: { area: "secure-store-init" } });
      }
    });
    return () => task.cancel();
  }, [initialize]);

  useEffect(() => {
    void initializeNotifications(router);
    return cleanupNotifications;
  }, [router]);

  


  // Safety fallback loop tracking stuck SecureStore configurations
  useEffect(() => {
    if (!isSecureStoreLoading) return;

    const timeout = setTimeout(() => {
      Sentry.captureMessage("Secure store init exceeded timeout", {
        level: "warning",
        tags: { area: "secure-store-init" },
      });
      setSecureStoreTimedOut(true);
    }, 8000);

    return () => clearTimeout(timeout);
  }, [isSecureStoreLoading]);

  useEffect(() => {
    const handleAppStateChange = (nextState: string) => {
      if (nextState === "background") {
        InteractionManager.runAfterInteractions(() => {
          Image.clearMemoryCache();
          if (Platform.OS === "android") {
            apolloClient.cache.evict({ id: "ROOT_QUERY" });
            apolloClient.cache.gc();
          }
        });
      }
    };

    const handleMemoryWarning = () => {
      Image.clearMemoryCache();
      apolloClient.cache.evict({ id: "ROOT_QUERY" });
      apolloClient.cache.gc();
      Sentry.addBreadcrumb({
        category: "memory",
        message: "Memory warning received — caches cleared",
        level: "warning",
      });
    };

    const appStateSub = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    const memWarnSub = AppState.addEventListener(
      "memoryWarning",
      handleMemoryWarning,
    );

    return () => {
      appStateSub.remove();
      memWarnSub.remove();
    };
  }, []);

  useEffect(() => {
    if (fontError)
      Sentry.captureException(fontError, { tags: { area: "font-loading" } });
  }, [fontError]);

  useEffect(() => {
    if (loaded) {
      void Asset.loadAsync([require("@/assets/images/Offline.webp")]).catch(() => {});
      SplashScreen.hideAsync().catch((e) => {
        Sentry.captureException(e, { tags: { area: "splash-hide" } });
      });
    }
  }, [loaded]);

  const secureStoreStillLoading =
    isSecureStoreLoading && token === null && !secureStoreTimedOut;
  if (!loaded || secureStoreStillLoading) return null;

  return (
    <RootErrorBoundary>
      <ThemeProvider>
        <DrawerContextProvider>

          <ToastProvider>
            <Provider store={store}>
              <AuthProvider>
                <ApolloProvider client={apolloClient}>
                  <RootBackground>
                    {!isConnected ? (
                      <Offline />
                    ) : (
                      <Stack
                        initialRouteName="index"
                        screenOptions={{
                          headerShown: false,
                          contentStyle: { backgroundColor: "transparent" },
                          animation:
                            Platform.OS === "android"
                              ? "fade_from_bottom"
                              : "default",
                        }}
                      >
                        <Stack.Screen name="index" />
                        <Stack.Screen
                          name="+not-found"
                          options={{ title: "Oops!" }}
                        />
                        <Stack.Protected guard={hasToken}>
                          <Stack.Screen
                            name="(protected)"
                            options={{ gestureEnabled: false }}
                          />
                        </Stack.Protected>
                        <Stack.Screen
                          name="onboarding"
                          options={{
                            animation: "slide_from_right",
                            gestureEnabled: false,
                          }}
                        />
                        <Stack.Screen
                          name="(unprotected)"
                          options={{ gestureEnabled: false }}
                        />
                        <Stack.Screen
                          name="privacy"
                          options={{ animation: "slide_from_bottom" }}
                        />
                        <Stack.Screen
                          name="terms"
                          options={{ animation: "slide_from_bottom" }}
                        />
                      </Stack>
                    )}
                  </RootBackground>
                </ApolloProvider>
              </AuthProvider>
            </Provider>
          </ToastProvider>
        </DrawerContextProvider>
      </ThemeProvider>

    </RootErrorBoundary>
  );
});
