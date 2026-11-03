import { checkExpiry } from "@/constants/checkExpiry";
import {
  clearToken,
  getTokenAsync,
  getTokenSync,
} from "@/constants/storeConfigsZ";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { jwtDecode } from "jwt-decode";
import { MotiImage } from "moti";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, View } from "react-native";

export default function HomeRoute() {
  const [target, setTarget] = useState<string | null>(null);
  const { width } = Dimensions.get("screen");

  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const decide = async () => {
      try {
        await getTokenAsync();
        const token = getTokenSync()?.toString();

        const firstTimeUser = await AsyncStorage.getItem("isFirstTimeUser");
        if (firstTimeUser === null || firstTimeUser !== "false") {
          setTarget("/onboarding");
          return;
        }

        if (!token) {
          setTarget("/(unprotected)/signin");
          return;
        }

        if (token.split(".").length !== 3) {
          await clearToken();
          setTarget("/(unprotected)/signin");
          return;
        }

        const hasAccess = await checkExpiry(token);

        if (!hasAccess) {
          await clearToken();
          setTarget("/(unprotected)/signin");
          return;
        }

        let decoded: any;

        try {
          decoded = jwtDecode(token);
        } catch {
          await clearToken();
          setTarget("/(unprotected)/signin");
          return;
        }

        const isOnboard =
          (await AsyncStorage.getItem("isOnboard")) ??
          String(decoded?.isOnboard ?? "false");

        await AsyncStorage.setItem("isOnboard", isOnboard);

        const targetRoute =
          token && isOnboard === "true"
            ? "/dashboard_new/home"
            : token && isOnboard !== "true"
              ? "/setup/welcome"
              : "/(unprotected)/signin";

        redirectTimerRef.current = setTimeout(() => {
          setTarget(targetRoute);
        }, 1000);
      } catch (err) {
        console.warn("Home route decide error:", err);
        setTarget("/(unprotected)/signin");
      }
    };

    const timer = setTimeout(() => {
      decide();
    }, 1500);

    return () => {
      clearTimeout(timer);

      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  if (target) {
    return <Redirect href={target as any} />;
  }

  const logoW = width * 0.35;
  const logoH = logoW * 0.5;

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#ffffff",
      }}
    >

      <MotiImage
        source={require("../assets/images/splash-dark.png")}
        from={{ translateX: 0, height: 100, opacity: 1 }}
        animate={{
          translateX: 40,
          height: logoH - 25,
          marginTop: 12,
          opacity: 0,
        }}
        transition={{ type: "timing", duration: 300, delay: 500 }}
        style={{
          width: logoW,
          height: logoH,
          resizeMode: "contain",
        }}
      />

      <MotiImage
        source={require("../assets/images/logo.webp")}
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 700, delay: 700 }}
        style={{
          width: 220,
          height: 150,
          resizeMode: "contain",
          position: "absolute",
        }}
      />
    </View>
  );
}