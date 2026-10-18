# Complainify Firestore Query Console

This optional admin-only JavaScript console reads and writes the same Cloud Firestore project configured in `js/firebase.js`. It does not replace Firebase Authentication or Firestore.

## Run it
1. Serve the project through a local web server (ES modules do not work reliably from `file://`).
2. Open `admin.html` and sign in with an account whose `users/{uid}` profile has `role: "admin"`.
3. Open browser DevTools → Console.
4. Run `await complainifyQuery.help()`.

## Read/query commands
```js
await complainifyQuery.verify()
await complainifyQuery.select({})
await complainifyQuery.select({ status: "Pending" })
await complainifyQuery.select({ priority: "High" })
await complainifyQuery.select({ status: "Pending", priority: "Low" })
await complainifyQuery.get("ACTUAL_DOCUMENT_ID")
await complainifyQuery.count({ status: "Resolved" })
await complainifyQuery.statusSummary()
```

## Write commands (these change the actual Firestore database)
```js
// CREATE: creates a new complaint; copy the returned id for later tests.
await complainifyQuery.insert({ title: "QC TEST - create", category: "Other", priority: "Low", description: "Temporary query-console test; safe to delete." })

// UPDATE: replace ACTUAL_DOCUMENT_ID with the ID returned by insert() or select().
await complainifyQuery.update("ACTUAL_DOCUMENT_ID", { status: "In Progress" })

// TRANSACTION: one atomic update; use an actual ID.
await complainifyQuery.transactionUpdate("ACTUAL_DOCUMENT_ID", { status: "Resolved" })

// BATCH: atomically updates several existing docs; use real IDs, not placeholders.
await complainifyQuery.batchUpdate(["REAL_ID_1", "REAL_ID_2"], { priority: "Medium" })

// DELETE: permanently deletes one document after a browser confirmation.
await complainifyQuery.delete("ACTUAL_DOCUMENT_ID")
```

After successful insert/update/transaction/batch/delete, the current admin dashboard receives a refresh event and reloads records/statistics. Verify the mutation in Firestore Console as well. Other already-open pages may need refreshing if they do not subscribe to live Firestore updates.

## DDL / DCL / TCL clarification
Firestore is a NoSQL document database, not a SQL server. It does not accept SQL `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `GRANT`, `COMMIT`, or `ROLLBACK` statements. The wrappers above demonstrate the concepts without pretending SQL syntax is supported:

- DML-like: `select`, `get`, `count`, `insert`, `update`, `delete`.
- DDL-like: Firestore collections are created implicitly when the first document is written; indexes and schema design are managed in Firebase Console, not through SQL DDL.
- DCL/security: Firebase Authentication, Firestore Security Rules, and IAM manage access. This browser console does not change rules or grant permissions.
- TCL/atomicity: `transactionUpdate` uses a Firestore transaction; `batchUpdate` uses a Firestore write batch. They commit through the SDK; there are no SQL `BEGIN`, `COMMIT`, or `ROLLBACK` commands here.

## Safety and limits
- The module checks that the signed-in user has `role: "admin"` in `users/{uid}`. Firestore Security Rules remain the real security boundary.
- `insert()` creates a complaint under the signed-in admin UID. Use only temporary test data.
- `delete()` permanently deletes the selected record after confirmation. Delete only the test document you created.
- Composite indexes may be required for some combinations of filters/order; follow the index-creation link shown by Firebase if a query requires one.
- Do not loosen security rules just to make a demo work.
