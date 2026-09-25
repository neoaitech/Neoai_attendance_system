// ===================================================================
// Test Suite: Predictive Pre-Loading & SWR In-Memory Cache
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Mock Browser Environment
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

global.window = {
  location: { hostname: 'localhost', protocol: 'http:' }
};

let fetchCallCount = 0;
let lastFetchedUrl = '';
let fetchDelayMs = 20;

global.fetch = async (url, options = {}) => {
  fetchCallCount++;
  lastFetchedUrl = url;
  
  if (fetchDelayMs > 0) {
    await new Promise(r => setTimeout(r, fetchDelayMs));
  }

  return {
    ok: true,
    status: 200,
    headers: {
      get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : '')
    },
    json: async () => ({
      success: true,
      url: url,
      method: options.method || 'GET',
      timestamp: Date.now()
    })
  };
};

// 2. Load API.js
const apiCode = fs.readFileSync(path.join(__dirname, '../frontend/js/api.js'), 'utf8');
eval(apiCode);
const API = window.API;
global.API = window.API;

async function runTests() {
  console.log("=================================================");
  console.log("   TESTING PREDICTIVE SWR CACHE & ENGINE");
  console.log("=================================================");

  // Set fake auth token so prefetch runs
  API.setToken("fake_test_jwt_token");

  // TEST 1: Initial cold fetch
  console.log("\n[Test 1] Cold fetch fills cache...");
  fetchCallCount = 0;
  const res1 = await API.get("/analytics/dashboard");
  assert.strictEqual(fetchCallCount, 1, "Should have made 1 fetch call");
  assert.strictEqual(API.hasValidCache("/analytics/dashboard"), true, "Cache should now be valid");
  console.log("✅ Passed: Cold fetch retrieved and stored in cache.");

  // TEST 2: Instant 0ms cache hit
  console.log("\n[Test 2] Warm cache returns instant hit without network call...");
  const countBefore = fetchCallCount;
  const startT = Date.now();
  const res2 = await API.get("/analytics/dashboard");
  const elapsed = Date.now() - startT;
  assert.strictEqual(fetchCallCount, countBefore, "Should NOT have made a new fetch call");
  assert.deepStrictEqual(res1, res2, "Data returned must match cached data");
  assert.ok(elapsed < 10, `Elapsed time must be ~0ms, got ${elapsed}ms`);
  console.log(`✅ Passed: Instant cache hit returned in ${elapsed}ms!`);

  // TEST 3: In-flight request de-duplication
  console.log("\n[Test 3] Concurrent prefetch + click de-duplication...");
  fetchCallCount = 0;
  API.invalidateCache("/classes");
  
  // Fire 3 simultaneous requests (simulating hover + 2 quick clicks)
  const [p1, p2, p3] = await Promise.all([
    API.prefetch("/classes"),
    API.get("/classes"),
    API.get("/classes")
  ]);
  assert.strictEqual(fetchCallCount, 1, "Only 1 HTTP fetch must be made for concurrent requests");
  assert.strictEqual(API.hasValidCache("/classes"), true, "Classes should be cached");
  console.log("✅ Passed: Concurrent requests de-duplicated to exactly 1 network call.");

  // TEST 4: Mutation auto-invalidation on POST /students
  console.log("\n[Test 4] Mutation auto-invalidation on POST /students...");
  await API.prefetch("/students");
  assert.strictEqual(API.hasValidCache("/students"), true, "/students should be warm in cache");
  
  // Now student is registered / modified
  await API.post("/students/register-with-photo", { name: "Test Student" });
  assert.strictEqual(API.hasValidCache("/students"), false, "/students must be invalidated after POST");
  assert.strictEqual(API.hasValidCache("/analytics/dashboard"), false, "Analytics must be invalidated after student POST");
  console.log("✅ Passed: Mutation auto-invalidated /students and /analytics cache tags.");

  // TEST 5: Mutation auto-invalidation on attendance sessions
  console.log("\n[Test 5] Mutation auto-invalidation on attendance sessions...");
  await API.get("/sessions");
  assert.strictEqual(API.hasValidCache("/sessions"), true, "/sessions should be cached");
  
  await API.post("/sessions/create-and-process", {});
  assert.strictEqual(API.hasValidCache("/sessions"), false, "/sessions must be invalidated");
  console.log("✅ Passed: Attendance session mutation invalidated session cache.");

  // TEST 6: Explicit fresh bypass
  console.log("\n[Test 6] Explicit fresh bypass (manual refresh button)...");
  await API.get("/academic/metadata");
  assert.strictEqual(API.hasValidCache("/academic/metadata"), true);
  
  const countBeforeFresh = fetchCallCount;
  await API.get("/academic/metadata", { fresh: true });
  assert.strictEqual(fetchCallCount, countBeforeFresh + 1, "fresh: true must bypass cache and fetch live");
  console.log("✅ Passed: fresh: true forces live network fetch.");

  // TEST 7: Clear cache on logout
  console.log("\n[Test 7] Cache reset on user logout...");
  API.clearCache();
  assert.strictEqual(API.cache.size, 0, "Cache size must be 0 after clearCache()");
  console.log("✅ Passed: Cache reset completely on logout.");

  console.log("\n=================================================");
  console.log("   ALL PREDICTIVE CACHE TESTS PASSED (7/7)!");
  console.log("=================================================");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
