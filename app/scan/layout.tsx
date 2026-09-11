import TeknisiPageShell from "@/components/TeknisiPageShell";

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeknisiPageShell>{children}</TeknisiPageShell>;
}
