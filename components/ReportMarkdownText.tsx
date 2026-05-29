import { Fragment } from "react";
import { Text } from "react-native";

function renderBoldInline(line: string) {
  const parts = line.split("**");
  return parts.map((part, idx) => (
    <Text key={`${idx}-${part.slice(0, 8)}`} style={idx % 2 === 1 ? { fontFamily: "GolosText_600SemiBold" } : undefined}>
      {part}
    </Text>
  ));
}

export function ReportMarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <Text style={{ fontFamily: "GolosText_400Regular", fontSize: 16, lineHeight: 28, color: "#1A1915" }}>
      {lines.map((line, idx) => (
        <Fragment key={`${idx}-${line.slice(0, 8)}`}>
          {renderBoldInline(line)}
          {idx < lines.length - 1 ? "\n" : ""}
        </Fragment>
      ))}
    </Text>
  );
}
