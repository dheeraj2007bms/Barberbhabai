# Security Specification for TrimTime

## 1. Data Invariants
- A `User` can only modify their own profile.
- A `BarberProfile` can only be modified by the user who owns it (matched by `userId`).
- A `Booking` can only be created by an authenticated user as the `customerId`.
- A `Booking` can be read by the `customerId` or the `barberId`.
- A `QueueEntry` can be joined by anyone (authenticated), but managed by the `barberId`.
- `createdAt` and `ownerId` (or similar) are immutable.
- `role` must be protected from self-assignment if possible, but for this app, we'll assume a basic signup chooses a role. (In a stricter app, RBAC would be handled by an admin).

## 2. The "Dirty Dozen" Payloads (To be rejected)
1. Creating a user profile for someone else's ID.
2. Updating `role` to 'admin' as a regular user.
3. Creating a booking where `customerId` != `request.auth.uid`.
4. Updating a booking's `totalPrice` after it was confirmed.
5. Deleting someone else's booking.
6. Injecting a 1MB string into `serviceName`.
7. Joining a queue with a negative `position`.
8. Updating a `QueueEntry` status to 'completed' when the user is not the barber.
9. Modifying `createdAt` during an update.
10. Creating a document with a 2KB long ID string.
11. Reading the `/users` collection without specifying an ID (list scraping).
12. Updating a booking where `barberId` was changed.

## 3. Test Runner (Draft rules first)
I will now draft the `firestore.rules` and then run ESLint.
