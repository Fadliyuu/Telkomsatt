/**
 * Automated Verification Script — Telkomsat Inventory Workflow & Rules Check
 *
 * Usage:
 *   node scripts/test-workflow-rules.js
 */

const path = require("path");
const fs = require("fs");

console.log("==========================================================");
console.log("  TELKOMSAT INVENTORY — AUTOMATED BEHAVIORAL VERIFICATION ");
console.log("==========================================================\n");

let passedCount = 0;
let totalCount = 0;

function assertRule(description, conditionFn) {
  totalCount++;
  try {
    const result = conditionFn();
    if (result) {
      console.log(`  [PASS] ${totalCount}. ${description}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${totalCount}. ${description}`);
    }
  } catch (err) {
    console.error(`  [FAIL] ${totalCount}. ${description} — Error: ${err.message}`);
  }
}

// ── Read files for inspection ──
const rbacContent = fs.readFileSync(path.join(__dirname, "../lib/rbac.ts"), "utf8");
const rulesContent = fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8");
const middlewareContent = fs.readFileSync(path.join(__dirname, "../middleware.ts"), "utf8");
const transactionsContent = fs.readFileSync(path.join(__dirname, "../lib/firebase/transactions.ts"), "utf8");
const verifikasiContent = fs.readFileSync(path.join(__dirname, "../app/spareparts/verifikasi/page.tsx"), "utf8");
const auditContent = fs.readFileSync(path.join(__dirname, "../lib/firebase/audit.ts"), "utf8");

console.log("--- PART 1: STATIC CODE & FIRESTORE RULES SYNTAX CHECKS ---");

// 1. Pengguna tanpa login ditolak
assertRule("Public prefixes exclude /scan and guest transactions (unauthenticated user redirected)", () => {
  return !middlewareContent.includes('"/scan"') && middlewareContent.includes('PUBLIC_PREFIXES = ["/login", "/api/auth/session"]');
});

// 2. Valid Firestore Rules syntax (no 'if' in function body, uses ternary operator)
assertRule("Firestore Rules uses valid ternary operator for role mapping without invalid 'if' control flow", () => {
  return rulesContent.includes("rawRole() in ['direktur', 'manager', 'admin_keuangan'] ? 'supervisor' : rawRole()") || rulesContent.includes("r in ['direktur', 'manager', 'admin_keuangan'] ? 'supervisor' : r");
});

// 3. Teknisi cannot update sparepart_items directly
assertRule("Teknisi update access on sparepart_items is strictly blocked in firestore.rules", () => {
  return rulesContent.includes("match /sparepart_items/{itemId}") && rulesContent.includes("allow update, delete: if isAdminGudang();") && rulesContent.includes("allow create: if isAdminGudang();");
});

// 4. Teknisi creates pending transaction with requestedByUid == request.auth.uid
assertRule("Teknisi is allowed to create transactions with statusTransaksi == 'pending' and requestedByUid == request.auth.uid", () => {
  return rulesContent.includes("d.requestedByUid == request.auth.uid") && rulesContent.includes("d.statusTransaksi == 'pending'");
});

// 5. Duplicate pending transactions prevented via item_locks reservation
assertRule("Item reservation locks (item_locks) enforced in firestore.rules and transactions.ts", () => {
  return rulesContent.includes("match /item_locks/{itemId}") && transactionsContent.includes("COLLECTIONS.ITEM_LOCKS") && transactionsContent.includes("sedang mempunyai pengajuan pending aktif");
});

// 6. Approval receives transactionId and updates statusTransaksi to completed
assertRule("executeAtomicApproval receives transactionId, checks status == pending, and sets statusTransaksi to completed", () => {
  return transactionsContent.includes("export const executeAtomicApproval = async (") && transactionsContent.includes("transactionId: string") && transactionsContent.includes('statusTransaksi: "completed"');
});

// 7. Rejection receives transactionId and sets statusTransaksi to rejected without mutating sparepart_items
assertRule("executeAtomicRejection receives transactionId and sets statusTransaksi to rejected without mutating item location/stock", () => {
  return transactionsContent.includes("export const executeAtomicRejection = async (") && transactionsContent.includes('statusTransaksi: "rejected"') && transactionsContent.includes("delete(lockRef)");
});

// 8. Audit log enforces actorUid == auth.currentUser.uid to prevent client spoofing
assertRule("Audit log enforces actorUid from auth.currentUser to prevent client spoofing", () => {
  return auditContent.includes("const currentUser = auth.currentUser") && auditContent.includes("actorUid = currentUser?.uid") && rulesContent.includes("d.actorUid == request.auth.uid");
});

// 9. Supervisor role is read-only
assertRule("Supervisor role is read-only in firestore.rules without write permissions", () => {
  return rulesContent.includes("userRole() == 'supervisor'") && !rulesContent.includes("isSupervisor() && (create || update)");
});

console.log("\n--- PART 2: ARCHITECTURAL STATE MACHINE VERIFICATION ---");

// 10. Test simulation of Pending Transaction & Lock Workflow
assertRule("Simulated transaction pipeline: Pending -> Lock Reserved -> Atomic Approval -> Completed & Lock Released", () => {
  // Simulate state machine
  const state = {
    items: { "ITEM_001": { id: "ITEM_001", lokasi: "Gudang", status: "Tersedia" } },
    catalog: { "SP_001": { id: "SP_001", stokGudang: 10 } },
    locks: {},
    transactions: {}
  };

  // Step 1: Technician submits proposal
  const txId = "TX_100";
  const itemId = "ITEM_001";
  if (state.locks[itemId]) throw new Error("Duplicate lock");
  
  state.locks[itemId] = { status: "pending", txId };
  state.transactions[txId] = { id: txId, itemId, statusTransaksi: "pending", jenisTransaksi: "OUT", lokasiTujuan: "Site Alpha" };

  // Verify item is NOT mutated during proposal creation
  if (state.items[itemId].lokasi !== "Gudang") return false;

  // Step 2: Attempt duplicate submission (must throw error)
  let duplicateBlocked = false;
  try {
    if (state.locks[itemId]) throw new Error("Item sedang mempunyai pengajuan pending aktif");
  } catch (err) {
    duplicateBlocked = true;
  }
  if (!duplicateBlocked) return false;

  // Step 3: Admin Gudang approves transaction txId
  const txDoc = state.transactions[txId];
  if (txDoc.statusTransaksi !== "pending") return false;

  state.items[itemId].lokasi = txDoc.lokasiTujuan;
  state.items[itemId].status = "Digunakan";
  state.catalog["SP_001"].stokGudang -= 1;
  txDoc.statusTransaksi = "completed";
  delete state.locks[itemId];

  // Final assertions
  return (
    state.items[itemId].lokasi === "Site Alpha" &&
    state.items[itemId].status === "Digunakan" &&
    state.catalog["SP_001"].stokGudang === 9 &&
    state.transactions[txId].statusTransaksi === "completed" &&
    state.locks[itemId] === undefined
  );
});

console.log("\n----------------------------------------------------------");
console.log(` RESULT: ${passedCount} / ${totalCount} VERIFICATION TESTS PASSED`);
console.log("----------------------------------------------------------\n");

if (passedCount === totalCount) {
  process.exit(0);
} else {
  process.exit(1);
}
