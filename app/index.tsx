// import { AuthEntryScreen } from "@/components/AuthEntryScreen";
import { Redirect } from "expo-router";

export default function IndexRoute() {
  // Testing: skip login — restore AuthEntryScreen when re-enabling auth
  return <Redirect href="/(tabs)" />;
  // return <AuthEntryScreen />;
}
