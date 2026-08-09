'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Mail,
  MessageSquareHeart,
  Phone,
  Eye,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useCoupleCMSStore } from '@/store/useCoupleCMSStore';
import { useCMSStore } from '@/store/useCMSStore';

// ---------------------------------------------------------------------------
// Icon mapping for notification types
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, React.ElementType> = {
  RSVP_RECEIVED: Mail,
  WISH_RECEIVED: MessageSquareHeart,
  CONTACT_RECEIVED: Phone,
  GUEST_OPENED: Eye,
  SYSTEM: Info,
};

const TYPE_COLORS: Record<string, string> = {
  RSVP_RECEIVED: 'text-blue-600 bg-blue-50',
  WISH_RECEIVED: 'text-rose-500 bg-rose-50',
  CONTACT_RECEIVED: 'text-amber-600 bg-amber-50',
  GUEST_OPENED: 'text-emerald-600 bg-emerald-50',
  SYSTEM: 'text-slate-500 bg-slate-50',
};

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// NotificationBell Component
// ---------------------------------------------------------------------------

export function NotificationBell({ variant = 'master' }: { variant?: 'master' | 'couple' }) {
  const {
    notifications,
    unreadCount,
    isOpen,
    loading,
    setOpen,
    setLoading,
    setNotifications,
    markRead,
    markAllRead,
    removeNotification,
    clearAll,
  } = useNotificationStore();

  const { setPage: setCouplePage } = useCoupleCMSStore();
  const { setPage: setMasterPage } = useCMSStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  // Fetch notifications on mount and poll every 30 seconds
  const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/notifications?XTransformPort=3000', { signal });
      if (res.ok) {
        const data = await res.json();
        if (!signal?.aborted) {
          setNotifications(data.notifications || [], data.unreadCount || 0);
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        // Silent — notifications are non-critical
      }
    }
  }, [setNotifications]);

  useEffect(() => {
    const controller = new AbortController();
    fetchNotifications(controller.signal);
    const interval = setInterval(() => fetchNotifications(controller.signal), 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, setOpen]);

  // Mark single as read
  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await fetch('/api/notifications?XTransformPort=3000', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      markRead(id);
    } catch {
      // Silent
    }
  }, [markRead]);

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await fetch('/api/notifications?XTransformPort=3000', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      markAllRead();
      toast({ title: 'Success', description: 'All notifications marked as read' });
    } catch {
      toast({ title: 'Error', description: 'Failed to mark all as read', variant: 'destructive' });
    } finally {
      setMarkingAll(false);
    }
  }, [markAllRead]);

  // Delete single
  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications?XTransformPort=3000&id=${id}`, {
        method: 'DELETE',
      });
      removeNotification(id);
    } catch {
      // Silent
    }
  }, [removeNotification]);

  // Clear all
  const handleClearAll = useCallback(async () => {
    setClearingAll(true);
    try {
      await fetch('/api/notifications?XTransformPort=3000&clearAll=true', {
        method: 'DELETE',
      });
      clearAll();
      toast({ title: 'Success', description: 'All notifications cleared' });
    } catch {
      toast({ title: 'Error', description: 'Failed to clear notifications', variant: 'destructive' });
    } finally {
      setClearingAll(false);
    }
  }, [clearAll]);

  // Handle notification click — navigate to relevant CMS page
  const handleNotificationClick = useCallback((notification: { id: string; isRead: boolean; link: string | null }) => {
    if (!notification.isRead) {
      handleMarkRead(notification.id);
    }
    setOpen(false);

    if (notification.link) {
      if (variant === 'couple') {
        setCouplePage(notification.link as 'overview' | 'details' | 'content' | 'schedule' | 'story' | 'faqs' | 'features' | 'images' | 'guests' | 'rsvps' | 'wishes' | 'audit' | 'sharing');
      } else {
        setMasterPage(notification.link as 'dashboard' | 'weddings' | 'users' | 'templates' | 'analytics' | 'settings');
      }
    }
  }, [variant, handleMarkRead, setOpen, setCouplePage, setMasterPage]);

  const isMasterVariant = variant === 'master';

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!isOpen)}
        className={`
          relative rounded-full p-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          ${isMasterVariant
            ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            : 'text-charcoal-ink/50 hover:bg-champagne-silk/40 hover:text-charcoal-ink'
          }
        `}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className={`
            absolute -top-0.5 -right-0.5 flex items-center justify-center
            rounded-full text-[10px] font-bold leading-none
            min-w-[18px] h-[18px] px-1
            ${isMasterVariant
              ? 'bg-red-500 text-white'
              : 'bg-cinematic-gold text-white'
            }
          `}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={`
          fixed top-[60px] right-2 left-2 sm:left-auto sm:right-4 sm:w-96 rounded-lg shadow-lg border z-50
          ${isMasterVariant
            ? 'bg-white border-slate-200'
            : 'bg-white border-champagne-silk'
          }
          animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200
        `}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
                >
                  {markingAll ? <Loader2 className="size-3 animate-spin" /> : <CheckCheck className="size-3" />}
                  <span className="ml-1 hidden sm:inline">Mark all read</span>
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={clearingAll}
                  className="h-7 px-2 text-xs text-slate-500 hover:text-red-600"
                >
                  {clearingAll ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:theme(colors.champagne-silk)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:bg-champagne-silk [&::-webkit-scrollbar-track]:bg-transparent">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-slate-300" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 mb-3">
                  <Bell className="size-5 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  {isMasterVariant
                    ? "You'll see platform activity here."
                    : "You'll see guest activity here."
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notification) => {
                  const Icon = TYPE_ICONS[notification.type] || Info;
                  const colorClass = TYPE_COLORS[notification.type] || 'text-slate-500 bg-slate-50';

                  return (
                    <div
                      key={notification.id}
                      className={`
                        group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer
                        ${!notification.isRead
                          ? 'bg-blue-50/40 hover:bg-blue-50/70'
                          : 'hover:bg-slate-50'
                        }
                      `}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Icon */}
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClass} mt-0.5`}>
                        <Icon className="size-3.5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${!notification.isRead ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {relativeTime(notification.createdAt)}
                        </p>
                      </div>

                      {/* Actions (visible on hover) */}
                      <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMarkRead(notification.id); }}
                            className="rounded p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Mark as read"
                          >
                            <Check className="size-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(notification.id); }}
                          className="rounded p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2">
              <p className="text-center text-[11px] text-slate-400">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''} · Polling every 30s
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;