import { ScrollView, type ScrollViewProps } from "react-native";

/** Native ScrollView — on web see TouchScrollView.web.tsx (real overflow scroll). */
export function TouchScrollView(props: ScrollViewProps) {
  return <ScrollView {...props} />;
}
