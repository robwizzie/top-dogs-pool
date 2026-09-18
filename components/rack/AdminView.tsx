"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ShieldCheck, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import type { ProfileRow, RosterClaimRow, RosterPlayer } from "@/lib/rack/types";
import { AuthPanel } from "./AuthPanel";
import { useSession } from "./RackShell";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Pill,
  PoolBallLoader,
  SectionTitle,
} from "./ui";

/**
 * Approving roster claims.
 *
 * The whole security model rests on this screen being the only way an account
 * gets attached to a roster player, so it is intentionally boring: who is
 * asking, which player they say they are, what they wrote, approve or decline.
 *
 * Admin is `profiles.is_admin`, set in the Supabase dashboard. There is no
 * in-app route to granting it, on purpose — an approval flow whose approvers
 * can appoint themselves isn't one.
 */
export function AdminView() {
  const supabase = getSupabaseBrowser();
  const { user, profile, loading } = useSession();

  const [claims, setClaims] = useState<RosterClaimRow[]>([]);
  const [people, setPeople] = useState<ProfileRow[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) return;
    setWorking(true);
    const [claimRes, peopleRes] = await Promise.all([
      supabase
        .from("rack_roster_claims")
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: true }),
      // Accounts only. A guest has no login, so they can never hold a roster
      // claim and listing them here would just be noise.
      supabase.from("profiles").select("*").eq("is_guest", false),
    ]);
    setClaims((claimRes.data ?? []) as RosterClaimRow[]);
    setPeople((peopleRes.data ?? []) as ProfileRow[]);
    setWorking(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    void fetch("/api/rack/roster")
      .then((r) => (r.ok ? r.json() : { players: [] }))
      .then((json) => {
        if (active) setRoster(json.players ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function decide(claimId: string, approve: boolean) {
    if (!supabase) return;
    setBusy(claimId);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("rack_decide_roster_claim", {
        p_claim_id: claimId,
        p_approve: approve,
      });
      if (rpcError) throw rpcError;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record that.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <PoolBallLoader />;
  if (!user) return <AuthPanel />;

  if (!profile?.is_admin) {
    return (
      <EmptyState title="Admins only" icon={<ShieldCheck className="h-6 w-6" />}>
        This page approves roster links. Ask the team captain if you need access.
      </EmptyState>
    );
  }

  const nameOfPerson = (id: string) =>
    people.find((p) => p.id === id)?.name ?? "Unknown account";
  const profileOf = (id: string) => people.find((p) => p.id === id) ?? null;
  const nameOfRoster = (id: string) =>
    roster.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          action={<Pill tone="primary">{claims.length} waiting</Pill>}
        >
          Roster claims
        </SectionTitle>
        <p className="text-sm text-[hsl(var(--rack-fg-muted))]">
          Approving attaches that account to that roster player, and pulls their
          photo and skill level across. Only approve if you know it&apos;s really
          them.
        </p>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      {working ? (
        <PoolBallLoader label="Loading claims" />
      ) : claims.length === 0 ? (
        <EmptyState title="Nothing waiting" icon={<BadgeCheck className="h-6 w-6" />}>
          Roster claims show up here as people send them.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {claims.map((claim) => {
            const account = profileOf(claim.user_id);
            return (
              <Card key={claim.id}>
                <li className="list-none">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar
                      name={account?.name ?? "?"}
                      url={account?.avatar_url}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {nameOfPerson(claim.user_id)}
                      </p>
                      <p className="text-sm text-[hsl(var(--rack-fg-muted))]">
                        claims to be{" "}
                        <strong className="text-[hsl(var(--rack-fg))]">
                          {nameOfRoster(claim.apa_member_id)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {claim.note && (
                    <p className="mt-3 rounded-[var(--rack-radius)] bg-[hsl(var(--rack-bg-soft))] px-3 py-2 text-sm italic text-[hsl(var(--rack-fg-muted))]">
                      “{claim.note}”
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="primary"
                      className="flex-1"
                      disabled={busy === claim.id}
                      onClick={() => void decide(claim.id, true)}
                    >
                      <BadgeCheck className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy === claim.id}
                      onClick={() => void decide(claim.id, false)}
                    >
                      <X className="h-4 w-4" /> Decline
                    </Button>
                  </div>
                </li>
              </Card>
            );
          })}
        </ul>
      )}

      <Card>
        <SectionTitle>Linked accounts</SectionTitle>
        {people.filter((p) => p.apa_member_id).length === 0 ? (
          <p className="text-sm text-[hsl(var(--rack-fg-muted))]">Nobody yet.</p>
        ) : (
          <ul className="space-y-2">
            {people
              .filter((p) => p.apa_member_id)
              .map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={p.name} url={p.avatar_url} size={26} />
                  <span className="truncate">{p.name}</span>
                  <span className="text-[hsl(var(--rack-fg-muted))]">
                    → {nameOfRoster(p.apa_member_id!)}
                  </span>
                  {p.is_admin && <Pill tone="accent">admin</Pill>}
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
