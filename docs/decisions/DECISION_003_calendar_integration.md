DECISION #3 — Calendar Integration: CalDAV (tsdav) vs Google Calendar API
Status: RESOLVED — Option 3 (Google Calendar API now, abstract behind interface, add CalDAV later)

Context: The blueprint chose CalDAV via tsdav for calendar-agnostic integration. But all 3 pilot clients will likely use Google Calendar. The tsdav library has documented reliability issues with Google Calendar (409 conflicts, timezone bugs, 30s+ availability checks). Google Calendar API is battle-tested, has a first-party Node.js client, and handles the exact booking use case with FreeBusy queries. CalDAV abstraction buys optionality you may never need at the cost of reliability risk on day one.

Options:
  1. CalDAV via tsdav — Works with Google, Outlook, Apple Calendar. Vendor-agnostic. | Tradeoff: Known bugs with Google Calendar specifically (the only provider you need today). tsdav is a single-maintainer library with 238+ open issues. Double-booking risk if sync fails silently.
  2. Google Calendar API directly — First-party googleapis Node.js SDK, FreeBusy endpoint for availability, atomic event creation, push notifications for changes. | Tradeoff: Locked to Google Calendar. If a client uses Outlook, you build a second integration. But that is a problem for client #10, not client #1-3.
  3. Google Calendar API now, add CalDAV adapter later — Start with the reliable path for known clients. Abstract the calendar interface so a CalDAV or Microsoft Graph adapter can slot in later. | Tradeoff: 20 min extra to define the interface, but you ship with the most reliable integration for your actual users.

Architect recommendation: Option 1 (CalDAV)
Vendor-agnostic from day one.

Devil's Advocate recommendation: Option 2 or 3 (Google Calendar API)
Your 3 pilot clients use Google Calendar. Ship the thing that works reliably for them. A double-booked appointment at 11pm with no one to fix it is a churned client. Define a CalendarProvider interface and swap in CalDAV when a real Outlook client shows up.

Your call (reply with a number):
