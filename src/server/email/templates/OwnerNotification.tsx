import { Fragment } from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import type { Locale } from "@/i18n/routing";
import * as s from "./styles";

export type OwnerNotificationProps = {
  name: string;
  email: string;
  company: string | null;
  body: string;
  locale: Locale;
  receivedAt: Date;
  inboxUrl: string;
};

const LANGUAGE: Record<Locale, string> = { en: "English", ro: "Română" };

/** New-message mail for the owner (English, like the admin). */
export function OwnerNotification(props: OwnerNotificationProps) {
  const rows = [
    ["Name", props.name],
    ["Email", props.email],
    ["Company", props.company ?? "—"],
    ["Language", LANGUAGE[props.locale]],
    ["Received", `${props.receivedAt.toISOString().slice(0, 16)} UTC`],
  ] as const;

  return (
    <Html lang="en">
      <Head />
      <Preview>{props.body.slice(0, 120)}</Preview>
      <Body lang="en" style={s.body}>
        <Container style={s.container}>
          <Heading as="h1" style={s.heading}>
            New message from the CV site
          </Heading>
          {rows.map(([label, value]) => (
            <Section key={label}>
              <Text style={s.label}>{label}</Text>
              <Text style={s.text}>{value}</Text>
            </Section>
          ))}
          <Hr />
          <Text style={s.text}>
            {props.body.split(/\r?\n/).map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity and never reorder.
              <Fragment key={index}>
                {index > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </Text>
          <Hr />
          <Text style={s.text}>
            <Link href={props.inboxUrl} style={s.link}>
              Open in the admin inbox
            </Link>
          </Text>
          <Text style={s.muted}>
            Reply to this email to answer {props.name} directly.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
