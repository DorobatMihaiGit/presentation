import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "react-email";
import type { Locale } from "@/i18n/routing";
import * as s from "./styles";

export type AutoReplyProps = {
  locale: Locale;
  ownerName: string;
  siteUrl: string;
};

// Deliberately generic: the auto-reply never repeats what the visitor typed
// (name, company, message), so a form submitted with someone else's address
// cannot be used to relay spam to them.
export const AUTO_REPLY_COPY = {
  en: {
    subject: "Thanks for your message",
    greeting: "Hello,",
    body: "Thanks for getting in touch. Your message reached me, and I reply to every message within two working days.",
    automatic:
      "This is an automatic confirmation, so there is no need to answer it.",
  },
  ro: {
    subject: "Mulțumesc pentru mesaj",
    greeting: "Bună,",
    body: "Îți mulțumesc că mi-ai scris. Mesajul tău a ajuns la mine și răspund fiecărui mesaj în două zile lucrătoare.",
    automatic:
      "Acesta este un mesaj automat de confirmare; nu e nevoie să îi răspunzi.",
  },
} satisfies Record<Locale, Record<string, string>>;

/** Confirmation sent to the visitor in the language of the page they used. */
export function AutoReply({ locale, ownerName, siteUrl }: AutoReplyProps) {
  const copy = AUTO_REPLY_COPY[locale];
  const pageUrl = `${siteUrl}/${locale}`;

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy.body}</Preview>
      <Body lang={locale} style={s.body}>
        <Container style={s.container}>
          <Heading as="h1" style={s.heading}>
            {copy.subject}
          </Heading>
          <Text style={s.text}>{copy.greeting}</Text>
          <Text style={s.text}>{copy.body}</Text>
          <Text style={s.text}>{ownerName}</Text>
          <Text style={s.muted}>
            {copy.automatic}{" "}
            <Link href={pageUrl} style={s.link}>
              {pageUrl}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
