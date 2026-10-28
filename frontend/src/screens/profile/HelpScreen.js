import React from 'react';
import { AppCard, AppHeader, AppScreen, AppText, DemoModeBadge } from '../../components/ui';

const answers = [
  ['Does NamPay move real money?', 'No. NamPay demonstrates a QR payment flow using test accounts and test instruments. No real funds move and no bank settlement occurs.'],
  ['How do I try a payment?', 'Use two demo accounts. One creates a QR request. The other scans or imports its image, reviews the amount and recipient, chooses an eligible test instrument and completes server verification.'],
  ['What if my request expires?', 'Ask the recipient to create a new QR request. Expired, cancelled, completed or altered codes cannot authorize another payment.'],
  ['Why is a payment still being checked?', 'The connection may have dropped after submission. Use Check status and let NamPay reconcile the server record. Do not start another payment to resolve an uncertain result.'],
  ['Where does the demo verification code come from?', 'In a local demonstration, the operator provides the code through a private test outbox. This does not send a real SMS or verify a real phone number. Never send your password or verification code to someone claiming to be support.'],
  ['Can I change my email or phone?', 'Contact changes need ownership verification. That delivery service is unavailable in this demo, so these fields are read-only. You can update your name and profile photo.'],
  ['The camera or biometric prompt is unavailable.', 'Import a saved QR image if camera access is unavailable. Optional device confirmation requires compatible hardware and enrolled biometrics. Server verification is always required for a simulated payment.'],
  ['How do I get help?', 'Contact the person running your demo environment. Share only the request or transaction reference needed to investigate. Do not share passwords, recovery codes, full card details or private account screenshots.'],
];

export default function HelpScreen({ navigation }) {
  return <AppScreen contentStyle={{ maxWidth: 760, gap: 18 }}><AppHeader title="Help and FAQ" kicker="A LITTLE GUIDANCE" subtitle="Clear answers for your demonstration." onBack={() => navigation.goBack()} /><DemoModeBadge />
    {answers.map(([question, answer]) => <AppCard key={question} style={{ gap: 10 }}><AppText variant="h3" accessibilityRole="header">{question}</AppText><AppText color="textSecondary">{answer}</AppText></AppCard>)}
  </AppScreen>;
}
