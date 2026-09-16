"use client";

import { RelatedPartyTool } from "../_RelatedPartyTool";

/**
 * Харилцсан гүйлгээ — хэрэгслийн хэсэгт (Дашбоард биш) хамаарна, тиймээс
 * дашбоардын sidebar-гүй. Эрх: proxy.ts `zainii_audit_rpt` + backend @RequireTools.
 */
export default function RelatedPartyPage() {
  return <RelatedPartyTool />;
}
