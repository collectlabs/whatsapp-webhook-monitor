import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WhatsApp Webhook Monitor',
  description: 'Monitor de webhooks do WhatsApp Cloud API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
