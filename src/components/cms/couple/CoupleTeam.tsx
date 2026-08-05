'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  UserPlus,
  Trash2,
  Mail,
  Loader2,
  Shield,
  Pencil,
  Eye,
  Users as UsersIcon,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useCoupleCMSStore } from '@/store/useCoupleCMSStore';
import { useSession } from 'next-auth/react';

interface Member {
  id: string;
  userId: string;
  role: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  COUPLE: 'Owner',
  CONSULTANT_1: 'Senior Consultant',
  CONSULTANT_2: 'Junior Consultant',
  COORDINATOR: 'Coordinator',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  EDITOR: 'Can edit content and upload media. Cannot manage guests, RSVPs, or settings.',
  VIEWER: 'Read-only access to the dashboard and analytics. Cannot make any changes.',
};

function getRoleIcon(role: string) {
  switch (role) {
    case 'COUPLE':
      return <Shield className="size-3.5 text-cinematic-gold" />;
    case 'CONSULTANT_1':
      return <Shield className="size-3.5 text-charcoal-ink/60" />;
    case 'EDITOR':
      return <Pencil className="size-3.5 text-charcoal-ink/60" />;
    case 'VIEWER':
      return <Eye className="size-3.5 text-charcoal-ink/60" />;
    default:
      return <UsersIcon className="size-3.5 text-charcoal-ink/60" />;
  }
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'COUPLE':
      return 'bg-cinematic-gold/15 text-cinematic-gold border-cinematic-gold/30';
    case 'CONSULTANT_1':
    case 'CONSULTANT_2':
      return 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20';
    case 'EDITOR':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'VIEWER':
      return 'bg-gray-50 text-gray-600 border-gray-200';
    default:
      return 'bg-charcoal-ink/5 text-charcoal-ink/60 border-charcoal-ink/10';
  }
}

export default function CoupleTeam() {
  const { weddingId } = useCoupleCMSStore();
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Invite form state
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');

  const fetchMembers = useCallback(async () => {
    if (!weddingId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/cms/tenants/${weddingId}/members?XTransformPort=3000`);
      if (!res.ok) {
        throw new Error('Failed to load team members');
      }
      const data = await res.json();
      setMembers(data.data || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load team members', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [weddingId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weddingId) return;
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    try {
      setInviting(true);
      const res = await fetch(`/api/cms/tenants/${weddingId}/members?XTransformPort=3000`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          name: inviteName.trim(),
          role: inviteRole,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to invite member');
      }

      toast({
        title: 'Member invited',
        description: `${inviteName} has been added as ${ROLE_LABELS[inviteRole]}.`,
      });

      setInviteName('');
      setInviteEmail('');
      setInviteRole('EDITOR');
      setInviteOpen(false);
      fetchMembers();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to invite member',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!weddingId) return;
    if (!confirm(`Remove ${memberName} from this wedding? They will lose access immediately.`)) return;

    try {
      const res = await fetch(`/api/cms/tenants/${weddingId}/members?memberId=${memberId}&XTransformPort=3000`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to remove member');
      }

      toast({ title: 'Member removed', description: `${memberName} no longer has access.` });
      fetchMembers();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const canManage = members.some(
    (m) => m.userId === session?.user?.id && (m.role === 'COUPLE' || m.role === 'CONSULTANT_1' || m.role === 'SUPER_ADMIN_1' || m.role === 'SUPER_ADMIN_2')
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-cinematic-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-charcoal-ink" style={{ fontFamily: "'Playfair Display', serif" }}>
            Team Members
          </h2>
          <p className="text-sm text-charcoal-ink/50 mt-1">
            Invite editors and viewers to help manage your wedding website.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90"
          >
            <UserPlus className="size-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Members list */}
      <div className="space-y-3">
        {members.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UsersIcon className="size-10 text-charcoal-ink/20 mx-auto mb-3" />
              <p className="text-sm text-charcoal-ink/50">No team members yet.</p>
              {canManage && (
                <p className="text-xs text-charcoal-ink/30 mt-1">
                  Click &ldquo;Invite Member&rdquo; to add an editor or viewer.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          members.map((member) => (
            <Card key={member.id}>
              <CardContent className="flex flex-wrap items-center justify-between py-4 gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-ink/5 text-sm font-medium text-charcoal-ink/60">
                    {member.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  {/* Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-charcoal-ink">{member.name}</p>
                      {member.userId === session?.user?.id && (
                        <span className="text-xs text-charcoal-ink/40">(You)</span>
                      )}
                    </div>
                    <p className="text-xs text-charcoal-ink/50 flex items-center gap-1 mt-0.5 truncate">
                      <Mail className="size-3 shrink-0" />
                      {member.email}
                    </p>
                  </div>
                </div>
                {/* Role + Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className={`text-xs ${getRoleBadgeClass(member.role)}`}>
                    {getRoleIcon(member.role)}
                    <span className="ml-1">{ROLE_LABELS[member.role] || member.role}</span>
                  </Badge>
                  {canManage && member.role !== 'COUPLE' && member.userId !== session?.user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member.id, member.name)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Help text */}
      {canManage && (
        <div className="bg-cinematic-gold/5 border border-cinematic-gold/20 rounded-lg p-4">
          <p className="text-xs text-charcoal-ink/60 leading-relaxed">
            <strong>Role permissions:</strong>
            <br />
            <strong>Editor</strong> — Can edit content and upload media. Cannot manage guests, RSVPs, or settings.
            <br />
            <strong>Viewer</strong> — Read-only access to the dashboard and analytics. Cannot make any changes.
          </p>
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Invite someone to help manage your wedding website. They&apos;ll receive a login via email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name" className="text-xs uppercase tracking-wider text-charcoal-ink/50">
                Full Name
              </Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Jane Doe"
                required
                disabled={inviting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs uppercase tracking-wider text-charcoal-ink/50">
                Email Address
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                disabled={inviting}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as 'EDITOR' | 'VIEWER')}
                disabled={inviting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR">Editor — Can edit content &amp; media</SelectItem>
                  <SelectItem value="VIEWER">Viewer — Read-only access</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-charcoal-ink/40 mt-1">{ROLE_DESCRIPTIONS[inviteRole]}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}>
                {inviting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Inviting...
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4 mr-2" />
                    Invite
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
