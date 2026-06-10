function mdToHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!<strong>)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .split("\n").map(line => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return `<li>${trimmed.slice(2)}</li>`;
      }
      return `<p>${trimmed}</p>`;
    }).join("\n").replace(/(<li>.*?<\/li>\n?)+/g, "<ul>$&</ul>");
}

interface MarkdownTextProps {
  text: string;
  className?: string;
}

export default function MarkdownText({ text, className }: MarkdownTextProps) {
  return (
    <div className={`${className || ""} dark:text-dark-text`} dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />
  );
}
