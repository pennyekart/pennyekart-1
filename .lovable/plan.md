
## What’s actually broken

The popup is not mainly failing because of the timer math. The bigger bug is state flow:

- `NotificationPopup` renders from `firstUnread`
- when the user taps `View Message`, `handleView()` immediately calls `markRead(firstUnread.id)`
- that updates notifications state in `useNotifications`
- `firstUnread` then changes to the next unread notification or becomes `null`
- because the popup content still depends on `firstUnread`, the currently opened message can disappear instantly

So the popup looks like it is “quick disappearing,” even when auto-dismiss is configured correctly.

## Fix plan

### 1. Stabilize the popup around a selected notification
Update `src/components/NotificationPopup.tsx` so it does not render directly from the live `firstUnread` value after opening.

Planned approach:
- keep a local `activeNotification` state
- when a new unread notification should be shown, copy it into `activeNotification`
- render the dialog from `activeNotification`, not `firstUnread`
- only clear `activeNotification` when the popup fully closes or when intentionally moving to the next message

This prevents the message from vanishing as soon as it gets marked as read.

### 2. Keep auto-dismiss tied to the opened message only
Retain the current intended behavior:
- initial “You have a new message” prompt should not auto-close
- timer starts only after `View Message`
- timer should use `activeNotification.auto_dismiss_seconds`, not `firstUnread`

That ensures the configured seconds work predictably.

### 3. Make close behavior consistent
While updating the popup flow:
- keep `Later` as a dismiss-only action
- keep `Close` closing the current popup cleanly
- keep link clicks marking `clicked_at` and navigating correctly
- avoid reopening the same notification during the same session because of the existing `sessionStorage` tracking

### 4. Verify admin setting alignment
`src/pages/admin/NotificationsPage.tsx` already saves:
- `auto_dismiss_seconds: Math.max(0, Number(editing.auto_dismiss_seconds) || 0)`

So no admin-page UI redesign is needed. I’ll just ensure the popup actually honors that saved value after the state fix.

## Files to update
- `src/components/NotificationPopup.tsx`

## Expected result after implementation
- popup stays visible after clicking `View Message`
- message content remains stable even after it is marked read
- auto-dismiss works only after full message opens
- `0` continues to mean “do not auto-dismiss”

## Technical note
Current root cause is a reactive dependency bug, not just a timeout bug:

```text
View Message
-> markRead()
-> notifications state updates
-> firstUnread changes
-> popup loses its source data
-> dialog appears to disappear immediately
```

Using a local snapshot (`activeNotification`) will break that chain.
