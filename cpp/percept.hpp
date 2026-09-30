// percept.hpp — header-only C++17 port of the delta-shape percept core.
// Integer-exact mirror of SuperInstance/delta-shape @ e2ad00d5 (core/VENDORED-FROM).
// JS semantics pinned under test/plugs.pins.mjs (P9 goldens + P11 differential fuzz):
//   - `|0` (ToInt32, truncating)      -> int32_t via uint32_t narrowing
//   - x/0 -> Inf|0 = 0                -> explicit s==0 guard, mag=0
//   - floorLog2 = 31 - clz32          -> portable bit loop (same result, int32 range)
//   - BigInt cross-multiplication     -> __int128 (documented range: |x| < 2^62)
// No floats anywhere. No dependencies.

#pragma once
#include <cstdint>
#include <vector>
#include <string>
#include <algorithm>

namespace percept {

inline int32_t toInt32(int64_t x) {  // JS ToInt32: mod 2^32, interpret signed
  return static_cast<int32_t>(static_cast<uint32_t>(static_cast<uint64_t>(x)));
}

inline int floor_log2_i32(int32_t n) {  // JS 31 - Math.clz32(n); null for n<=0
  if (n <= 0) return -1;
  int r = 0;
  for (uint32_t m = static_cast<uint32_t>(n); m >>= 1; ++r) {}
  return r;
}

inline long long surround_med(const std::vector<long long>& s, size_t i, size_t w) {
  if (i == 0) return 0;  // sentinel; caller checks i==0 first
  size_t lo = i > w ? i - w : 0;
  std::vector<long long> win(s.begin() + lo, s.begin() + i);
  std::sort(win.begin(), win.end());
  return win[win.size() >> 1];  // upper median, matches JS win[len>>1]
}

struct Percept { int level; int signed_; };  // level -1 = null (JS null)

inline Percept percept_at(const std::vector<long long>& s, size_t i, size_t w, long long scale) {
  if (i == 0) return { -1, 0 };
  long long sur = surround_med(s, i, w);
  long long d = s[i] - sur;
  if (d == 0) return { -1, 0 };
  int64_t mag64;
  if (sur == 0) mag64 = 0;                    // JS: ((|d|*scale)/0)|0 = Inf|0 = 0
  else mag64 = (std::abs(d) * scale) / sur;   // C++ int div truncates toward zero = JS |0
  int32_t mag = toInt32(mag64);
  int sign = (d > 0) - (d < 0);
  if (mag == 0) return { 0, sign };
  return { floor_log2_i32(mag), sign };
}

inline std::vector<Percept> perceive(const std::vector<long long>& s, size_t w = 4, long long scale = 1024) {
  std::vector<Percept> out;
  out.reserve(s.size());
  for (size_t i = 0; i < s.size(); ++i) out.push_back(percept_at(s, i, w, scale));
  return out;
}

inline std::vector<long long> diffs(const std::vector<long long>& xs) {
  std::vector<long long> out;
  for (size_t i = 1; i < xs.size(); ++i) out.push_back(xs[i] - xs[i - 1]);
  return out;
}

inline char slope_class(long long d) { return d > 0 ? '+' : d < 0 ? '-' : '0'; }

inline std::string shape_of(const std::vector<long long>& xs) {
  std::string out;
  for (long long d : diffs(xs)) out += slope_class(d);
  return out;
}

inline std::vector<size_t> change_points(const std::vector<long long>& xs) {
  std::string s = shape_of(xs);
  std::vector<size_t> out;
  for (size_t i = 1; i < s.size(); ++i) if (s[i] != s[i - 1]) out.push_back(i);
  return out;
}

inline int64_t first_crossing(const std::vector<long long>& xs, long long k) {
  for (size_t i = 0; i < xs.size(); ++i) if (xs[i] >= k) return static_cast<int64_t>(i);
  return -1;  // JS null
}

inline long long eta_ll(long long space_units, long long units_per_tick) {
  if (units_per_tick <= 0) return -1;  // JS null
  long long q = space_units / units_per_tick;
  return (space_units % units_per_tick) ? q + 1 : q;  // ceil, C trunc + remainder
}

inline std::string cp_hash(const std::vector<size_t>& cps) {
  uint64_t h = 0xcbf29ce484222325ull;
  for (size_t c : cps) {
    h ^= static_cast<uint64_t>(c + 1);
    h *= 0x100000001b3ull;
  }
  char buf[17];
  for (int i = 0; i < 16; ++i) buf[15 - i] = "0123456789abcdef"[(h >> (4 * i)) & 0xf];
  buf[16] = 0;
  return std::string(buf);
}

// --- sheet-level API (matches the JS/Python adapters) ---
inline std::string SHAPEOF(const std::vector<long long>& xs) {
  return shape_of(xs) + " " + cp_hash(change_points(xs));
}

inline std::vector<int> PERCEPTS(const std::vector<long long>& xs, size_t w = 4) {
  std::vector<int> out;
  for (auto& p : perceive(xs, w)) out.push_back(p.level);
  return out;
}

inline long long ETA(const std::vector<long long>& xs, long long target, long long upt) {
  long long remaining = target - xs.back();
  if (remaining < 0) remaining = 0;
  return eta_ll(remaining, upt);
}

inline long long DRIFTALARM(const std::vector<long long>& xs, long long num, long long den) {
  for (size_t i = 1; i < xs.size(); ++i) {
    __int128 lhs = (__int128)std::llabs(xs[i] - xs[i - 1]) * den;
    __int128 rhs = (__int128)std::llabs(xs[i - 1]) * num;
    if (lhs > rhs) return static_cast<long long>(i);
  }
  return -1;
}

}  // namespace percept
